import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_MEET_LINK = "https://meet.google.com/jww-deey-iaa";
const HOSTS_PHOTO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/anja-ingo-hosts.jpg";
const SIGNATURE_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/anja-signature.png";
const FRONTEND_URL = "https://preview--peachhaus-property-central.lovable.app";

interface DiscoveryCallNotificationRequest {
  discoveryCallId: string;
  notificationType: "confirmation" | "admin_notification" | "reminder_24h" | "reminder_1h";
}

// Calculate revenue potential score based on property location and type
function calculateRevenueScore(propertyAddress: string, propertyType: string | null): { score: number; reasoning: string } {
  let score = 50; // Base score
  const reasons: string[] = [];

  // Location-based scoring
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

  // Property type scoring
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

  // Cap at 100
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { discoveryCallId, notificationType }: DiscoveryCallNotificationRequest = await req.json();

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
    const formattedDate = scheduledAt.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const formattedTime = scheduledAt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

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
      // Send confirmation to the lead
      if (lead?.email) {
        await resend.emails.send({
          from: "PeachHaus <notifications@peachhausgroup.com>",
          to: [lead.email],
          subject: `Your Discovery Call is Confirmed - ${formattedDate}`,
          html: `
            <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; background: #fdfcfb;">
              <!-- Header with warm gradient -->
              <div style="background: linear-gradient(135deg, #b8956a 0%, #c9a87a 50%, #d4b896 100%); padding: 40px 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 400; letter-spacing: 1px;">Your Call is Confirmed</h1>
              </div>
              
              <div style="padding: 40px 35px; background: #fff;">
                <p style="font-size: 16px; line-height: 1.8; color: #4a4a4a; margin: 0 0 20px 0;">
                  Hi ${lead.name},
                </p>
                
                <p style="font-size: 16px; line-height: 1.8; color: #4a4a4a; margin: 0 0 25px 0;">
                  We're looking forward to speaking with you! Here are the details of your upcoming discovery call:
                </p>
                
                <div style="background: #faf9f7; padding: 25px; border-radius: 12px; margin: 25px 0; border: 1px solid #e8e4de;">
                  <p style="margin: 0 0 12px 0; font-size: 15px; color: #333;"><strong>📅 Date:</strong> ${formattedDate}</p>
                  <p style="margin: 0 0 12px 0; font-size: 15px; color: #333;"><strong>🕐 Time:</strong> ${formattedTime}</p>
                  ${meetingDetails}
                  <p style="margin: 0 0 12px 0; font-size: 15px; color: #333;"><strong>🏠 Property:</strong> ${lead.property_address || "To be discussed"}</p>
                  <p style="margin: 0; font-size: 15px; color: #333;"><strong>📋 Interest:</strong> ${serviceInterestText}</p>
                </div>
                
                ${isVideoCall ? `
                <div style="background: #e8f5e9; padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center;">
                  <p style="margin: 0 0 15px 0; font-size: 15px; color: #2e7d32;"><strong>📹 Join Video Call:</strong></p>
                  <a href="${GOOGLE_MEET_LINK}" style="display: inline-block; background: #4CAF50; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Join Google Meet</a>
                  <p style="margin: 12px 0 0 0; font-size: 12px; color: #666;">${GOOGLE_MEET_LINK}</p>
                </div>
                ` : ""}
                
                <p style="font-size: 15px; color: #4a4a4a; font-weight: 600; margin: 25px 0 10px 0;">What to expect:</p>
                <ul style="margin: 0; padding-left: 20px; color: #4a4a4a; font-size: 15px; line-height: 1.8;">
                  <li>We'll discuss your property's potential</li>
                  <li>Review our management approach</li>
                  <li>Answer all your questions</li>
                  <li>Provide a custom revenue estimate</li>
                </ul>
                
                <p style="font-size: 16px; line-height: 1.8; color: #4a4a4a; margin: 30px 0 0 0;">
                  We're excited to learn about your property and show you how we can help maximize your investment!
                </p>
              </div>
              
              <!-- Signature Section -->
              <div style="padding: 30px 35px; text-align: center; border-top: 1px solid #e8e4de;">
                <p style="margin: 0 0 15px 0; font-family: Georgia, serif; font-size: 14px; color: #8a8a8a; text-transform: uppercase; letter-spacing: 2px;">
                  WARMEST REGARDS
                </p>
                <img src="${SIGNATURE_URL}" 
                     alt="Anja & Ingo Schaer" 
                     style="height: 50px; width: auto; margin-bottom: 12px;">
                <p style="margin: 0 0 4px 0; font-family: Georgia, serif; font-size: 13px; color: #8a8a8a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                  PEACHHAUS GROUP
                </p>
                <p style="margin: 16px 0 0 0; font-family: Georgia, serif; font-size: 12px; color: #8a8a8a;">
                  (404) 800-5932 | info@peachhausgroup.com
                </p>
                <div style="margin-top: 15px;">
                  <img src="${HOSTS_PHOTO_URL}" 
                       alt="Anja & Ingo" 
                       width="80" 
                       style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid #e8e4de; object-fit: cover;">
                </div>
              </div>
              
              <!-- Footer -->
              <div style="padding: 20px 35px; background-color: #faf9f7; border-top: 1px solid #e8e4de; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #8a8a8a;">
                  PeachHaus Group · Atlanta, Georgia
                </p>
              </div>
            </div>
          `,
        });

        // Also send SMS confirmation if phone available
        if (lead?.phone) {
          try {
            await supabase.functions.invoke("send-sms", {
              body: {
                to: lead.phone,
                message: `Hi ${lead.name}! Your PeachHaus discovery call is confirmed for ${formattedDate} at ${formattedTime}. ${isVideoCall ? `Join here: ${GOOGLE_MEET_LINK}` : "We'll call you!"} Reply STOP to opt out.`,
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
      }
    }

    if (notificationType === "admin_notification") {
      // Send admin notification with map and revenue score
      const revenueData = calculateRevenueScore(lead?.property_address || "", lead?.property_type);
      const mapImageUrl = getStaticMapUrl(lead?.property_address || "");
      const mapsLink = getGoogleMapsLink(lead?.property_address || "");

      const scoreColor = revenueData.score >= 75 ? "#4CAF50" : revenueData.score >= 50 ? "#FF9800" : "#f44336";

      await resend.emails.send({
        from: "PeachHaus System <notifications@peachhausgroup.com>",
        to: ["alex@peachhausgroup.com", "anja@peachhausgroup.com"],
        subject: `🗓️ New Discovery Call Booked - ${lead?.name} (Score: ${revenueData.score}/100)`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
            <div style="background: #1a1a2e; padding: 20px; text-align: center;">
              <h1 style="color: #f97316; margin: 0;">New Discovery Call Booked!</h1>
            </div>
            
            <div style="padding: 25px; background: #fff;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                  <h2 style="margin: 0; color: #333;">${lead?.name}</h2>
                  <p style="margin: 5px 0; color: #666;">${lead?.email} | ${lead?.phone}</p>
                </div>
                <div style="background: ${scoreColor}; color: white; padding: 15px 25px; border-radius: 50%; text-align: center;">
                  <div style="font-size: 24px; font-weight: bold;">${revenueData.score}</div>
                  <div style="font-size: 10px;">SCORE</div>
                </div>
              </div>
              
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p><strong>📅 Scheduled:</strong> ${formattedDate} at ${formattedTime}</p>
                <p><strong>📹 Meeting Type:</strong> ${isVideoCall ? "Video Call (Google Meet)" : "Phone Call"}</p>
                <p><strong>🏠 Interest:</strong> ${serviceInterestText}</p>
                <p><strong>⏰ Start Timeline:</strong> ${call.start_timeline || "Not specified"}</p>
                ${call.meeting_notes ? `<p><strong>📝 Notes:</strong> ${call.meeting_notes}</p>` : ""}
              </div>
              
              <h3>📍 Property Location</h3>
              <p><strong>${lead?.property_address}</strong></p>
              <a href="${mapsLink}" target="_blank">
                <img src="${mapImageUrl}" alt="Property Location" style="width: 100%; border-radius: 8px; cursor: pointer;" />
              </a>
              <p style="text-align: center;">
                <a href="${mapsLink}" style="color: #4285f4;">🔍 Open in Google Maps for full view</a>
              </p>
              
              <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <h4 style="margin-top: 0; color: #e65100;">💰 Revenue Potential Analysis</h4>
                <div style="background: #e0e0e0; border-radius: 10px; overflow: hidden; margin: 10px 0;">
                  <div style="background: ${scoreColor}; height: 20px; width: ${revenueData.score}%;"></div>
                </div>
                <p><strong>Score:</strong> ${revenueData.score}/100</p>
                <p><strong>Reasoning:</strong> ${revenueData.reasoning}</p>
                <p><strong>Property Type:</strong> ${lead?.property_type || "Not specified"}</p>
                ${lead?.opportunity_value ? `<p><strong>Estimated Value:</strong> $${lead.opportunity_value.toLocaleString()}</p>` : ""}
              </div>
              
              ${isVideoCall ? `
              <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: center;">
                <p style="margin: 0 0 10px 0;"><strong>📹 Video Meeting Link:</strong></p>
                <a href="${GOOGLE_MEET_LINK}" style="display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Join Google Meet</a>
              </div>
              ` : ""}
            </div>
          </div>
        `,
      });
    }

    if (notificationType === "reminder_24h" || notificationType === "reminder_1h") {
      const reminderText = notificationType === "reminder_24h" ? "tomorrow" : "in 1 hour";
      const urgencyEmoji = notificationType === "reminder_1h" ? "⏰" : "📅";
      
      // Email reminder
      if (lead?.email) {
        await resend.emails.send({
          from: "PeachHaus <notifications@peachhausgroup.com>",
          to: [lead.email],
          subject: `${urgencyEmoji} Reminder: Discovery Call ${reminderText} - ${formattedTime}`,
          html: `
            <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; background: #fdfcfb;">
              <div style="background: linear-gradient(135deg, #b8956a 0%, #c9a87a 50%, #d4b896 100%); padding: 35px 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 400; letter-spacing: 1px;">${urgencyEmoji} Call Reminder</h1>
              </div>
              
              <div style="padding: 35px; background: #fff;">
                <p style="font-size: 16px; line-height: 1.8; color: #4a4a4a; margin: 0 0 20px 0;">
                  Hi ${lead.name},
                </p>
                
                <p style="font-size: 16px; line-height: 1.8; color: #4a4a4a; margin: 0 0 25px 0;">
                  Just a friendly reminder that your discovery call is <strong>${reminderText}</strong>!
                </p>
                
                <div style="background: #fff8f0; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #b8956a;">
                  <p style="margin: 0 0 10px 0; font-size: 15px; color: #333;"><strong>📅 Date:</strong> ${formattedDate}</p>
                  <p style="margin: 0 0 10px 0; font-size: 15px; color: #333;"><strong>🕐 Time:</strong> ${formattedTime}</p>
                  ${meetingDetails}
                </div>
                
                ${isVideoCall ? `
                <div style="text-align: center; margin: 25px 0;">
                  <a href="${GOOGLE_MEET_LINK}" style="display: inline-block; background: #4CAF50; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">📹 Join Video Call</a>
                  <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">${GOOGLE_MEET_LINK}</p>
                </div>
                ` : `
                <p style="text-align: center; font-size: 16px; color: #666; margin: 25px 0;">
                  📞 We will call you at <strong>${lead.phone}</strong>
                </p>
                `}
                
                <p style="font-size: 16px; line-height: 1.8; color: #4a4a4a; margin: 25px 0 0 0;">
                  We're looking forward to discussing how we can help you with your property!
                </p>
              </div>
              
              <!-- Signature Section -->
              <div style="padding: 25px 35px; text-align: center; border-top: 1px solid #e8e4de;">
                <p style="margin: 0 0 12px 0; font-family: Georgia, serif; font-size: 13px; color: #8a8a8a; text-transform: uppercase; letter-spacing: 2px;">
                  SEE YOU SOON
                </p>
                <img src="${SIGNATURE_URL}" 
                     alt="Anja & Ingo Schaer" 
                     style="height: 45px; width: auto; margin-bottom: 10px;">
                <p style="margin: 0; font-family: Georgia, serif; font-size: 12px; color: #8a8a8a;">
                  (404) 800-5932 | info@peachhausgroup.com
                </p>
              </div>
            </div>
          `,
        });
      }

      // SMS reminder
      if (lead?.phone) {
        try {
          await supabase.functions.invoke("send-sms", {
            body: {
              to: lead.phone,
              message: `${urgencyEmoji} Hi ${lead.name}! Reminder: Your PeachHaus call is ${reminderText} at ${formattedTime}. ${isVideoCall ? `Join: ${GOOGLE_MEET_LINK}` : "We'll call you!"} See you soon!`,
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
