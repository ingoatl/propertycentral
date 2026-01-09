import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  toName: string;
  subject: string;
  body: string;
  contactType: "lead" | "owner";
  contactId: string;
  senderEmail?: string;
  senderName?: string;
}

// Team signatures based on email
const SIGNATURES: Record<string, string> = {
  "ingo@peachhausgroup.com": `
<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <tr>
    <td style="padding: 20px 0; vertical-align: top;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right: 15px; border-right: 2px solid #e5a653; vertical-align: top;">
            <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/assets/ingo-signature-photo.png" alt="Ingo Schaer" width="100" style="border-radius: 50%; display: block;" />
            <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/assets/ingo-signature.png" alt="Signature" width="100" style="display: block; margin-top: 10px;" />
          </td>
          <td style="padding-left: 15px; vertical-align: top;">
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #333;">Ingo Schaer</p>
            <p style="margin: 4px 0 0; font-size: 13px; color: #666;">Co-Founder, Operations Manager</p>
            <p style="margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #333;">PeachHaus Group LLC</p>
            <p style="margin: 10px 0 0; font-size: 13px; color: #666;">(404) 800-5932</p>
            <p style="margin: 4px 0 0;"><a href="mailto:ingo@peachhausgroup.com" style="font-size: 13px; color: #1a73e8; text-decoration: none;">ingo@peachhausgroup.com</a></p>
            <p style="margin: 4px 0 0;"><a href="https://propertycentral.lovable.app" style="font-size: 13px; color: #1a73e8; text-decoration: none;">propertycentral.lovable.app</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  "anja@peachhausgroup.com": `
<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <tr>
    <td style="padding: 20px 0; vertical-align: top;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right: 15px; border-right: 2px solid #e5a653; vertical-align: top;">
            <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/assets/anja-signature-photo.png" alt="Anja Schaer" width="100" style="border-radius: 50%; display: block;" />
            <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/assets/anja-signature.png" alt="Signature" width="100" style="display: block; margin-top: 10px;" />
          </td>
          <td style="padding-left: 15px; vertical-align: top;">
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #333;">Anja Schaer</p>
            <p style="margin: 4px 0 0; font-size: 13px; color: #666;">Co-Founder, GA Real Estate Broker</p>
            <p style="margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #333;">PeachHaus Group LLC</p>
            <p style="margin: 10px 0 0; font-size: 13px; color: #666;">(404) 800-5932</p>
            <p style="margin: 4px 0 0;"><a href="mailto:anja@peachhausgroup.com" style="font-size: 13px; color: #1a73e8; text-decoration: none;">anja@peachhausgroup.com</a></p>
            <p style="margin: 4px 0 0;"><a href="https://propertycentral.lovable.app" style="font-size: 13px; color: #1a73e8; text-decoration: none;">propertycentral.lovable.app</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
};

// Default signature for other team members
function getDefaultSignature(name: string, email: string): string {
  const firstName = name?.split(' ')[0]?.toUpperCase() || email.split('@')[0].toUpperCase();
  return `
<table cellpadding="0" cellspacing="0" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #333;">
  <tr>
    <td style="padding-top: 20px; border-top: 2px solid #e5a653;">
      <strong style="font-size: 16px; color: #333;">${firstName}</strong><br/>
      <span style="font-weight: 600; color: #e5a653;">PEACHHAUS GROUP LLC</span>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 12px; font-size: 13px; color: #666;">
      <strong>website</strong> <a href="https://www.peachhausgroup.com" style="color: #e5a653; text-decoration: none;">www.peachhausgroup.com</a><br/>
      <strong>phone</strong> (404) 800-5932<br/>
      <strong>email</strong> <a href="mailto:${email}" style="color: #e5a653; text-decoration: none;">${email}</a>
    </td>
  </tr>
</table>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, toName, subject, body, contactType, contactId, senderEmail, senderName }: EmailRequest = await req.json();

    if (!to || !subject || !body) {
      throw new Error("Missing required fields: to, subject, body");
    }

    // Determine sender - use provided email or fallback to noreply
    const fromEmail = senderEmail && senderEmail.endsWith("@peachhausgroup.com") 
      ? senderEmail 
      : "noreply@peachhausgroup.com";
    
    const fromName = senderName || (senderEmail ? senderEmail.split('@')[0] : "PeachHaus");
    
    console.log(`Sending email from ${fromEmail} (${fromName}) to ${to} (${toName}) - Subject: ${subject}`);

    // Get signature for the sender
    const signature = SIGNATURES[fromEmail.toLowerCase()] || 
      (senderEmail ? getDefaultSignature(senderName || "", senderEmail) : "");

    // Convert plain text body to HTML
    const htmlBody = body
      .split("\n")
      .map((line: string) => (line.trim() ? `<p style="margin: 0 0 10px 0;">${line}</p>` : "<br/>"))
      .join("");

    const emailResponse = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${htmlBody}
          ${signature}
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the communication in the database
    if (contactType === "lead" && contactId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      await supabase.from("lead_communications").insert({
        lead_id: contactId,
        communication_type: "email",
        direction: "outbound",
        subject: subject,
        body: body,
        status: "sent",
        sent_at: new Date().toISOString(),
        metadata: { sender_email: fromEmail, sender_name: fromName },
      });

      console.log("Communication logged for lead:", contactId);
    }

    return new Response(JSON.stringify({ success: true, id: emailResponse.data?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
