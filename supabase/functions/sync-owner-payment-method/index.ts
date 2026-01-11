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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const { ownerId, syncAll } = await req.json();

    // Get owners to sync
    let ownersQuery = supabase
      .from("property_owners")
      .select("id, name, stripe_customer_id, payment_method")
      .not("stripe_customer_id", "is", null);

    if (!syncAll && ownerId) {
      ownersQuery = ownersQuery.eq("id", ownerId);
    }

    const { data: owners, error: ownersError } = await ownersQuery;

    if (ownersError) throw ownersError;

    const results: Array<{
      ownerId: string;
      name: string;
      oldMethod: string | null;
      newMethod: string;
      updated: boolean;
      hasPaymentMethod?: boolean;
    }> = [];

    for (const owner of owners || []) {
      if (!owner.stripe_customer_id) continue;

      try {
        // Get customer's default payment method from Stripe
        const customer = await stripe.customers.retrieve(owner.stripe_customer_id);
        
        if ('deleted' in customer && customer.deleted) {
          console.log(`Customer ${owner.stripe_customer_id} is deleted, skipping`);
          continue;
        }

        let detectedMethod: string | null = null; // null means no payment method found
        let hasPaymentMethod = false;
        const defaultPmId = (customer as Stripe.Customer).invoice_settings?.default_payment_method;

        if (defaultPmId) {
          // Get the payment method details
          const pm = await stripe.paymentMethods.retrieve(defaultPmId as string);
          if (pm.type === 'us_bank_account') {
            detectedMethod = 'ach';
          } else if (pm.type === 'card') {
            detectedMethod = 'card';
          }
          hasPaymentMethod = true;
          console.log(`Owner ${owner.name}: Default PM is ${pm.type} (${pm.id})`);
        } else {
          // No default, check what payment methods exist
          const [cards, banks] = await Promise.all([
            stripe.paymentMethods.list({ customer: owner.stripe_customer_id, type: 'card', limit: 1 }),
            stripe.paymentMethods.list({ customer: owner.stripe_customer_id, type: 'us_bank_account', limit: 1 }),
          ]);

          if (banks.data.length > 0) {
            detectedMethod = 'ach';
            hasPaymentMethod = true;
          } else if (cards.data.length > 0) {
            detectedMethod = 'card';
            hasPaymentMethod = true;
          }
          console.log(`Owner ${owner.name}: Found ${cards.data.length} cards, ${banks.data.length} banks -> ${hasPaymentMethod ? detectedMethod : 'NO PAYMENT METHOD'}`);
        }
        
        // Update has_payment_method status in database
        await supabase
          .from("property_owners")
          .update({ has_payment_method: hasPaymentMethod })
          .eq("id", owner.id);
        
        // Skip if no payment method found
        if (!hasPaymentMethod) {
          results.push({
            ownerId: owner.id,
            name: owner.name,
            oldMethod: owner.payment_method,
            newMethod: 'none',
            updated: false,
            hasPaymentMethod: false,
          });
          console.log(`Owner ${owner.name}: No payment method found in Stripe, updated has_payment_method=false`);
          continue;
        }

        // Update if different (only if we actually have a payment method)
        if (owner.payment_method !== detectedMethod && detectedMethod) {
          await supabase
            .from("property_owners")
            .update({ payment_method: detectedMethod })
            .eq("id", owner.id);

          results.push({
            ownerId: owner.id,
            name: owner.name,
            oldMethod: owner.payment_method,
            newMethod: detectedMethod,
            updated: true,
            hasPaymentMethod: true,
          });
          console.log(`Updated ${owner.name}: ${owner.payment_method} -> ${detectedMethod}`);
        } else {
          results.push({
            ownerId: owner.id,
            name: owner.name,
            oldMethod: owner.payment_method,
            newMethod: detectedMethod || owner.payment_method,
            updated: false,
            hasPaymentMethod: true,
          });
        }
      } catch (stripeError) {
        console.error(`Error syncing ${owner.name}:`, stripeError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: results.length,
        updated: results.filter(r => r.updated).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error syncing payment methods:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
