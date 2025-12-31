import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-OWNER-PAYMENT-SETUP] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ownerId, email, name } = await req.json();
    
    if (!ownerId || !email) {
      throw new Error("Missing required parameters: ownerId and email");
    }

    logStep("Creating payment setup for owner", { ownerId, email });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Check if a Stripe customer already exists for this email
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });
    } else {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          owner_id: ownerId,
          type: "property_owner",
        },
      });
      customerId = customer.id;
      logStep("Created new Stripe customer", { customerId });
    }

    // Create a Stripe Checkout session for setting up a payment method
    const siteUrl = "https://propertycentral.lovable.app";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "setup",
      currency: "usd",
      payment_method_types: ["us_bank_account", "card"],
      payment_method_options: {
        us_bank_account: {
          financial_connections: {
            permissions: ["payment_method"],
          },
        },
      },
      success_url: `${siteUrl}/owner-payment-success?owner=${ownerId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/owner-payment-setup?owner=${ownerId}&canceled=true`,
      metadata: {
        owner_id: ownerId,
        type: "property_owner",
      },
    });

    logStep("Created Stripe checkout session", { sessionId: session.id });

    // Update owner with Stripe customer ID
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase
      .from("property_owners")
      .update({ stripe_customer_id: customerId })
      .eq("id", ownerId);

    logStep("Updated owner with Stripe customer ID");

    return new Response(JSON.stringify({ url: session.url, customerId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
