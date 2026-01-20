import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-LEAD-PAYMENT-SETUP] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId } = await req.json();
    logStep("Request received", { leadId });

    if (!leadId) {
      throw new Error("Missing required field: leadId");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, name, email, stripe_customer_id, property_address")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found");
    }

    logStep("Lead found", { name: lead.name, email: lead.email, hasCustomerId: !!lead.stripe_customer_id });

    let customerId = lead.stripe_customer_id;

    // Create or get Stripe customer
    if (!customerId) {
      if (!lead.email) {
        throw new Error("Lead does not have an email address");
      }

      const existingCustomers = await stripe.customers.list({ email: lead.email, limit: 1 });
      
      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
        logStep("Found existing customer", { customerId });
      } else {
        const customer = await stripe.customers.create({
          email: lead.email,
          name: lead.name,
          metadata: { lead_id: leadId },
        });
        customerId = customer.id;
        logStep("Created new customer", { customerId });
      }

      // Update lead with customer ID
      await supabase
        .from("leads")
        .update({ stripe_customer_id: customerId })
        .eq("id", leadId);
    }

    const siteUrl = "https://propertycentral.lovable.app";

    // Create Stripe Checkout session in setup mode
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "setup",
      payment_method_types: ["us_bank_account", "card"],
      payment_method_options: {
        us_bank_account: {
          financial_connections: {
            permissions: ["payment_method"],
          },
          verification_method: "instant",
        },
      },
      success_url: `${siteUrl}/lead-payment-success?lead=${leadId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/lead-payment-setup?lead=${leadId}&canceled=true`,
      metadata: {
        lead_id: leadId,
        type: "lead_payment_authorization",
      },
      custom_text: {
        submit: {
          message: "By confirming, you authorize PeachHaus to charge this payment method for property management fees and approved expenses.",
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    // Update lead with setup intent ID
    await supabase
      .from("leads")
      .update({ stripe_setup_intent_id: session.setup_intent })
      .eq("id", leadId);

    // Log timeline
    await supabase.from("lead_timeline").insert({
      lead_id: leadId,
      action: "Payment setup session initiated",
      metadata: { sessionId: session.id, customerId },
    });

    return new Response(
      JSON.stringify({
        url: session.url,
        sessionId: session.id,
        customerId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
