import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { reconciliation_id, test_mode = false } = await req.json();

    if (!reconciliation_id) {
      return new Response(
        JSON.stringify({ error: "reconciliation_id is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`Processing charge for reconciliation: ${reconciliation_id}, test_mode: ${test_mode}`);

    // Fetch reconciliation with property and owner details
    const { data: reconciliation, error: recError } = await supabase
      .from("monthly_reconciliations")
      .select(`
        *,
        properties(id, name, address, management_fee_percentage),
        property_owners(id, name, email, stripe_customer_id, payment_method, service_type)
      `)
      .eq("id", reconciliation_id)
      .single();

    if (recError || !reconciliation) {
      console.error("Reconciliation not found:", recError);
      return new Response(
        JSON.stringify({ error: "Reconciliation not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Check service type - only charge co-hosting clients
    const serviceType = reconciliation.property_owners?.service_type || 'cohosting';
    if (serviceType !== 'cohosting') {
      return new Response(
        JSON.stringify({ 
          error: "Cannot charge full-service clients. Use process-owner-payout instead.",
          service_type: serviceType 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check reconciliation status
    if (!['approved', 'statement_sent'].includes(reconciliation.status)) {
      return new Response(
        JSON.stringify({ 
          error: `Cannot charge reconciliation with status: ${reconciliation.status}. Must be approved or statement_sent.` 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check if already charged
    if (reconciliation.charged_at) {
      return new Response(
        JSON.stringify({ 
          error: "Reconciliation has already been charged",
          charged_at: reconciliation.charged_at,
          charge_id: reconciliation.charge_id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Fetch line items for calculation
    const { data: lineItems, error: itemsError } = await supabase
      .from("reconciliation_line_items")
      .select("*")
      .eq("reconciliation_id", reconciliation_id);

    if (itemsError) {
      console.error("Error fetching line items:", itemsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch line items" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Calculate due from owner using approved items only
    const approvedItems = (lineItems || []).filter(
      (item: any) => item.verified === true && item.excluded === false
    );

    const visitFees = approvedItems
      .filter((item: any) => item.item_type === "visit")
      .reduce((sum: number, item: any) => sum + Math.abs(item.amount), 0);

    const totalExpenses = approvedItems
      .filter((item: any) => {
        if (item.item_type !== "expense") return false;
        const description = (item.description || '').toLowerCase();
        return !description.includes('visit fee') && 
               !description.includes('visit charge') &&
               !description.includes('hourly charge') &&
               !description.includes('property visit');
      })
      .reduce((sum: number, item: any) => sum + Math.abs(item.amount), 0);

    const passThroughFees = approvedItems
      .filter((item: any) => item.item_type === "pass_through_fee")
      .reduce((sum: number, item: any) => sum + Math.abs(item.amount), 0);

    const managementFee = reconciliation.management_fee || 0;
    const dueFromOwner = managementFee + visitFees + totalExpenses + passThroughFees;

    console.log(`Calculated amounts:`, {
      managementFee,
      visitFees,
      totalExpenses,
      passThroughFees,
      dueFromOwner
    });

    // Check if owner has Stripe setup
    const owner = reconciliation.property_owners;
    if (!owner?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ 
          error: "Owner does not have a Stripe customer ID configured",
          owner_id: owner?.id,
          owner_name: owner?.name
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Add processing fee based on payment method (3% for card, 1% for ACH)
    let processingFee = 0;
    const paymentMethod = owner.payment_method || 'card';
    if (paymentMethod === 'card' || paymentMethod === 'credit_card') {
      processingFee = dueFromOwner * 0.03;  // 3% for credit card
    } else if (paymentMethod === 'ach') {
      processingFee = dueFromOwner * 0.01;  // 1% for ACH
    }
    const totalChargeAmount = dueFromOwner + processingFee;

    console.log(`Total charge: $${totalChargeAmount.toFixed(2)} (includes $${processingFee.toFixed(2)} ${paymentMethod === 'ach' ? 'ACH' : 'CC'} fee)`);

    if (test_mode) {
      // Return calculation results without charging
      return new Response(
        JSON.stringify({
          test_mode: true,
          reconciliation_id,
          owner_name: owner.name,
          owner_email: owner.email,
          stripe_customer_id: owner.stripe_customer_id,
          payment_method: paymentMethod,
          breakdown: {
            management_fee: managementFee,
            visit_fees: visitFees,
            expenses: totalExpenses,
            pass_through_fees: passThroughFees,
            subtotal: dueFromOwner,
            processing_fee: processingFee,
            total: totalChargeAmount
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    // Get customer's default payment method
    const customer = await stripe.customers.retrieve(owner.stripe_customer_id);
    if (!customer || customer.deleted) {
      return new Response(
        JSON.stringify({ error: "Stripe customer not found or deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const defaultPaymentMethodId = (customer as Stripe.Customer).invoice_settings?.default_payment_method as string | undefined;
    if (!defaultPaymentMethodId) {
      return new Response(
        JSON.stringify({ error: "Owner has no default payment method configured in Stripe" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalChargeAmount * 100), // Convert to cents
      currency: "usd",
      customer: owner.stripe_customer_id,
      payment_method: defaultPaymentMethodId,
      off_session: true,
      confirm: true,
      description: `Monthly reconciliation for ${reconciliation.properties?.name || 'Property'} - ${new Date(reconciliation.reconciliation_month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      metadata: {
        reconciliation_id,
        property_id: reconciliation.property_id,
        owner_id: owner.id,
        month: reconciliation.reconciliation_month
      }
    });

    console.log(`Payment intent created: ${paymentIntent.id}, status: ${paymentIntent.status}`);

    // Create monthly_charges record linked to reconciliation
    const { data: charge, error: chargeError } = await supabase
      .from("monthly_charges")
      .insert({
        owner_id: owner.id,
        property_id: reconciliation.property_id,
        reconciliation_id,
        amount: totalChargeAmount,
        charge_month: reconciliation.reconciliation_month,
        status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'processing',
        stripe_payment_intent_id: paymentIntent.id,
        description: `Monthly reconciliation - ${new Date(reconciliation.reconciliation_month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        notes: `Management fee: $${managementFee.toFixed(2)}, Visit fees: $${visitFees.toFixed(2)}, Expenses: $${totalExpenses.toFixed(2)}, Pass-through: $${passThroughFees.toFixed(2)}${processingFee > 0 ? `, CC fee: $${processingFee.toFixed(2)}` : ''}`
      })
      .select()
      .single();

    if (chargeError) {
      console.error("Error creating charge record:", chargeError);
    }

    // Store processing fee as separate line item for QuickBooks tracking
    if (processingFee > 0 && charge?.id) {
      const { error: feeLineItemError } = await supabase
        .from("charge_line_items")
        .insert({
          charge_id: charge.id,
          category: "processing_fee",
          description: `${paymentMethod === 'ach' ? 'ACH' : 'Credit Card'} Processing Fee (${paymentMethod === 'ach' ? '1%' : '3%'})`,
          amount: processingFee,
          qbo_account_code: "Payment Processing Expense"
        });
      
      if (feeLineItemError) {
        console.error("Error creating processing fee line item:", feeLineItemError);
      } else {
        console.log(`Processing fee line item created: $${processingFee.toFixed(2)}`);
      }
    }

    // Update reconciliation with charge info
    const { error: updateError } = await supabase
      .from("monthly_reconciliations")
      .update({
        charged_at: new Date().toISOString(),
        charge_id: charge?.id || null,
        due_from_owner: dueFromOwner,
        status: 'charged',
        updated_at: new Date().toISOString()
      })
      .eq("id", reconciliation_id);

    if (updateError) {
      console.error("Error updating reconciliation:", updateError);
    }

    // Log in audit trail
    await supabase.from("reconciliation_audit_log").insert({
      reconciliation_id,
      action: 'owner_charged',
      notes: `Charged $${totalChargeAmount.toFixed(2)} via Stripe (${paymentIntent.status}). Payment intent: ${paymentIntent.id}`
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_intent_id: paymentIntent.id,
        payment_status: paymentIntent.status,
        charge_id: charge?.id,
        amount_charged: totalChargeAmount,
        breakdown: {
          management_fee: managementFee,
          visit_fees: visitFees,
          expenses: totalExpenses,
          pass_through_fees: passThroughFees,
          processing_fee: processingFee,
          total: totalChargeAmount
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("Error processing charge:", error);
    
    // Handle Stripe-specific errors
    if (error.type === 'StripeCardError') {
      return new Response(
        JSON.stringify({ 
          error: "Payment failed", 
          details: error.message,
          decline_code: error.decline_code 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
