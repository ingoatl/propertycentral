import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-OWNER-PAYMENT-REQUEST] ${step}${detailsStr}`);
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

    logStep("Starting payment request for owner", { ownerId, email, name });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const resend = new Resend(resendKey);

    // Check if a Stripe customer already exists for this email
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });
    } else {
      const customer = await stripe.customers.create({
        email,
        name: name || undefined,
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
        type: "owner_payment_setup",
      },
    });

    logStep("Created Stripe checkout session", { sessionId: session.id, url: session.url });

    // Update owner with Stripe customer ID in Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase
      .from("property_owners")
      .update({ stripe_customer_id: customerId })
      .eq("id", ownerId);

    logStep("Updated owner with Stripe customer ID");

    // Get owner's properties for context
    const { data: properties } = await supabase
      .from("properties")
      .select("name, address")
      .eq("owner_id", ownerId);

    const propertyList = properties?.map(p => p.name || p.address).join(", ") || "your properties";

    // Get owner's service type to customize messaging
    const { data: ownerData } = await supabase
      .from("property_owners")
      .select("service_type")
      .eq("id", ownerId)
      .single();
    
    const serviceType = ownerData?.service_type || 'cohosting';
    const isFullService = serviceType === 'full_service';

    // Create payment setup request record for reminder tracking (with service_type)
    await supabase.from("payment_setup_requests").upsert({
      owner_id: ownerId,
      initial_sent_at: new Date().toISOString(),
      status: "pending",
      stripe_session_url: session.url,
      service_type: serviceType,
      reminder_count: 0,
    }, {
      onConflict: "owner_id",
      ignoreDuplicates: false,
    });

    logStep("Created payment setup request for reminders", { serviceType });

    const firstName = (name || '').split(' ')[0] || 'there';

    // Build Fortune 500-style email based on service type
    const purposeSection = isFullService ? `
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #10b981;">
        <div style="font-size: 11px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; margin-bottom: 8px;">💰 YOUR RENTAL PAYOUTS</div>
        <p style="color: #166534; font-weight: 600; margin: 0 0 8px 0; font-size: 16px;">Receive Your Earnings on the 5th</p>
        <p style="color: #15803d; margin: 0; font-size: 14px; line-height: 1.6;">
          We deposit your net rental earnings directly to your bank account on the <strong>5th of each month</strong>, following the monthly reconciliation.
        </p>
      </div>
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="color: #374151; font-size: 14px; margin: 0; line-height: 1.6;">
          <strong>Payment Method:</strong> US Bank Account (ACH) — <span style="color: #166534; font-weight: 600;">No fees for payouts</span>
        </p>
      </div>
    ` : `
      <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #3b82f6;">
        <div style="font-size: 11px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; margin-bottom: 12px;">🔒 NO FORMS TO FILL OUT</div>
        <p style="color: #1e3a8a; font-weight: 600; margin: 0 0 12px 0; font-size: 16px;">Just Link Your Account in 2 Minutes</p>
        <p style="color: #1d4ed8; margin: 0; font-size: 14px; line-height: 1.6;">
          This isn't a form — you'll securely link your bank account or card directly through Stripe's protected portal. Your details are <strong>never stored on our servers</strong>.
        </p>
      </div>
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="color: #166534; font-weight: 600; margin: 0 0 12px 0; font-size: 15px;">✨ What you get:</p>
        <ul style="color: #15803d; margin: 0; padding: 0 0 0 20px; font-size: 14px; line-height: 2;">
          <li><strong>One-time setup</strong> — Takes just 2 minutes, then payments happen automatically</li>
          <li><strong>Your choice</strong> — Bank transfer (1% fee) or card (3% fee)</li>
          <li><strong>Complete transparency</strong> — See every charge before it posts</li>
          <li><strong>Bank-level security</strong> — Your info is encrypted and never stored on our servers</li>
        </ul>
      </div>
    `;

    const ctaText = isFullService ? 'Set Up My Payout Account →' : 'Set Up My Payment Method →';
    const subject = isFullService 
      ? 'Set Up Your Payout Account - 2 Minute Setup'
      : 'Upgrading Your Payment Security - 2 Minute Setup';
    
    const introText = isFullService 
      ? `We need to set up your bank account so we can deposit your rental earnings from <strong>${propertyList}</strong>.`
      : `We're upgrading our payment system to Stripe — the industry-leading platform trusted by Amazon, Google, and millions of businesses worldwide.`;
    
    const subIntroText = isFullService
      ? `<p style="color: #4a5568; line-height: 1.8; margin-bottom: 20px;">
          As your full-service property management partner, we handle everything from guest bookings to maintenance. Setting up your bank account ensures you receive your rental income on time, every month.
        </p>`
      : `<p style="color: #4a5568; line-height: 1.8; margin-bottom: 20px;">
          Your payment details will be used for monthly management fees and any approved property expenses for <strong>${propertyList}</strong>. You'll see every charge clearly before it processes.
        </p>`;

    const whyStripeSection = `
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; margin-bottom: 12px;">WHY STRIPE?</div>
        <div style="display: grid; gap: 8px;">
          <div style="font-size: 14px; color: #334155;">✓ <strong>Bank-level encryption</strong> — 256-bit SSL security</div>
          <div style="font-size: 14px; color: #334155;">✓ <strong>Never stored on our servers</strong> — Details kept in Stripe's secure vault</div>
          <div style="font-size: 14px; color: #334155;">✓ <strong>Trusted by millions</strong> — Used by Amazon, Google, and Shopify</div>
          <div style="font-size: 14px; color: #334155;">✓ <strong>PCI DSS Level 1</strong> — Highest security certification</div>
        </div>
      </div>
    `;

    // Send email with Fortune 500 style - service type aware
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); padding: 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size: 24px; font-weight: 700; color: #ffffff;">🍑 PeachHaus</div>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 4px;">Property Management</div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 6px 12px; background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; border-radius: 20px; font-size: 11px; font-weight: 700; color: #34d399; letter-spacing: 0.5px;">
                      ${isFullService ? 'PAYOUT SETUP' : 'PAYMENT SETUP'}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <!-- Greeting -->
              <div style="font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 20px;">
                Hi ${firstName},
              </div>
              
              <!-- Intro -->
              <div style="font-size: 16px; color: #374151; line-height: 1.8; margin-bottom: 20px;">
                ${introText}
              </div>
              
              ${subIntroText}
              
              ${purposeSection}
              
              ${whyStripeSection}
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${siteUrl}/owner-payment-setup?owner=${ownerId}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 18px 48px; border-radius: 10px; font-weight: 600; font-size: 17px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                  ${ctaText}
                </a>
              </div>
              
              <p style="color: #64748b; font-size: 13px; text-align: center; margin: 24px 0 0 0;">
                This link won't expire — complete setup whenever you're ready!
              </p>
            </td>
          </tr>
          
          <!-- Signature -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: top; padding-right: 16px;">
                    <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-headshot.png" alt="Ingo" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover;" />
                  </td>
                  <td style="vertical-align: top; border-left: 3px solid #f59e0b; padding-left: 12px;">
                    <div style="font-weight: 700; font-size: 14px; color: #111827;">Ingo Schaer</div>
                    <div style="font-size: 12px; color: #6b7280;">Co-Founder, Operations Manager</div>
                    <div style="font-size: 12px; margin-top: 4px;">
                      <a href="tel:+14048005932" style="color: #111827; text-decoration: none;">(404) 800-5932</a> · 
                      <a href="mailto:ingo@peachhausgroup.com" style="color: #2563eb; text-decoration: none;">ingo@peachhausgroup.com</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <div style="font-size: 11px; color: #9ca3af;">
                © ${new Date().getFullYear()} PeachHaus Group LLC · Atlanta, GA<br>
                Making property ownership easier, one home at a time.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "PeachHaus <info@peachhausgroup.com>",
      to: [email],
      subject: subject,
      html: emailHtml,
    });

    logStep("Email sent", { emailResponse });

    // Log the email in owner communications
    // Note: Owners don't have lead_communications - we might want a separate table
    // For now, just log to console

    return new Response(JSON.stringify({ 
      success: true, 
      sessionUrl: session.url,
      customerId,
      emailId: emailResponse?.data?.id 
    }), {
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
