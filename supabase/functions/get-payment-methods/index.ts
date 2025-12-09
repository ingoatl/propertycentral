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
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    
    if (!user) throw new Error("Unauthorized");

    const { ownerId } = await req.json();
    
    if (!ownerId) {
      throw new Error("Owner ID is required");
    }

    // Get owner details
    const { data: owner, error: ownerError } = await supabaseClient
      .from("property_owners")
      .select("*")
      .eq("id", ownerId)
      .single();

    if (ownerError) throw ownerError;
    if (!owner || !owner.stripe_customer_id) {
      return new Response(
        JSON.stringify({ paymentMethods: [] }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get ALL payment methods for this customer (both cards and bank accounts)
    const [cardMethods, bankMethods] = await Promise.all([
      stripe.paymentMethods.list({
        customer: owner.stripe_customer_id,
        type: "card",
      }),
      stripe.paymentMethods.list({
        customer: owner.stripe_customer_id,
        type: "us_bank_account",
      }),
    ]);

    const allMethods = [...cardMethods.data, ...bankMethods.data];
    console.log("Found payment methods:", allMethods.length, "(cards:", cardMethods.data.length, ", banks:", bankMethods.data.length, ")");

    return new Response(
      JSON.stringify({ 
        paymentMethods: allMethods.map((pm: any) => ({
          id: pm.id,
          type: pm.type,
          card: pm.card ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
          } : null,
          us_bank_account: pm.us_bank_account ? {
            bank_name: pm.us_bank_account.bank_name,
            last4: pm.us_bank_account.last4,
            account_type: pm.us_bank_account.account_type,
          } : null,
        }))
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in get-payment-methods:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
