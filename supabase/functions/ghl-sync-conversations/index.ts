import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize phone number to multiple formats for matching
function normalizePhone(phone: string): string[] {
  if (!phone) return [];
  
  // Strip all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Get last 10 digits (remove country code if present)
  const last10 = digits.slice(-10);
  
  if (last10.length !== 10) return [digits];
  
  // Return multiple formats to match against
  return [
    last10,                                                    // 2169783598
    `+1${last10}`,                                            // +12169783598
    `1${last10}`,                                             // 12169783598
    `${last10.slice(0,3)}-${last10.slice(3,6)}-${last10.slice(6)}`,  // 216-978-3598
    `(${last10.slice(0,3)}) ${last10.slice(3,6)}-${last10.slice(6)}`, // (216) 978-3598
    `${last10.slice(0,3)}.${last10.slice(3,6)}.${last10.slice(6)}`,  // 216.978.3598
  ];
}

// Extract caller name from transcript, excluding team members
function extractCallerNameFromTranscript(transcript: string | null): string | null {
  if (!transcript) return null;
  
  const teamMembers = ['ingo', 'tom', 'anja', 'thomas', 'peachhaus', 'peach haus'];
  
  // Patterns to match introductions
  const patterns = [
    /(?:this is|my name is|i'm|i am|it's|its)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    /(?:hi,?\s*this is|hey,?\s*it's|hello,?\s*this is)\s+([A-Z][a-z]+)/gi,
    /^([A-Z][a-z]+)(?:\s+here|(?:\s+[A-Z][a-z]+)?\s+calling)/gm,
  ];
  
  for (const pattern of patterns) {
    const matches = transcript.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const name = match[1].trim();
        const nameLower = name.toLowerCase();
        // Skip team members
        if (!teamMembers.some(tm => nameLower.includes(tm))) {
          return name;
        }
      }
    }
  }
  return null;
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

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let syncedMessages: Array<Record<string, unknown>> = [];
    let conversationsToProcess: Array<Record<string, unknown>> = [];

    // STEP 1: Sync calls from GHL Calls API (this endpoint has better call data)
    console.log("=== Syncing Human Calls from GHL Calls API ===");
    try {
      const callsResponse = await fetch(
        `https://services.leadconnectorhq.com/locations/${ghlLocationId}/calls?limit=${limit}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${ghlApiKey}`,
            "Version": "2021-07-28",
            "Content-Type": "application/json",
          },
        }
      );

      if (callsResponse.ok) {
        const callsData = await callsResponse.json();
        const calls = callsData.calls || callsData.data || [];
        console.log(`Found ${calls.length} calls from GHL Calls API`);

        for (const call of calls) {
          // Skip if already synced by ghl_call_id
          const { data: existingCall } = await supabase
            .from("lead_communications")
            .select("id")
            .eq("ghl_call_id", call.id)
            .single();

          if (existingCall) {
            continue;
          }

          // Try to match contact to owner or lead
          let matchedOwnerId: string | null = null;
          let matchedLeadId: string | null = null;
          let callerDisplayName: string | null = null;

          const contactPhone = (call.from || call.to || "").replace(/\D/g, '').slice(-10);
          
          if (contactPhone && contactPhone.length >= 10) {
            // Match to owner first
            const { data: allOwners } = await supabase
              .from("property_owners")
              .select("id, name, phone, email");
              
            if (allOwners) {
              for (const owner of allOwners) {
                if (owner.phone) {
                  const ownerPhone = owner.phone.replace(/\D/g, '').slice(-10);
                  if (ownerPhone === contactPhone) {
                    matchedOwnerId = owner.id;
                    callerDisplayName = owner.name;
                    console.log(`Matched call to owner: ${owner.name}`);
                    break;
                  }
                }
              }
            }

            // If no owner match, try leads
            if (!matchedOwnerId) {
              const phonePatterns = normalizePhone(contactPhone);
              const phoneOrConditions = phonePatterns.map(p => {
                const last10 = p.replace(/\D/g, '').slice(-10);
                return `phone.ilike.%${last10}%`;
              }).join(',');
              
              const { data: leadByPhone } = await supabase
                .from("leads")
                .select("id, name")
                .or(phoneOrConditions)
                .limit(1);

              if (leadByPhone && leadByPhone.length > 0) {
                matchedLeadId = leadByPhone[0].id;
                callerDisplayName = leadByPhone[0].name;
                console.log(`Matched call to lead: ${leadByPhone[0].name}`);
              }
            }
          }

          if (!matchedOwnerId && !matchedLeadId) {
            console.log(`No match for call ${call.id} from ${contactPhone}, skipping`);
            continue;
          }

          // Determine direction
          const direction = call.direction === "outbound" ? "outbound" : "inbound";

          // Try to get call recording/transcript
          let messageBody = "";
          let recordingUrl = call.recordingUrl || call.recording_url || null;

          // Try to fetch transcript from GHL
          if (call.id) {
            try {
              const transcriptResponse = await fetch(
                `https://services.leadconnectorhq.com/locations/${ghlLocationId}/calls/${call.id}/transcription`,
                {
                  method: "GET",
                  headers: {
                    "Authorization": `Bearer ${ghlApiKey}`,
                    "Version": "2021-07-28",
                    "Content-Type": "application/json",
                  },
                }
              );

              if (transcriptResponse.ok) {
                const transcriptData = await transcriptResponse.json();
                console.log(`GHL call transcript response for ${call.id}:`, JSON.stringify(transcriptData).slice(0, 200));
                
                if (Array.isArray(transcriptData)) {
                  messageBody = transcriptData.map((t: { sentence?: string; text?: string }) => t.sentence || t.text || "").join(" ").trim();
                } else if (transcriptData.transcription) {
                  messageBody = transcriptData.transcription;
                } else if (transcriptData.text) {
                  messageBody = transcriptData.text;
                }
              }
            } catch (e) {
              console.log(`No transcript for call ${call.id}`);
            }
          }

          // Fallback body
          if (!messageBody || messageBody.length < 10) {
            const durationMins = call.duration ? Math.round(call.duration / 60) : 0;
            messageBody = `Phone call ${direction === "inbound" ? "from" : "to"} ${callerDisplayName || "Contact"}. Duration: ${durationMins > 0 ? durationMins + ' min' : 'Unknown'}.`;
          }

          // Parse date
          const callDate = call.startedAt || call.createdAt || call.dateAdded || new Date().toISOString();

          const communicationData = {
            lead_id: matchedOwnerId ? null : matchedLeadId,
            owner_id: matchedOwnerId,
            communication_type: "call",
            direction: direction,
            body: messageBody,
            subject: `Call ${direction === "inbound" ? "from" : "to"} ${callerDisplayName || "Contact"}`,
            status: call.status || "completed",
            ghl_call_id: call.id,
            call_duration: call.duration || null,
            call_recording_url: recordingUrl,
            created_at: new Date(callDate).toISOString(),
            metadata: {
              ghl_data: {
                callId: call.id,
                from: call.from,
                to: call.to,
                status: call.status,
                callType: "human",
              }
            },
          };

          const { data: inserted, error: insertError } = await supabase
            .from("lead_communications")
            .insert(communicationData)
            .select()
            .single();

          if (insertError) {
            console.error(`Error inserting call ${call.id}:`, insertError);
          } else {
            console.log(`Synced call ${call.id} for ${callerDisplayName}`);
            syncedMessages.push({
              id: inserted.id,
              ghl_call_id: call.id,
              type: "call",
              source: "calls_api",
              owner_id: matchedOwnerId,
              lead_id: matchedLeadId,
            });

            // Trigger call analysis for calls with transcripts
            if (messageBody && messageBody.length > 100) {
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
                    matchedName: callerDisplayName,
                    callDuration: call.duration,
                    transcript: messageBody,
                    ghlCallId: call.id,
                  }),
                }).catch(e => console.error("Analysis trigger failed:", e));
              } catch (e) {
                console.error("Error triggering analysis:", e);
              }
            }
          }
        }
      } else {
        const errorText = await callsResponse.text();
        console.error("GHL Calls API error:", callsResponse.status, errorText);
      }
    } catch (callsError) {
      console.error("Error fetching GHL calls:", callsError);
    }

    // STEP 2: Sync conversations (SMS, emails) from Conversations API
    console.log("=== Syncing Conversations (SMS/Email) ===");
    
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
      } else if (messagesData.messages?.messages && Array.isArray(messagesData.messages.messages)) {
        messages = messagesData.messages.messages;
      } else if (messagesData.messages && Array.isArray(messagesData.messages)) {
        messages = messagesData.messages;
      } else if (messagesData.data?.messages && Array.isArray(messagesData.data.messages)) {
        messages = messagesData.data.messages;
      } else {
        console.log(`Unexpected messages response structure for conversation ${conversation.id}`);
        continue;
      }
      
      console.log(`Processing ${messages.length} messages for conversation ${conversation.id}`);

      // Try to find matching owner FIRST, then lead
      let matchedLeadId = leadId;
      let matchedOwnerId: string | null = null;
      let matchedOwnerName: string | null = null;
      let matchedLeadName: string | null = null;
      
      if (conversation.contactId) {
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
          const rawContactPhone = contact?.phone || '';
          const contactPhone = rawContactPhone.replace(/\D/g, '').slice(-10);
          const contactEmail = contact?.email?.toLowerCase() || '';
          
          console.log(`Contact lookup - Phone: ${rawContactPhone} (normalized: ${contactPhone}), Email: ${contactEmail}`);
          
          // Match to property owner by phone or email
          if (contactPhone && contactPhone.length >= 10) {
            const { data: allOwners } = await supabase
              .from("property_owners")
              .select("id, name, phone, email");
              
            if (allOwners) {
              for (const owner of allOwners) {
                if (owner.phone) {
                  const ownerPhone = owner.phone.replace(/\D/g, '').slice(-10);
                  if (ownerPhone === contactPhone) {
                    matchedOwnerId = owner.id;
                    matchedOwnerName = owner.name;
                    console.log(`Matched to owner by normalized phone: ${owner.name}`);
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
          
          // If no owner match, try leads with normalized phone
          if (!matchedOwnerId && !matchedLeadId && contactPhone) {
            const phonePatterns = normalizePhone(contactPhone);
            const phoneOrConditions = phonePatterns.map(p => {
              const last10 = p.replace(/\D/g, '').slice(-10);
              return `phone.ilike.%${last10}%`;
            }).join(',');
            
            const { data: leadByPhone } = await supabase
              .from("leads")
              .select("id, name")
              .or(phoneOrConditions)
              .limit(1);

            if (leadByPhone && leadByPhone.length > 0) {
              matchedLeadId = leadByPhone[0].id;
              matchedLeadName = leadByPhone[0].name;
              console.log(`Matched to lead by phone: ${leadByPhone[0].name}`);
            }
          }
          
          // Try by ghl_contact_id or email
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
        }
      }
      
      // Skip if no match found
      if (!matchedLeadId && !matchedOwnerId) {
        console.log(`No lead or owner match for conversation ${conversation.id}, skipping`);
        continue;
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

        // Determine communication type - skip calls (handled by Calls API above)
        const rawType = message.type;
        const rawMessageType = message.messageType;
        const rawContentType = message.contentType;
        
        const msgType = (typeof rawType === 'string' ? rawType : String(rawType ?? '')).toUpperCase();
        const msgMessageType = (typeof rawMessageType === 'number' ? String(rawMessageType) : String(rawMessageType ?? ''));
        const contentType = (typeof rawContentType === 'string' ? rawContentType : String(rawContentType ?? '')).toLowerCase();
        
        // Check if this is a call - skip since we handle via Calls API
        if (msgType === "TYPE_CALL" || msgType === "CALL" || msgType.includes("CALL") || 
            contentType === "call" || msgType === "TYPE_VOICEMAIL" || msgType.includes("VOICEMAIL") ||
            msgMessageType === "7" || msgMessageType === "10") {
          console.log(`Skipping call from conversations API (handled by Calls API): ${message.id}`);
          continue;
        }
        
        let commType = "sms";
        if (msgType === "TYPE_EMAIL" || msgType === "EMAIL" ||
            contentType.includes("email") || msgMessageType === "3") {
          commType = "email";
        }

        // Determine direction
        const direction = message.direction === "outbound" ? "outbound" : "inbound";

        // Get caller display name
        const callerDisplayName = matchedOwnerName || matchedLeadName || (conversation.contactName as string) || null;
        
        // Get message body
        const messageBody = (message.body as string) || (message.text as string) || `${commType.toUpperCase()} message`;
        
        // Parse the correct date from GHL data
        const dateAddedStr = message.dateAdded as string | undefined;
        const createdAtStr = message.createdAt as string | undefined;
        const messageDate = dateAddedStr 
          ? new Date(dateAddedStr).toISOString()
          : createdAtStr
            ? new Date(createdAtStr).toISOString()
            : new Date().toISOString();
        
        const communicationData: Record<string, unknown> = {
          lead_id: matchedOwnerId ? null : matchedLeadId,
          owner_id: matchedOwnerId,
          communication_type: commType,
          direction: direction,
          body: messageBody,
          subject: commType === "email" ? (message.subject as string) || null : null,
          status: message.status || "delivered",
          ghl_message_id: message.id,
          ghl_conversation_id: conversation.id,
          external_id: message.id,
          created_at: messageDate,
          metadata: {
            ghl_data: {
              conversationId: conversation.id,
              contactId: conversation.contactId,
              contactName: callerDisplayName || conversation.contactName,
              messageType: message.type || message.messageType,
              attachments: message.attachments,
              contentType: message.contentType,
              dateAdded: message.dateAdded,
              createdAt: message.createdAt,
            }
          },
        };

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
            source: "conversations_api",
            lead_id: matchedLeadId,
            owner_id: matchedOwnerId,
          });
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
