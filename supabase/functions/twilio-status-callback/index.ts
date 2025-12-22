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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse form data from Twilio
    const formData = await req.formData();
    const messageSid = formData.get("MessageSid") as string;
    const messageStatus = formData.get("MessageStatus") as string;
    const errorCode = formData.get("ErrorCode") as string;
    const errorMessage = formData.get("ErrorMessage") as string;
    const to = formData.get("To") as string;

    console.log(`Status callback received - SID: ${messageSid}, Status: ${messageStatus}, Error: ${errorCode || "none"}`);

    if (!messageSid) {
      console.error("No MessageSid in callback");
      return new Response("OK", { status: 200 });
    }

    // Update sms_log with delivery status
    const updateData: Record<string, unknown> = {
      delivery_status: messageStatus,
      delivery_status_updated_at: new Date().toISOString(),
    };

    // Map Twilio status to our status
    if (messageStatus === "delivered") {
      updateData.status = "delivered";
    } else if (messageStatus === "failed" || messageStatus === "undelivered") {
      updateData.status = "failed";
      if (errorCode) {
        updateData.error_code = parseInt(errorCode, 10);
        updateData.error_message = errorMessage || `Twilio error code: ${errorCode}`;
      }
    }

    // Update by twilio_message_sid
    const { error: updateError, count } = await supabase
      .from("sms_log")
      .update(updateData)
      .eq("twilio_message_sid", messageSid);

    if (updateError) {
      console.error("Error updating sms_log:", updateError);
    } else {
      console.log(`Updated sms_log for SID ${messageSid} to status ${messageStatus}`);
    }

    // Handle specific error codes
    if (errorCode) {
      const code = parseInt(errorCode, 10);
      
      // 30003 = Unreachable destination
      // 30004 = Message blocked
      // 30005 = Unknown destination
      // 30006 = Landline or unreachable carrier
      // 30007 = Carrier violation (spam)
      // 21610 = Unsubscribed recipient
      const problematicCodes = [30003, 30004, 30005, 30006, 30007, 21610];
      
      if (problematicCodes.includes(code)) {
        console.log(`Problematic error code ${code} for ${to}, may need attention`);
        
        // For unsubscribe errors, update opt-out status
        if (code === 21610) {
          const cleanPhone = to.replace(/[\s\-\(\)\+]/g, "");
          const phoneDigits = cleanPhone.slice(-10);
          
          await supabase
            .from("google_review_requests")
            .update({
              opted_out: true,
              opted_out_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .ilike("guest_phone", `%${phoneDigits}`);
          
          console.log(`Marked ${to} as opted out due to carrier-level unsubscribe`);
        }
      }
    }

    // Return TwiML response
    return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Status callback error:", error);
    return new Response("OK", { status: 200 });
  }
});
