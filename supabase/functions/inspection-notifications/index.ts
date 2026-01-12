import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";
const SMART_LOCK_URL = "https://www.amazon.com/Yale-Security-Connected-Back-Up-YRD410-WF1-BSP/dp/B0B9HWYMV5";

// Build professional inspection email
function buildInspectionConfirmationEmail(
  recipientName: string,
  scheduledAt: Date,
  inspectionType: string,
  propertyAddress: string,
  googleMeetLink?: string
): string {
  const dateStr = scheduledAt.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const timeStr = scheduledAt.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York'
  });

  const isVirtual = inspectionType === 'virtual_inspection' || inspectionType === 'virtual';
  const meetingDetails = isVirtual && googleMeetLink 
    ? `<p style="margin: 8px 0 0 0;"><strong>Google Meet:</strong> <a href="${googleMeetLink}" style="color: #2563eb;">${googleMeetLink}</a></p>`
    : `<p style="margin: 8px 0 0 0;"><strong>Location:</strong> ${propertyAddress || 'Your property'}</p>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); padding: 32px; text-align: center;">
                  <img src="${LOGO_URL}" alt="PeachHaus" style="height: 48px; margin-bottom: 16px;" />
                  <div style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Your Onboarding Inspection is Confirmed! 🏠</div>
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 32px 32px 16px 32px;">
                  <div style="font-size: 16px; color: #111827;">Hi <strong>${recipientName}</strong>,</div>
                  <div style="font-size: 14px; color: #374151; margin-top: 12px; line-height: 1.7;">
                    Great news! Your onboarding inspection has been scheduled. We're excited to complete this final step before getting your property live!
                  </div>
                </td>
              </tr>

              <!-- Appointment Details -->
              <tr>
                <td style="padding: 0 32px;">
                  <div style="margin: 20px 0; padding: 24px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 12px;">
                    <div style="font-size: 12px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; font-weight: 600;">📅 Appointment Details</div>
                    <div style="font-size: 18px; font-weight: 700; color: #166534;">${dateStr}</div>
                    <div style="font-size: 16px; color: #166534; margin-top: 4px;">${timeStr} EST</div>
                    <div style="font-size: 14px; color: #166534; margin-top: 4px;">${isVirtual ? '📹 Virtual Inspection' : '🏠 In-Person Walkthrough'}</div>
                    ${meetingDetails}
                  </div>
                </td>
              </tr>

              <!-- What Happens Section -->
              <tr>
                <td style="padding: 0 32px;">
                  <div style="margin: 20px 0;">
                    <div style="padding: 12px 0; border-bottom: 2px solid #f59e0b; margin-bottom: 16px;">
                      <span style="font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">🔍 What We'll Cover During Your Inspection</span>
                    </div>
                    <div style="font-size: 14px; color: #374151; line-height: 1.7;">
                      <table style="width: 100%;">
                        <tr>
                          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
                            <div style="display: flex; align-items: flex-start;">
                              <span style="color: #f59e0b; font-size: 18px; margin-right: 12px;">🛡️</span>
                              <div>
                                <strong>Safety & Onboarding Inspection</strong>
                                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">We'll document all appliance serial numbers, verify safety equipment (fire extinguishers, smoke/CO detectors), and ensure everything meets guest-ready standards.</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
                            <div style="display: flex; align-items: flex-start;">
                              <span style="color: #f59e0b; font-size: 18px; margin-right: 12px;">📋</span>
                              <div>
                                <strong>Property Inventory Check</strong>
                                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">We verify that all essential items are in place - linens, kitchen supplies, toiletries, and everything your guests will need for a 5-star experience.</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
                            <div style="display: flex; align-items: flex-start;">
                              <span style="color: #f59e0b; font-size: 18px; margin-right: 12px;">🔐</span>
                              <div>
                                <strong>Smart Lock Verification</strong>
                                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">We'll test and verify your smart lock is properly connected and working, ensuring seamless guest check-ins.</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 12px 0; vertical-align: top;">
                            <div style="display: flex; align-items: flex-start;">
                              <span style="color: #f59e0b; font-size: 18px; margin-right: 12px;">✨</span>
                              <div>
                                <strong>Final Go-Live Preparation</strong>
                                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">After the inspection, your property will be ready to welcome guests!</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </div>
                </td>
              </tr>

              <!-- Smart Lock Recommendation -->
              <tr>
                <td style="padding: 0 32px;">
                  <div style="margin: 20px 0; padding: 20px 24px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #fbbf24; border-radius: 12px;">
                    <div style="font-size: 14px; color: #92400e; font-weight: 600; margin-bottom: 8px;">🔐 Don't have a smart lock yet?</div>
                    <div style="font-size: 13px; color: #92400e; line-height: 1.6;">
                      We recommend the <a href="${SMART_LOCK_URL}" style="color: #1e40af; font-weight: 600;">Yale Security Connected Smart Lock</a> for reliable, secure access.
                      <br><br>
                      <strong>Can't install it yourself?</strong> No problem! We can install it for you at <strong>no extra charge</strong> during your inspection.
                    </div>
                  </div>
                </td>
              </tr>

              <!-- What to Prepare -->
              <tr>
                <td style="padding: 0 32px;">
                  <div style="margin: 20px 0;">
                    <div style="padding: 12px 0; border-bottom: 2px solid #f59e0b; margin-bottom: 16px;">
                      <span style="font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">📝 Please Have Ready</span>
                    </div>
                    <div style="font-size: 14px; color: #374151; line-height: 1.7;">
                      <ul style="margin: 0; padding-left: 20px;">
                        <li style="margin-bottom: 8px;">Access to all areas of the property (bedrooms, closets, utility areas)</li>
                        <li style="margin-bottom: 8px;">WiFi network name and password</li>
                        <li style="margin-bottom: 8px;">Smart lock access codes or the lock itself if not yet installed</li>
                        <li style="margin-bottom: 8px;">Any questions about the onboarding process</li>
                      </ul>
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
                        <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-headshot.png" alt="Ingo" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover;" />
                      </td>
                      <td style="vertical-align: top; border-left: 3px solid #f59e0b; padding-left: 12px;">
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
                    © ${new Date().getFullYear()} PeachHaus Group LLC · Atlanta, GA
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inspectionId, leadId, notificationType, inspectionType, scheduledAt } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      console.error("Lead not found:", leadError);
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lead.email) {
      console.log("Lead has no email, skipping notification");
      return new Response(JSON.stringify({ message: "No email to send to" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scheduledDate = new Date(scheduledAt);
    const recipientName = lead.name?.split(' ')[0] || lead.name || 'there';
    const propertyAddress = lead.property_address || '';

    // Get Google Meet link if virtual
    let googleMeetLink: string | undefined;
    if (inspectionId) {
      const { data: inspection } = await supabase
        .from("discovery_calls")
        .select("google_meet_link")
        .eq("id", inspectionId)
        .single();
      googleMeetLink = inspection?.google_meet_link;
    }

    // Build and send the email
    const emailHtml = buildInspectionConfirmationEmail(
      recipientName,
      scheduledDate,
      inspectionType,
      propertyAddress,
      googleMeetLink
    );

    // Send to lead
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PeachHaus Group LLC - Ingo Schaer <ingo@peachhausgroup.com>",
        to: [lead.email],
        subject: "Your Onboarding Inspection is Confirmed! 🏠 - PeachHaus",
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Lead email result:", emailResult);

    // Send admin notification
    const adminEmailHtml = `
      <h2>🏠 New Inspection Scheduled</h2>
      <p><strong>Lead:</strong> ${lead.name}</p>
      <p><strong>Email:</strong> ${lead.email}</p>
      <p><strong>Phone:</strong> ${lead.phone || 'N/A'}</p>
      <p><strong>Property:</strong> ${propertyAddress || 'Not specified'}</p>
      <p><strong>Type:</strong> ${inspectionType === 'virtual_inspection' || inspectionType === 'virtual' ? 'Virtual Inspection' : 'In-Person Walkthrough'}</p>
      <p><strong>Scheduled:</strong> ${scheduledDate.toLocaleString('en-US', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York'
      })} EST</p>
      ${googleMeetLink ? `<p><strong>Google Meet:</strong> <a href="${googleMeetLink}">${googleMeetLink}</a></p>` : ''}
    `;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PeachHaus Notifications <notifications@peachhausgroup.com>",
        to: ["info@peachhausgroup.com"],
        subject: `🏠 Inspection Scheduled: ${lead.name} - ${scheduledDate.toLocaleDateString()}`,
        html: adminEmailHtml,
      }),
    });

    // Record communication
    await supabase.from("lead_communications").insert({
      lead_id: leadId,
      communication_type: "email",
      direction: "outbound",
      subject: "Inspection Confirmation Email",
      body: `Inspection confirmation sent for ${scheduledDate.toLocaleString()}`,
      status: emailResponse.ok ? "sent" : "failed",
      external_id: emailResult.id,
    });

    return new Response(JSON.stringify({ success: true, emailId: emailResult.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in inspection-notifications:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
