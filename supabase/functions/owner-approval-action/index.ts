import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const workOrderId = url.searchParams.get("workOrderId");
    const action = url.searchParams.get("action"); // "approve" or "decline"
    const token = url.searchParams.get("token"); // Security token

    if (!workOrderId || !action || !token) {
      return generateHtmlResponse("Missing required parameters", false);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the token matches the work order's approval token
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .select(`
        *,
        property:properties(id, name, address, owner_id),
        vendor:vendors!work_orders_assigned_vendor_id_fkey(id, name, phone, company_name)
      `)
      .eq("id", workOrderId)
      .eq("owner_approval_token", token)
      .single();

    if (woError || !workOrder) {
      console.error("Work order not found or invalid token:", woError);
      return generateHtmlResponse("Invalid or expired approval link. Please contact your property manager.", false);
    }

    // Check if already processed
    if (workOrder.owner_approved !== null) {
      const status = workOrder.owner_approved ? "approved" : "declined";
      return generateHtmlResponse(`This work order has already been ${status}.`, true, status === "approved");
    }

    // Get owner details
    const { data: owner } = await supabase
      .from("property_owners")
      .select("id, name, email, phone")
      .eq("id", workOrder.property?.owner_id)
      .single();

    const ownerName = owner?.name || "Owner";
    const vendorName = workOrder.vendor?.name || "Vendor";
    const vendorPhone = workOrder.vendor?.phone;
    const quotedCost = workOrder.quoted_cost ? `$${workOrder.quoted_cost.toLocaleString()}` : "pending";
    const propertyName = workOrder.property?.name || "Property";

    if (action === "approve") {
      // Update work order to approved
      await supabase
        .from("work_orders")
        .update({
          owner_approved: true,
          owner_approved_at: new Date().toISOString(),
          status: "scheduled",
        })
        .eq("id", workOrderId);

      // Add timeline entry
      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrderId,
        action: `Owner ${ownerName} approved the quote of ${quotedCost}`,
        performed_by_type: "owner",
        performed_by_name: ownerName,
        new_status: "scheduled",
      });

      // Notify vendor via GHL
      if (vendorPhone && ghlApiKey && ghlLocationId) {
        await notifyVendorViaGHL(
          ghlApiKey,
          ghlLocationId,
          vendorPhone,
          vendorName,
          `PeachHaus Property Management\n\nGood news! Your quote of ${quotedCost} for ${propertyName} has been approved by the owner.\n\nPlease proceed with the work and reply DONE when complete.\n\nWO #${workOrder.work_order_number || workOrderId.slice(0, 8).toUpperCase()}`
        );
      }

      return generateHtmlResponse(
        `Thank you! You have approved the quote of ${quotedCost} for ${workOrder.title}. The vendor has been notified to proceed.`,
        true,
        true
      );
    } else if (action === "decline") {
      // Update work order to declined
      await supabase
        .from("work_orders")
        .update({
          owner_approved: false,
          owner_approved_at: new Date().toISOString(),
          status: "on_hold",
        })
        .eq("id", workOrderId);

      // Add timeline entry
      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrderId,
        action: `Owner ${ownerName} declined the quote of ${quotedCost}`,
        performed_by_type: "owner",
        performed_by_name: ownerName,
        new_status: "on_hold",
      });

      // Notify vendor via GHL
      if (vendorPhone && ghlApiKey && ghlLocationId) {
        await notifyVendorViaGHL(
          ghlApiKey,
          ghlLocationId,
          vendorPhone,
          vendorName,
          `PeachHaus Property Management\n\nThe owner has declined your quote of ${quotedCost} for ${propertyName}.\n\nOur team will follow up with next steps.\n\nWO #${workOrder.work_order_number || workOrderId.slice(0, 8).toUpperCase()}`
        );
      }

      return generateHtmlResponse(
        `You have declined the quote of ${quotedCost} for ${workOrder.title}. Our team will follow up with alternative options.`,
        true,
        false
      );
    }

    return generateHtmlResponse("Invalid action", false);
  } catch (error: unknown) {
    console.error("Owner approval action error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return generateHtmlResponse(`An error occurred: ${errorMessage}`, false);
  }
});

async function notifyVendorViaGHL(
  ghlApiKey: string,
  ghlLocationId: string,
  vendorPhone: string,
  vendorName: string,
  message: string
) {
  try {
    // Format phone
    const digits = vendorPhone.replace(/\D/g, '');
    const formattedPhone = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : vendorPhone;

    // Find or create contact
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

    let ghlContactId = null;
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
            name: vendorName,
          }),
        }
      );

      if (createResponse.ok) {
        const createData = await createResponse.json();
        ghlContactId = createData.contact?.id;
      }
    }

    if (ghlContactId) {
      await fetch(
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
            message: message,
            fromNumber: "+14045741740",
          }),
        }
      );
      console.log(`Vendor notification sent to ${vendorName}`);
    }
  } catch (error) {
    console.error("Failed to notify vendor:", error);
  }
}

function generateHtmlResponse(message: string, success: boolean, approved?: boolean): Response {
  const logoUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";
  
  const statusColor = success 
    ? (approved ? "#111111" : "#666666")
    : "#dc2626";
  
  const statusIcon = success
    ? (approved 
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`)
    : `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PeachHaus - Approval Response</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      max-width: 480px;
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    }
    .header {
      padding: 24px;
      border-bottom: 1px solid #e5e5e5;
    }
    .header img { height: 28px; }
    .content {
      padding: 48px 24px;
      text-align: center;
    }
    .icon { margin-bottom: 24px; }
    .message {
      font-size: 16px;
      line-height: 1.6;
      color: #333;
    }
    .footer {
      padding: 24px;
      background: #f9f9f9;
      border-top: 1px solid #e5e5e5;
      text-align: center;
    }
    .footer p {
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="PeachHaus" />
    </div>
    <div class="content">
      <div class="icon">${statusIcon}</div>
      <p class="message">${message}</p>
    </div>
    <div class="footer">
      <p>PeachHaus Property Management | 404-991-5076</p>
    </div>
  </div>
</body>
</html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
