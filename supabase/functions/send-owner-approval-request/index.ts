import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { workOrderId } = await req.json();

    if (!workOrderId) {
      return new Response(
        JSON.stringify({ success: false, error: "Work order ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch work order with property and vendor details
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .select(`
        *,
        property:properties(id, name, address, owner_id),
        vendor:vendors!work_orders_assigned_vendor_id_fkey(id, name, phone)
      `)
      .eq("id", workOrderId)
      .single();

    if (woError || !workOrder) {
      console.error("Work order not found:", woError);
      return new Response(
        JSON.stringify({ success: false, error: "Work order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get owner details
    const { data: owner, error: ownerError } = await supabase
      .from("property_owners")
      .select("id, name, email, phone")
      .eq("id", workOrder.property?.owner_id)
      .single();

    if (ownerError || !owner) {
      console.error("Owner not found:", ownerError);
      return new Response(
        JSON.stringify({ success: false, error: "Property owner not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = { sms: false, email: false };
    const propertyName = workOrder.property?.name || workOrder.property?.address || "Your property";
    const quotedCost = workOrder.quoted_cost ? `$${workOrder.quoted_cost.toLocaleString()}` : "pending quote";
    const vendorName = workOrder.vendor?.name || "Assigned vendor";

    // Update work order status and track approval request
    await supabase
      .from("work_orders")
      .update({
        status: "pending_approval",
        owner_approval_requested_at: new Date().toISOString(),
        owner_approval_reminder_count: (workOrder.owner_approval_reminder_count || 0) + 1,
      })
      .eq("id", workOrderId);

    // Send SMS via GHL if owner has phone
    if (owner.phone && ghlApiKey && ghlLocationId) {
      const formattedPhone = formatPhoneE164(owner.phone);
      
      const smsMessage = `🏠 Approval Needed for ${propertyName}

Issue: ${workOrder.title}
Vendor: ${vendorName}
Quote: ${quotedCost}

Reply APPROVE to proceed or DECLINE to reject.

Questions? Reply to this message.`;

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
        ghlContactId = searchData.contact?.id;
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
              name: owner.name || "Owner",
              email: owner.email || undefined,
            }),
          }
        );

        if (createResponse.ok) {
          const createData = await createResponse.json();
          ghlContactId = createData.contact?.id;
        }
      }

      if (ghlContactId) {
        // Use owner communication number (different from vendor number)
        const fromNumber = "+14046090955";
        
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
              fromNumber: fromNumber,
            }),
          }
        );

        if (sendResponse.ok) {
          const sendData = await sendResponse.json();
          console.log(`Owner approval SMS sent to ${owner.name}: ${sendData.messageId}`);
          results.sms = true;

          // Log communication
          await supabase.from("lead_communications").insert({
            owner_id: owner.id,
            communication_type: "sms",
            direction: "outbound",
            body: smsMessage,
            status: "sent",
            external_id: sendData.messageId,
            ghl_conversation_id: sendData.conversationId,
            metadata: {
              provider: "gohighlevel",
              ghl_contact_id: ghlContactId,
              from_number: fromNumber,
              to_number: formattedPhone,
              work_order_id: workOrderId,
              approval_request: true,
            },
          });
        }
      }
    }

    // Send email if owner has email
    if (owner.email && resendApiKey) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <h2 style="margin: 0; color: #92400e;">⚠️ Approval Required</h2>
          </div>
          
          <p>Hi ${owner.name || "there"},</p>
          
          <p>A maintenance quote requires your approval for <strong>${propertyName}</strong>:</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Issue:</strong> ${workOrder.title}</p>
            <p style="margin: 0 0 8px 0;"><strong>Description:</strong> ${workOrder.description || "N/A"}</p>
            <p style="margin: 0 0 8px 0;"><strong>Vendor:</strong> ${vendorName}</p>
            <p style="margin: 0; font-size: 20px;"><strong>Quote:</strong> ${quotedCost}</p>
          </div>
          
          <p><strong>To approve or decline:</strong></p>
          <ul>
            <li>Reply to the SMS we sent with <strong>APPROVE</strong> or <strong>DECLINE</strong></li>
            <li>Or log in to your owner portal to review details and approve</li>
          </ul>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          
          <p style="color: #6b7280; font-size: 14px;">
            If you have questions, simply reply to this email or call us.
          </p>
          
          <p style="color: #6b7280; font-size: 14px;">
            — PeachHaus Property Management
          </p>
        </div>
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
            subject: `⚠️ Approval Needed: ${workOrder.title} - ${quotedCost}`,
            html: emailHtml,
          }),
        });

        if (emailResponse.ok) {
          const emailData = await emailResponse.json();
          console.log(`Owner approval email sent to ${owner.name}: ${emailData.id}`);
          results.email = true;
        }
      } catch (emailError) {
        console.error("Email error:", emailError);
      }
    }

    // Add timeline entry
    await supabase.from("work_order_timeline").insert({
      work_order_id: workOrderId,
      action: `Owner approval request sent via ${[results.sms && "SMS", results.email && "Email"].filter(Boolean).join(" and ") || "no channels"}`,
      performed_by_type: "system",
      performed_by_name: "System",
    });

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Approval request sent: ${results.sms ? "SMS ✓" : ""} ${results.email ? "Email ✓" : ""}`.trim(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending owner approval request:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
