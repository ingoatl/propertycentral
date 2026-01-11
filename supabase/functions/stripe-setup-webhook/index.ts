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

    // Verify the webhook signature using async method for Deno compatibility
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
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
    // Determine payment method type from actual payment method (not metadata)
    const actualPaymentType = paymentMethod.type === "us_bank_account" ? "ach" : "card";
    console.log(`Actual payment method type from Stripe: ${paymentMethod.type} -> storing as: ${actualPaymentType}`);
    
    const updateData: any = {
      payment_method: actualPaymentType,
      stripe_customer_id: session.customer as string,
    };

    await supabase
      .from("property_owners")
      .update(updateData)
      .eq("id", ownerId);

    console.log(`Updated owner ${ownerId} with payment method`);

    // Mark payment setup request as completed
    await supabase
      .from("payment_setup_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("owner_id", ownerId);

    console.log(`Marked payment setup request as completed for owner ${ownerId}`);

    // Get owner details for email
    const { data: owner } = await supabase
      .from("property_owners")
      .select("name, email")
      .eq("id", ownerId)
      .single();

    // Get properties for this owner
    const { data: properties } = await supabase
      .from("properties")
      .select("name, address")
      .eq("owner_id", ownerId);

    const propertyList = properties?.map((p: { name: string | null; address: string | null }) => p.name || p.address).join(", ") || "your properties";

    // Send confirmation emails for owner payment setup
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey && owner) {
      const resend = new Resend(resendApiKey);

      // Admin notification - Fortune 500 style matching owner statements
      try {
        console.log("Sending admin payment confirmation email...");
        const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";
        const notificationId = `PAY-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${ownerId.slice(0, 8).toUpperCase()}`;
        const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const issueTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        await resend.emails.send({
          from: "PeachHaus <info@peachhausgroup.com>",
          to: ["info@peachhausgroup.com"],
          subject: `Payment Method Connected: ${owner.name}`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Payment Setup Complete</title>
              </head>
              <body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
                  
                  <!-- Header - Corporate Minimal with Logo -->
                  <div style="padding: 24px 32px; border-bottom: 2px solid #111111;">
                    <table style="width: 100%;">
                      <tr>
                        <td style="vertical-align: middle;">
                          <img src="${LOGO_URL}" alt="PeachHaus" style="height: 40px; width: auto;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                          <div style="display: none; font-size: 20px; font-weight: 700; color: #111111; letter-spacing: -0.3px;">PeachHaus</div>
                        </td>
                        <td style="text-align: right; vertical-align: middle;">
                          <div style="font-size: 16px; font-weight: 600; color: #111111; margin-bottom: 4px;">PAYMENT SETUP CONFIRMATION</div>
                          <div style="font-size: 10px; color: #666666; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
                            ${notificationId}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- Owner & Date Info -->
                  <div style="padding: 20px 32px; background: #f9f9f9; border-bottom: 1px solid #e5e5e5;">
                    <table style="width: 100%;">
                      <tr>
                        <td style="vertical-align: top; width: 50%;">
                          <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Owner</div>
                          <div style="font-size: 14px; font-weight: 600; color: #111111;">${owner.name}</div>
                          <div style="font-size: 12px; color: #666666; margin-top: 2px;">${owner.email}</div>
                        </td>
                        <td style="vertical-align: top; text-align: right;">
                          <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Completed</div>
                          <div style="font-size: 14px; font-weight: 600; color: #111111;">${issueDate}</div>
                          <div style="font-size: 12px; color: #666666; margin-top: 2px;">${issueTime}</div>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- SUCCESS STATUS - Primary Focus (matching owner statement black style) -->
                  <div style="padding: 24px 32px;">
                    <table style="width: 100%; border: 2px solid #111111;">
                      <tr>
                        <td style="padding: 16px 20px; background: #111111;">
                          <table style="width: 100%;">
                            <tr>
                              <td style="vertical-align: middle;">
                                <div style="font-size: 10px; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8;">PAYMENT AUTHORIZATION</div>
                                <div style="font-size: 10px; color: #ffffff; opacity: 0.6; margin-top: 2px;">Status Update</div>
                              </td>
                              <td style="text-align: right; vertical-align: middle;">
                                <div style="font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
                                  ✓ COMPLETE
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 20px; background: #f9f9f9;">
                          <table style="width: 100%;">
                            <tr>
                              <td style="font-size: 11px; color: #666666;">Owner</td>
                              <td style="font-size: 13px; font-weight: 600; color: #111111; text-align: right;">${owner.name}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- Details Section -->
                  <div style="padding: 0 32px 24px 32px;">
                    <div style="font-size: 11px; font-weight: 600; color: #111111; padding: 8px 0; border-bottom: 1px solid #111111; text-transform: uppercase; letter-spacing: 0.5px;">
                      Setup Details
                    </div>
                    <table style="width: 100%;">
                      <tr>
                        <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">Payment Method</td>
                        <td style="padding: 12px 0; font-size: 13px; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; border-bottom: 1px solid #e5e5e5; font-weight: 600;">${paymentMethodDisplay}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">Properties Managed</td>
                        <td style="padding: 12px 0; font-size: 13px; color: #111111; text-align: right; border-bottom: 1px solid #e5e5e5;">${propertyList}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">Stripe Customer ID</td>
                        <td style="padding: 12px 0; font-size: 11px; color: #666666; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">${session.customer}</td>
                      </tr>
                      <tr style="background: #f9f9f9;">
                        <td style="padding: 12px 0; font-size: 13px; font-weight: 600; color: #111111;">Billing Status</td>
                        <td style="padding: 12px 0; font-size: 13px; color: #111111; text-align: right; font-weight: 600;">Ready for Charges</td>
                      </tr>
                    </table>
                  </div>

                  <!-- Action Note -->
                  <div style="padding: 0 32px 24px 32px;">
                    <div style="background: #f9f9f9; border-left: 3px solid #111111; padding: 16px;">
                      <p style="font-size: 13px; color: #111111; margin: 0; line-height: 1.6;">
                        <strong>✓ This owner can now be charged from the Reconciliation Panel.</strong><br>
                        <span style="font-size: 12px; color: #666666;">Monthly management fees and expenses can be processed via Stripe without re-authorization.</span>
                      </p>
                    </div>
                  </div>

                  <!-- Footer -->
                  <div style="padding: 20px 32px; border-top: 1px solid #e5e5e5; background: #f9f9f9;">
                    <p style="font-size: 11px; color: #666666; margin: 0; text-align: center;">
                      PeachHaus Property Management • (404) 800-5932 • Atlanta, GA<br>
                      <span style="color: #999999;">This is an automated notification from the payment system.</span>
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `,
        });
        console.log("Admin payment confirmation email sent successfully");
      } catch (emailError: any) {
        console.error("Failed to send admin notification:", emailError.message);
      }

      // Owner confirmation email
      try {
        console.log("Sending owner payment confirmation email...");
        await resend.emails.send({
          from: "PeachHaus <info@peachhausgroup.com>",
          to: [owner.email],
          subject: "Payment Method Successfully Connected - PeachHaus",
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🍑 PeachHaus</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">Property Management</p>
              </div>
              
              <div style="background: white; padding: 30px; margin-top: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <div style="text-align: center; margin-bottom: 25px;">
                  <div style="background: #d1fae5; border-radius: 50%; width: 60px; height: 60px; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 30px;">✓</span>
                  </div>
                </div>
                
                <h2 style="color: #1a1a2e; text-align: center; margin: 0 0 20px 0;">Payment Method Connected!</h2>
                
                <p style="color: #4a5568; line-height: 1.8;">
                  Hi ${owner.name.split(' ')[0]},
                </p>
                
                <p style="color: #4a5568; line-height: 1.8;">
                  Your payment method has been successfully connected to your PeachHaus account for <strong>${propertyList}</strong>.
                </p>
                
                <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #10b981;">
                  <p style="margin: 0; color: #166534;"><strong>Payment Method:</strong> ${paymentMethodDisplay}</p>
                </div>
                
                <p style="color: #4a5568; line-height: 1.8;">
                  This payment method will be used for monthly management fees and any property-related expenses. You'll receive detailed statements before any charges are processed.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
                
                <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                  Questions? Reply to this email or call us at <a href="tel:+14048005932" style="color: #10b981; text-decoration: none;">(404) 800-5932</a>.
                </p>
                
                <p style="color: #4a5568; margin-top: 25px;">
                  Best regards,<br>
                  <strong>The PeachHaus Team</strong>
                </p>
              </div>
              
              <div style="text-align: center; padding: 20px; color: #a0aec0; font-size: 12px;">
                <p>© ${new Date().getFullYear()} PeachHaus Group. All rights reserved.</p>
              </div>
            </div>
          `,
        });
        console.log("Owner payment confirmation email sent successfully");
      } catch (emailError: any) {
        console.error("Failed to send owner confirmation:", emailError.message);
      }
    }
  }

  // Update lead and advance stage if we have a lead ID
  // Move to ach_form_signed which triggers onboarding form email
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

    // NOTE: Emails are now handled by process-lead-stage-change to prevent duplicates
    // The stage change trigger above will send appropriate emails
    console.log(`Lead ${leadId} advanced to ach_form_signed - emails handled by stage change processor`);
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
