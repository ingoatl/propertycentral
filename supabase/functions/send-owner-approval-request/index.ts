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

// Format date for display
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Generate a secure random token
function generateApprovalToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workOrderId, vendorNote } = await req.json();

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
        property:properties(id, name, address, owner_id, image_path),
        vendor:vendors!work_orders_assigned_vendor_id_fkey(id, name, phone, company_name)
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
    const propertyName = workOrder.property?.name || "Your property";
    const propertyAddress = workOrder.property?.address || "";
    const quotedCost = workOrder.quoted_cost ? `$${workOrder.quoted_cost.toLocaleString()}` : "pending quote";
    const vendorName = workOrder.vendor?.name || "Assigned vendor";
    const vendorCompany = workOrder.vendor?.company_name || "";
    const requestId = `WO-${workOrder.id.slice(0, 8).toUpperCase()}`;
    const issueDate = formatDate(new Date());
    
    // Get first name from owner
    let ownerFirstName = "there";
    if (owner.name) {
      if (owner.name.includes('&')) {
        ownerFirstName = owner.name.split('&').map((n: string) => n.trim().split(' ')[0]).join(' & ');
      } else if (owner.name.toLowerCase().includes(' and ')) {
        ownerFirstName = owner.name.split(/\sand\s/i).map((n: string) => n.trim().split(' ')[0]).join(' & ');
      } else {
        ownerFirstName = owner.name.split(' ')[0];
      }
    }

    // Generate a secure approval token
    const approvalToken = generateApprovalToken();
    
    // Build approval URLs
    const approvalBaseUrl = `${supabaseUrl}/functions/v1/owner-approval-action`;
    const approveUrl = `${approvalBaseUrl}?workOrderId=${workOrderId}&action=approve&token=${approvalToken}`;
    const declineUrl = `${approvalBaseUrl}?workOrderId=${workOrderId}&action=decline&token=${approvalToken}`;

    // Update work order status and store approval token
    await supabase
      .from("work_orders")
      .update({
        status: "pending_approval",
        owner_approval_requested_at: new Date().toISOString(),
        owner_approval_reminder_count: (workOrder.owner_approval_reminder_count || 0) + 1,
        owner_approval_token: approvalToken,
      })
      .eq("id", workOrderId);

    // Company logo URL
    const logoUrl = `${supabaseUrl}/storage/v1/object/public/property-images/peachhaus-logo.png`;

    // Send SMS via GHL if owner has phone
    if (owner.phone && ghlApiKey && ghlLocationId) {
      const formattedPhone = formatPhoneE164(owner.phone);
      
      // Clean, professional SMS - no emojis
      const smsMessage = `PeachHaus Property Management

Approval Required for ${propertyName}

Issue: ${workOrder.title}
Vendor: ${vendorName}${vendorCompany ? ` (${vendorCompany})` : ''}
Quote: ${quotedCost}
${vendorNote ? `\nVendor Note: ${vendorNote}` : ''}

Reply APPROVE to proceed or DECLINE to reject.

- Ingo`;

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
        // Use owner communication number
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

    // Send Fortune 500 style email if owner has email
    if (owner.email && resendApiKey) {
      // Fortune 500 style: Clean, institutional, bank-statement quality
      // All black text, minimal colors, professional typography
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
    
    <!-- Header -->
    <div style="padding: 24px 32px; border-bottom: 1px solid #e5e5e5;">
      <table style="width: 100%;">
        <tr>
          <td style="vertical-align: middle;">
            <img src="${logoUrl}" alt="PeachHaus" style="height: 32px; width: auto;" />
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <div style="font-size: 14px; font-weight: 600; color: #111111; margin-bottom: 4px;">APPROVAL REQUEST</div>
            <div style="font-size: 10px; color: #666666; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
              ${requestId}
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Property & Date Info -->
    <div style="padding: 20px 32px; background: #f9f9f9; border-bottom: 1px solid #e5e5e5;">
      <table style="width: 100%;">
        <tr>
          <td style="vertical-align: top; width: 60%;">
            <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Property</div>
            <div style="font-size: 14px; font-weight: 600; color: #111111;">${propertyName}</div>
            <div style="font-size: 12px; color: #666666; margin-top: 2px;">${propertyAddress}</div>
          </td>
          <td style="vertical-align: top; text-align: right;">
            <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Date</div>
            <div style="font-size: 14px; font-weight: 600; color: #111111;">${issueDate}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Greeting -->
    <div style="padding: 24px 32px 16px 32px;">
      <p style="font-size: 14px; line-height: 1.6; color: #111111; margin: 0;">
        Dear ${ownerFirstName},
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #444444; margin: 12px 0 0 0;">
        A maintenance quote for your property requires your approval before we proceed with the work.
      </p>
    </div>

    <!-- Quote Amount - Primary Focus -->
    <div style="padding: 0 32px 24px 32px;">
      <table style="width: 100%; border: 2px solid #111111;">
        <tr>
          <td style="padding: 16px 20px; background: #111111;">
            <table style="width: 100%;">
              <tr>
                <td style="vertical-align: middle;">
                  <div style="font-size: 10px; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8;">QUOTED AMOUNT</div>
                  <div style="font-size: 10px; color: #ffffff; opacity: 0.6; margin-top: 2px;">Requires Owner Approval</div>
                </td>
                <td style="text-align: right; vertical-align: middle;">
                  <div style="font-size: 28px; font-weight: 700; color: #ffffff; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
                    ${quotedCost}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- Work Details Section -->
    <div style="padding: 0 32px 16px 32px;">
      <div style="font-size: 11px; font-weight: 600; color: #111111; padding: 8px 0; border-bottom: 1px solid #111111; text-transform: uppercase; letter-spacing: 0.5px;">
        Work Details
      </div>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
            <div style="font-weight: 600; margin-bottom: 4px;">Issue</div>
            <div style="color: #444444;">${workOrder.title}</div>
          </td>
        </tr>
        ${workOrder.description ? `
        <tr>
          <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
            <div style="font-weight: 600; margin-bottom: 4px;">Description</div>
            <div style="color: #444444;">${workOrder.description}</div>
          </td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
            <div style="font-weight: 600; margin-bottom: 4px;">Vendor</div>
            <div style="color: #444444;">${vendorName}${vendorCompany ? ` — ${vendorCompany}` : ''}</div>
          </td>
        </tr>
        ${vendorNote ? `
        <tr>
          <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
            <div style="font-weight: 600; margin-bottom: 4px;">Vendor's Assessment</div>
            <div style="color: #444444; background: #f9f9f9; padding: 12px; border-radius: 4px; border-left: 3px solid #111111;">${vendorNote}</div>
          </td>
        </tr>
        ` : ''}
        ${workOrder.quote_scope ? `
        <tr>
          <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
            <div style="font-weight: 600; margin-bottom: 4px;">Scope of Work</div>
            <div style="color: #444444;">${workOrder.quote_scope}</div>
          </td>
        </tr>
        ` : ''}
        ${workOrder.quote_materials ? `
        <tr>
          <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
            <div style="font-weight: 600; margin-bottom: 4px;">Materials</div>
            <div style="color: #444444;">${workOrder.quote_materials}</div>
          </td>
        </tr>
        ` : ''}
        ${workOrder.quote_labor_hours ? `
        <tr>
          <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
            <div style="font-weight: 600; margin-bottom: 4px;">Estimated Labor</div>
            <div style="color: #444444;">${workOrder.quote_labor_hours} hours</div>
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    <!-- Action Buttons -->
    <div style="padding: 0 32px 24px 32px;">
      <div style="font-size: 11px; font-weight: 600; color: #111111; padding: 8px 0; border-bottom: 1px solid #111111; text-transform: uppercase; letter-spacing: 0.5px;">
        Your Response
      </div>
      <div style="padding: 20px 0;">
        <p style="font-size: 13px; color: #444444; margin: 0 0 20px 0;">Click below to approve or decline this work:</p>
        
        <!-- Approval Buttons -->
        <table style="width: 100%;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-right: 8px; width: 50%;">
              <a href="${approveUrl}" style="display: block; background: #111111; color: #ffffff; text-decoration: none; padding: 16px 24px; text-align: center; font-size: 14px; font-weight: 600; border-radius: 4px;">
                Approve Quote
              </a>
            </td>
            <td style="padding-left: 8px; width: 50%;">
              <a href="${declineUrl}" style="display: block; background: #ffffff; color: #111111; text-decoration: none; padding: 16px 24px; text-align: center; font-size: 14px; font-weight: 600; border: 2px solid #111111; border-radius: 4px;">
                Decline Quote
              </a>
            </td>
          </tr>
        </table>
        
        <p style="font-size: 12px; color: #888888; margin: 16px 0 0 0; text-align: center;">
          Or reply to our SMS with APPROVE or DECLINE
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 24px 32px; background: #f9f9f9; border-top: 1px solid #e5e5e5;">
      <p style="font-size: 12px; color: #666666; margin: 0 0 8px 0;">
        If you have questions about this quote, simply reply to this email or call us.
      </p>
      <p style="font-size: 12px; color: #666666; margin: 0;">
        Best,<br>
        <strong>Ingo</strong><br>
        PeachHaus Group
      </p>
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e5e5;">
        <p style="font-size: 10px; color: #999999; margin: 0;">
          PeachHaus Property Management | Atlanta, GA | 404-991-5076
        </p>
      </div>
    </div>
  </div>
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
            from: "PeachHaus Property Management <noreply@peachhausgroup.com>",
            to: owner.email,
            cc: "info@peachhausgroup.com",
            subject: `Approval Required: ${workOrder.title} — ${quotedCost}`,
            html: emailHtml,
          }),
        });

        if (emailResponse.ok) {
          const emailData = await emailResponse.json();
          console.log(`Owner approval email sent to ${owner.name}: ${emailData.id}`);
          results.email = true;
        } else {
          const errorText = await emailResponse.text();
          console.error("Email send failed:", errorText);
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
