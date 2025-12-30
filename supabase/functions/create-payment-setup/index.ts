import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
    const { leadId, email, name } = await req.json();
    
    if (!leadId || !email) {
      throw new Error("Missing required parameters: leadId and email");
    }

    console.log(`Creating payment setup for lead ${leadId}, email: ${email}`);

    // Initialize Stripe
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
      console.log(`Found existing Stripe customer: ${customerId}`);
    } else {
      // Create a new customer
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          lead_id: leadId,
        },
      });
      customerId = customer.id;
      console.log(`Created new Stripe customer: ${customerId}`);
    }

    // Create a Stripe Checkout session for setting up a payment method
    // Always use the production site URL for customer-facing redirects
    const siteUrl = "https://www.peachhausgroup.com";
    
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
      success_url: `${siteUrl}/payment-success?lead=${leadId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/payment-setup?lead=${leadId}&canceled=true`,
      metadata: {
        lead_id: leadId,
      },
    });

    console.log(`Created Stripe checkout session: ${session.id}`);

    // Update lead with Stripe customer ID
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase
      .from("leads")
      .update({ stripe_customer_id: customerId })
      .eq("id", leadId);

    // Add timeline entry
    await supabase.from("lead_timeline").insert({
      lead_id: leadId,
      action: "Payment setup initiated",
      metadata: { 
        stripe_customer_id: customerId,
        checkout_session_id: session.id 
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in create-payment-setup:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
