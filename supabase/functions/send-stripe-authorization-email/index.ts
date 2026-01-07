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

    // Send email with Stripe payment setup link
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
      <h2 style="margin: 0 0 20px 0; color: #1a1a2e; font-size: 24px;">Payment Authorization Required</h2>
      
      <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
        Hi ${name || 'there'},
      </p>
      
      <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
        To complete the onboarding process${propertyAddress ? ` for <strong>${propertyAddress}</strong>` : ''}, we need to set up your payment method for recurring management fees and property expenses.
      </p>
      
      <p style="color: #4a5568; line-height: 1.6; margin-bottom: 30px;">
        You can securely connect your bank account (ACH) or credit/debit card through our trusted payment partner, Stripe.
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${session.url}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Set Up Payment Method →
        </a>
      </div>
      
      <p style="color: #718096; font-size: 14px; line-height: 1.6; margin-top: 30px;">
        <strong>Why ACH?</strong> Bank transfers have lower fees than credit cards, which means more savings for you. However, you can also use a credit or debit card if preferred.
      </p>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      
      <p style="color: #a0aec0; font-size: 12px; text-align: center;">
        This link will expire in 24 hours. If you have any questions, reply to this email or contact us at support@peachhausgroup.com
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
      from: "PeachHaus <onboarding@resend.dev>",
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
