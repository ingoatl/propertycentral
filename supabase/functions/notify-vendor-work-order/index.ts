import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workOrderId, vendorId, notifyMethods } = await req.json();

    if (!workOrderId || !vendorId) {
      return new Response(
        JSON.stringify({ success: false, error: "Work order ID and vendor ID are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch work order with property
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .select("*, property:properties(name, address)")
      .eq("id", workOrderId)
      .single();

    if (woError || !workOrder) {
      console.error("Work order not found:", woError);
      return new Response(
        JSON.stringify({ success: false, error: "Work order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch vendor
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .single();

    if (vendorError || !vendor) {
      console.error("Vendor not found:", vendorError);
      return new Response(
        JSON.stringify({ success: false, error: "Vendor not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      sms: false,
      email: false,
    };

    const propertyAddress = workOrder.property?.address || workOrder.property?.name || "Property";
    const urgencyLabel = workOrder.urgency === "emergency" ? "🚨 EMERGENCY" : 
                         workOrder.urgency === "high" ? "⚠️ HIGH PRIORITY" : "";

    // Generate vendor access token - valid for 1 YEAR
    const vendorToken = crypto.randomUUID().replace(/-/g, '').substring(0, 24);
    const portalUrl = `https://propertycentral.lovable.app/vendor-job/${vendorToken}`;

    // Update work order with access token - 1 year expiry
    await supabase
      .from("work_orders")
      .update({ 
        vendor_access_token: vendorToken,
        vendor_access_token_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 YEAR
      })
      .eq("id", workOrderId);

    // Send SMS via GHL if vendor has phone and SMS is requested
    if (notifyMethods?.includes("sms") && vendor.phone) {
      const smsMessage = `${urgencyLabel ? urgencyLabel + "\n\n" : ""}🔧 New Job Assigned

📍 ${propertyAddress}
Issue: ${workOrder.title}

${workOrder.description?.substring(0, 80)}${workOrder.description?.length > 80 ? "..." : ""}

▶️ View & Upload Photos:
${portalUrl}

Reply CONFIRM to accept or DECLINE to pass.`;

      if (ghlApiKey && ghlLocationId) {
        const formattedPhone = formatPhoneE164(vendor.phone);
        
        // Find or create GHL contact for this vendor
        let ghlContactId = null;
        
        // Search for existing contact
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
            console.log(`Found existing GHL contact for vendor: ${ghlContactId}`);
          }
        }

        // Create contact if not found
        if (!ghlContactId) {
          console.log(`Creating GHL contact for vendor: ${vendor.name}`);
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
            console.log(`Created new GHL contact for vendor: ${ghlContactId}`);
          } else {
            console.error("Failed to create GHL contact:", await createResponse.text());
          }
        }

        // Send SMS via GHL
        if (ghlContactId) {
          try {
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
              console.log(`SMS sent to vendor ${vendor.name} via GHL: ${sendData.messageId}`);
              results.sms = true;

              // Log to lead_communications for inbox visibility
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
                  vendor_phone: formattedPhone,
                  contact_type: "vendor",
                  work_order_id: workOrderId,
                },
              });

              await supabase.from("sms_log").insert({
                phone_number: vendor.phone,
                message_type: "work_order_assignment",
                message_body: smsMessage,
                ghl_message_id: sendData.messageId,
                status: "sent",
              });
            } else {
              const errorText = await sendResponse.text();
              console.error("Failed to send SMS via GHL:", errorText);
            }
          } catch (smsError) {
            console.error("GHL SMS error:", smsError);
          }
        }
      } else {
        console.log("GHL credentials not configured, skipping SMS");
      }
    }

    // Send email if vendor has email and email is requested
    if (notifyMethods?.includes("email") && vendor.email) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

      if (RESEND_API_KEY) {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${urgencyLabel ? `<div style="background: ${workOrder.urgency === "emergency" ? "#fee2e2" : "#fef3c7"}; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-weight: bold;">${urgencyLabel}</div>` : ""}
            
            <h2 style="color: #1f2937;">New Work Order Assigned</h2>
            
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <p style="margin: 0 0 8px 0;"><strong>Property:</strong> ${propertyAddress}</p>
              <p style="margin: 0 0 8px 0;"><strong>Issue:</strong> ${workOrder.title}</p>
              <p style="margin: 0 0 8px 0;"><strong>Category:</strong> ${workOrder.category}</p>
              <p style="margin: 0 0 8px 0;"><strong>Urgency:</strong> ${workOrder.urgency}</p>
            </div>
            
            <h3 style="color: #374151;">Description</h3>
            <p style="color: #4b5563;">${workOrder.description}</p>
            
            ${workOrder.access_instructions ? `
              <h3 style="color: #374151;">Access Instructions</h3>
              <p style="color: #4b5563;">${workOrder.access_instructions}</p>
            ` : ""}
            
            <div style="margin: 24px 0; text-align: center;">
              <a href="${portalUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Job & Upload Photos</a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            
            <p style="color: #6b7280; font-size: 14px;">
              Please respond via SMS to confirm your availability. Reply CONFIRM to accept or DECLINE to pass.
            </p>
            
            <p style="color: #6b7280; font-size: 14px;">
              After completing the work, please submit your invoice through Bill.com.
            </p>
          </div>
        `;

        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "PeachHaus <noreply@peachhausgroup.com>",
              to: vendor.email,
              subject: `${urgencyLabel ? urgencyLabel + " - " : ""}New Work Order: ${workOrder.title}`,
              html: emailHtml,
            }),
          });

          const emailData = await emailResponse.json();

          if (emailResponse.ok) {
            console.log(`Email sent to vendor ${vendor.name}: ${emailData.id}`);
            results.email = true;
          } else {
            console.error("Failed to send email:", emailData);
          }
        } catch (emailError) {
          console.error("Email error:", emailError);
        }
      } else {
        console.log("Resend API key not configured, skipping email");
      }
    }

    // Add timeline entry
    await supabase.from("work_order_timeline").insert({
      work_order_id: workOrderId,
      action: `Notification sent to vendor via ${[results.sms && "SMS", results.email && "Email"].filter(Boolean).join(" and ") || "no channels"}`,
      performed_by_type: "system",
      performed_by_name: "System",
    });

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Notifications sent: ${results.sms ? "SMS ✓" : ""} ${results.email ? "Email ✓" : ""}`.trim() || "No notifications sent",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error notifying vendor:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
