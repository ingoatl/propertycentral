import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

/**
 * Handles Stripe webhooks for payment setup events.
 * Updates owner records with saved payment methods.
 * Advances leads to ach_form_signed stage when payment method is saved.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    // For now, we'll skip signature verification in development
    // In production, you should verify with the webhook secret
    const event = JSON.parse(body);
    
    console.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode === "setup") {
          await handleSetupComplete(supabase, stripe, session);
        }
        break;
      }

      case "setup_intent.succeeded": {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        await handleSetupIntentSucceeded(supabase, stripe, setupIntent);
        break;
      }

      case "payment_method.attached": {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        console.log(`Payment method attached: ${paymentMethod.id} to customer ${paymentMethod.customer}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Stripe webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

/**
 * Handle completed checkout session for setup mode
 */
async function handleSetupComplete(
  supabase: any, 
  stripe: Stripe, 
  session: Stripe.Checkout.Session
) {
  console.log("Processing setup checkout completion:", session.id);
  
  const metadata = session.metadata || {};
  const ownerId = metadata.owner_id;
  const leadId = metadata.lead_id;
  const paymentMethodType = metadata.payment_method_type;
  const feePercentage = metadata.fee_percentage;

  // Get the setup intent to find the payment method
  const setupIntentId = session.setup_intent as string;
  if (!setupIntentId) {
    console.error("No setup intent found in session");
    return;
  }

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  const paymentMethodId = setupIntent.payment_method as string;

  if (!paymentMethodId) {
    console.error("No payment method found in setup intent");
    return;
  }

  // Get payment method details
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  
  // Determine payment method display info
  let paymentMethodDisplay = "";
  if (paymentMethod.type === "card" && paymentMethod.card) {
    paymentMethodDisplay = `${paymentMethod.card.brand} ****${paymentMethod.card.last4}`;
  } else if (paymentMethod.type === "us_bank_account" && paymentMethod.us_bank_account) {
    paymentMethodDisplay = `${paymentMethod.us_bank_account.bank_name} ****${paymentMethod.us_bank_account.last4}`;
  }

  console.log(`Payment method saved: ${paymentMethodDisplay}`);

  // Set as default payment method for the customer
  if (session.customer) {
    await stripe.customers.update(session.customer as string, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    console.log("Set as default payment method for customer");
  }

  // Update owner record if we have an owner ID
  if (ownerId) {
    const updateData: any = {
      payment_method: paymentMethodType === "card" ? "cc" : "ach",
      stripe_customer_id: session.customer as string,
    };

    await supabase
      .from("property_owners")
      .update(updateData)
      .eq("id", ownerId);

    console.log(`Updated owner ${ownerId} with payment method`);
  }

  // Update lead and advance stage if we have a lead ID
  if (leadId) {
    // Update lead
    await supabase
      .from("leads")
      .update({
        stage: "ach_form_signed",
        stage_changed_at: new Date().toISOString(),
        last_stage_auto_update_at: new Date().toISOString(),
        auto_stage_reason: `Payment method saved: ${paymentMethodDisplay}`
      })
      .eq("id", leadId);

    // Add timeline entry
    await supabase.from("lead_timeline").insert({
      lead_id: leadId,
      action: `Payment method saved: ${paymentMethodDisplay}`,
      stage_from: null,
      stage_to: "ach_form_signed",
      metadata: { 
        payment_method_id: paymentMethodId,
        payment_method_type: paymentMethodType,
        fee_percentage: feePercentage
      }
    });

    // Log event
    await supabase.from("lead_event_log").insert({
      lead_id: leadId,
      event_type: "payment_method_saved",
      event_source: "stripe-setup-webhook",
      event_data: {
        checkout_session_id: session.id,
        payment_method_id: paymentMethodId,
        payment_method_type: paymentMethodType,
        payment_method_display: paymentMethodDisplay
      },
      stage_changed_to: "ach_form_signed",
      processed: true
    });

    // Trigger stage change automations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    await fetch(`${supabaseUrl}/functions/v1/process-lead-stage-change`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leadId: leadId,
        newStage: "ach_form_signed",
        previousStage: "contract_signed",
        autoTriggered: true,
        triggerSource: "stripe-setup-webhook"
      }),
    });

    console.log(`Lead ${leadId} advanced to ach_form_signed`);
  }
}

/**
 * Handle successful setup intent (can be triggered separately from checkout)
 */
async function handleSetupIntentSucceeded(
  supabase: any,
  stripe: Stripe,
  setupIntent: Stripe.SetupIntent
) {
  console.log("Setup intent succeeded:", setupIntent.id);
  
  // The main logic is in checkout.session.completed
  // This handles cases where setup intent succeeds outside of checkout flow
  
  const customerId = setupIntent.customer as string;
  if (!customerId) return;

  // Find owner by stripe customer ID
  const { data: owner } = await supabase
    .from("property_owners")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (owner) {
    console.log(`Setup intent succeeded for owner: ${owner.id}`);
  }
}
