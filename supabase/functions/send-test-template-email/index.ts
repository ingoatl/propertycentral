import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

// Signature configurations
const SIGNATURES = {
  ingo: {
    name: "Ingo Schaer",
    title: "Co-Founder, Operations Manager",
    company: "PeachHaus Group LLC",
    phone: "(404) 800-5932",
    email: "ingo@peachhausgroup.com",
    headshotUrl: "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-headshot.png",
    signatureUrl: "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-signature.png",
  },
  anja: {
    name: "Anja Schaer",
    title: "Co-Founder",
    company: "PeachHaus Group LLC",
    phone: "(404) 800-5932",
    email: "anja@peachhausgroup.com",
    headshotUrl: "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/anja-ingo-hosts.jpg",
    signatureUrl: "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/anja-signature.png",
  },
};

function buildSignatureHtml(signatureType: string): string {
  const sig = signatureType === "anja" ? SIGNATURES.anja : SIGNATURES.ingo;
  
  return `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; margin-top: 30px;">
      <tr>
        <td style="padding-right: 15px; vertical-align: top;">
          <img src="${sig.headshotUrl}" alt="${sig.name}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;" />
        </td>
        <td style="vertical-align: top;">
          <img src="${sig.signatureUrl}" alt="Signature" style="height: 40px; margin-bottom: 5px;" /><br/>
          <strong style="color: #333; font-size: 14px;">${sig.name}</strong><br/>
          <span style="color: #666; font-size: 12px;">${sig.title}</span><br/>
          <span style="color: #666; font-size: 12px;">${sig.company}</span><br/>
          <span style="color: #666; font-size: 12px;">📞 ${sig.phone}</span><br/>
          <a href="mailto:${sig.email}" style="color: #E07A5F; font-size: 12px; text-decoration: none;">${sig.email}</a><br/>
          <a href="https://www.peachhausgroup.com" style="color: #E07A5F; font-size: 12px; text-decoration: none;">www.peachhausgroup.com</a>
        </td>
      </tr>
    </table>
  `;
}

function processTemplateVariables(content: string, testData: Record<string, string>): string {
  let processed = content;
  for (const [key, value] of Object.entries(testData)) {
    processed = processed.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return processed;
}

function buildEmailHtml(bodyContent: string, signatureType: string): string {
  const signatureHtml = buildSignatureHtml(signatureType);
  const htmlBody = bodyContent
    .split("\n")
    .map((line: string) => (line.trim() ? `<p style="margin: 0 0 10px 0;">${line}</p>` : "<br/>"))
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${htmlBody}
      ${signatureHtml}
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { templateId, testEmail, customEmail } = await req.json();

    if (!testEmail) {
      throw new Error("Missing required field: testEmail");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(RESEND_API_KEY);

    let processedSubject: string;
    let emailHtml: string;

    // Handle custom email (no template lookup)
    if (customEmail && customEmail.subject && customEmail.body) {
      processedSubject = `[TEST] ${customEmail.subject}`;
      emailHtml = buildEmailHtml(customEmail.body, "ingo");
    } else if (templateId) {
      // Fetch the template
      const { data: template, error: templateError } = await supabase
        .from("lead_email_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (templateError || !template) {
        throw new Error("Template not found");
      }

      // Test data for variable substitution
      const testData = {
        name: "Test User",
        property_address: "123 Test Street, Atlanta, GA 30309",
        email: testEmail,
        phone: "(555) 123-4567",
        new_str_onboarding_url: "https://app.peachhausgroup.com/new-str-onboarding",
        existing_str_onboarding_url: "https://app.peachhausgroup.com/owner-onboarding",
      };

      // Process template variables
      processedSubject = `[TEST] ${processTemplateVariables(template.subject, testData)}`;
      const processedBody = processTemplateVariables(template.body_content, testData);
      emailHtml = buildEmailHtml(processedBody, template.signature_type);
    } else {
      throw new Error("Either templateId or customEmail is required");
    }

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "PeachHaus <noreply@peachhausgroup.com>",
      to: [testEmail],
      subject: processedSubject,
      html: emailHtml,
    });

    console.log("Test email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, id: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending test email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
