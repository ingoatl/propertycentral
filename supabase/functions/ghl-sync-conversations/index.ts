import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");
    
    if (!ghlApiKey || !ghlLocationId) {
      throw new Error("GHL_API_KEY and GHL_LOCATION_ID are required");
    }

    const { leadId, contactId, limit = 50 } = await req.json();

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let syncedMessages = [];
    let conversationsToProcess = [];

    if (contactId) {
      // Fetch conversations for specific contact
      console.log(`Fetching conversations for contact: ${contactId}`);
      const response = await fetch(
        `https://services.leadconnectorhq.com/conversations/search?locationId=${ghlLocationId}&contactId=${contactId}&limit=${limit}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${ghlApiKey}`,
            "Version": "2021-04-15",
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("GHL Conversations API error:", errorText);
        throw new Error(`GHL API error: ${response.status}`);
      }

      const data = await response.json();
      conversationsToProcess = data.conversations || [];
    } else {
      // Fetch recent conversations for location
      console.log(`Fetching recent conversations for location: ${ghlLocationId}`);
      const response = await fetch(
        `https://services.leadconnectorhq.com/conversations/search?locationId=${ghlLocationId}&limit=${limit}&sort=desc&sortBy=last_message_date`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${ghlApiKey}`,
            "Version": "2021-04-15",
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("GHL Conversations API error:", errorText);
        throw new Error(`GHL API error: ${response.status}`);
      }

      const data = await response.json();
      conversationsToProcess = data.conversations || [];
    }

    console.log(`Processing ${conversationsToProcess.length} conversations`);

    for (const conversation of conversationsToProcess) {
      // Fetch messages for this conversation
      const messagesResponse = await fetch(
        `https://services.leadconnectorhq.com/conversations/${conversation.id}/messages?limit=100`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${ghlApiKey}`,
            "Version": "2021-04-15",
            "Content-Type": "application/json",
          },
        }
      );

      if (!messagesResponse.ok) {
        console.error(`Failed to fetch messages for conversation ${conversation.id}`);
        continue;
      }

      const messagesData = await messagesResponse.json();
      
      // Handle different GHL API response structures
      let messages: Array<Record<string, unknown>> = [];
      if (Array.isArray(messagesData)) {
        messages = messagesData;
      } else if (messagesData.messages && Array.isArray(messagesData.messages)) {
        messages = messagesData.messages;
      } else if (messagesData.data?.messages && Array.isArray(messagesData.data.messages)) {
        messages = messagesData.data.messages;
      } else {
        console.log(`Unexpected messages response structure for conversation ${conversation.id}:`, JSON.stringify(messagesData).slice(0, 200));
        continue;
      }
      
      console.log(`Processing ${messages.length} messages for conversation ${conversation.id}`);

      // Try to find matching lead by contact phone or email
      let matchedLeadId = leadId;
      
      if (!matchedLeadId && conversation.contactId) {
        // Fetch contact details to get phone/email
        const contactResponse = await fetch(
          `https://services.leadconnectorhq.com/contacts/${conversation.contactId}`,
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
          const contact = contactData.contact;
          
          // Match by ghl_contact_id first
          const { data: leadByGhlId } = await supabase
            .from("leads")
            .select("id")
            .eq("ghl_contact_id", conversation.contactId)
            .single();

          if (leadByGhlId) {
            matchedLeadId = leadByGhlId.id;
          } else if (contact?.phone) {
            // Try matching by phone
            const cleanPhone = contact.phone.replace(/\D/g, '').slice(-10);
            const { data: leadByPhone } = await supabase
              .from("leads")
              .select("id")
              .or(`phone.ilike.%${cleanPhone}%`)
              .limit(1);

            if (leadByPhone && leadByPhone.length > 0) {
              matchedLeadId = leadByPhone[0].id;
            }
          } else if (contact?.email) {
            // Try matching by email
            const { data: leadByEmail } = await supabase
              .from("leads")
              .select("id")
              .eq("email", contact.email)
              .limit(1);

            if (leadByEmail && leadByEmail.length > 0) {
              matchedLeadId = leadByEmail[0].id;
            }
          }
        }
      }

      // Process each message
      for (const message of messages) {
        // Skip if already synced
        const { data: existing } = await supabase
          .from("lead_communications")
          .select("id")
          .eq("ghl_message_id", message.id)
          .single();

        if (existing) {
          continue;
        }

        // Determine communication type
        let commType = "sms";
        if (message.type === "TYPE_CALL" || message.messageType === "call") {
          commType = "call";
        } else if (message.type === "TYPE_EMAIL" || message.messageType === "email") {
          commType = "email";
        }

        // Determine direction
        const direction = message.direction === "outbound" ? "outbound" : "inbound";

        // Build communication record
        const communicationData: Record<string, unknown> = {
          lead_id: matchedLeadId,
          communication_type: commType,
          direction: direction,
          body: message.body || message.text || null,
          subject: commType === "call" 
            ? `Call ${direction === "inbound" ? "from" : "to"} ${conversation.contactName || "Contact"}`
            : null,
          status: message.status || "delivered",
          ghl_message_id: message.id,
          ghl_conversation_id: conversation.id,
          external_id: message.id,
          created_at: message.dateAdded || new Date().toISOString(),
          metadata: {
            ghl_data: {
              conversationId: conversation.id,
              contactId: conversation.contactId,
              contactName: conversation.contactName,
              messageType: message.type || message.messageType,
              attachments: message.attachments,
              contentType: message.contentType,
            }
          },
        };

        // Add call-specific fields
        if (commType === "call") {
          communicationData.call_duration = message.duration || null;
          communicationData.call_recording_url = message.recordingUrl || null;
        }

        const { data: inserted, error: insertError } = await supabase
          .from("lead_communications")
          .insert(communicationData)
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting message ${message.id}:`, insertError);
        } else {
          syncedMessages.push({
            id: inserted.id,
            ghl_message_id: message.id,
            type: commType,
            lead_id: matchedLeadId,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount: syncedMessages.length,
        messages: syncedMessages,
        conversationsProcessed: conversationsToProcess.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error syncing GHL conversations:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
