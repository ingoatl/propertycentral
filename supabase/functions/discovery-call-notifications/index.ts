import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_MEET_LINK = "https://meet.google.com/jww-deey-iaa";
const HOSTS_PHOTO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-headshot.png";
const SIGNATURE_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-signature.png";
const FRONTEND_URL = "https://preview--peachhaus-property-central.lovable.app";
const BOOKING_URL = "https://propertycentral.lovable.app/book-discovery-call";
const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";
const FROM_EMAIL = "PeachHaus <info@peachhausgroup.com>";
const RESCHEDULE_BASE_URL = "https://propertycentral.lovable.app/reschedule";
const OWNER_PITCH_URL = "https://propertycentral.lovable.app/onboarding-presentation";

interface DiscoveryCallNotificationRequest {
  discoveryCallId: string;
  notificationType: "confirmation" | "admin_notification" | "reminder_24h" | "reminder_1h" | "reminder_48h" | "reschedule_confirmation";
  oldScheduledAt?: string;
}

// Intelligent name personalization - NEVER use "Hi Unknown"
function getPersonalizedGreeting(lead: any): { firstName: string; greeting: string; formalGreeting: string } {
  const fullName = lead?.name?.trim() || '';
  
  if (fullName && fullName.toLowerCase() !== 'unknown') {
    const firstName = fullName.split(' ')[0];
    return { 
      firstName, 
      greeting: `Hi ${firstName}`,
      formalGreeting: `Dear ${firstName}`
    };
  }
  
  // Fallback: Extract name from email prefix
  const email = lead?.email || '';
  if (email) {
    const emailPrefix = email.split('@')[0] || '';
    // Clean up email prefix - remove numbers, dots, underscores
    const cleanName = emailPrefix
      .replace(/[0-9._-]/g, ' ')
      .trim()
      .split(' ')[0];
    
    if (cleanName && cleanName.length >= 2) {
      const capitalizedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
      return {
        firstName: capitalizedName,
        greeting: `Hi ${capitalizedName}`,
        formalGreeting: `Dear ${capitalizedName}`
      };
    }
  }
  
  // Ultimate fallback - warm but generic
  return { 
    firstName: 'there', 
    greeting: 'Hi there',
    formalGreeting: 'Hello'
  };
}

// Get property context for personalized messaging
function getPropertyContext(lead: any): string {
  if (lead?.property_address) {
    return ` regarding your property at ${lead.property_address}`;
  }
  return '';
}

// Calculate revenue potential score based on property location and type
function calculateRevenueScore(propertyAddress: string, propertyType: string | null): { score: number; reasoning: string } {
  let score = 50;
  const reasons: string[] = [];

  const address = propertyAddress?.toLowerCase() || "";
  
  if (address.includes("atlanta") || address.includes("buckhead") || address.includes("midtown")) {
    score += 20;
    reasons.push("Prime Atlanta location (+20)");
  } else if (address.includes("marietta") || address.includes("decatur") || address.includes("sandy springs")) {
    score += 15;
    reasons.push("Excellent suburban location (+15)");
  } else if (address.includes("alpharetta") || address.includes("roswell") || address.includes("dunwoody")) {
    score += 12;
    reasons.push("Strong suburban market (+12)");
  }

  if (propertyType === "single_family") {
    score += 15;
    reasons.push("Single family home - high demand (+15)");
  } else if (propertyType === "condo") {
    score += 10;
    reasons.push("Condo - good urban appeal (+10)");
  } else if (propertyType === "townhouse") {
    score += 12;
    reasons.push("Townhouse - family friendly (+12)");
  }

  score = Math.min(score, 100);

  return {
    score,
    reasoning: reasons.length > 0 ? reasons.join(", ") : "Standard market potential",
  };
}

// Generate static map URL for email
function getStaticMapUrl(address: string): string {
  const encodedAddress = encodeURIComponent(address);
  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY") || "";
  return `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=15&size=600x300&maptype=roadmap&markers=color:red%7C${encodedAddress}&key=${apiKey}`;
}

