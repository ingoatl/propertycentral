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

const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";
const HOSTS_PHOTO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-headshot.png";
const SIGNATURE_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-signature.png";
const GOOGLE_MEET_LINK = "https://meet.google.com/jww-deey-iaa";

// Signature configurations
const SIGNATURES = {
  ingo: {
    name: "Ingo Schaer",
    title: "Co-Founder, Operations Manager",
    company: "PeachHaus Group LLC",
    phone: "(404) 800-5932",
    email: "ingo@peachhausgroup.com",
    headshotUrl: HOSTS_PHOTO_URL,
    signatureUrl: SIGNATURE_URL,
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

// Build Fortune 500 / Owner Statement style email for call confirmations
function buildCallConfirmationEmail(data: {
  contactName: string;
  meetingType: "video" | "phone";
  date: string;
  time: string;
  contactPhone?: string;
  contactEmail?: string;
  contactType?: string;
  leadId?: string;
  scheduledBy?: string;
}): string {
  const confirmationId = `CALL-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const isVideoCall = data.meetingType === "video";
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Call Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
          
          <!-- Header - Corporate Minimal with Logo -->
          <div style="padding: 24px 32px; border-bottom: 2px solid #111111;">
            <table style="width: 100%;">
              <tr>
                <td style="vertical-align: middle;">
                  <img src="${LOGO_URL}" alt="PeachHaus" style="height: 40px; width: auto;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                  <div style="display: none; font-size: 20px; font-weight: 700; color: #111111; letter-spacing: -0.3px;">PeachHaus</div>
                </td>
                <td style="text-align: right; vertical-align: middle;">
                  <div style="font-size: 16px; font-weight: 600; color: #111111; margin-bottom: 4px;">CALL CONFIRMED</div>
                  <div style="font-size: 10px; color: #666666; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
                    ${confirmationId}
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Call Details Section -->
          <div style="padding: 20px 32px; background: #f9f9f9; border-bottom: 1px solid #e5e5e5;">
            <table style="width: 100%;">
              <tr>
                <td style="vertical-align: top; width: 50%;">
                  <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Scheduled For</div>
                  <div style="font-size: 14px; font-weight: 600; color: #111111;">${data.date}</div>
                  <div style="font-size: 12px; color: #666666; margin-top: 2px;">${data.time} EST</div>
                </td>
                <td style="vertical-align: top; text-align: right;">
                  <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Meeting Type</div>
                  <div style="font-size: 14px; font-weight: 600; color: #111111;">${isVideoCall ? '📹 Video Call' : '📞 Phone Call'}</div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Greeting -->
          <div style="padding: 24px 32px 16px 32px;">
            <p style="font-size: 14px; line-height: 1.6; color: #111111; margin: 0;">
              Dear ${data.contactName},
            </p>
            <p style="font-size: 13px; line-height: 1.6; color: #444444; margin: 12px 0 0 0;">
              Thank you for scheduling a ${isVideoCall ? 'video' : 'phone'} call with PeachHaus. We're looking forward to learning about your property and discussing how we can help maximize your investment.
            </p>
          </div>

          <!-- Call Details Table -->
          <div style="padding: 0 32px 24px 32px;">
            <div style="font-size: 11px; font-weight: 600; color: #111111; padding: 8px 0; border-bottom: 1px solid #111111; text-transform: uppercase; letter-spacing: 0.5px;">
              Call Details
            </div>
            <table style="width: 100%;">
              <tr>
                <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5; width: 140px;">Date & Time</td>
                <td style="padding: 12px 0; font-size: 13px; color: #111111; font-weight: 600; border-bottom: 1px solid #e5e5e5;">${data.date} at ${data.time} EST</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Meeting Type</td>
                <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
                  ${isVideoCall ? 'Video Call (Google Meet)' : `Phone Call to ${data.contactPhone || 'your number'}`}
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Contact</td>
                <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
                  ${data.contactName}<br/>
                  <span style="color: #666666;">${data.contactPhone || 'No phone'} · ${data.contactEmail || 'No email'}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Duration</td>
                <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">30 minutes</td>
              </tr>
              ${data.scheduledBy ? `
              <tr>
                <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Scheduled By</td>
                <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">${data.scheduledBy}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          ${isVideoCall ? `
          <!-- Video Call CTA -->
          <div style="padding: 0 32px 24px 32px;">
            <div style="text-align: center; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0;">
              <p style="font-size: 12px; color: #166534; margin: 0 0 12px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">JOIN VIDEO CALL</p>
              <a href="${GOOGLE_MEET_LINK}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 32px; text-decoration: none; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">
                Open Google Meet
              </a>
              <p style="font-size: 11px; color: #666666; margin: 12px 0 0 0; font-family: 'SF Mono', Menlo, monospace;">${GOOGLE_MEET_LINK}</p>
            </div>
          </div>
          ` : ''}

          <!-- Calendar Confirmation Notice -->
          <div style="padding: 0 32px 24px 32px;">
            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 4px; padding: 16px;">
              <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 600;">
                📅 Important: Confirm Your Calendar Invite
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #a16207;">
                You'll receive a separate Google Calendar invitation for this call. Please click <strong>"Yes"</strong> to confirm your attendance. This helps us ensure our meeting is on your calendar and you'll receive reminders.
              </p>
            </div>
          </div>

          <!-- What to Expect -->
          <div style="padding: 0 32px 24px 32px;">
            <div style="font-size: 11px; font-weight: 600; color: #111111; padding: 8px 0; border-bottom: 1px solid #111111; text-transform: uppercase; letter-spacing: 0.5px;">
              What to Expect
            </div>
            <ul style="margin: 16px 0 0 0; padding-left: 20px; color: #444444; font-size: 13px; line-height: 1.8;">
              <li>Discussion of your property's rental potential</li>
              <li>Overview of our management approach</li>
              <li>Custom revenue estimate for your property</li>
              <li>Answers to all your questions</li>
            </ul>
            <p style="margin: 16px 0 0 0; font-size: 12px; color: #666666; font-style: italic;">
              Note: This call may be recorded for quality and training purposes.
            </p>
          </div>

          <!-- Signature Section -->
          <div style="padding: 24px 32px; border-top: 1px solid #e5e5e5;">
            <table style="width: 100%;">
              <tr>
                <td style="vertical-align: middle; width: 70px;">
                  <img src="${HOSTS_PHOTO_URL}" alt="Ingo Schaer" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid #e5e5e5;">
                </td>
                <td style="vertical-align: middle; padding-left: 16px;">
                  <p style="margin: 0; font-size: 13px; color: #111111; font-weight: 600;">Looking forward to speaking with you,</p>
                  <img src="${SIGNATURE_URL}" alt="Signature" style="height: 32px; margin: 8px 0;">
                  <p style="margin: 0; font-size: 12px; color: #666666;">PeachHaus Property Management</p>
                  <p style="margin: 4px 0 0 0; font-size: 11px; color: #888888;">(404) 800-5932 · info@peachhausgroup.com</p>
                </td>
              </tr>
            </table>
          </div>

          <!-- Footer -->
          <div style="padding: 16px 32px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #666666;">
              PeachHaus Property Management · Atlanta, Georgia
            </p>
          </div>
        </div>
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

    // Handle custom email for call confirmations (Fortune 500 style)
    if (customEmail && customEmail.subject && customEmail.body) {
      // Check if this is a call confirmation email
      if (customEmail.subject.includes("Call Scheduled") || customEmail.subject.includes("Video Call") || customEmail.subject.includes("Phone Call")) {
        // Parse the body to extract details
        const bodyLines = customEmail.body.split("\n");
        const dateLine = bodyLines.find((l: string) => l.includes("📅 Date:"));
        const timeLine = bodyLines.find((l: string) => l.includes("🕐 Time:"));
        const nameLine = bodyLines.find((l: string) => l.includes("• Name:"));
        const phoneLine = bodyLines.find((l: string) => l.includes("• Phone:"));
        const emailLine = bodyLines.find((l: string) => l.includes("• Email:"));
        const scheduledByLine = bodyLines.find((l: string) => l.includes("Scheduled by:"));
        
        const contactName = nameLine?.split(":")[1]?.trim() || customEmail.body.split("!")[0]?.replace("Hi ", "") || "Contact";
        const date = dateLine?.split(":").slice(1).join(":").trim() || "TBD";
        const time = timeLine?.split(":").slice(1).join(":").trim().replace(" EST", "") || "TBD";
        const phone = phoneLine?.split(":")[1]?.trim() || undefined;
        const email = emailLine?.split(":")[1]?.trim() || undefined;
        const scheduledBy = scheduledByLine?.split(":")[1]?.trim() || undefined;
        const isVideo = customEmail.subject.includes("Video") || customEmail.body.includes("video");
        
        processedSubject = `[TEST] ${customEmail.subject}`;
        emailHtml = buildCallConfirmationEmail({
          contactName,
          meetingType: isVideo ? "video" : "phone",
          date,
          time,
          contactPhone: phone,
          contactEmail: email,
          scheduledBy,
        });
      } else {
        processedSubject = `[TEST] ${customEmail.subject}`;
        emailHtml = buildEmailHtml(customEmail.body, "ingo");
      }
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
      from: "PeachHaus <info@peachhausgroup.com>",
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