import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-BILLING-TRANSITION-EMAIL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ownerId, ownerEmail, ownerName, propertyNames } = await req.json();
    
    if (!ownerId || !ownerEmail || !ownerName) {
      throw new Error("Missing required parameters");
    }

    logStep("Sending billing transition email", { ownerId, ownerEmail, ownerName });

    const siteUrl = "https://propertycentral.lovable.app";
    const setupUrl = `${siteUrl}/owner-payment-setup?owner=${ownerId}`;
    const deadline = "December 5th, 2024";

    const propertyList = propertyNames?.length > 0 
      ? propertyNames.map((name: string) => `<li>${name}</li>`).join('')
      : '<li>Your managed property</li>';

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Update Your Payment Method</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <img src="https://propertycentral.lovable.app/peachhaus-logo.png" alt="PeachHaus" style="height: 50px; margin-bottom: 15px;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Important: Update Your Payment Method</h1>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <p style="font-size: 16px;">Hi ${ownerName.split(' ')[0]},</p>
    
    <p>We're upgrading our billing system to make payments more secure and convenient for you. Starting this month, we'll be using <strong>Stripe</strong> – the industry leader in payment security – to process all billing.</p>
    
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-weight: 600; color: #92400e;">⏰ Action Required by ${deadline}</p>
      <p style="margin: 10px 0 0 0; color: #78350f;">Please set up your preferred payment method before the deadline to ensure uninterrupted service.</p>
    </div>

    <h3 style="color: #d97706; margin-top: 25px;">Properties Under Management:</h3>
    <ul style="background: #f8fafc; padding: 15px 15px 15px 35px; border-radius: 8px; margin: 10px 0;">
      ${propertyList}
    </ul>

    <h3 style="color: #d97706; margin-top: 25px;">What You Can Do:</h3>
    <ul style="padding-left: 20px;">
      <li style="margin-bottom: 10px;"><strong>🏦 Connect Your Bank Account</strong> – No fees, automatic payments</li>
      <li style="margin-bottom: 10px;"><strong>💳 Add a Credit/Debit Card</strong> – 3% processing fee applies</li>
      <li style="margin-bottom: 10px;"><strong>Keep Your Current Method</strong> – If you prefer Zelle or another method, you can still select that option</li>
    </ul>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${setupUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);">
        Set Up Payment Method →
      </a>
    </div>

    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; color: #065f46;">
        <strong>🔒 Secure & Encrypted</strong><br>
        Your payment information is protected by Stripe's bank-level security. We never store your sensitive details on our servers.
      </p>
    </div>

    <h3 style="color: #d97706; margin-top: 25px;">Why We're Making This Change:</h3>
    <ul style="padding-left: 20px; color: #666;">
      <li style="margin-bottom: 8px;">Faster processing of your monthly statements</li>
      <li style="margin-bottom: 8px;">Automatic payment options (no more manual transfers)</li>
      <li style="margin-bottom: 8px;">Clear transaction history in one place</li>
      <li style="margin-bottom: 8px;">Industry-leading security</li>
    </ul>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #666; font-size: 14px;">
      Questions? Simply reply to this email or contact us at <a href="mailto:info@peachhausgroup.com" style="color: #d97706;">info@peachhausgroup.com</a>
    </p>

    <p style="margin-top: 20px;">
      Best regards,<br>
      <strong>The PeachHaus Team</strong>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>© 2024 PeachHaus Group. All rights reserved.</p>
    <p>Atlanta, Georgia</p>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "PeachHaus <billing@peachhausgroup.com>",
      to: [ownerEmail],
      subject: `Action Required: Set Up Your Payment Method by ${deadline}`,
      html: emailHtml,
    });

    const emailId = (emailResponse as any).data?.id || 'sent';
    logStep("Email sent successfully", { emailId });

    // Log the email in the database
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase.from("email_drafts").insert({
      to_email: ownerEmail,
      to_name: ownerName,
      subject: `Action Required: Set Up Your Payment Method by ${deadline}`,
      body: "Billing transition email sent",
      status: "sent",
      sent_at: new Date().toISOString(),
      contact_type: "owner",
      ai_generated: true,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      emailId,
      setupUrl 
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
