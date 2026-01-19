import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Generate vendor access token
    const vendorToken = crypto.randomUUID().replace(/-/g, '').substring(0, 24);
    const portalUrl = `https://propertycentral.lovable.app/vendor-job/${vendorToken}`;

    // Update work order with access token
    await supabase
      .from("work_orders")
      .update({ 
        vendor_access_token: vendorToken,
        vendor_access_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      })
      .eq("id", workOrderId);

    // Send SMS if vendor has phone and SMS is requested
    if (notifyMethods?.includes("sms") && vendor.phone) {
      const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      const TWILIO_VENDOR_PHONE = Deno.env.get("TWILIO_VENDOR_PHONE_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");

      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VENDOR_PHONE) {
        const smsMessage = `${urgencyLabel ? urgencyLabel + "\n\n" : ""}🔧 New Job Assigned

📍 ${propertyAddress}
Issue: ${workOrder.title}

${workOrder.description?.substring(0, 80)}${workOrder.description?.length > 80 ? "..." : ""}

▶️ View & Upload Photos:
${portalUrl}

Reply CONFIRM to accept or DECLINE to pass.`;

        try {
          const twilioResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
              },
              body: new URLSearchParams({
                From: TWILIO_VENDOR_PHONE,
                To: vendor.phone,
                Body: smsMessage,
              }),
            }
          );

          const twilioData = await twilioResponse.json();
          
          if (twilioResponse.ok) {
            console.log(`SMS sent to vendor ${vendor.name} with job portal link: ${twilioData.sid}`);
            results.sms = true;

            await supabase.from("sms_log").insert({
              phone_number: vendor.phone,
              message_type: "work_order_assignment",
              message_body: smsMessage,
              twilio_message_sid: twilioData.sid,
              status: "sent",
            });
          } else {
            console.error("Failed to send SMS:", twilioData);
          }
        } catch (smsError) {
          console.error("SMS error:", smsError);
        }
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
