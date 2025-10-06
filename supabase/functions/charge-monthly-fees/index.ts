import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    console.log("Starting monthly fee charging process");

    // Get the charge month (previous month)
    const now = new Date();
    const chargeMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const chargeMonthStr = chargeMonth.toISOString().split('T')[0];

    console.log("Charging for month:", chargeMonthStr);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get all property owners
    const { data: owners, error: ownersError } = await supabaseClient
      .from("property_owners")
      .select("*");

    if (ownersError) throw ownersError;
    if (!owners || owners.length === 0) {
      return new Response(
        JSON.stringify({ message: "No property owners found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`Found ${owners.length} property owners`);

    const results = [];

    for (const owner of owners) {
      console.log(`Processing owner: ${owner.name}`);

      // Get properties for this owner
      const { data: properties, error: propsError } = await supabaseClient
        .from("properties")
        .select("id, name")
        .eq("owner_id", owner.id);

      if (propsError) {
        console.error(`Error fetching properties for owner ${owner.id}:`, propsError);
        continue;
      }

      if (!properties || properties.length === 0) {
        console.log(`No properties found for owner ${owner.name}`);
        continue;
      }

      const propertyIds = properties.map(p => p.id);
      console.log(`Found ${propertyIds.length} properties for ${owner.name}`);

      // Calculate total management fees for the month
      const { data: bookings, error: bookingsError } = await supabaseClient
        .from("ownerrez_bookings")
        .select("management_fee")
        .in("property_id", propertyIds)
        .gte("check_in", `${chargeMonthStr}`)
        .lt("check_in", new Date(chargeMonth.getFullYear(), chargeMonth.getMonth() + 1, 1).toISOString().split('T')[0]);

      if (bookingsError) {
        console.error(`Error fetching bookings for owner ${owner.id}:`, bookingsError);
        continue;
      }

      const totalFees = bookings?.reduce((sum, booking) => sum + Number(booking.management_fee || 0), 0) || 0;
      console.log(`Total management fees for ${owner.name}: $${totalFees}`);

      if (totalFees === 0) {
        console.log(`No fees to charge for ${owner.name}`);
        results.push({ owner: owner.name, status: "skipped", reason: "No fees" });
        continue;
      }

      // Check if already charged
      const { data: existingCharge } = await supabaseClient
        .from("monthly_charges")
        .select("id, charge_status")
        .eq("owner_id", owner.id)
        .eq("charge_month", chargeMonthStr)
        .single();

      if (existingCharge && existingCharge.charge_status === "succeeded") {
        console.log(`Already charged ${owner.name} for ${chargeMonthStr}`);
        results.push({ owner: owner.name, status: "already_charged", amount: totalFees });
        continue;
      }

      // Get or create Stripe customer
      let customerId = owner.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: owner.email,
          name: owner.name,
          metadata: { owner_id: owner.id },
        });
        customerId = customer.id;

        // Update owner with customer ID
        await supabaseClient
          .from("property_owners")
          .update({ stripe_customer_id: customerId })
          .eq("id", owner.id);

        console.log(`Created Stripe customer ${customerId} for ${owner.name}`);
      }

      // Get payment methods on file
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: owner.payment_method === "ach" ? "us_bank_account" : "card",
        limit: 1,
      });

      if (paymentMethods.data.length === 0) {
        console.log(`No payment method on file for ${owner.name}`);
        
        // Record failed charge
        await supabaseClient
          .from("monthly_charges")
          .upsert({
            owner_id: owner.id,
            charge_month: chargeMonthStr,
            total_management_fees: totalFees,
            charge_status: "failed",
          }, {
            onConflict: "owner_id,charge_month",
          });

        results.push({
          owner: owner.name,
          status: "failed",
          amount: totalFees,
          error: "No payment method on file",
        });
        continue;
      }

      const paymentMethodId = paymentMethods.data[0].id;
      console.log(`Using payment method ${paymentMethodId} for ${owner.name}`);
      
      try {
        // Create and confirm payment intent with the payment method on file
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(totalFees * 100), // Convert to cents
          currency: "usd",
          customer: customerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          description: `Management fees for ${chargeMonthStr}`,
          metadata: {
            owner_id: owner.id,
            charge_month: chargeMonthStr,
          },
        });

        console.log(`Payment intent ${paymentIntent.id} status: ${paymentIntent.status}`);

        // Record the charge
        const { error: chargeError } = await supabaseClient
          .from("monthly_charges")
          .upsert({
            owner_id: owner.id,
            charge_month: chargeMonthStr,
            total_management_fees: totalFees,
            stripe_payment_intent_id: paymentIntent.id,
            charge_status: paymentIntent.status === "succeeded" ? "succeeded" : "processing",
            charged_at: paymentIntent.status === "succeeded" ? new Date().toISOString() : null,
          }, {
            onConflict: "owner_id,charge_month",
          });

        if (chargeError) throw chargeError;

        results.push({
          owner: owner.name,
          status: "charged",
          amount: totalFees,
          payment_intent_id: paymentIntent.id,
          payment_method: owner.payment_method,
        });
      } catch (stripeError: any) {
        console.error(`Stripe error for ${owner.name}:`, stripeError);
        
        // Record failed charge
        await supabaseClient
          .from("monthly_charges")
          .upsert({
            owner_id: owner.id,
            charge_month: chargeMonthStr,
            total_management_fees: totalFees,
            charge_status: "failed",
          }, {
            onConflict: "owner_id,charge_month",
          });

        results.push({
          owner: owner.name,
          status: "failed",
          amount: totalFees,
          error: stripeError.message,
        });
      }
    }

    console.log("Monthly charging completed:", results);

    return new Response(
      JSON.stringify({
        success: true,
        charge_month: chargeMonthStr,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in charge-monthly-fees:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