// Generate zoomable map link
function getGoogleMapsLink(address: string): string {
  const encodedAddress = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
}

// Format date/time in EST - consistent across all messages
function formatInEST(date: Date): { date: string; time: string; dateTime: string } {
  const estDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const estTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  const formattedDate = estDateFormatter.format(date);
  const formattedTime = estTimeFormatter.format(date) + " EST";
  
  return {
    date: formattedDate,
    time: formattedTime,
    dateTime: `${formattedDate} at ${formattedTime}`
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { discoveryCallId, notificationType, oldScheduledAt }: DiscoveryCallNotificationRequest = await req.json();
    const rescheduleUrl = `${RESCHEDULE_BASE_URL}/${discoveryCallId}`;

    // Fetch discovery call with lead info
    const { data: call, error: callError } = await supabase
      .from("discovery_calls")
      .select(`
        *,
        leads (
          id, name, email, phone, property_address, property_type, opportunity_value
        )
      `)
      .eq("id", discoveryCallId)
      .single();

    if (callError || !call) {
      throw new Error(`Discovery call not found: ${callError?.message}`);
    }

    const lead = call.leads;
    const scheduledAt = new Date(call.scheduled_at);
    
    // Get personalized greeting (never "Unknown")
    const { firstName, greeting, formalGreeting } = getPersonalizedGreeting(lead);
    const propertyContext = getPropertyContext(lead);
    
    // Format times in EST
    const { date: formattedDate, time: formattedTime, dateTime: formattedDateTime } = formatInEST(scheduledAt);

    const isVideoCall = call.meeting_type === "video";
    const meetingDetails = isVideoCall
      ? `<p><strong>📹 Video Call:</strong> <a href="${GOOGLE_MEET_LINK}" style="color: #4CAF50; font-weight: bold;">${GOOGLE_MEET_LINK}</a></p>`
      : `<p><strong>📞 Phone Call:</strong> We will call you at ${lead?.phone || "your phone number"}</p>`;

    const serviceInterestText = call.service_interest === "property_management" 
      ? "Full Property Management" 
      : call.service_interest === "cohosting" 
        ? "Co-hosting Partnership" 
        : "To be discussed";

    if (notificationType === "confirmation") {
      // Send confirmation to the lead - Fortune 500 / Owner Statement style
      if (lead?.email) {
        console.log("Sending confirmation email to:", lead.email);
        const confirmationId = `CALL-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${discoveryCallId.slice(0, 6).toUpperCase()}`;
        
        const emailResult = await resend.emails.send({
          from: FROM_EMAIL,
          to: [lead.email],
          subject: `Discovery Call Confirmed - ${formattedDate}`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Discovery Call Confirmed</title>
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
                          <div style="font-size: 14px; font-weight: 600; color: #111111;">${formattedDate}</div>
                          <div style="font-size: 12px; color: #666666; margin-top: 2px;">${formattedTime}</div>
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
                      ${formalGreeting},
                    </p>
                    <p style="font-size: 13px; line-height: 1.6; color: #444444; margin: 12px 0 0 0;">
                      Thank you for scheduling a discovery call with PeachHaus${propertyContext}. We're looking forward to learning about your property and discussing how we can help maximize your investment.
                    </p>
                  </div>

                  <!-- Pre-Call Preparation Section - Owner Pitch Presentation -->
                  <div style="padding: 0 32px 24px 32px;">
                    <div style="background: linear-gradient(135deg, #fef9e7 0%, #fff8e1 100%); border: 1px solid #f9e79f; border-radius: 8px; padding: 20px;">
                      <p style="margin: 0; font-size: 14px; color: #7d6608; font-weight: 600;">
                        📊 Prepare for Your Call
                      </p>
                      <p style="margin: 10px 0 14px 0; font-size: 13px; color: #9a7b0a; line-height: 1.5;">
                        Take 5 minutes to explore what PeachHaus can do for your property. See how we've helped other Atlanta property owners maximize their rental income.
                      </p>
                      <a href="${OWNER_PITCH_URL}" style="display: inline-block; background: linear-gradient(135deg, #f1c40f 0%, #d4ac0d 100%); color: #7d6608; padding: 12px 24px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 6px; box-shadow: 0 2px 4px rgba(241, 196, 15, 0.3);">
                        View Owner Presentation →
                      </a>
                    </div>
                  </div>

                  <!-- Call Details Table -->
                  <div style="padding: 0 32px 24px 32px;">
                    <div style="font-size: 11px; font-weight: 600; color: #111111; padding: 8px 0; border-bottom: 1px solid #111111; text-transform: uppercase; letter-spacing: 0.5px;">
                      Call Details
                    </div>
                    <table style="width: 100%;">
                      <tr>
                        <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5; width: 140px;">Date & Time</td>
                        <td style="padding: 12px 0; font-size: 13px; color: #111111; font-weight: 600; border-bottom: 1px solid #e5e5e5;">${formattedDateTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Meeting Type</td>
                        <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
                          ${isVideoCall ? 'Video Call (Google Meet)' : `Phone Call to ${lead.phone || 'your number'}`}
                        </td>
                      </tr>
                      ${lead.property_address ? `
                      <tr>
                        <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Property</td>
                        <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">${lead.property_address}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Duration</td>
                        <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">30 minutes</td>
                      </tr>
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

                  <!-- Reschedule Option -->
                  <div style="padding: 0 32px 24px 32px;">
                    <div style="text-align: center; padding: 16px; background: #f5f5f5; border: 1px solid #e5e5e5; border-radius: 4px;">
                      <p style="font-size: 12px; color: #666666; margin: 0 0 8px 0;">Need to reschedule?</p>
                      <a href="${rescheduleUrl}" style="display: inline-block; background: #6b7280; color: white; padding: 8px 20px; text-decoration: none; font-size: 12px; font-weight: 500; border-radius: 4px;">
                        Reschedule Call
                      </a>
                    </div>
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
          `,
        });
        console.log("Confirmation email result:", JSON.stringify(emailResult));
        
        // Send SMS with pitch link
        if (lead?.phone) {
          try {
            await supabase.functions.invoke("send-sms", {
              body: {
                to: lead.phone,
                message: `${greeting}! Your PeachHaus call is confirmed for ${formattedDate} at ${formattedTime}. Before we chat, check out what we can do for your property: ${OWNER_PITCH_URL} ${isVideoCall ? `Join: ${GOOGLE_MEET_LINK}` : "We'll call you!"} - Ingo`,
              },
            });
          } catch (smsError) {
            console.error("SMS confirmation failed:", smsError);
          }
        }

        // Mark confirmation sent
        await supabase
          .from("discovery_calls")
          .update({ confirmation_email_sent: true, confirmation_sent: true })
          .eq("id", discoveryCallId);

        // Auto-schedule Recall.ai bot for video calls at confirmation time
        if (isVideoCall) {
          try {
            console.log("Auto-scheduling Recall.ai bot for video call:", discoveryCallId);
            const recallResult = await supabase.functions.invoke("recall-auto-schedule-bot", {
              body: { discoveryCallId },
            });
            console.log("Recall auto-schedule result:", recallResult.data);
          } catch (recallError) {
            console.error("Failed to auto-schedule Recall bot:", recallError);
          }
        }
      }
    }

    if (notificationType === "admin_notification") {
      // Send admin notification with owner statement styling
      const revenueData = calculateRevenueScore(lead?.property_address || "", lead?.property_type);
      const mapsLink = getGoogleMapsLink(lead?.property_address || "");
      const scoreColor = revenueData.score >= 75 ? "#2e7d32" : revenueData.score >= 50 ? "#ed6c02" : "#d32f2f";
      const callId = `CALL-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${discoveryCallId.slice(0, 6).toUpperCase()}`;

      console.log("Sending admin notification email to: info@peachhausgroup.com, alex@peachhausgroup.com, anja@peachhausgroup.com");
      const adminEmailResult = await resend.emails.send({
        from: FROM_EMAIL,
        to: ["info@peachhausgroup.com", "alex@peachhausgroup.com", "anja@peachhausgroup.com"],
        subject: `New Discovery Call Booked - ${lead?.name || firstName}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Discovery Call Notification</title>
            </head>
            <body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;">
              <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
                
                <!-- Header - Corporate Minimal -->
                <div style="padding: 24px 32px; border-bottom: 2px solid #111111;">
                  <table style="width: 100%;">
                    <tr>
                      <td style="vertical-align: middle;">
                        <img src="${LOGO_URL}" alt="PeachHaus" style="height: 40px; width: auto;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                        <div style="display: none; font-size: 20px; font-weight: 700; color: #111111; letter-spacing: -0.3px;">PeachHaus</div>
                      </td>
                      <td style="text-align: right; vertical-align: middle;">
                        <div style="font-size: 16px; font-weight: 600; color: #111111; margin-bottom: 4px;">DISCOVERY CALL</div>
                        <div style="font-size: 10px; color: #666666; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
                          ${callId}
                        </div>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Lead Info Section -->
                <div style="padding: 20px 32px; background: #f9f9f9; border-bottom: 1px solid #e5e5e5;">
                  <table style="width: 100%;">
                    <tr>
                      <td style="vertical-align: top; width: 60%;">
                        <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Lead</div>
                        <div style="font-size: 18px; font-weight: 600; color: #111111;">${lead?.name || firstName}</div>
                        <div style="font-size: 12px; color: #666666; margin-top: 4px;">
                          ${lead?.email || ""} ${lead?.phone ? `• ${lead.phone}` : ""}
                        </div>
                      </td>
                      <td style="vertical-align: top; text-align: right;">
                        <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Revenue Score</div>
                        <div style="display: inline-block; background: ${scoreColor}; color: white; padding: 8px 16px; border-radius: 4px; font-family: 'SF Mono', Menlo, monospace;">
                          <span style="font-size: 20px; font-weight: 700;">${revenueData.score}</span>
                          <span style="font-size: 10px;">/100</span>
                        </div>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Call Details -->
                <div style="padding: 24px 32px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5; width: 140px;">Scheduled Date</td>
                      <td style="padding: 12px 0; font-size: 13px; color: #111111; font-weight: 600; border-bottom: 1px solid #e5e5e5;">${formattedDate}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Time</td>
                      <td style="padding: 12px 0; font-size: 13px; color: #111111; font-weight: 600; border-bottom: 1px solid #e5e5e5;">${formattedTime}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Meeting Type</td>
                      <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
                        ${isVideoCall ? "📹 Video Call (Google Meet)" : "📞 Phone Call"}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Service Interest</td>
                      <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">${serviceInterestText}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Timeline</td>
                      <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">${call.start_timeline || "Not specified"}</td>
                    </tr>
                    ${lead?.property_address ? `
                    <tr>
                      <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Property</td>
                      <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
                        <a href="${mapsLink}" style="color: #2563eb; text-decoration: none;">${lead.property_address}</a>
                      </td>
                    </tr>
                    ` : ""}
                    ${call.meeting_notes ? `
                    <tr>
                      <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5; vertical-align: top;">Notes</td>
                      <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">${call.meeting_notes}</td>
                    </tr>
                    ` : ""}
                  </table>

                  <!-- Revenue Analysis Box -->
                  <div style="background: #f9f9f9; border: 1px solid #e5e5e5; padding: 16px; margin-top: 20px;">
                    <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Revenue Potential Analysis</div>
                    <div style="background: #e0e0e0; border-radius: 4px; overflow: hidden; margin: 8px 0;">
                      <div style="background: ${scoreColor}; height: 8px; width: ${revenueData.score}%;"></div>
                    </div>
                    <p style="font-size: 12px; color: #666666; margin: 8px 0 0 0;">${revenueData.reasoning}</p>
                  </div>

                  ${isVideoCall ? `
                  <!-- Meeting Link -->
                  <div style="text-align: center; margin-top: 24px; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0;">
                    <p style="font-size: 12px; color: #166534; margin: 0 0 12px 0; font-weight: 600;">JOIN VIDEO CALL</p>
                    <a href="${GOOGLE_MEET_LINK}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 32px; text-decoration: none; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">
                      Open Google Meet
                    </a>
                    <p style="font-size: 11px; color: #666666; margin: 12px 0 0 0; font-family: 'SF Mono', Menlo, monospace;">${GOOGLE_MEET_LINK}</p>
                  </div>
                  ` : ""}
                </div>

                <!-- Footer -->
                <div style="padding: 16px 32px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
                  <p style="margin: 0; font-size: 11px; color: #666666;">
                    PeachHaus Property Management • Atlanta, Georgia
                  </p>
                </div>
              </div>
            </body>
          </html>
        `,
      });
      console.log("Admin email result:", JSON.stringify(adminEmailResult));
    }

    // Handle reschedule confirmation
    if (notificationType === "reschedule_confirmation") {
      const oldDate = oldScheduledAt ? new Date(oldScheduledAt) : null;
      
      // Format old date/time in EST
      const oldFormatted = oldDate ? formatInEST(oldDate) : null;

      if (lead?.email) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: [lead.email],
          subject: `✅ Call Rescheduled - New Time: ${formattedDate} at ${formattedTime}`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="margin: 0; padding: 0; background: #f5f5f5; font-family: Georgia, 'Times New Roman', serif;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
                  
                  <!-- Header -->
                  <div style="background: linear-gradient(135deg, #b8956a 0%, #c9a87a 50%, #d4b896 100%); padding: 32px; text-align: center;">
                    <img src="${LOGO_URL}" alt="PeachHaus" style="height: 40px; margin-bottom: 16px;" />
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 400;">✅ Call Rescheduled</h1>
                  </div>
                  
                  <div style="padding: 32px;">
                    <p style="font-size: 16px; color: #444; line-height: 1.6; margin: 0 0 16px 0;">${greeting},</p>
                    <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 24px 0;">Your discovery call${propertyContext} has been successfully rescheduled.</p>
                    
                    ${oldFormatted ? `
                    <div style="background: #fef2f2; padding: 14px 18px; border-radius: 8px; margin: 0 0 16px 0; border-left: 4px solid #ef4444;">
                      <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>Previous:</strong> ${oldFormatted.dateTime}</p>
                    </div>
                    ` : ''}
                    
                    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #16a34a; margin: 0 0 24px 0;">
                      <p style="margin: 0 0 8px 0; color: #166534; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">NEW DATE & TIME:</p>
                      <p style="margin: 0; color: #166534; font-size: 20px; font-weight: 600;">${formattedDate}</p>
                      <p style="margin: 4px 0 0 0; color: #166534; font-size: 16px;">${formattedTime}</p>
                    </div>
                    
                    <!-- Owner Pitch Reminder -->
                    <div style="background: #fef9e7; padding: 16px; border-radius: 8px; border: 1px solid #f9e79f; margin: 0 0 24px 0; text-align: center;">
                      <p style="margin: 0 0 10px 0; color: #7d6608; font-size: 13px;">Haven't seen our presentation yet?</p>
                      <a href="${OWNER_PITCH_URL}" style="display: inline-block; background: #f1c40f; color: #7d6608; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 6px;">
                        View Owner Presentation
                      </a>
                    </div>
                    
                    ${isVideoCall ? `
                    <div style="text-align: center; margin: 0 0 24px 0;">
                      <a href="${GOOGLE_MEET_LINK}" style="display: inline-block; background: #16a34a; color: white; padding: 14px 32px; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 15px;">📹 Join Video Call</a>
                      <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">${GOOGLE_MEET_LINK}</p>
                    </div>
                    ` : `
                    <p style="text-align: center; color: #666; font-size: 15px; margin: 0 0 24px 0;">
                      📞 We will call you at <strong>${lead.phone || 'your phone number'}</strong>
                    </p>
                    `}
                    
                    <div style="text-align: center; padding: 16px; background: #f5f5f5; border-radius: 8px;">
                      <p style="font-size: 12px; color: #666; margin: 0 0 8px 0;">Need to reschedule again?</p>
                      <a href="${rescheduleUrl}" style="color: #2563eb; font-size: 13px; text-decoration: underline;">Click here</a>
                    </div>
                  </div>
                  
                  <!-- Signature -->
                  <div style="padding: 24px 32px; border-top: 1px solid #e8e4de; text-align: center;">
                    <img src="${SIGNATURE_URL}" alt="Signature" style="height: 36px; margin-bottom: 8px;">
                    <p style="margin: 0; font-size: 12px; color: #888;">PeachHaus Property Management</p>
                    <p style="margin: 4px 0 0 0; font-size: 11px; color: #aaa;">(404) 800-5932 · info@peachhausgroup.com</p>
                  </div>
                </div>
              </body>
            </html>
          `,
        });
      }

      if (lead?.phone) {
        try {
          await supabase.functions.invoke("send-sms", {
            body: {
              to: lead.phone,
              message: `✅ ${greeting}! Your PeachHaus call has been rescheduled to ${formattedDate} at ${formattedTime}. ${isVideoCall ? `Join: ${GOOGLE_MEET_LINK}` : "We'll call you!"} Questions? Reply here. - Ingo`,
            },
          });
        } catch (smsError) {
          console.error("SMS reschedule confirmation failed:", smsError);
        }
      }
    }

    // 48h Reminder - Email only (psychology: value reinforcement, reduce pre-call anxiety)
    if (notificationType === "reminder_48h") {
      if (lead?.email) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: [lead.email],
          subject: `📅 Your Discovery Call is in 2 Days - ${formattedDate}`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="margin: 0; padding: 0; background: #f5f5f5; font-family: Georgia, 'Times New Roman', serif;">
                <div style="max-width: 600px; margin: 0 auto; background: #fdfcfb;">
                  
                  <!-- Header -->
                  <div style="background: linear-gradient(135deg, #b8956a 0%, #c9a87a 50%, #d4b896 100%); padding: 32px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 400; letter-spacing: 1px;">📅 2 Days Until Your Call</h1>
                  </div>
                  
                  <div style="padding: 32px;">
                    <p style="font-size: 16px; line-height: 1.8; color: #4a4a4a; margin: 0 0 16px 0;">
                      ${greeting},
                    </p>
                    
                    <p style="font-size: 15px; line-height: 1.8; color: #4a4a4a; margin: 0 0 24px 0;">
                      Just a friendly reminder that we're looking forward to speaking with you${propertyContext} in 2 days!
                    </p>
                    
                    <!-- Call Details -->
                    <div style="background: #fff8f0; padding: 20px; border-radius: 12px; margin: 0 0 24px 0; border-left: 4px solid #b8956a;">
                      <p style="margin: 0 0 10px 0; font-size: 15px; color: #333;"><strong>📅 Date:</strong> ${formattedDate}</p>
                      <p style="margin: 0 0 10px 0; font-size: 15px; color: #333;"><strong>🕐 Time:</strong> ${formattedTime}</p>
                      <p style="margin: 0; font-size: 15px; color: #333;"><strong>${isVideoCall ? '📹' : '📞'} Type:</strong> ${isVideoCall ? 'Video Call' : 'Phone Call'}</p>
                    </div>
                    
                    <!-- Pre-Call Preparation -->
                    <div style="background: linear-gradient(135deg, #fef9e7 0%, #fff8e1 100%); padding: 24px; border-radius: 12px; margin: 0 0 24px 0; text-align: center;">
                      <p style="margin: 0 0 8px 0; font-size: 14px; color: #7d6608; font-weight: 600;">📊 Before We Chat</p>
                      <p style="margin: 0 0 16px 0; font-size: 14px; color: #9a7b0a; line-height: 1.6;">
                        Take 5 minutes to see how we've helped other Atlanta property owners like you maximize their rental income.
                      </p>
                      <a href="${OWNER_PITCH_URL}" style="display: inline-block; background: linear-gradient(135deg, #f1c40f 0%, #d4ac0d 100%); color: #7d6608; padding: 14px 28px; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 8px; box-shadow: 0 2px 8px rgba(241, 196, 15, 0.3);">
                        View Owner Presentation →
                      </a>
                    </div>
                    
                    ${isVideoCall ? `
                    <div style="text-align: center; margin: 0 0 24px 0;">
                      <a href="${GOOGLE_MEET_LINK}" style="display: inline-block; background: #4CAF50; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">📹 Join Video Call</a>
                      <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">${GOOGLE_MEET_LINK}</p>
                    </div>
                    ` : ''}
                    
                    <p style="font-size: 15px; line-height: 1.8; color: #4a4a4a; margin: 0;">
                      We're excited to discuss your property's potential and answer any questions you have!
                    </p>
                  </div>
                  
                  <!-- Signature -->
                  <div style="padding: 24px 32px; text-align: center; border-top: 1px solid #e8e4de;">
                    <p style="margin: 0 0 12px 0; font-size: 13px; color: #8a8a8a; text-transform: uppercase; letter-spacing: 2px;">
                      SEE YOU SOON
                    </p>
                    <img src="${SIGNATURE_URL}" alt="Signature" style="height: 40px; margin-bottom: 8px;">
                    <p style="margin: 0; font-size: 12px; color: #8a8a8a;">
                      (404) 800-5932 | info@peachhausgroup.com
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `,
        });
      }

      // Update reminder sent status
      await supabase
        .from("discovery_calls")
        .update({ reminder_48h_sent: true })
        .eq("id", discoveryCallId);

      // Log reminder
      await supabase.from("discovery_call_reminders").insert({
        discovery_call_id: discoveryCallId,
        reminder_type: "48h",
        channel: "email",
        sent_at: new Date().toISOString(),
        status: "sent",
      });
    }

    // 24h and 1h Reminders
    if (notificationType === "reminder_24h" || notificationType === "reminder_1h") {
      const reminderText = notificationType === "reminder_24h" ? "tomorrow" : "in 1 hour";
      const urgencyEmoji = notificationType === "reminder_1h" ? "⏰" : "📅";
      
      // Email reminder
      if (lead?.email) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: [lead.email],
          subject: `${urgencyEmoji} Reminder: Discovery Call ${reminderText} - ${formattedTime}`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="margin: 0; padding: 0; background: #f5f5f5; font-family: Georgia, 'Times New Roman', serif;">
                <div style="max-width: 600px; margin: 0 auto; background: #fdfcfb;">
                  
                  <!-- Header -->
                  <div style="background: linear-gradient(135deg, #b8956a 0%, #c9a87a 50%, #d4b896 100%); padding: 32px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 400; letter-spacing: 1px;">${urgencyEmoji} Call Reminder</h1>
                  </div>
                  
                  <div style="padding: 32px;">
                    <p style="font-size: 16px; line-height: 1.8; color: #4a4a4a; margin: 0 0 16px 0;">
                      ${greeting},
                    </p>
                    
                    <p style="font-size: 15px; line-height: 1.8; color: #4a4a4a; margin: 0 0 24px 0;">
                      Just a friendly reminder that your discovery call${propertyContext} is <strong>${reminderText}</strong>!
                    </p>
                    
                    <div style="background: #fff8f0; padding: 20px; border-radius: 12px; margin: 0 0 24px 0; border-left: 4px solid #b8956a;">
                      <p style="margin: 0 0 10px 0; font-size: 15px; color: #333;"><strong>📅 Date:</strong> ${formattedDate}</p>
                      <p style="margin: 0 0 10px 0; font-size: 15px; color: #333;"><strong>🕐 Time:</strong> ${formattedTime}</p>
                      ${meetingDetails}
                    </div>
                    
                    ${notificationType === "reminder_24h" ? `
                    <!-- Final pitch link reminder for 24h -->
                    <div style="background: #fef9e7; padding: 16px; border-radius: 8px; border: 1px solid #f9e79f; margin: 0 0 24px 0; text-align: center;">
                      <p style="margin: 0 0 10px 0; color: #7d6608; font-size: 13px;">Don't forget to review our presentation before we chat!</p>
                      <a href="${OWNER_PITCH_URL}" style="display: inline-block; background: #f1c40f; color: #7d6608; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 6px;">
                        View Owner Presentation
                      </a>
                    </div>
                    ` : ''}
                    
                    ${isVideoCall ? `
                    <div style="text-align: center; margin: 0 0 24px 0;">
                      <a href="${GOOGLE_MEET_LINK}" style="display: inline-block; background: #4CAF50; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">📹 Join Video Call</a>
                      <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">${GOOGLE_MEET_LINK}</p>
                    </div>
                    ` : `
                    <p style="text-align: center; font-size: 15px; color: #666; margin: 0 0 24px 0;">
                      📞 We will call you at <strong>${lead.phone || 'your phone number'}</strong>
                    </p>
                    `}
                    
                    <p style="font-size: 15px; line-height: 1.8; color: #4a4a4a; margin: 0;">
                      We're looking forward to discussing how we can help you with your property!
                    </p>
                  </div>
                  
                  <!-- Signature -->
                  <div style="padding: 24px 32px; text-align: center; border-top: 1px solid #e8e4de;">
                    <p style="margin: 0 0 12px 0; font-size: 13px; color: #8a8a8a; text-transform: uppercase; letter-spacing: 2px;">
                      SEE YOU SOON
                    </p>
                    <img src="${SIGNATURE_URL}" alt="Signature" style="height: 40px; margin-bottom: 8px;">
                    <p style="margin: 0; font-size: 12px; color: #8a8a8a;">
                      (404) 800-5932 | info@peachhausgroup.com
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `,
        });
      }

      // SMS reminder
      if (lead?.phone) {
        try {
          const smsMessage = notificationType === "reminder_1h" 
            ? `⏰ ${greeting}! Your PeachHaus call is in 1 hour at ${formattedTime}. ${isVideoCall ? `Join now: ${GOOGLE_MEET_LINK}` : "We'll call you soon!"}`
            : `📅 ${greeting}! Reminder: Your PeachHaus call is tomorrow at ${formattedTime}. ${isVideoCall ? `Join: ${GOOGLE_MEET_LINK}` : "We'll call you!"} See you soon! - Ingo`;
          
          await supabase.functions.invoke("send-sms", {
            body: {
              to: lead.phone,
              message: smsMessage,
            },
          });
        } catch (smsError) {
          console.error("SMS reminder failed:", smsError);
        }
      }

      // Update reminder sent status
      const updateField = notificationType === "reminder_24h" ? "reminder_24h_sent" : "reminder_1h_sent";
      await supabase
        .from("discovery_calls")
        .update({ [updateField]: true })
        .eq("id", discoveryCallId);

      // Log reminder
      await supabase.from("discovery_call_reminders").insert({
        discovery_call_id: discoveryCallId,
        reminder_type: notificationType === "reminder_24h" ? "24h" : "1h",
        channel: "email",
        sent_at: new Date().toISOString(),
        status: "sent",
      });

      // For 1-hour reminder on VIDEO calls: Auto-send Recall.ai bot to record the meeting
      if (notificationType === "reminder_1h" && isVideoCall) {
        try {
          console.log("Sending Recall.ai bot to join video call:", GOOGLE_MEET_LINK);
          const recallResult = await supabase.functions.invoke("recall-send-bot", {
            body: {
              meetingUrl: GOOGLE_MEET_LINK,
              meetingTitle: `Discovery Call: ${lead?.name || firstName}`,
              platform: "google_meet",
            },
          });
          
          if (recallResult.data?.recordingId) {
            await supabase
              .from("meeting_recordings")
              .update({
                discovery_call_id: discoveryCallId,
                lead_id: lead?.id,
              })
              .eq("id", recallResult.data.recordingId);
            
            console.log("Recall bot sent successfully, recording ID:", recallResult.data.recordingId);
          }
        } catch (recallError) {
          console.error("Failed to send Recall bot:", recallError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, notificationType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in discovery-call-notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
