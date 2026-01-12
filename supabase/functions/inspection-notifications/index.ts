import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";
const SMART_LOCK_URL = "https://www.amazon.com/Yale-Security-Connected-Back-Up-YRD410-WF1-BSP/dp/B0B9HWYMV5";
const CHECKLIST_URL = "https://propertycentral.lovable.app/documents/MTR_Start_Up_Checklist.pdf";

// Build professional inspection confirmation email for lead
function buildInspectionConfirmationEmail(
  recipientName: string,
  scheduledAt: Date,
  inspectionType: string,
  propertyAddress: string,
  safetyNotes?: string
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

  const isVirtual = inspectionType === 'virtual';
  const locationDetails = isVirtual 
    ? `<p style="margin: 8px 0 0 0;"><strong>Type:</strong> 📹 Virtual Inspection (We'll send you a Google Meet link before your appointment)</p>`
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
                    Great news! Your onboarding inspection has been scheduled. We're excited to complete this final step before getting your property live and welcoming guests!
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
                    ${locationDetails}
                  </div>
                </td>
              </tr>

              <!-- What We'll Cover -->
              <tr>
                <td style="padding: 0 32px;">
                  <div style="margin: 20px 0;">
                    <div style="padding: 12px 0; border-bottom: 2px solid #f59e0b; margin-bottom: 16px;">
                      <span style="font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">🔍 What We'll Cover During Your Inspection</span>
                    </div>
                    <table style="width: 100%; font-size: 14px; color: #374151;">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <strong style="color: #f59e0b;">🛡️ Safety Check</strong>
                          <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Fire extinguishers, fire blankets, smoke/CO detectors verification</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <strong style="color: #f59e0b;">📋 Appliance Documentation</strong>
                          <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Recording all appliance serial numbers and model information</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <strong style="color: #f59e0b;">🧺 Inventory Check</strong>
                          <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Verifying all guest essentials are in place - linens, kitchen items, toiletries, plungers</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <strong style="color: #f59e0b;">🔐 Smart Lock Setup</strong>
                          <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Testing and verifying your smart lock is connected for seamless guest check-ins</p>
                        </td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- Prepare for Inspection -->
              <tr>
                <td style="padding: 0 32px;">
                  <div style="margin: 20px 0; padding: 20px 24px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #93c5fd; border-radius: 12px;">
                    <div style="font-size: 12px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">📥 Prepare for Your Inspection</div>
                    <div style="font-size: 14px; color: #1e40af; line-height: 1.6; margin-bottom: 12px;">
                      Download our inventory checklist to ensure your property has everything needed for a 5-star guest experience:
                    </div>
                    <a href="${CHECKLIST_URL}" style="display: inline-block; padding: 10px 20px; background: #1e40af; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;">📄 Download STR/MTR Setup Checklist</a>
                  </div>
                </td>
              </tr>

              <!-- Smart Lock Reminder -->
              <tr>
                <td style="padding: 0 32px;">
                  <div style="margin: 20px 0; padding: 16px 20px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0;">
                    <div style="font-size: 14px; color: #92400e; font-weight: 600;">🔐 Smart Lock Reminder</div>
                    <div style="font-size: 13px; color: #92400e; margin-top: 4px;">
                      Don't have a smart lock yet? We recommend the <a href="${SMART_LOCK_URL}" style="color: #1e40af;">Yale Security Smart Lock</a>. 
                      We can install it for you at <strong>no extra charge</strong> during your inspection!
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

// Build admin notification email
function buildAdminNotificationEmail(
  leadName: string,
  leadEmail: string,
  leadPhone: string,
  propertyAddress: string,
  inspectionType: string,
  scheduledAt: Date,
  safetyNotes: string
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

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; text-align: center;">
                  <div style="font-size: 20px; font-weight: 700; color: #ffffff;">🏠 New Inspection Booked!</div>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px;">
                  <table width="100%" style="font-size: 14px; color: #374151;">
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                        <strong>Lead Name:</strong> ${leadName}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                        <strong>Email:</strong> <a href="mailto:${leadEmail}" style="color: #2563eb;">${leadEmail}</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                        <strong>Phone:</strong> <a href="tel:${leadPhone}" style="color: #2563eb;">${leadPhone}</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                        <strong>Property:</strong> ${propertyAddress}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                        <strong>Type:</strong> ${inspectionType === 'virtual' ? '📹 Virtual Inspection' : '🏠 In-Person Inspection'}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; background: #f0fdf4; border-radius: 8px; margin-top: 8px;">
                        <div style="text-align: center;">
                          <div style="font-size: 12px; color: #166534; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Scheduled For</div>
                          <div style="font-size: 18px; font-weight: 700; color: #166534;">${dateStr}</div>
                          <div style="font-size: 16px; color: #166534;">${timeStr} EST</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                  
                  ${safetyNotes ? `
                  <div style="margin-top: 20px; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-weight: 600; color: #111827; margin-bottom: 8px;">📋 Safety Checklist Responses:</div>
                    <pre style="font-family: inherit; font-size: 13px; color: #6b7280; white-space: pre-wrap; margin: 0;">${safetyNotes}</pre>
                  </div>
                  ` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 24px; background: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
                  <a href="https://propertycentral.lovable.app/leads" style="display: inline-block; padding: 10px 24px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">View in PropertyCentral →</a>
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
    const body = await req.json();
    const { type } = body;
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle booking from public page
    if (type === 'booking') {
      const { name, email, phone, propertyAddress, inspectionType, scheduledAt, safetyNotes } = body;
      
      if (!name || !email || !scheduledAt) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const scheduledDate = new Date(scheduledAt);
      const recipientName = name.split(' ')[0] || name;

      // Try to find existing lead by email
      let leadId: string | null = null;
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("email", email.toLowerCase())
        .single();

      if (existingLead) {
        leadId = existingLead.id;
        // Update lead with inspection date
        await supabase
          .from("leads")
          .update({ 
            inspection_date: scheduledDate.toISOString(),
            stage: 'inspection_scheduled'
          })
          .eq("id", leadId);
      }

      // Send confirmation email to lead
      const emailHtml = buildInspectionConfirmationEmail(
        recipientName,
        scheduledDate,
        inspectionType,
        propertyAddress,
        safetyNotes
      );

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "PeachHaus Group <ingo@peachhausgroup.com>",
          to: [email],
          subject: "Your Onboarding Inspection is Confirmed! 🏠",
          html: emailHtml,
        }),
      });

      const emailResult = await emailResponse.json();
      console.log("Lead confirmation email result:", emailResult);

      // Send admin notification email
      const adminEmailHtml = buildAdminNotificationEmail(
        name,
        email,
        phone,
        propertyAddress,
        inspectionType,
        scheduledDate,
        safetyNotes
      );

      const adminResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "PeachHaus Notifications <notifications@peachhausgroup.com>",
          to: ["info@peachhausgroup.com", "ingo@peachhausgroup.com"],
          subject: `🏠 New Inspection Booked: ${name} - ${scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          html: adminEmailHtml,
        }),
      });

      console.log("Admin notification sent:", await adminResponse.json());

      // Record communication if we have a lead
      if (leadId) {
        await supabase.from("lead_communications").insert({
          lead_id: leadId,
          communication_type: "email",
          direction: "outbound",
          subject: "Inspection Confirmation Email",
          body: `Inspection confirmed for ${scheduledDate.toLocaleString('en-US', { 
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}`,
          status: emailResponse.ok ? "sent" : "failed",
          external_id: emailResult.id,
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        emailId: emailResult.id,
        leadId 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle notification for existing lead (called from stage change)
    const { leadId, inspectionType, scheduledAt } = body;

    if (!leadId) {
      return new Response(JSON.stringify({ error: "Lead ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const scheduledDate = new Date(scheduledAt);
    const recipientName = lead.name?.split(' ')[0] || lead.name || 'there';
    const propertyAddress = lead.property_address || '';

    // Build and send the email
    const emailHtml = buildInspectionConfirmationEmail(
      recipientName,
      scheduledDate,
      inspectionType || 'in_person',
      propertyAddress
    );

    // Send to lead
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PeachHaus Group <ingo@peachhausgroup.com>",
        to: [lead.email],
        subject: "Your Onboarding Inspection is Confirmed! 🏠",
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Lead email result:", emailResult);

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
