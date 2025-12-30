import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// Format phone number to E.164 for matching
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("GHL Inbound Webhook received:", JSON.stringify(payload, null, 2));

    // GHL InboundMessage webhook structure
    const {
      type,
      body: messageBody,
      contactId: ghlContactId,
      conversationId: ghlConversationId,
      direction,
      messageType,
      dateAdded,
      locationId,
    } = payload;

    // Only process inbound SMS messages
    if (type !== "InboundMessage" || messageType !== "TYPE_SMS" || direction !== "inbound") {
      console.log("Ignoring non-inbound SMS event:", type, messageType, direction);
      return new Response(JSON.stringify({ success: true, message: "Event ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get contact phone from GHL API
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    if (!ghlApiKey) {
      throw new Error("GHL_API_KEY not configured");
    }

    let contactPhone: string | null = null;
    let contactName: string | null = null;

    // Fetch contact details from GHL
    try {
      const contactResponse = await fetch(
        `https://services.leadconnectorhq.com/contacts/${ghlContactId}`,
        {
          headers: {
            Authorization: `Bearer ${ghlApiKey}`,
            Version: "2021-07-28",
          },
        }
      );

      if (contactResponse.ok) {
        const contactData = await contactResponse.json();
        contactPhone = contactData.contact?.phone || null;
        contactName = contactData.contact?.name || contactData.contact?.firstName || null;
        console.log("GHL contact fetched:", { phone: contactPhone, name: contactName });
      } else {
        console.error("Failed to fetch GHL contact:", await contactResponse.text());
      }
    } catch (e) {
      console.error("Error fetching GHL contact:", e);
    }

    if (!contactPhone) {
      console.log("No phone number found for GHL contact");
      return new Response(JSON.stringify({ success: false, message: "No phone number found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize phone for matching
    const normalizedPhone = normalizePhone(contactPhone);
    console.log("Looking for lead with phone:", normalizedPhone);

    // Find matching lead by phone number
    const { data: leads, error: leadError } = await supabase
      .from("leads")
      .select("id, name, phone, stage, active_sequence_id")
      .or(`phone.eq.${normalizedPhone},phone.eq.${contactPhone},phone.ilike.%${normalizedPhone.slice(-10)}%`)
      .limit(1);

    if (leadError) {
      console.error("Error finding lead:", leadError);
      throw leadError;
    }

    const lead = leads?.[0];

    if (!lead) {
      console.log("No matching lead found for phone:", normalizedPhone);
      // Still log the message for manual review
      return new Response(
        JSON.stringify({ success: true, message: "No matching lead found", phone: normalizedPhone }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found matching lead:", lead.id, lead.name);

    // Create lead_communications record
    const { data: comm, error: commError } = await supabase
      .from("lead_communications")
      .insert({
        lead_id: lead.id,
        communication_type: "sms",
        direction: "inbound",
        body: messageBody,
        status: "received",
        ghl_conversation_id: ghlConversationId,
        ghl_contact_id: ghlContactId,
        is_read: false,
      })
      .select()
      .single();

    if (commError) {
      console.error("Error creating communication:", commError);
      throw commError;
    }

    console.log("Communication record created:", comm.id);

    // Update lead with last_response_at and has_unread_messages
    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({
        last_response_at: new Date().toISOString(),
        has_unread_messages: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (leadUpdateError) {
      console.error("Error updating lead:", leadUpdateError);
    }

    // Check if we need to pause/cancel follow-up sequences
    if (lead.active_sequence_id) {
      // Check if sequence has stop_on_response enabled
      const { data: sequence } = await supabase
        .from("lead_follow_up_sequences")
        .select("stop_on_response")
        .eq("id", lead.active_sequence_id)
        .single();

      if (sequence?.stop_on_response) {
        console.log("Cancelling pending follow-ups due to lead response");
        
        // Cancel all pending follow-ups for this lead
        const { error: cancelError } = await supabase
          .from("lead_follow_up_schedules")
          .update({ status: "cancelled" })
          .eq("lead_id", lead.id)
          .eq("status", "pending");

        if (cancelError) {
          console.error("Error cancelling follow-ups:", cancelError);
        } else {
          // Log timeline entry
          await supabase.from("lead_timeline").insert({
            lead_id: lead.id,
            action: "Follow-up sequence paused due to lead response",
            performed_by_name: "System",
          });
        }
      }
    }

    // Add timeline entry for the inbound message
    const messagePreview = messageBody.length > 50 ? messageBody.slice(0, 50) + "..." : messageBody;
    await supabase.from("lead_timeline").insert({
      lead_id: lead.id,
      action: `SMS received: "${messagePreview}"`,
      performed_by_name: lead.name || contactName || "Lead",
    });

    console.log("GHL inbound SMS processed successfully for lead:", lead.id);

    return new Response(
      JSON.stringify({
        success: true,
        leadId: lead.id,
        communicationId: comm.id,
        message: "Inbound SMS processed successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing GHL webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
