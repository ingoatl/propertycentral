import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize phone number to multiple formats for matching
function normalizePhone(phone: string): string[] {
  if (!phone) return [];
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  if (last10.length !== 10) return [digits];
  return [
    last10,
    `+1${last10}`,
    `1${last10}`,
    `${last10.slice(0,3)}-${last10.slice(3,6)}-${last10.slice(6)}`,
    `(${last10.slice(0,3)}) ${last10.slice(3,6)}-${last10.slice(6)}`,
  ];
}

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

    const { leadId, contactId, limit = 100 } = await req.json();
    const safeLimit = Math.min(limit, 100);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const syncedMessages: Array<Record<string, unknown>> = [];
    let conversationsToProcess: Array<Record<string, unknown>> = [];

    console.log("=== Starting GHL Sync (ALL conversations) ===");

    // Fetch conversations from GHL
    const endpoint = contactId 
      ? `https://services.leadconnectorhq.com/conversations/search?locationId=${ghlLocationId}&contactId=${contactId}&limit=${safeLimit}`
      : `https://services.leadconnectorhq.com/conversations/search?locationId=${ghlLocationId}&limit=${safeLimit}&sort=desc&sortBy=last_message_date`;
    
    console.log(`Fetching from: ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${ghlApiKey}`,
        "Version": "2021-04-15",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GHL Conversations API error:", errorText);
      throw new Error(`GHL API error: ${response.status}`);
    }

    const data = await response.json();
    conversationsToProcess = data.conversations || [];
    console.log(`Processing ${conversationsToProcess.length} conversations`);

    for (const conversation of conversationsToProcess) {
      // Get contact details first
      let contactName = conversation.contactName || "Unknown";
      let contactPhone = "";
      let contactEmail = "";
      
      if (conversation.contactId) {
        try {
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
            contactPhone = contact?.phone || '';
            contactEmail = contact?.email?.toLowerCase() || '';
            contactName = contact?.name || contact?.firstName || contactName;
            console.log(`Contact: ${contactName}, Phone: ${contactPhone}, Email: ${contactEmail}`);
          }
        } catch (e) {
          console.log(`Failed to fetch contact ${conversation.contactId}`);
        }
      }

      // Try to match to owner or lead
      let matchedLeadId = leadId;
      let matchedOwnerId: string | null = null;
      let matchedOwnerName: string | null = null;
      let matchedLeadName: string | null = null;
      const normalizedPhone = contactPhone.replace(/\D/g, '').slice(-10);
      
      if (normalizedPhone && normalizedPhone.length >= 10) {
        const { data: allOwners } = await supabase
          .from("property_owners")
          .select("id, name, phone, email");
          
        if (allOwners) {
          for (const owner of allOwners) {
            if (owner.phone) {
              const ownerPhone = owner.phone.replace(/\D/g, '').slice(-10);
              if (ownerPhone === normalizedPhone) {
                matchedOwnerId = owner.id;
                matchedOwnerName = owner.name;
                console.log(`Matched to owner: ${owner.name}`);
                break;
              }
            }
          }
        }
      }
      
      if (!matchedOwnerId && contactEmail) {
        const { data: ownerByEmail } = await supabase
          .from("property_owners")
          .select("id, name")
          .ilike("email", contactEmail)
          .limit(1);

        if (ownerByEmail && ownerByEmail.length > 0) {
          matchedOwnerId = ownerByEmail[0].id;
          matchedOwnerName = ownerByEmail[0].name;
          console.log(`Matched to owner by email: ${ownerByEmail[0].name}`);
        }
      }
      
      if (!matchedOwnerId && !matchedLeadId && normalizedPhone) {
        const phonePatterns = normalizePhone(normalizedPhone);
        const phoneOrConditions = phonePatterns.map(p => `phone.ilike.%${p.replace(/\D/g, '').slice(-10)}%`).join(',');
        
        const { data: leadByPhone } = await supabase
          .from("leads")
          .select("id, name")
          .or(phoneOrConditions)
          .limit(1);

        if (leadByPhone && leadByPhone.length > 0) {
          matchedLeadId = leadByPhone[0].id;
          matchedLeadName = leadByPhone[0].name;
          console.log(`Matched to lead: ${leadByPhone[0].name}`);
        }
      }
      
      if (!matchedOwnerId && !matchedLeadId) {
        const { data: leadByGhlId } = await supabase
          .from("leads")
          .select("id, name")
          .eq("ghl_contact_id", conversation.contactId)
          .single();

        if (leadByGhlId) {
          matchedLeadId = leadByGhlId.id;
          matchedLeadName = leadByGhlId.name;
        } else if (contactEmail) {
          const { data: leadByEmail } = await supabase
            .from("leads")
            .select("id, name")
            .ilike("email", contactEmail)
            .limit(1);

          if (leadByEmail && leadByEmail.length > 0) {
            matchedLeadId = leadByEmail[0].id;
            matchedLeadName = leadByEmail[0].name;
          }
        }
      }
      
      // IMPORTANT: Even if no match, we still sync the conversation for visibility
      // Store contact info in metadata for later matching
      const displayName = matchedOwnerName || matchedLeadName || contactName;
      
      // Fetch messages for this conversation
      const messagesResponse = await fetch(
        `https://services.leadconnectorhq.com/conversations/${conversation.id}/messages?limit=50`,
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
      
      let messages: Array<Record<string, unknown>> = [];
      if (Array.isArray(messagesData)) {
        messages = messagesData;
      } else if (messagesData.messages?.messages && Array.isArray(messagesData.messages.messages)) {
        messages = messagesData.messages.messages;
      } else if (messagesData.messages && Array.isArray(messagesData.messages)) {
        messages = messagesData.messages;
      } else if (messagesData.data?.messages && Array.isArray(messagesData.data.messages)) {
        messages = messagesData.data.messages;
      } else {
        continue;
      }
      
      console.log(`Processing ${messages.length} messages for ${displayName}`);

      for (const message of messages) {
        // Skip if already synced
        const { data: existing } = await supabase
          .from("lead_communications")
          .select("id")
          .eq("ghl_message_id", message.id)
          .single();

        if (existing) continue;

        // Determine communication type
        const rawType = message.type;
        const rawMessageType = message.messageType;
        const rawContentType = message.contentType;
        
        const msgType = (typeof rawType === 'string' ? rawType : String(rawType ?? '')).toUpperCase();
        const msgMessageType = String(rawMessageType ?? '');
        const contentType = (typeof rawContentType === 'string' ? rawContentType : String(rawContentType ?? '')).toLowerCase();
        
        let commType = "sms";
        let isCall = false;
        
        if (msgType === "TYPE_CALL" || msgType === "CALL" || msgType.includes("CALL") || 
            contentType === "call" || msgType.includes("VOICEMAIL") ||
            msgMessageType === "7" || msgMessageType === "10") {
          commType = "call";
          isCall = true;
        } else if (msgType === "TYPE_EMAIL" || msgType === "EMAIL" || contentType.includes("email") || msgMessageType === "3") {
          commType = "email";
        }

        const direction = message.direction === "outbound" ? "outbound" : "inbound";

        // CRITICAL: Extract message body from all possible fields
        let messageBody = "";
        
        // GHL stores body in different fields - check all
        const bodyFields = ['body', 'text', 'message', 'content', 'snippet'];
        for (const field of bodyFields) {
          const value = message[field];
          if (typeof value === 'string' && value.trim() && value.trim().length > messageBody.length) {
            messageBody = value.trim();
          }
        }
        
        // Log what we found for debugging
        console.log(`Message ${message.id}: type=${commType}, body fields: body=${typeof message.body}/${String(message.body).slice(0, 30)}, text=${typeof message.text}, extracted=${messageBody.slice(0, 50)}`);

        // For calls, try to get transcript
        if (isCall && (!messageBody || messageBody.length < 50)) {
          try {
            const transcriptResponse = await fetch(
              `https://services.leadconnectorhq.com/conversations/locations/${ghlLocationId}/messages/${message.id}/transcription`,
              {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${ghlApiKey}`,
                  "Version": "2021-04-15",
                  "Content-Type": "application/json",
                },
              }
            );
            
            if (transcriptResponse.ok) {
              const transcriptData = await transcriptResponse.json();
              if (Array.isArray(transcriptData)) {
                const text = transcriptData.map((t: { sentence?: string; text?: string }) => t.sentence || t.text || "").join(" ").trim();
                if (text) messageBody = text;
              } else if (transcriptData.transcription) {
                messageBody = transcriptData.transcription;
              } else if (transcriptData.text) {
                messageBody = transcriptData.text;
              }
            }
          } catch (e) {
            console.log(`No transcript for call ${message.id}`);
          }
        }
        
        // Fallback for calls without transcripts
        if (isCall && (!messageBody || messageBody.length < 10)) {
          const durationMins = message.duration ? Math.round((message.duration as number) / 60) : 0;
          messageBody = `Phone call ${direction === "inbound" ? "from" : "to"} ${displayName}. Duration: ${durationMins > 0 ? durationMins + ' min' : 'Unknown'}.`;
        }
        
        // Skip messages with no content (but NOT calls - we always want calls)
        if (!isCall && (!messageBody || messageBody.length < 2)) {
          console.log(`Skipping ${commType} ${message.id} - no body`);
          continue;
        }
        
        const dateAddedStr = message.dateAdded as string | undefined;
        const createdAtStr = message.createdAt as string | undefined;
        const messageDate = dateAddedStr 
          ? new Date(dateAddedStr).toISOString()
          : createdAtStr
            ? new Date(createdAtStr).toISOString()
            : new Date().toISOString();
        
        // Store ALL communications - even unmatched ones
        // Store contact info in metadata for later matching
        const communicationData: Record<string, unknown> = {
          lead_id: matchedOwnerId ? null : (matchedLeadId || null),
          owner_id: matchedOwnerId || null,
          communication_type: commType,
          direction: direction,
          body: messageBody,
          subject: isCall 
            ? `Call ${direction === "inbound" ? "from" : "to"} ${displayName}`
            : (message.subject as string) || null,
          status: message.status || "delivered",
          ghl_message_id: message.id,
          ghl_conversation_id: conversation.id,
          ghl_contact_id: conversation.contactId || null,
          external_id: message.id,
          created_at: messageDate,
          metadata: {
            ghl_data: {
              conversationId: conversation.id,
              contactId: conversation.contactId,
              contactName: displayName,
              contactPhone: contactPhone,
              contactEmail: contactEmail,
              messageType: message.type || message.messageType,
              contentType: message.contentType,
              callType: isCall ? "human" : undefined,
              unmatched: !matchedOwnerId && !matchedLeadId,
            }
          },
        };

        if (isCall) {
          communicationData.call_duration = message.duration || null;
          communicationData.call_recording_url = message.recordingUrl || null;
        }

        const { data: inserted, error: insertError } = await supabase
          .from("lead_communications")
          .insert(communicationData)
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting ${message.id}:`, insertError);
        } else {
          console.log(`✓ Synced ${commType} for ${displayName}: ${messageBody.slice(0, 40)}...`);
          syncedMessages.push({
            id: inserted.id,
            ghl_message_id: message.id,
            type: commType,
            matched: !!(matchedOwnerId || matchedLeadId),
            contact_name: displayName,
          });
          
          // Trigger call analysis for good transcripts
          if (isCall && messageBody && messageBody.length > 100 && (matchedOwnerId || matchedLeadId)) {
            try {
              fetch(`${supabaseUrl}/functions/v1/analyze-call-transcript`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  communicationId: inserted.id,
                  ownerId: matchedOwnerId,
                  leadId: matchedLeadId,
                  matchedName: displayName,
                  callDuration: message.duration,
                  transcript: messageBody,
                  ghlCallId: message.id,
                }),
              }).catch(e => console.error("Analysis trigger failed:", e));
            } catch (e) {
              console.error("Analysis error:", e);
            }
          }
          
          // Save Voice AI transcripts to lead timeline for context
          const isVoiceAITranscript = messageBody.includes("Your AI Employee has handled another call") ||
                                       messageBody.includes("AI Agent Name:") ||
                                       messageBody.includes("Call Transcript:");
          
          if (isVoiceAITranscript && matchedLeadId) {
            try {
              // Extract call summary from transcript
              const summaryMatch = messageBody.match(/Call Summary:\s*([\s\S]*?)(?:Call Transcript:|$)/);
              const callSummary = summaryMatch ? summaryMatch[1].trim().slice(0, 500) : "Voice AI call handled";
              
              await supabase.from("lead_timeline").insert({
                lead_id: matchedLeadId,
                action: "Voice AI call transcript received",
                performed_by: null,
                metadata: {
                  communication_id: inserted.id,
                  call_summary: callSummary,
                  caller_phone: contactPhone,
                  transcript_preview: messageBody.slice(0, 1000),
                  source: "ghl_voice_ai"
                }
              });
              console.log(`✓ Saved Voice AI transcript to timeline for lead ${matchedLeadId}`);
            } catch (timelineError) {
              console.error("Failed to save to timeline:", timelineError);
            }
          }
        }
      }
    }

    console.log(`=== Sync Complete: ${syncedMessages.length} messages synced ===`);

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
