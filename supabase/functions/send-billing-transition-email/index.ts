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

// Format date as "January 15th, 2026"
const formatDeadlineDate = (date: Date): string => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const day = date.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' 
               : day === 2 || day === 22 ? 'nd'
               : day === 3 || day === 23 ? 'rd' 
               : 'th';
  return `${months[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ownerId, ownerEmail, ownerName, propertyNames, propertyAddress } = await req.json();
    
    if (!ownerId || !ownerEmail || !ownerName) {
      throw new Error("Missing required parameters");
    }

    logStep("Sending billing transition email", { ownerId, ownerEmail, ownerName });

    const siteUrl = "https://propertycentral.lovable.app";
    const setupUrl = `${siteUrl}/owner-payment-setup?owner=${ownerId}`;
    
    // Calculate deadline as 3 days from now
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 3);
    const deadline = formatDeadlineDate(deadlineDate);

    // Storage URLs for images
    const storageUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images";
    const logoUrl = `${storageUrl}/peachhaus-logo.png`;
    const headshotUrl = `${storageUrl}/ingo-headshot.png`;
    const signatureUrl = `${storageUrl}/ingo-signature.png`;

    // Build property display
    const primaryProperty = propertyNames?.[0] || "Your Property";
    const displayAddress = propertyAddress || "";

    const emailHtml = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin: 0; padding: 0; background: #f5f9ff; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <div style="max-width: 650px; margin: 0 auto; background: #ffffff; margin-top: 32px; margin-bottom: 32px;">
      
      <!-- Header Section - Matching Statement Layout -->
      <div style="padding: 32px 40px; border-bottom: 1px solid #e5e7eb;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align: middle;">
              <img src="${logoUrl}" alt="PeachHaus Property Management" style="height: 56px;" />
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <p style="margin: 0; font-size: 22px; font-weight: 700; color: #1a3b4c; letter-spacing: 1px;">PAYMENT SETUP</p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; font-weight: 500; letter-spacing: 0.5px;">REQUIRED</p>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Property Info Row -->
      <div style="padding: 24px 40px; background: #f8fafc; border-bottom: 1px solid #e5e7eb;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align: top;">
              <p style="margin: 0; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">PROPERTY</p>
              <p style="margin: 6px 0 0 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">${primaryProperty}</p>
              ${displayAddress ? `<p style="margin: 2px 0 0 0; font-size: 13px; color: #64748b;">${displayAddress}</p>` : ''}
            </td>
            <td style="text-align: right; vertical-align: top;">
              <p style="margin: 0; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">DUE BY</p>
              <p style="margin: 6px 0 0 0; font-size: 14px; font-weight: 600; color: #dc2626;">${deadline}</p>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 40px;">
        <p style="font-size: 16px; line-height: 1.5; color: #1a1a1a; margin: 0 0 8px 0;">
          Dear ${ownerName.split(' ')[0]},
        </p>
        
        <p style="font-size: 15px; line-height: 1.75; color: #4a5568; margin: 20px 0 32px 0;">
          We're upgrading to a more secure and convenient billing system powered by <strong>Stripe</strong>—the industry leader in payment security. Please set up your preferred payment method to ensure seamless processing of your monthly statements.
        </p>

        <!-- CTA Button Box -->
        <div style="background: #1a3b4c; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 32px;">
          <p style="margin: 0 0 20px 0; font-size: 14px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">SET UP YOUR PAYMENT</p>
          <a href="${setupUrl}" style="display: inline-block; background: #f59e0b; color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Complete Setup →
          </a>
          <p style="margin: 16px 0 0 0; font-size: 12px; color: #94a3b8;">Takes less than 2 minutes to complete</p>
        </div>

        <!-- Payment Options Section -->
        <p style="margin: 0 0 16px 0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">PAYMENT OPTIONS</p>
        
        <p style="font-size: 14px; line-height: 1.6; color: #4a5568; margin: 0 0 24px 0;">
          Choose the payment method that works best for you:
        </p>

        <!-- Option 1 -->
        <div style="display: flex; margin-bottom: 16px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="vertical-align: top; width: 36px;">
                <span style="display: inline-block; width: 24px; height: 24px; background: #ecfdf5; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px;">🏦</span>
              </td>
              <td>
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Connect Your Bank Account</p>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">No fees • Automatic monthly payments • Most convenient</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- Option 2 -->
        <div style="display: flex; margin-bottom: 16px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="vertical-align: top; width: 36px;">
                <span style="display: inline-block; width: 24px; height: 24px; background: #fef3c7; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px;">💳</span>
              </td>
              <td>
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Add a Credit/Debit Card</p>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">3% processing fee applies • Instant processing</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- Security Note -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px 20px; margin: 32px 0;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="vertical-align: top; width: 32px;">
                <span style="font-size: 18px;">🔒</span>
              </td>
              <td>
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #166534;">Secure & Encrypted</p>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #15803d; line-height: 1.5;">Your payment information is protected by Stripe's bank-level security. We never store your sensitive details on our servers.</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- Why Section -->
        <p style="margin: 32px 0 16px 0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">WHY WE'RE MAKING THIS CHANGE</p>
        
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #4a5568;">✓ Faster processing of your monthly statements</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #4a5568;">✓ Automatic payment options (no more manual transfers)</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #4a5568;">✓ Clear transaction history in one place</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #4a5568;">✓ Industry-leading security for your peace of mind</td>
          </tr>
        </table>

        <!-- Divider -->
        <div style="border-top: 1px solid #e5e7eb; margin: 32px 0;"></div>

        <!-- Questions -->
        <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 0 0 24px 0;">
          Questions? Simply reply to this email or contact us at <a href="mailto:info@peachhausgroup.com" style="color: #1a3b4c; font-weight: 500;">info@peachhausgroup.com</a>
        </p>

        <!-- Signature Section -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="width: 70px; vertical-align: top; padding-right: 16px;">
              <img src="${headshotUrl}" alt="Ingo Schaer" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;" />
            </td>
            <td style="vertical-align: middle;">
              <p style="margin: 0; font-size: 14px; color: #4a5568;">Warm regards,</p>
              <img src="${signatureUrl}" alt="Ingo Schaer signature" style="height: 36px; margin: 8px 0;" />
              <p style="margin: 0; font-size: 13px; color: #64748b;">Ingo & Anja Schaer</p>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: #94a3b8;">Founders, PeachHaus Group LLC</p>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Footer -->
      <div style="padding: 24px 40px; background: #f8fafc; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">
          © ${new Date().getFullYear()} PeachHaus Group LLC • Atlanta, Georgia
        </p>
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #cbd5e1;">
          Making your rental property effortless
        </p>
      </div>
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
    logStep("Email sent successfully", { emailId, deadline });

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
      setupUrl,
      deadline
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
