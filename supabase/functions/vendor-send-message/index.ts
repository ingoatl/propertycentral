import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Alex's routing info
const ALEX_USER_ID = "fbd13e57-3a59-4c53-bb3b-14ab354b3420";
const ALEX_PHONE_NUMBER = "+14043415202";
const ALEX_ASSIGNMENT_ID = "8f7ad44a-0fd1-412e-aba7-16c6908c89d5";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workOrderId, vendorId, vendorName, vendorPhone, message } = await req.json();

    if (!workOrderId || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get work order details for context
    const { data: workOrder } = await supabase
      .from("work_orders")
      .select("title, property:properties(name, address)")
      .eq("id", workOrderId)
      .single();

    const property = Array.isArray(workOrder?.property) 
      ? workOrder.property[0] 
      : workOrder?.property;
    const propertyName = property?.name || "Unknown Property";
    const propertyAddress = property?.address || "";

    // Create communication record routed to Alex
    const { error: commError } = await supabase
      .from("lead_communications")
      .insert({
        communication_type: "sms",
        direction: "inbound",
        body: message,
        from_number: vendorPhone || "vendor_portal",
        to_number: ALEX_PHONE_NUMBER,
        assigned_user_id: ALEX_USER_ID,
        recipient_user_id: ALEX_USER_ID,
        status: "received",
        metadata: {
          work_order_id: workOrderId,
          vendor_id: vendorId,
          vendor_name: vendorName,
          vendor_phone: vendorPhone,
          property_name: propertyName,
          property_address: propertyAddress,
          message_source: "vendor_portal",
          alex_routed: true,
          display_name: `${vendorName} (Vendor)`,
        },
      });

    if (commError) {
      console.error("Failed to create communication:", commError);
      throw commError;
    }

    // Also add to work order timeline
    await supabase.from("work_order_timeline").insert({
      work_order_id: workOrderId,
      action: "vendor_message",
      description: `${vendorName} sent a message: "${message.substring(0, 100)}${message.length > 100 ? "..." : ""}"`,
      performed_by: vendorName,
      user_type: "vendor",
    });

    console.log(`Vendor message from ${vendorName} routed to Alex for work order ${workOrderId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in vendor-send-message:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
