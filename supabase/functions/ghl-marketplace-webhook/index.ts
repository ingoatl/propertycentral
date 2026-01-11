import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wh-signature",
};

// Format phone number to E.164 for matching - strips ALL non-digit characters including Unicode
function normalizePhone(phone: string): string {
  // Remove ALL non-digit characters including Unicode formatting characters
  const digits = phone.replace(/[^\d]/g, "");
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
    const ghlApiKey = Deno.env.get("GHL_API_KEY") || Deno.env.get("GOHIGHLEVEL_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("GHL Marketplace Webhook received:", JSON.stringify(payload, null, 2));

    // GHL Marketplace webhook format for InboundMessage
    // {
    //   "type": "InboundMessage",
    //   "locationId": "...",
    //   "attachments": [],
    //   "body": "message text",
    //   "contactId": "...",
    //   "conversationId": "...",
    //   "dateAdded": "...",
    //   "direction": "inbound",
    //   "messageType": "SMS",
    //   "status": "delivered",
    //   "messageId": "..."
    // }

    const {
      type,
      locationId,
      attachments,
      body: messageBody,
      contactId: ghlContactId,
      conversationId,
      dateAdded,
      direction,
      messageType,
      status,
      messageId,
      callDuration,
      callStatus,
    } = payload;

    // Process InboundMessage and call events
    const supportedTypes = ["InboundMessage", "InboundCall", "CallCompleted", "OutboundMessage"];
    if (!supportedTypes.includes(type)) {
      console.log("Ignoring unsupported event type:", type);
      return new Response(JSON.stringify({ success: true, message: `Ignored event type: ${type}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Handle call events
    const isCallEvent = type === "InboundCall" || type === "CallCompleted";
    if (isCallEvent) {
      console.log("Processing call event:", type);
    }

    // Skip if no body (unless it's a call/voicemail)
    if (!messageBody && messageType !== "CALL") {
      console.log("No message body found in payload");
      return new Response(JSON.stringify({ success: true, message: "No message body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract media URLs from attachments array - check ALL possible formats
    const mediaUrls: string[] = [];
    
    // Check attachments array
    if (attachments && Array.isArray(attachments)) {
      for (const attachment of attachments) {
        if (typeof attachment === "string") {
          mediaUrls.push(attachment);
        } else if (attachment?.url) {
          mediaUrls.push(attachment.url);
        } else if (attachment?.mediaUrl) {
          mediaUrls.push(attachment.mediaUrl);
        } else if (attachment?.link) {
          mediaUrls.push(attachment.link);
        }
      }
    }
    
    // Check payload.mediaUrls (alternative location)
    if (payload.mediaUrls && Array.isArray(payload.mediaUrls)) {
      for (const url of payload.mediaUrls) {
        if (typeof url === "string" && !mediaUrls.includes(url)) {
          mediaUrls.push(url);
        }
      }
    }
    
    // Check payload.media (another alternative)
    if (payload.media && Array.isArray(payload.media)) {
      for (const media of payload.media) {
        if (typeof media === "string" && !mediaUrls.includes(media)) {
          mediaUrls.push(media);
        } else if (media?.url && !mediaUrls.includes(media.url)) {
          mediaUrls.push(media.url);
        }
      }
    }
    
    console.log("Media URLs found:", mediaUrls);

    // We need to get the contact's phone number from GHL API using contactId
    let contactPhone = "";
    let contactName = "Unknown";
    let contactEmail = "";

    if (ghlContactId && ghlApiKey) {
      try {
        const contactResponse = await fetch(
          `https://services.leadconnectorhq.com/contacts/${ghlContactId}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${ghlApiKey}`,
              "Version": "2021-07-28",
              "Content-Type": "application/json",
            },
          }
        );

        if (contactResponse.ok) {
          const contactData = await contactResponse.json();
          console.log("GHL Contact data:", JSON.stringify(contactData, null, 2));
          contactPhone = contactData.contact?.phone || contactData.phone || "";
          contactName = contactData.contact?.name || contactData.contact?.firstName || contactData.name || contactData.firstName || "Unknown";
          contactEmail = contactData.contact?.email || contactData.email || "";
        } else {
          console.error("Failed to fetch GHL contact:", contactResponse.status, await contactResponse.text());
        }
      } catch (fetchError) {
        console.error("Error fetching GHL contact:", fetchError);
      }
    }

    // Determine communication type
    const commType = messageType === "CALL" ? "call" : 
                     messageType === "Email" ? "email" : "sms";

    // If we couldn't get contact phone from API, store with contactId for later resolution
    if (!contactPhone) {
      console.log("Could not resolve contact phone, storing with GHL contact ID");
      
      const { data: comm, error: commError } = await supabase
        .from("lead_communications")
        .insert({
          communication_type: commType,
          direction: "inbound",
          body: messageBody || (messageType === "CALL" ? `Inbound call (${callStatus || "unknown"})` : ""),
          status: status || "received",
          ghl_contact_id: ghlContactId,
          ghl_conversation_id: conversationId,
          ghl_message_id: messageId,
          is_read: false,
          call_duration: callDuration,
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          metadata: {
            ghl_location_id: locationId,
            ghl_contact_id: ghlContactId,
            ghl_conversation_id: conversationId,
            contact_name: contactName,
            unresolved: true,
          }
        })
        .select()
        .single();

      if (commError) {
        console.error("Error creating communication:", commError);
        throw commError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Message stored - contact phone pending resolution",
          communicationId: comm?.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone for matching
    const normalizedPhone = normalizePhone(contactPhone);
    const digits = normalizedPhone.replace(/\D/g, "");
    const last10Digits = digits.slice(-10);
    const last4Digits = digits.slice(-4);
    console.log("Looking for contact with phone:", normalizedPhone, "last 10:", last10Digits);

    // Find matching lead
    const { data: leads, error: leadError } = await supabase
      .from("leads")
      .select("id, name, phone, stage, active_sequence_id")
      .ilike("phone", `%${last4Digits}%`)
      .limit(20);

    if (leadError) {
      console.error("Error finding lead:", leadError);
    }

    const lead = leads?.find(l => {
      const leadDigits = l.phone?.replace(/\D/g, "").slice(-10);
      return leadDigits === last10Digits;
    });

    // Check mid_term_bookings (tenants) if no lead found
    let tenantMatch: { id: string; name: string; phone: string } | null = null;
    if (!lead) {
      const { data: tenants, error: tenantError } = await supabase
        .from("mid_term_bookings")
        .select("id, tenant_name, tenant_phone")
        .ilike("tenant_phone", `%${last4Digits}%`)
        .limit(20);

      if (!tenantError && tenants) {
        const tenant = tenants.find(t => {
          const tenantDigits = t.tenant_phone?.replace(/\D/g, "").slice(-10);
          return tenantDigits === last10Digits;
        });
        if (tenant) {
          tenantMatch = { id: tenant.id, name: tenant.tenant_name, phone: tenant.tenant_phone };
          console.log("Found matching tenant:", tenantMatch.id, tenantMatch.name);
        }
      }
    }

    // Prepare metadata
    const metadata: Record<string, unknown> = {
      ghl_location_id: locationId,
      ghl_contact_id: ghlContactId,
      ghl_conversation_id: conversationId,
    };

    if (!lead && !tenantMatch) {
      metadata.unmatched_phone = normalizedPhone;
      metadata.contact_name = contactName;
      metadata.ghl_data = { contactPhone, contactName, contactEmail };
    } else if (tenantMatch) {
      metadata.tenant_id = tenantMatch.id;
      metadata.tenant_name = tenantMatch.name;
      metadata.tenant_phone = tenantMatch.phone;
    }

    // Create lead_communications record
    const { data: comm, error: commError } = await supabase
      .from("lead_communications")
      .insert({
        lead_id: lead?.id || null,
        communication_type: commType,
        direction: "inbound",
        body: messageBody || (messageType === "CALL" ? `Inbound call (${callStatus || "unknown"})` : ""),
        status: status || "received",
        ghl_contact_id: ghlContactId,
        ghl_conversation_id: conversationId,
        ghl_message_id: messageId,
        is_read: false,
        call_duration: callDuration,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      })
      .select()
      .single();

    if (commError) {
      console.error("Error creating communication:", commError);
      throw commError;
    }

    console.log("Communication record created:", comm.id);

    // Update lead if we found one
    if (lead) {
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
        const { data: sequence } = await supabase
          .from("lead_follow_up_sequences")
          .select("stop_on_response")
          .eq("id", lead.active_sequence_id)
          .single();

        if (sequence?.stop_on_response) {
          console.log("Cancelling pending follow-ups due to lead response");
          
          await supabase
            .from("lead_follow_up_schedules")
            .update({ status: "cancelled" })
            .eq("lead_id", lead.id)
            .eq("status", "pending");

          await supabase.from("lead_timeline").insert({
            lead_id: lead.id,
            action: "Follow-up sequence paused due to lead response",
            performed_by_name: "System",
          });
        }
      }

      // Add timeline entry
      const preview = messageBody ? 
        (messageBody.length > 50 ? messageBody.slice(0, 50) + "..." : messageBody) :
        `Inbound ${commType}`;
      await supabase.from("lead_timeline").insert({
        lead_id: lead.id,
        action: `${commType.toUpperCase()} received: "${preview}"`,
        performed_by_name: contactName,
      });
    }

    const contactType = lead ? "lead" : tenantMatch ? "tenant" : "external";
    const contactId = lead?.id || tenantMatch?.id || ghlContactId;

    console.log(`GHL Marketplace webhook processed successfully for ${contactType}:`, contactId);

    return new Response(
      JSON.stringify({
        success: true,
        contactType,
        contactId,
        communicationId: comm.id,
        hasAttachments: mediaUrls.length > 0,
        message: "Inbound message processed successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing GHL Marketplace webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
