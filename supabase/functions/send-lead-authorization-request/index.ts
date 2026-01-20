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
  console.log(`[SEND-LEAD-AUTH-REQUEST] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, email, name, propertyAddress } = await req.json();
    logStep("Request received", { leadId, email, name });

    if (!leadId || !email || !name) {
      throw new Error("Missing required fields: leadId, email, name");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const resend = new Resend(resendKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for existing Stripe customer
    logStep("Checking for existing Stripe customer");
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    
    let customerId: string;
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: { lead_id: leadId },
      });
      customerId = customer.id;
      logStep("Created new customer", { customerId });
    }

    // Update lead with stripe_customer_id
    const { error: updateError } = await supabase
      .from("leads")
      .update({ stripe_customer_id: customerId })
      .eq("id", leadId);

    if (updateError) {
      logStep("Failed to update lead with customer ID", { error: updateError.message });
    }

    // Determine site URL
    const siteUrl = "https://propertycentral.lovable.app";

    // Create the authorization landing page URL (this won't expire!)
    const authorizationUrl = `${siteUrl}/lead-payment-setup?lead=${leadId}`;
    logStep("Created authorization URL", { authorizationUrl });

    // Log timeline entry
    await supabase.from("lead_timeline").insert({
      lead_id: leadId,
      action: "Payment authorization request sent",
      metadata: { customerId, email },
    });

    // Send email with authorization link
    const LOGO_URL = `${supabaseUrl}/storage/v1/object/public/property-images/peachhaus-logo.png`;

    const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #ffffff; border-radius: 12px; overflow: hidden;">
      <div style="padding: 40px 32px; text-align: center; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);">
        <img src="${LOGO_URL}" alt="PeachHaus" style="height: 60px; margin-bottom: 24px;" />
        <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #fae052;">Payment Authorization</h1>
        <p style="margin: 12px 0 0; color: #a0aec0; font-size: 15px;">Set up your payment method for property management</p>
      </div>
      
      <div style="padding: 32px;">
        <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi ${name.split(' ')[0]},
        </p>
        
        <p style="color: #cbd5e0; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
          To get started with PeachHaus property management, we need to set up a payment method on file. 
          This allows us to charge for property management fees and any authorized expenses.
        </p>
        
        ${propertyAddress ? `
        <div style="background: rgba(250, 224, 82, 0.1); border-left: 3px solid #fae052; padding: 16px 20px; margin: 0 0 24px; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; color: #fae052; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Property</p>
          <p style="margin: 8px 0 0; color: #e2e8f0; font-size: 15px;">${propertyAddress}</p>
        </div>
        ` : ''}
        
        <div style="background: rgba(16, 185, 129, 0.1); border-radius: 12px; padding: 24px; margin: 0 0 24px;">
          <h3 style="margin: 0 0 16px; color: #10b981; font-size: 16px;">What You're Authorizing:</h3>
          <ul style="margin: 0; padding: 0 0 0 20px; color: #cbd5e0; font-size: 14px; line-height: 1.8;">
            <li>Monthly property management fees</li>
            <li>Pre-approved maintenance & supplies</li>
            <li>Utility reimbursements (if applicable)</li>
          </ul>
          <p style="margin: 16px 0 0; color: #a0aec0; font-size: 13px;">
            <strong>Note:</strong> You won't be charged today. This just saves your payment method securely.
          </p>
        </div>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${authorizationUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 18px 48px; border-radius: 10px; font-weight: 600; font-size: 17px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
            Set Up Payment Method →
          </a>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px; margin-top: 24px;">
          <h4 style="margin: 0 0 12px; color: #e2e8f0; font-size: 14px;">Payment Options:</h4>
          <div style="display: flex; gap: 16px;">
            <div style="flex: 1;">
              <p style="margin: 0; color: #10b981; font-weight: 600; font-size: 13px;">🏦 Bank Account</p>
              <p style="margin: 4px 0 0; color: #a0aec0; font-size: 12px;">1% processing fee</p>
            </div>
            <div style="flex: 1;">
              <p style="margin: 0; color: #8b5cf6; font-weight: 600; font-size: 13px;">💳 Credit Card</p>
              <p style="margin: 4px 0 0; color: #a0aec0; font-size: 12px;">3% processing fee</p>
            </div>
          </div>
        </div>
        
        <p style="color: #a0aec0; font-size: 12px; margin-top: 24px; text-align: center;">
          This link won't expire — complete setup whenever you're ready!
        </p>
      </div>
      
      <div style="padding: 24px 32px; background: rgba(0,0,0,0.2); text-align: center;">
        <p style="margin: 0; color: #718096; font-size: 12px;">
          Secure payment processing by Stripe. Your information is encrypted and safe.
        </p>
        <p style="margin: 8px 0 0; color: #4a5568; font-size: 11px;">
          Questions? Reply to this email or call (404) 800-6804
        </p>
      </div>
    </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "PeachHaus <payments@peachhausgroup.com>",
      to: [email],
      subject: "Set Up Your Payment Method - PeachHaus Property Management",
      html: emailHtml,
    });

    logStep("Email sent", { emailId: emailResponse.id });

    // Log communication
    await supabase.from("lead_communications").insert({
      lead_id: leadId,
      communication_type: "email",
      direction: "outbound",
      subject: "Set Up Your Payment Method - PeachHaus Property Management",
      body: `Payment authorization request sent to ${email}`,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        authorizationUrl,
        customerId,
        emailId: emailResponse.id,
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
