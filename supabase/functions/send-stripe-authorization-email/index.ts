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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, email, name, propertyAddress } = await req.json();
    
    if (!leadId || !email) {
      throw new Error("Missing required parameters: leadId and email");
    }

    logStep("Starting Stripe authorization email", { leadId, email, name });

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update lead with stripe setup intent
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
          sent_to: email
        },
      });

    logStep("Updated lead in Supabase");

    // Send email with Stripe payment setup link - improved persuasive copy
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; color: white; text-align: center;">
      <h1 style="margin: 0 0 10px 0; font-size: 28px; font-weight: 700;">🍑 PeachHaus</h1>
      <p style="margin: 0; opacity: 0.8; font-size: 14px;">Property Management</p>
    </div>
    
    <div style="background: white; border-radius: 16px; padding: 40px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <h2 style="margin: 0 0 20px 0; color: #1a1a2e; font-size: 24px;">Quick Update to Simplify Your Payments</h2>
      
      <p style="color: #4a5568; line-height: 1.8; margin-bottom: 20px;">
        Hi ${name || 'there'},
      </p>
      
      <p style="color: #4a5568; line-height: 1.8; margin-bottom: 20px;">
        ${propertyAddress ? `We're excited to get started managing <strong>${propertyAddress}</strong> for you!` : `We're excited to get started working with you!`}
      </p>
      
      <p style="color: #4a5568; line-height: 1.8; margin-bottom: 20px;">
        <strong>We may have your current payment information on file</strong>, but we're transitioning to <strong>Stripe</strong> — a bank-level secure payment system used by millions of businesses worldwide. This change offers better security and a smoother experience for both of us.
      </p>
      
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #10b981;">
        <p style="color: #166534; font-weight: 600; margin: 0 0 16px 0; font-size: 16px;">✨ Here's what this means for you:</p>
        <ul style="color: #15803d; margin: 0; padding: 0 0 0 20px; font-size: 15px; line-height: 2;">
          <li><strong>One-time setup</strong> — Takes just 2 minutes, then payments happen automatically</li>
          <li><strong>Your choice</strong> — Bank transfer (1% fee) or card (3% fee)</li>
          <li><strong>Complete transparency</strong> — See every charge before it posts</li>
          <li><strong>Instant receipts</strong> — Get email confirmations for every transaction</li>
          <li><strong>Bank-level security</strong> — Your info is encrypted and never stored on our servers</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${session.url}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 18px 48px; border-radius: 10px; font-weight: 600; font-size: 17px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
          Set Up My Payment Method →
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      
      <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
        <strong>Questions?</strong> Just reply to this email or call us at <a href="tel:+14048005932" style="color: #10b981; text-decoration: none;">(404) 800-5932</a>.
      </p>
      
      <p style="color: #a0aec0; font-size: 12px; margin-top: 20px;">
        This link will expire in 24 hours.
      </p>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #a0aec0; font-size: 12px;">
      <p>© ${new Date().getFullYear()} PeachHaus Group. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "PeachHaus <info@peachhausgroup.com>",
      to: [email],
      subject: "Complete Your Payment Setup - PeachHaus",
      html: emailHtml,
    });

    logStep("Email sent", { emailResponse });

    // Log communication
    await supabase
      .from("lead_communications")
      .insert({
        lead_id: leadId,
        type: "email",
        direction: "outbound",
        subject: "Complete Your Payment Setup - PeachHaus",
        content: `Stripe payment authorization email sent to ${email}`,
        sent_at: new Date().toISOString(),
      });

    logStep("Communication logged");

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
