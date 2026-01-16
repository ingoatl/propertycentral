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
  console.log(`[SEND-STRIPE-AUTH-EMAIL] ${step}${detailsStr}`);
};

// Company logo URL
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const LOGO_URL = `${supabaseUrl}/storage/v1/object/public/property-images/peachhaus-logo.png`;

// W-9 PDF URL
const W9_URL = "https://propertycentral.lovable.app/documents/w9_Peachhausgroup.pdf";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, email, name, propertyAddress, serviceType } = await req.json();
    
    if (!leadId || !email) {
      throw new Error("Missing required parameters: leadId and email");
    }

    logStep("Starting Stripe authorization & W-9 email", { leadId, email, name, serviceType });

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
          lead_id: leadId,
          type: "lead",
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
      success_url: `${siteUrl}/payment-success?lead=${leadId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/payment-setup?lead=${leadId}&canceled=true`,
      metadata: {
        lead_id: leadId,
        type: "lead_payment_setup",
      },
    });

    logStep("Created Stripe checkout session", { sessionId: session.id, url: session.url });

    // Update lead with Stripe info in Supabase
    await supabase
      .from("leads")
      .update({ 
        stripe_setup_intent_id: session.id,
        last_contacted_at: new Date().toISOString()
      })
      .eq("id", leadId);

    // Add timeline entry
    await supabase
      .from("lead_timeline")
      .insert({
        lead_id: leadId,
        event_type: "payment_setup_sent",
        event_data: { 
          session_id: session.id, 
          customer_id: customerId,
          sent_to: email,
          includes_w9: true
        },
      });

    logStep("Updated lead in Supabase");

    const firstName = name ? name.split(" ")[0] : "there";

    // Determine if this is a cohosting client (they need the W-9)
    const isCohosting = serviceType === "cohosting";

    // Send email with Stripe payment setup link AND W-9 info for cohosting clients
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  </style>
</head>
<body style="margin: 0; padding: 0; background: #f4f4f4;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    
    <!-- Email Container -->
    <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
      
      <!-- Header with Logo -->
      <div style="background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%); padding: 32px 32px 28px 32px; text-align: center;">
        <img src="${LOGO_URL}" alt="PeachHaus Group" style="height: 40px; margin-bottom: 16px;" onerror="this.style.display='none'" />
        <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600; letter-spacing: -0.3px;">
          Complete Your Payment Setup${isCohosting ? ' & W-9' : ''}
        </h1>
        <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.7); font-size: 13px;">
          ${propertyAddress || 'Getting Started with PeachHaus'}
        </p>
      </div>

      <!-- Main Content -->
      <div style="padding: 32px;">
        
        <!-- Greeting -->
        <p style="font-size: 15px; color: #333333; line-height: 1.7; margin: 0 0 20px 0;">
          Hi ${firstName},
        </p>
        
        <p style="font-size: 15px; color: #333333; line-height: 1.7; margin: 0 0 24px 0;">
          ${propertyAddress 
            ? `We're excited to get started managing <strong>${propertyAddress}</strong> for you!`
            : `We're excited to get started working with you!`}
        </p>

        <!-- Payment Setup Section -->
        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #10b981;">
          <h3 style="margin: 0 0 16px 0; color: #166534; font-size: 16px; font-weight: 600;">
            🏦 Step 1: Set Up Your Payment Method
          </h3>
          <p style="color: #15803d; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
            We're using <strong>Stripe</strong> — a bank-level secure payment system used by millions of businesses worldwide. This one-time setup takes just 2 minutes.
          </p>
          <ul style="color: #15803d; margin: 0 0 20px 0; padding: 0 0 0 20px; font-size: 14px; line-height: 1.8;">
            <li><strong>Your choice</strong> — Bank transfer (1% fee) or card (3% fee)</li>
            <li><strong>Complete transparency</strong> — See every charge before it posts</li>
            <li><strong>Instant receipts</strong> — Get email confirmations for every transaction</li>
            <li><strong>Bank-level security</strong> — Your info is encrypted and never stored on our servers</li>
          </ul>
          <div style="text-align: center;">
            <a href="${session.url}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
              Set Up My Payment Method →
            </a>
          </div>
        </div>

        ${isCohosting ? `
        <!-- W-9 Section for Cohosting Clients -->
        <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h3 style="margin: 0 0 16px 0; color: #111111; font-size: 16px; font-weight: 600;">
            📄 Step 2: W-9 Form for Your Records
          </h3>
          <p style="font-size: 14px; color: #555555; line-height: 1.7; margin: 0 0 16px 0;">
            Because you'll be paying PeachHaus for management services, the IRS requires that you issue us a <strong>1099 at year-end</strong> if total payments exceed $600.
          </p>
          <p style="font-size: 14px; color: #555555; line-height: 1.7; margin: 0 0 16px 0;">
            Our W-9 provides you with the tax information you'll need, including:
          </p>
          <ul style="margin: 0 0 20px 0; padding-left: 20px;">
            <li style="font-size: 14px; color: #555555; line-height: 1.8;">Our legal business name and address</li>
            <li style="font-size: 14px; color: #555555; line-height: 1.8;">Federal Tax Identification Number (EIN)</li>
            <li style="font-size: 14px; color: #555555; line-height: 1.8;">Business classification</li>
          </ul>
          <div style="text-align: center;">
            <a href="${W9_URL}" style="display: inline-block; background: #111111; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; letter-spacing: 0.3px;">
              Download W-9 Form →
            </a>
          </div>
        </div>
        ` : ''}
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
        
        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
          <strong>Questions?</strong> Just reply to this email or call us at <a href="tel:+14048005932" style="color: #10b981; text-decoration: none;">(404) 800-5932</a>.
        </p>
        
        <p style="color: #a0aec0; font-size: 12px; margin-top: 20px;">
          This payment setup link will expire in 24 hours.
        </p>

        <!-- Signature -->
        <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
          <p style="margin: 0; font-size: 14px; color: #333333; font-weight: 500;">
            Ingo Winzer
          </p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #666666;">
            Founder & CEO, PeachHaus Group
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding: 24px 32px; border-top: 1px solid #e5e5e5; background: #f9fafb;">
        <div style="font-size: 10px; color: #999999;">
          <div style="margin-bottom: 4px;">© ${new Date().getFullYear()} PeachHaus Group LLC</div>
          <div>Atlanta, Georgia</div>
        </div>
      </div>

    </div>
  </div>
</body>
</html>
    `;

    const emailSubject = isCohosting 
      ? "Complete Your Payment Setup & W-9 - PeachHaus"
      : "Complete Your Payment Setup - PeachHaus";

    const emailResponse = await resend.emails.send({
      from: "PeachHaus <info@peachhausgroup.com>",
      to: [email],
      subject: emailSubject,
      html: emailHtml,
    });

    logStep("Email sent", { emailResponse, includesW9: isCohosting });

    // Log communication
    await supabase
      .from("lead_communications")
      .insert({
        lead_id: leadId,
        type: "email",
        direction: "outbound",
        subject: emailSubject,
        content: `Stripe payment authorization${isCohosting ? ' and W-9 form' : ''} email sent to ${email}`,
        sent_at: new Date().toISOString(),
      });

    logStep("Communication logged");

    return new Response(JSON.stringify({ 
      success: true, 
      sessionUrl: session.url,
      customerId,
      emailId: emailResponse?.data?.id,
      includesW9: isCohosting
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
