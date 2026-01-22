import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
const TELNYX_PHONE_NUMBER = Deno.env.get("TELNYX_PHONE_NUMBER");

const LOGO_URL = `${supabaseUrl}/storage/v1/object/public/property-images/peachhaus-logo.png`;
const INGO_HEADSHOT_URL = `${supabaseUrl}/storage/v1/object/public/property-images/ingo-headshot.png`;
const IRS_W9_URL = "https://www.irs.gov/pub/irs-pdf/fw9.pdf";

interface W9ReminderRequest {
  type: "owner" | "vendor";
  id: string;
  reminderDay: number; // 1-10 for the 10-day sequence
}

function formatPhoneForTelnyx(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  return phone.startsWith('+') ? phone : `+${cleaned}`;
}

async function sendSMS(phone: string, message: string): Promise<boolean> {
  if (!TELNYX_API_KEY || !TELNYX_PHONE_NUMBER) {
    console.log("Telnyx not configured, skipping SMS");
    return false;
  }

  try {
    const formattedPhone = formatPhoneForTelnyx(phone);
    console.log(`Sending SMS to ${formattedPhone}`);

    const response = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: TELNYX_PHONE_NUMBER,
        to: formattedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SMS send failed:", errorText);
      return false;
    }

    console.log("SMS sent successfully");
    return true;
  } catch (error) {
    console.error("SMS error:", error);
    return false;
  }
}

// Research-based reminder messaging using Cialdini's principles:
// Day 1: Initial request (already sent)
// Day 2: Helpful follow-up (Reciprocity - providing value)
// Day 3: Social proof (Others have completed it)
// Day 4: Commitment nudge (You started this process)
// Day 5: Scarcity/urgency (Deadline approaching)
// Day 6: Authority (IRS requirements)
// Day 7: Personal touch (Direct from Ingo)
// Day 8: Final countdown (3 days left)
// Day 9: Urgency escalation (Tomorrow is deadline)
// Day 10: Last chance (Final opportunity)

interface ReminderContent {
  subject: string;
  headline: string;
  message: string;
  ctaText: string;
  urgencyLevel: "low" | "medium" | "high" | "critical";
  smsMessage: string;
}

