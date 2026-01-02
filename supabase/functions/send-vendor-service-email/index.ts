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
  propertyId: string;
  vendorId: string;
  senderEmail?: string;
  senderName?: string;
}

// Team signatures based on email
const SIGNATURES: Record<string, { name: string; title: string; headshot?: string }> = {
  "ingo@peachhausgroup.com": {
    name: "INGO SCHAER",
    title: "CO-FOUNDER, OPERATIONS",
  },
  "anja@peachhausgroup.com": {
    name: "ANJA SCHAER",
    title: "CO-FOUNDER, GA REAL ESTATE BROKER",
  },
};

function buildSignatureHtml(senderEmail: string, senderName: string): string {
  const sigInfo = SIGNATURES[senderEmail.toLowerCase()];
  const displayName = sigInfo?.name || senderName?.toUpperCase() || senderEmail.split("@")[0].toUpperCase();
  const title = sigInfo?.title || "TEAM MEMBER";

  return `
    <table cellpadding="0" cellspacing="0" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #333; margin-top: 30px;">
      <tr>
        <td style="padding-top: 20px; border-top: 2px solid #e5a653;">
          <strong style="font-size: 16px; color: #333;">${displayName}</strong><br/>
          <span style="color: #666; font-size: 12px;">${title}</span><br/>
          <span style="font-weight: 600; color: #e5a653;">PEACHHAUS GROUP LLC</span>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 12px; font-size: 13px; color: #666;">
          <strong>website</strong> <a href="https://www.peachhausgroup.com" style="color: #e5a653; text-decoration: none;">www.peachhausgroup.com</a><br/>
          <strong>phone</strong> (404) 800-5932<br/>
          <strong>email</strong> <a href="mailto:${senderEmail}" style="color: #e5a653; text-decoration: none;">${senderEmail}</a>
        </td>
      </tr>
    </table>`;
}

function convertBodyToHtml(body: string): string {
  // Convert plain text body to styled HTML
  const lines = body.split("\n");
  let html = "";
  let inSection = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check for section headers (lines with ─ characters)
    if (trimmedLine.includes("─")) {
      continue; // Skip separator lines
    }
    
    // Check for section titles (ALL CAPS lines before separators)
    if (/^[A-Z\s]+$/.test(trimmedLine) && trimmedLine.length > 3) {
      if (inSection) {
        html += "</div>";
      }
      html += `
        <div style="margin-top: 20px; margin-bottom: 10px;">
          <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #e5a653; letter-spacing: 1px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px;">
            ${trimmedLine}
          </h3>
        </div>
        <div style="margin-left: 0;">`;
      inSection = true;
      continue;
    }
    
    // Regular content
    if (trimmedLine === "") {
      html += "<br/>";
    } else if (trimmedLine.startsWith("Dear ")) {
      html += `<p style="margin: 0 0 15px 0; font-size: 15px;">${trimmedLine}</p>`;
    } else if (trimmedLine.includes(":") && !trimmedLine.startsWith("http")) {
      // Key-value pairs
      const [key, ...valueParts] = trimmedLine.split(":");
      const value = valueParts.join(":").trim();
      html += `<p style="margin: 4px 0; font-size: 14px;"><span style="color: #666;">${key}:</span> <span style="font-weight: 500;">${value}</span></p>`;
    } else if (trimmedLine.startsWith("Note:")) {
      html += `<p style="margin: 10px 0; font-size: 13px; color: #666; font-style: italic;">${trimmedLine}</p>`;
    } else {
      html += `<p style="margin: 8px 0; font-size: 14px; line-height: 1.6;">${trimmedLine}</p>`;
    }
  }

  if (inSection) {
    html += "</div>";
  }

  return html;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, toName, subject, body, propertyId, vendorId, senderEmail, senderName }: EmailRequest = await req.json();

    console.log("Received vendor service email request:", { to, toName, subject, propertyId, vendorId });

    if (!to || !subject || !body) {
      throw new Error("Missing required fields: to, subject, body");
    }

    // Determine sender
    const fromEmail = senderEmail && senderEmail.endsWith("@peachhausgroup.com")
      ? senderEmail
      : "noreply@peachhausgroup.com";

    const fromName = senderName || (senderEmail ? senderEmail.split("@")[0] : "PeachHaus");

    console.log(`Sending vendor service email from ${fromEmail} (${fromName}) to ${to}`);

    // Build email HTML
    const bodyHtml = convertBodyToHtml(body);
    const signatureHtml = buildSignatureHtml(fromEmail, fromName);

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #f9f9f9;">
        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #e5a653;">
            <h1 style="margin: 0; font-size: 24px; color: #333; font-weight: 600;">PeachHaus Group</h1>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #666; letter-spacing: 2px;">PROPERTY MANAGEMENT</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 0 10px;">
            ${bodyHtml}
          </div>
          
          <!-- Signature -->
          ${signatureHtml}
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #999;">
          <p>PeachHaus Group LLC | Atlanta, GA</p>
          <p>This email was sent regarding a property management service request.</p>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: subject,
      html: fullHtml,
    });

    console.log("Vendor service email sent successfully:", emailResponse);

    // Log to vendor_service_requests if table exists (optional enhancement)
    // For now, just log success
    
    return new Response(JSON.stringify({ success: true, id: emailResponse.data?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending vendor service email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
