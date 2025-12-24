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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { leadId, type, message, subject } = await req.json();
    console.log(`Sending ${type} notification to lead ${leadId}`);

    // Fetch the lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found");
    }

    let result: { success: boolean; externalId?: string; error?: string } = { success: false };

    if (type === "sms" && lead.phone) {
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioPhone = Deno.env.get("TWILIO_VENDOR_PHONE_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhone) {
        throw new Error("Twilio credentials not configured");
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      
      const formData = new URLSearchParams();
      formData.append("To", lead.phone);
      formData.append("From", twilioPhone);
      formData.append("Body", message);

      const twilioResponse = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const twilioResult = await twilioResponse.json();
      
      result = {
        success: twilioResponse.ok,
        externalId: twilioResult.sid,
        error: twilioResult.error_message,
      };

      // Update communication record
      await supabase
        .from("lead_communications")
        .update({
          status: twilioResponse.ok ? "sent" : "failed",
          external_id: twilioResult.sid,
          error_message: twilioResult.error_message,
          sent_at: twilioResponse.ok ? new Date().toISOString() : null,
        })
        .eq("lead_id", leadId)
        .eq("communication_type", "sms")
        .eq("body", message)
        .eq("status", "pending");

      console.log(`SMS ${twilioResponse.ok ? "sent" : "failed"}: ${twilioResult.sid || twilioResult.error_message}`);
      
    } else if (type === "email" && lead.email) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      
      if (!resendApiKey) {
        throw new Error("Resend API key not configured");
      }

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "PeachHaus <hello@peachhaus.co>",
          to: [lead.email],
          subject: subject || "Message from PeachHaus",
          text: message,
        }),
      });

      const emailResult = await emailResponse.json();
      
      result = {
        success: emailResponse.ok,
        externalId: emailResult.id,
        error: emailResult.message,
      };

      // Update communication record
      await supabase
        .from("lead_communications")
        .update({
          status: emailResponse.ok ? "sent" : "failed",
          external_id: emailResult.id,
          error_message: emailResult.message,
          sent_at: emailResponse.ok ? new Date().toISOString() : null,
        })
        .eq("lead_id", leadId)
        .eq("communication_type", "email")
        .eq("body", message)
        .eq("status", "pending");

      console.log(`Email ${emailResponse.ok ? "sent" : "failed"}: ${emailResult.id || emailResult.message}`);
    } else {
      throw new Error(`Invalid notification type or missing contact info for ${type}`);
    }

    // Add timeline entry
    if (result.success) {
      await supabase.from("lead_timeline").insert({
        lead_id: leadId,
        action: `Manual ${type.toUpperCase()} sent`,
        metadata: { external_id: result.externalId },
      });
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending lead notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
