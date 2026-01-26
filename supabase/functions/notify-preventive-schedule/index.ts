import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Vendor phone number for all vendor communications
const VENDOR_FROM_NUMBER = "+14045741740";

// Format phone number to E.164 format
function formatPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length > 10) {
    return `+${digits}`;
  }
  return phone;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    hvac: "HVAC Service",
    plumbing: "Plumbing",
    electrical: "Electrical",
    appliances: "Appliances",
    general: "General Maintenance",
    exterior: "Exterior/Landscaping",
    cleaning: "Cleaning",
    pest_control: "Pest Control",
    pool_spa: "Pool/Spa",
  };
  return labels[category] || category;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scheduleIds, propertyId, notifyVendor = true, notifyOwner = true } = await req.json();

    if (!scheduleIds?.length || !propertyId) {
      return new Response(
        JSON.stringify({ success: false, error: "scheduleIds and propertyId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch property with owner
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("id, name, address, owner_id")
      .eq("id", propertyId)
      .single();

    if (propError || !property) {
      console.error("Property not found:", propError);
      return new Response(
        JSON.stringify({ success: false, error: "Property not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch owner if exists
    let owner = null;
    if (property.owner_id) {
      const { data } = await supabase
        .from("property_owners")
        .select("id, name, email, phone")
        .eq("id", property.owner_id)
        .single();
      owner = data;
    }

    // Fetch the schedules with templates and vendors
    const { data: schedules, error: schedError } = await supabase
      .from("property_maintenance_schedules")
      .select(`
        id,
        next_due_at,
        preferred_vendor_id,
        template:preventive_maintenance_templates(id, name, category, frequency_months, estimated_cost_low, estimated_cost_high),
        vendor:vendors(id, name, phone, email)
      `)
      .in("id", scheduleIds);

    if (schedError || !schedules?.length) {
      console.error("Schedules not found:", schedError);
      return new Response(
        JSON.stringify({ success: false, error: "Schedules not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      vendorSmsCount: 0,
      ownerEmailSent: false,
    };

    const propertyAddress = property.address || property.name;

    // Group schedules by vendor for consolidated SMS
    const vendorSchedules = new Map<string, typeof schedules>();
    for (const schedule of schedules) {
      if (schedule.vendor) {
        const vendorId = (schedule.vendor as any).id;
        if (!vendorSchedules.has(vendorId)) {
          vendorSchedules.set(vendorId, []);
        }
        vendorSchedules.get(vendorId)!.push(schedule);
      }
    }

    // Send SMS to each vendor
    if (notifyVendor && ghlApiKey && ghlLocationId) {
      for (const [vendorId, vendorScheds] of vendorSchedules) {
        const vendor = (vendorScheds[0].vendor as any);
        if (!vendor?.phone) continue;

        const formattedPhone = formatPhoneE164(vendor.phone);
        
        // Build task list for SMS
        const taskList = vendorScheds.map(s => {
          const template = s.template as any;
          const dueDate = s.next_due_at ? formatDate(s.next_due_at) : "TBD";
          return `• ${template?.name || "Maintenance"} - ${dueDate}`;
        }).join("\n");

        const smsMessage = `📋 Scheduled Maintenance Assigned

📍 ${propertyAddress}

${taskList}

You'll receive a job link when each task is due. Reply with questions.

- PeachHaus Team`;

        // Find or create GHL contact
        let ghlContactId = null;
        
        const searchResponse = await fetch(
          `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${ghlLocationId}&phone=${encodeURIComponent(formattedPhone)}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${ghlApiKey}`,
              "Version": "2021-07-28",
              "Content-Type": "application/json",
            },
          }
        );

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.contact?.id) {
            ghlContactId = searchData.contact.id;
          }
        }

        if (!ghlContactId) {
          const createResponse = await fetch(
            `https://services.leadconnectorhq.com/contacts/`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${ghlApiKey}`,
                "Version": "2021-07-28",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                locationId: ghlLocationId,
                phone: formattedPhone,
                name: vendor.name || "Vendor",
                email: vendor.email || undefined,
              }),
            }
          );

          if (createResponse.ok) {
            const createData = await createResponse.json();
            ghlContactId = createData.contact?.id;
          }
        }

        if (ghlContactId) {
          const sendResponse = await fetch(
            `https://services.leadconnectorhq.com/conversations/messages`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${ghlApiKey}`,
                "Version": "2021-04-15",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                type: "SMS",
                contactId: ghlContactId,
                message: smsMessage,
                fromNumber: VENDOR_FROM_NUMBER,
              }),
            }
          );

          if (sendResponse.ok) {
            const sendData = await sendResponse.json();
            console.log(`SMS sent to vendor ${vendor.name}: ${sendData.messageId}`);
            results.vendorSmsCount++;

            // Log to lead_communications
            await supabase.from("lead_communications").insert({
              communication_type: "sms",
              direction: "outbound",
              body: smsMessage,
              status: "sent",
              external_id: sendData.messageId || sendData.conversationId,
              ghl_conversation_id: sendData.conversationId,
              metadata: {
                provider: "gohighlevel",
                ghl_contact_id: ghlContactId,
                from_number: VENDOR_FROM_NUMBER,
                to_number: formattedPhone,
                vendor_id: vendorId,
                contact_type: "vendor",
                preventive_maintenance: true,
              },
            });
          } else {
            console.error(`Failed to send SMS to vendor ${vendor.name}:`, await sendResponse.text());
          }
        }
      }
    }

    // Send email to owner
    if (notifyOwner && owner?.email && resendApiKey) {
      const taskRows = schedules.map(s => {
        const template = s.template as any;
        const vendor = s.vendor as any;
        const dueDate = s.next_due_at ? formatDate(s.next_due_at) : "To be scheduled";
        const costRange = template?.estimated_cost_low && template?.estimated_cost_high 
          ? `$${template.estimated_cost_low} - $${template.estimated_cost_high}` 
          : "TBD";
        
        return `
          <tr>
            <td style="padding: 16px; border-bottom: 1px solid #E5E7EB;">
              <div style="font-weight: 600; color: #111827;">${template?.name || "Maintenance"}</div>
              <div style="font-size: 13px; color: #6B7280; margin-top: 4px;">${getCategoryLabel(template?.category || "general")}</div>
            </td>
            <td style="padding: 16px; border-bottom: 1px solid #E5E7EB; color: #374151;">${dueDate}</td>
            <td style="padding: 16px; border-bottom: 1px solid #E5E7EB; color: #374151;">${vendor?.name || "Auto-assigned"}</td>
            <td style="padding: 16px; border-bottom: 1px solid #E5E7EB; color: #374151;">${costRange}</td>
          </tr>
        `;
      }).join("");

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #F9FAFB;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1E3A5F 0%, #2D5A87 100%); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <div style="margin-bottom: 16px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M16 2V6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M8 2V6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M3 10H21" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                Preventive Maintenance Scheduled
              </h1>
              <p style="margin: 12px 0 0 0; color: rgba(255, 255, 255, 0.85); font-size: 16px;">
                Protecting your investment with proactive care
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 40px 40px 24px 40px;">
              <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Dear <strong>${owner.name || "Valued Owner"}</strong>,
              </p>
              <p style="margin: 16px 0 0 0; color: #374151; font-size: 16px; line-height: 1.6;">
                We're pleased to confirm that preventive maintenance has been scheduled for your property at 
                <strong>${propertyAddress}</strong>. These routine services are essential to maintaining your property's value 
                and preventing costly repairs.
              </p>
            </td>
          </tr>

          <!-- Property Badge -->
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%); border-radius: 8px; border-left: 4px solid #1E3A5F;">
                <tr>
                  <td style="padding: 20px;">
                    <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; margin-bottom: 4px;">Property</div>
                    <div style="font-size: 18px; font-weight: 600; color: #111827;">${property.name || property.address}</div>
                    ${property.address !== property.name ? `<div style="font-size: 14px; color: #6B7280; margin-top: 4px;">${property.address}</div>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Schedule Table -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: 600;">Scheduled Services</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #F9FAFB;">
                    <th style="padding: 14px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; font-weight: 600;">Service</th>
                    <th style="padding: 14px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; font-weight: 600;">Scheduled Date</th>
                    <th style="padding: 14px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; font-weight: 600;">Assigned To</th>
                    <th style="padding: 14px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; font-weight: 600;">Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  ${taskRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- What to Expect -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #EFF6FF; border-radius: 8px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 12px 0; color: #1E3A5F; font-size: 16px; font-weight: 600;">What to Expect</h3>
                    <ul style="margin: 0; padding: 0 0 0 20px; color: #374151; font-size: 14px; line-height: 1.8;">
                      <li>You'll receive a reminder 7 days before each scheduled service</li>
                      <li>Our vetted vendors will coordinate access as needed</li>
                      <li>Before & after photos will be documented in your portal</li>
                      <li>Any issues requiring approval will be communicated immediately</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 40px 40px; text-align: center;">
              <a href="https://propertycentral.lovable.app/owner-portal" 
                 style="display: inline-block; background: linear-gradient(135deg, #1E3A5F 0%, #2D5A87 100%); color: #FFFFFF; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(30, 58, 95, 0.3);">
                View Your Owner Portal
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 32px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #E5E7EB;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 14px;">
                      Questions about your maintenance schedule?
                    </p>
                    <p style="margin: 0; color: #374151; font-size: 14px;">
                      <a href="mailto:alex@peachhausgroup.com" style="color: #1E3A5F; text-decoration: none; font-weight: 500;">alex@peachhausgroup.com</a>
                      &nbsp;|&nbsp;
                      <a href="tel:+14043415202" style="color: #1E3A5F; text-decoration: none; font-weight: 500;">(404) 341-5202</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-top: 24px;">
                    <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
                      © ${new Date().getFullYear()} PeachHaus Property Group. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "PeachHaus <noreply@peachhausgroup.com>",
            to: owner.email,
            subject: `Preventive Maintenance Scheduled - ${property.name || property.address}`,
            html: emailHtml,
          }),
        });

        if (emailResponse.ok) {
          const emailData = await emailResponse.json();
          console.log(`Email sent to owner ${owner.name}: ${emailData.id}`);
          results.ownerEmailSent = true;

          // Log to lead_communications
          await supabase.from("lead_communications").insert({
            owner_id: owner.id,
            communication_type: "email",
            direction: "outbound",
            subject: `Preventive Maintenance Scheduled - ${property.name || property.address}`,
            body: `Preventive maintenance scheduled: ${schedules.length} service(s)`,
            status: "sent",
            external_id: emailData.id,
            metadata: {
              provider: "resend",
              property_id: propertyId,
              schedule_ids: scheduleIds,
              preventive_maintenance: true,
            },
          });
        } else {
          console.error("Failed to send owner email:", await emailResponse.text());
        }
      } catch (emailError) {
        console.error("Email error:", emailError);
      }
    }

    console.log(`Notifications sent: ${results.vendorSmsCount} vendor SMS, owner email: ${results.ownerEmailSent}`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Sent ${results.vendorSmsCount} vendor SMS${results.ownerEmailSent ? " and owner email" : ""}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-preventive-schedule:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
