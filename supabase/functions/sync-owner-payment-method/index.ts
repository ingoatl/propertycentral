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

        let detectedMethod = 'card'; // Default to card
        const defaultPmId = (customer as Stripe.Customer).invoice_settings?.default_payment_method;

        if (defaultPmId) {
          // Get the payment method details
          const pm = await stripe.paymentMethods.retrieve(defaultPmId as string);
          if (pm.type === 'us_bank_account') {
            detectedMethod = 'ach';
          } else if (pm.type === 'card') {
            detectedMethod = 'card';
          }
          console.log(`Owner ${owner.name}: Default PM is ${pm.type} (${pm.id})`);
        } else {
          // No default, check what payment methods exist
          const [cards, banks] = await Promise.all([
            stripe.paymentMethods.list({ customer: owner.stripe_customer_id, type: 'card', limit: 1 }),
            stripe.paymentMethods.list({ customer: owner.stripe_customer_id, type: 'us_bank_account', limit: 1 }),
          ]);

          if (banks.data.length > 0 && cards.data.length === 0) {
            detectedMethod = 'ach';
          } else {
            detectedMethod = 'card';
          }
          console.log(`Owner ${owner.name}: Found ${cards.data.length} cards, ${banks.data.length} banks -> ${detectedMethod}`);
        }

        // Update if different
        if (owner.payment_method !== detectedMethod) {
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
          });
          console.log(`Updated ${owner.name}: ${owner.payment_method} -> ${detectedMethod}`);
        } else {
          results.push({
            ownerId: owner.id,
            name: owner.name,
            oldMethod: owner.payment_method,
            newMethod: detectedMethod,
            updated: false,
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
