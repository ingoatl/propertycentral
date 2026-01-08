import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!sig) {
      console.error("No stripe-signature header found");
      return new Response(JSON.stringify({ error: "No signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    console.log(`Stripe webhook verified and received: ${event.type}`);

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

    // Get lead details for email
    const { data: lead } = await supabase
      .from("leads")
      .select("name, email, property_address")
      .eq("id", leadId)
      .single();

    // Send confirmation emails
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey && lead) {
      const resend = new Resend(resendApiKey);

      // Admin notification
      try {
        await resend.emails.send({
          from: "PeachHaus <notifications@peachhausgroup.com>",
          to: ["info@peachhausgroup.com"],
          subject: `✅ Payment Authorization Complete: ${lead.name}`,
          html: `
            <h2>Payment Authorization Complete</h2>
            <p>A lead has successfully completed payment authorization. You can now charge this customer without further confirmation.</p>
            <hr>
            <p><strong>Lead:</strong> ${lead.name}</p>
            <p><strong>Email:</strong> ${lead.email}</p>
            <p><strong>Payment Method:</strong> ${paymentMethodDisplay}</p>
            <p><strong>Property:</strong> ${lead.property_address || 'Not specified'}</p>
            <hr>
            <p>Lead stage has been automatically updated to <strong>ACH Form Signed</strong>.</p>
            <p style="color: green;"><strong>✓ This customer can now be charged without re-authorization.</strong></p>
          `,
        });

        // Log admin email
        await supabase.from("lead_communications").insert({
          lead_id: leadId,
          communication_type: "email",
          direction: "outbound",
          subject: `Payment Authorization Complete: ${lead.name}`,
          body: `Admin notification sent for payment authorization completion. Payment method: ${paymentMethodDisplay}`,
          delivery_status: "sent",
        });

        console.log("Admin payment authorization email sent");
      } catch (emailError: any) {
        console.error("Failed to send admin notification:", emailError.message);
      }

      // Owner confirmation email
      try {
        await resend.emails.send({
          from: "PeachHaus <info@peachhausgroup.com>",
          to: [lead.email],
          subject: "Payment Method Successfully Connected - PeachHaus",
          html: `
            <h2>Payment Method Connected Successfully!</h2>
            <p>Hi ${lead.name.split(' ')[0]},</p>
            <p>Your payment method has been successfully connected to your PeachHaus account.</p>
            <p><strong>Payment Method:</strong> ${paymentMethodDisplay}</p>
            <p>This payment method will be used for monthly management fees and any property-related expenses.</p>
            <h3>What's Next?</h3>
            <p>Our team will continue with the onboarding process and will reach out with next steps shortly.</p>
            <p>If you have any questions, please don't hesitate to contact us at info@peachhausgroup.com or call (770) 906-5022.</p>
            <p>Best regards,<br>The PeachHaus Team</p>
          `,
        });

        // Log owner email
        await supabase.from("lead_communications").insert({
          lead_id: leadId,
          communication_type: "email",
          direction: "outbound",
          subject: "Payment Method Successfully Connected - PeachHaus",
          body: `Confirmation email sent to owner. Payment method: ${paymentMethodDisplay}`,
          delivery_status: "sent",
        });

        console.log("Owner payment confirmation email sent");
      } catch (emailError: any) {
        console.error("Failed to send owner confirmation:", emailError.message);
      }
    }
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