function getReminderContent(day: number, firstName: string, uploadUrl: string): ReminderContent {
  const reminders: Record<number, ReminderContent> = {
    // Day 2: Helpful follow-up (Reciprocity)
    2: {
      subject: "Quick reminder: Your W-9 form for PeachHaus",
      headline: "We're Here to Help",
      message: `Hi ${firstName}! Just wanted to follow up on the W-9 form we requested. We know paperwork can slip through the cracks, so we've made it super easy - just click the button below and upload your completed form in under 2 minutes. We've even included a direct link to the official IRS form if you need a fresh copy.`,
      ctaText: "Upload Your W-9 Now",
      urgencyLevel: "low",
      smsMessage: `Hi ${firstName}! Quick reminder about your W-9 for PeachHaus. Takes just 2 min to upload: ${uploadUrl} - Ingo`,
    },
    // Day 3: Social Proof
    3: {
      subject: "Most property owners have already submitted their W-9",
      headline: "Join 90% of Our Partners",
      message: `Hi ${firstName}! Great news - most of our property owners have already submitted their W-9 forms this season. It only takes a couple of minutes, and you'll be all set for tax season. Don't let this small task linger - let's get it checked off your list today!`,
      ctaText: "Complete Your W-9",
      urgencyLevel: "low",
      smsMessage: `${firstName}, 90% of our partners have submitted their W-9! Join them - takes 2 min: ${uploadUrl} - PeachHaus`,
    },
    // Day 4: Commitment/Consistency
    4: {
      subject: "One step away from completing your tax paperwork",
      headline: "You're Almost There!",
      message: `Hi ${firstName}! You've already taken the first step by working with PeachHaus. Now there's just one quick thing left to complete your tax documentation. Once your W-9 is on file, you're all set - no more follow-ups, no more reminders. Let's finish what we started!`,
      ctaText: "Finish Your W-9 Now",
      urgencyLevel: "medium",
      smsMessage: `${firstName}, you're 1 step away from completing your tax docs! Quick upload here: ${uploadUrl} - PeachHaus`,
    },
    // Day 5: Scarcity/Urgency
    5: {
      subject: "⏰ W-9 deadline reminder - 5 days remaining",
      headline: "Time Is Running Short",
      message: `Hi ${firstName}! We're now 5 days from our internal deadline for W-9 collection. To ensure we can prepare your 1099 accurately and on time for IRS filing, we need your W-9 form as soon as possible. This protects both of us from potential IRS penalties.`,
      ctaText: "Submit W-9 Today",
      urgencyLevel: "medium",
      smsMessage: `⏰ ${firstName}, 5 days left for W-9! Avoid delays - upload now: ${uploadUrl} - PeachHaus`,
    },
    // Day 6: Authority
    6: {
      subject: "IRS Requirement: W-9 needed for your 1099",
      headline: "IRS Compliance Required",
      message: `Hi ${firstName}! The IRS requires us to collect W-9 forms from all payees receiving $600 or more. Without your W-9, we cannot issue your 1099-NEC, which could result in backup withholding at 24% on future payments. Please submit your W-9 today to avoid any complications.`,
      ctaText: "Submit W-9 for Compliance",
      urgencyLevel: "high",
      smsMessage: `📋 ${firstName}, IRS requires your W-9 for 1099 filing. Avoid 24% backup withholding: ${uploadUrl} - PeachHaus`,
    },
    // Day 7: Personal Touch
    7: {
      subject: "Personal note from Ingo about your W-9",
      headline: "A Quick Personal Note",
      message: `Hi ${firstName}! This is Ingo personally reaching out. I noticed your W-9 is still pending, and I wanted to check if you're having any trouble with the upload process or have questions about the form. We truly value our partnership, and I want to make sure this doesn't become a tax headache for you. Feel free to reply to this email or call me directly at (404) 800-5932.`,
      ctaText: "Upload W-9 or Reply for Help",
      urgencyLevel: "high",
      smsMessage: `${firstName}, this is Ingo. Still need your W-9 - call me at (404) 800-5932 if you need help, or upload here: ${uploadUrl}`,
    },
    // Day 8: Final Countdown
    8: {
      subject: "🚨 3 days left: W-9 urgently needed",
      headline: "Only 3 Days Remaining",
      message: `Hi ${firstName}! We're down to the final 3 days before our W-9 collection deadline. After this point, we may not be able to include you in our standard 1099 processing batch, which could delay your tax documents. Please take 2 minutes right now to upload your W-9.`,
      ctaText: "Upload W-9 Immediately",
      urgencyLevel: "high",
      smsMessage: `🚨 ${firstName}! 3 DAYS LEFT for W-9. Don't miss the deadline: ${uploadUrl} - PeachHaus`,
    },
    // Day 9: Tomorrow
    9: {
      subject: "⚠️ TOMORROW: Final W-9 deadline",
      headline: "Tomorrow Is the Deadline",
      message: `Hi ${firstName}! Tomorrow is our final deadline for W-9 collection. If we don't receive your form by end of day tomorrow, your 1099 processing may be delayed, and you could face IRS complications. Please submit your W-9 TODAY to avoid any issues.`,
      ctaText: "Submit W-9 NOW",
      urgencyLevel: "critical",
      smsMessage: `⚠️ URGENT ${firstName}! W-9 deadline TOMORROW. Submit NOW: ${uploadUrl} - PeachHaus`,
    },
    // Day 10: Last Chance
    10: {
      subject: "🔴 FINAL NOTICE: Last chance to submit W-9",
      headline: "Final Notice - Last Chance",
      message: `Hi ${firstName}! This is our final notice. Today is the last day to submit your W-9 for timely 1099 processing. Without your W-9 on file, we cannot guarantee your 1099 will be issued on time, which may result in IRS penalties for both of us. Please submit your W-9 immediately.`,
      ctaText: "SUBMIT W-9 IMMEDIATELY",
      urgencyLevel: "critical",
      smsMessage: `🔴 FINAL NOTICE ${firstName}! Last day for W-9. Submit NOW or risk IRS penalties: ${uploadUrl} - PeachHaus`,
    },
  };

  return reminders[day] || reminders[2];
}

