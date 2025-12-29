import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Creates a Stripe Checkout session for payment method setup.
 * Supports both ACH (us_bank_account) and Credit Card (card) methods.
 * The 3% CC fee is calculated and added at charge time, not here.
 * 
 * This replaces the PDF ACH/CC form with a secure, PCI-compliant flow.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Parse request - can be called with or without auth
    const { ownerId, leadId, paymentMethod, returnUrl } = await req.json();
    
    console.log(`Creating payment checkout: ownerId=${ownerId}, leadId=${leadId}, method=${paymentMethod}`);

    if (!paymentMethod || !["ach", "card"].includes(paymentMethod)) {
      throw new Error("Payment method must be 'ach' or 'card'");
    }

    // Get owner or lead details
    let email: string;
    let name: string;
    let stripeCustomerId: string | null = null;
    let ownerRecord: any = null;

    if (ownerId) {
      const { data: owner, error: ownerError } = await supabase
        .from("property_owners")
        .select("*")
        .eq("id", ownerId)
        .single();

      if (ownerError || !owner) throw new Error("Owner not found");
      
      email = owner.email;
      name = owner.name;
      stripeCustomerId = owner.stripe_customer_id;
      ownerRecord = owner;
    } else if (leadId) {
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();

      if (leadError || !lead) throw new Error("Lead not found");
      if (!lead.email) throw new Error("Lead has no email address");
      
      email = lead.email;
      name = lead.name;
    } else {
      throw new Error("Either ownerId or leadId is required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get or create Stripe customer
    if (!stripeCustomerId) {
      // Check if customer exists by email
      const existingCustomers = await stripe.customers.list({ 
        email: email, 
        limit: 1 
      });

      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: email,
          name: name,
          metadata: { 
            owner_id: ownerId || "",
            lead_id: leadId || "",
            source: "payment_setup_checkout"
          },
        });
        stripeCustomerId = customer.id;
      }

      // Update owner with customer ID if we have an owner
      if (ownerId && ownerRecord) {
        await supabase
          .from("property_owners")
          .update({ 
            stripe_customer_id: stripeCustomerId,
            payment_method: paymentMethod
          })
          .eq("id", ownerId);
      }
    }

    // Determine payment method types for Stripe Checkout
    const paymentMethodTypes = paymentMethod === "ach" 
      ? ["us_bank_account"] 
      : ["card"];

    // Build success/cancel URLs
    const origin = req.headers.get("origin") || returnUrl || "https://peachhaus.co";
    const successUrl = `${origin}/payment-setup-success?session_id={CHECKOUT_SESSION_ID}&owner_id=${ownerId || ""}&lead_id=${leadId || ""}`;
    const cancelUrl = `${origin}/payment-setup-cancelled`;

    // Create Checkout session in setup mode (saves payment method without charging)
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "setup",
      payment_method_types: paymentMethodTypes,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        owner_id: ownerId || "",
        lead_id: leadId || "",
        payment_method_type: paymentMethod,
        fee_percentage: paymentMethod === "card" ? "3" : "0"
      },
      // For ACH, use Financial Connections for secure bank linking
      ...(paymentMethod === "ach" && {
        payment_method_options: {
          us_bank_account: {
            financial_connections: {
              permissions: ["payment_method", "balances"],
            },
            verification_method: "instant", // Use instant verification via Plaid
          },
        },
      }),
      // Custom branding
      custom_text: {
        submit: {
          message: paymentMethod === "card" 
            ? "By saving your card, you authorize PeachHaus to charge management fees and approved expenses. A 3% processing fee applies to credit card payments."
            : "By linking your bank account, you authorize PeachHaus to debit management fees and approved expenses via ACH."
        }
      }
    });

    console.log(`Created checkout session: ${session.id}, url: ${session.url}`);

    // If this is for a lead, update lead stage
    if (leadId) {
      await supabase
        .from("leads")
        .update({ 
          stripe_setup_intent_id: session.setup_intent as string,
          stage_changed_at: new Date().toISOString()
        })
        .eq("id", leadId);

      // Add timeline entry
      await supabase.from("lead_timeline").insert({
        lead_id: leadId,
        action: `Payment setup initiated: ${paymentMethod === "card" ? "Credit Card" : "ACH Bank Transfer"}`,
        metadata: { checkout_session_id: session.id, payment_method: paymentMethod }
      });
    }

    return new Response(
      JSON.stringify({ 
        url: session.url,
        sessionId: session.id,
        customerId: stripeCustomerId
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in create-payment-checkout:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
