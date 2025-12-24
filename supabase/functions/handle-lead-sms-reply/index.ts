import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function handles inbound SMS replies from leads
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Twilio webhook data
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;

    console.log(`Received SMS reply from ${from}: ${body?.substring(0, 50)}...`);

    if (!from) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Normalize phone number for matching
    const normalizedPhone = from.replace(/\D/g, '').slice(-10);
    
    // Find lead by phone number
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .or(`phone.ilike.%${normalizedPhone}`)
      .single();

    if (leadError || !lead) {
      console.log(`No lead found for phone ${from}`);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    console.log(`Found lead: ${lead.id} (${lead.name})`);

    // Record the inbound communication
    await supabase.from("lead_communications").insert({
      lead_id: lead.id,
      communication_type: "sms",
      direction: "inbound",
      body: body,
      status: "delivered",
      external_id: messageSid,
      delivery_status: "delivered",
      replied_at: new Date().toISOString(),
    });

    // Update lead's last response time (this will stop sequences if configured)
    await supabase
      .from("leads")
      .update({ 
        last_response_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", lead.id);

    // Cancel any pending follow-ups if sequence is set to stop on response
    if (lead.active_sequence_id) {
      const { data: sequence } = await supabase
        .from("lead_follow_up_sequences")
        .select("stop_on_response")
        .eq("id", lead.active_sequence_id)
        .single();

      if (sequence?.stop_on_response) {
        await supabase
          .from("lead_follow_up_schedules")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("lead_id", lead.id)
          .eq("status", "pending");

        console.log(`Cancelled pending follow-ups for lead ${lead.id} due to response`);
      }
    }

    // Add timeline entry
    await supabase.from("lead_timeline").insert({
      lead_id: lead.id,
      action: `SMS received: "${body?.substring(0, 100)}${body?.length > 100 ? '...' : ''}"`,
      metadata: { message_sid: messageSid, from },
    });

    console.log(`Successfully processed SMS reply for lead ${lead.id}`);

    // Return empty TwiML response
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (error: unknown) {
    console.error("Error handling SMS reply:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
});