function buildReminderEmailHtml(
  firstName: string,
  uploadUrl: string,
  content: ReminderContent
): string {
  const urgencyColors = {
    low: { bg: "#f0fdf4", border: "#86efac", text: "#166534" },
    medium: { bg: "#fef9c3", border: "#fde047", text: "#854d0e" },
    high: { bg: "#fed7aa", border: "#fb923c", text: "#9a3412" },
    critical: { bg: "#fecaca", border: "#f87171", text: "#991b1b" },
  };

  const colors = urgencyColors[content.urgencyLevel];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); padding: 32px; text-align: center;">
                  <img src="${LOGO_URL}" alt="PeachHaus" style="height: 48px; margin-bottom: 16px;" />
                  <div style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">${content.headline}</div>
                </td>
              </tr>

              <!-- Message -->
              <tr>
                <td style="padding: 32px;">
                  <div style="font-size: 14px; color: #374151; line-height: 1.8;">
                    ${content.message}
                  </div>
                </td>
              </tr>

              <!-- CTA Button -->
              <tr>
                <td style="padding: 0 32px 24px 32px; text-align: center;">
                  <a href="${uploadUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);">
                    📤 ${content.ctaText}
                  </a>
                </td>
              </tr>

              <!-- IRS Form Link -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center;">
                    <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">Need a blank W-9 form?</div>
                    <a href="${IRS_W9_URL}" style="color: #2563eb; text-decoration: none; font-weight: 500; font-size: 14px;">
                      📄 Download from IRS.gov
                    </a>
                  </div>
                </td>
              </tr>

              <!-- Urgency Notice -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="background: ${colors.bg}; border: 1px solid ${colors.border}; border-radius: 8px; padding: 16px 20px; text-align: center;">
                    <div style="font-size: 14px; color: ${colors.text}; font-weight: 500;">
                      ⏰ <strong>Deadline:</strong> December 15th for timely 1099 processing
                    </div>
                  </div>
                </td>
              </tr>

              <!-- Signature -->
              <tr>
                <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align: top; padding-right: 16px;">
                        <img src="${INGO_HEADSHOT_URL}" alt="Ingo" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover;" />
                      </td>
                      <td style="vertical-align: top; border-left: 3px solid #2563eb; padding-left: 12px;">
                        <div style="font-weight: 700; font-size: 14px; color: #111827;">Ingo Schaer</div>
                        <div style="font-size: 12px; color: #6b7280;">Co-Founder, Operations Manager</div>
                        <div style="font-size: 12px; color: #111827; margin-top: 4px;">PeachHaus Group LLC</div>
                        <div style="font-size: 12px; margin-top: 4px;">
                          <a href="tel:+14048005932" style="color: #111827; text-decoration: none;">(404) 800-5932</a> · 
                          <a href="mailto:ingo@peachhausgroup.com" style="color: #2563eb; text-decoration: none;">ingo@peachhausgroup.com</a>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <div style="font-size: 11px; color: #9ca3af;">
                    © ${new Date().getFullYear()} PeachHaus Group LLC · Atlanta, GA<br/>
                    <span style="color: #6b7280;">This is a tax compliance reminder.</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-w9-reminder function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, id, reminderDay }: W9ReminderRequest = await req.json();
    console.log(`Processing W-9 reminder day ${reminderDay} for ${type}:`, id);

    if (!type || !id || !reminderDay) {
      throw new Error("type, id, and reminderDay are required");
    }

    if (reminderDay < 2 || reminderDay > 10) {
      throw new Error("reminderDay must be between 2 and 10");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let entity: any;
    let uploadUrl: string;
    let firstName: string;
    let email: string;
    let phone: string | null;

    if (type === "owner") {
      const { data: owner, error } = await supabase
        .from("property_owners")
        .select("id, name, email, phone, owner_w9_uploaded_at")
        .eq("id", id)
        .single();

      if (error || !owner) {
        throw new Error("Owner not found");
      }

      // Skip if W-9 already uploaded
      if (owner.owner_w9_uploaded_at) {
        return new Response(
          JSON.stringify({ success: true, message: "W-9 already received, skipping reminder" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      entity = owner;
      email = owner.email;
      phone = owner.phone;
      firstName = owner.name.split(" ")[0];

      // Get existing token
      const { data: token } = await supabase
        .from("owner_w9_tokens")
        .select("token")
        .eq("owner_id", id)
        .gt("expires_at", new Date().toISOString())
        .single();

      uploadUrl = token?.token
        ? `https://propertycentral.lovable.app/owner/w9-upload?token=${token.token}`
        : "https://propertycentral.lovable.app";

    } else {
      const { data: vendor, error } = await supabase
        .from("vendors")
        .select("id, name, company_name, email, phone, w9_received_at, w9_on_file")
        .eq("id", id)
        .single();

      if (error || !vendor) {
        throw new Error("Vendor not found");
      }

      // Skip if W-9 already on file
      if (vendor.w9_received_at || vendor.w9_on_file) {
        return new Response(
          JSON.stringify({ success: true, message: "W-9 already received, skipping reminder" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      entity = vendor;
      email = vendor.email;
      phone = vendor.phone;
      firstName = vendor.name.split(" ")[0];

      // Get existing token
      const { data: token } = await supabase
        .from("vendor_w9_tokens")
        .select("token")
        .eq("vendor_id", id)
        .gt("expires_at", new Date().toISOString())
        .single();

      uploadUrl = token?.token
        ? `https://propertycentral.lovable.app/vendor/w9-upload?token=${token.token}`
        : "https://propertycentral.lovable.app";
    }

    if (!email) {
      throw new Error("No email address on file");
    }

    // Get reminder content based on day
    const content = getReminderContent(reminderDay, firstName, uploadUrl);

    // Build and send email
    const emailHtml = buildReminderEmailHtml(firstName, uploadUrl, content);

    const emailResponse = await resend.emails.send({
      from: "PeachHaus Group LLC - Ingo Schaer <ingo@peachhausgroup.com>",
      to: [email],
      subject: content.subject,
      html: emailHtml,
    });

    if (emailResponse.error) {
      throw new Error(`Email failed: ${emailResponse.error.message}`);
    }

    console.log("Reminder email sent:", emailResponse);

    // Send SMS if phone exists
    let smsSent = false;
    if (phone) {
      smsSent = await sendSMS(phone, content.smsMessage);
    }

    // Log communication
    await supabase.from("lead_communications").insert({
      communication_type: "email",
      direction: "outbound",
      subject: content.subject,
      body: `W-9 reminder day ${reminderDay}${smsSent ? ' (SMS also sent)' : ''}`,
      recipient_email: email,
      owner_id: type === "owner" ? id : null,
      vendor_id: type === "vendor" ? id : null,
      status: "sent",
      metadata: {
        email_type: "w9_reminder",
        reminder_day: reminderDay,
        urgency_level: content.urgencyLevel,
        message_id: emailResponse.data?.id,
        sms_sent: smsSent,
      },
    });

    // Update last reminder sent timestamp
    if (type === "owner") {
      await supabase
        .from("property_owners")
        .update({ w9_last_reminder_at: new Date().toISOString() })
        .eq("id", id);
    } else {
      await supabase
        .from("vendors")
        .update({ w9_last_reminder_at: new Date().toISOString() })
        .eq("id", id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `W-9 reminder day ${reminderDay} sent to ${email}${smsSent ? ' and SMS' : ''}`,
        reminderDay,
        urgencyLevel: content.urgencyLevel,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-w9-reminder:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);