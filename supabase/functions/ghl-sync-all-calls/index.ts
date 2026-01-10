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

interface GHLCall {
  id: string;
  type?: string;
  messageType?: string | number;
  contentType?: string;
  body?: string;
  text?: string;
  message?: string;
  content?: string;
  transcript?: string;
  snippet?: string;
  summary?: string;
  direction?: string;
  duration?: number;
  callDuration?: number;
  dateAdded?: string;
  createdAt?: string;
  date?: string;
  recordingUrl?: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  conversationId?: string;
  fromNumber?: string;
  toNumber?: string;
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

    const requestBody = await req.json().catch(() => ({}));
    const limit = requestBody.limit || 200;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const syncedCalls: Array<Record<string, unknown>> = [];
    
    console.log("=== Starting GHL ALL CALLS Sync ===");
    console.log(`Location ID: ${ghlLocationId}`);

    const allCalls: GHLCall[] = [];
    
    // Fetch conversations and find calls
    console.log("Fetching conversations to find calls...");
    const conversationsEndpoint = `https://services.leadconnectorhq.com/conversations/search?locationId=${ghlLocationId}&limit=${Math.min(limit, 100)}&sort=desc&sortBy=last_message_date`;
    
    const convResponse = await fetch(conversationsEndpoint, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${ghlApiKey}`,
        "Version": "2021-04-15",
        "Content-Type": "application/json",
      },
    });

    if (convResponse.ok) {
      const convData = await convResponse.json();
      const conversations = convData.conversations || [];
      console.log(`Found ${conversations.length} conversations to check for calls`);
      
      for (const conv of conversations) {
        let contactName = conv.contactName || "Unknown";
        let contactPhone = "";
        let contactEmail = "";
        
        if (conv.contactId) {
          try {
            const contactResponse = await fetch(
              `https://services.leadconnectorhq.com/contacts/${conv.contactId}`,
              {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${ghlApiKey}`,
                  "Version": "2021-07-28",
                },
              }
            );
            if (contactResponse.ok) {
              const contactData = await contactResponse.json();
              const contact = contactData.contact;
              contactPhone = contact?.phone || '';
              contactEmail = contact?.email?.toLowerCase() || '';
              contactName = contact?.name || contact?.firstName || contactName;
            }
          } catch (_e) {
            console.log(`Failed to fetch contact ${conv.contactId}`);
          }
        }
        
        // Fetch messages for this conversation to find calls
        const msgResponse = await fetch(
          `https://services.leadconnectorhq.com/conversations/${conv.id}/messages?limit=50`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${ghlApiKey}`,
              "Version": "2021-04-15",
            },
          }
        );
        
        if (!msgResponse.ok) {
          console.log(`Failed to fetch messages for conv ${conv.id}: ${msgResponse.status}`);
          continue;
        }
        
        const msgData = await msgResponse.json();
        let messages: Array<Record<string, unknown>> = [];
        if (Array.isArray(msgData)) messages = msgData;
        else if (msgData.messages?.messages) messages = msgData.messages.messages;
        else if (msgData.messages) messages = msgData.messages;
        else if (msgData.data?.messages) messages = msgData.data.messages;
        
        console.log(`Conv ${conv.id} (${contactName}): ${messages.length} messages`);
        
        for (const msg of messages) {
          const rawType = String(msg.type || '').toUpperCase();
          const rawMsgType = String(msg.messageType || '');
          const contentType = String(msg.contentType || '').toLowerCase();
          
          // Log ALL messages to see what types exist
          console.log(`Msg ${msg.id}: type=${rawType}, msgType=${rawMsgType}, contentType=${contentType}`);
          
          // Check if this is a call - expand detection to catch more
          const isCall = rawType.includes("CALL") || 
                        rawType === "TYPE_CALL" ||
                        rawMsgType === "7" || 
                        rawMsgType === "10" ||
                        rawMsgType === "TYPE_CALL" ||
                        contentType === "call" ||
                        contentType.includes("call") ||
                        rawType.includes("VOICEMAIL") ||
                        rawType.includes("PHONE") ||
                        // Also check if body mentions call details
                        (msg.body && String(msg.body).includes("Call Duration:")) ||
                        (msg.body && String(msg.body).includes("Your AI Employee has handled another call"));
          
          if (isCall) {
            console.log(`✓ Found call: ${msg.id}`);
            allCalls.push({
              id: msg.id as string,
              type: msg.type as string | undefined,
              messageType: msg.messageType as string | number | undefined,
              contentType: msg.contentType as string | undefined,
              body: msg.body as string | undefined,
              text: msg.text as string | undefined,
              message: msg.message as string | undefined,
              content: msg.content as string | undefined,
              transcript: msg.transcript as string | undefined,
              snippet: msg.snippet as string | undefined,
              summary: msg.summary as string | undefined,
              direction: msg.direction as string | undefined,
              duration: msg.duration as number | undefined,
              dateAdded: msg.dateAdded as string | undefined,
              createdAt: msg.createdAt as string | undefined,
              recordingUrl: msg.recordingUrl as string | undefined,
              contactId: conv.contactId,
              contactName,
              contactPhone,
              contactEmail,
              conversationId: conv.id,
              fromNumber: msg.fromNumber as string | undefined,
              toNumber: msg.toNumber as string | undefined,
            });
          }
        }
      }
    }
    
    // Also try additional endpoints
    console.log("Trying additional call endpoints...");
    try {
      const callsEndpoint = `https://services.leadconnectorhq.com/conversations/calls?locationId=${ghlLocationId}&limit=100`;
      const callsResponse = await fetch(callsEndpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-04-15",
        },
      });
      
      if (callsResponse.ok) {
        const callsData = await callsResponse.json();
        const calls = callsData.calls || callsData.data || [];
        console.log(`Calls endpoint returned ${calls.length} calls`);
        
        for (const call of calls) {
          const exists = allCalls.some(c => c.id === call.id);
          if (!exists) {
            allCalls.push(call as GHLCall);
          }
        }
      }
    } catch (_e) {
      console.log("Calls endpoint not available");
    }

    console.log(`Total calls found: ${allCalls.length}`);

    // Process each call
    for (const call of allCalls) {
      const callId = call.id;
      
      // Check if already synced
      const { data: existing } = await supabase
        .from("lead_communications")
        .select("id")
        .or(`ghl_call_id.eq.${callId},ghl_message_id.eq.${callId},external_id.eq.${callId}`)
        .single();

      if (existing) {
        console.log(`Call ${callId} already synced, skipping`);
        continue;
      }

      // Extract call details
      const contactPhone = String(call.contactPhone || call.fromNumber || call.toNumber || "");
      const contactEmail = String(call.contactEmail || "");
      const contactName = String(call.contactName || "Unknown Caller");
      const normalizedPhone = contactPhone.replace(/\D/g, '').slice(-10);
      
      console.log(`Processing call from ${contactName} (${contactPhone})`);
      
      // Match to owner or lead
      let matchedOwnerId: string | null = null;
      let matchedLeadId: string | null = null;
      let matchedName = contactName;

      if (normalizedPhone && normalizedPhone.length >= 10) {
        // Try to match to owner
        const { data: allOwners } = await supabase
          .from("property_owners")
          .select("id, name, phone, email");
          
        if (allOwners) {
          for (const owner of allOwners) {
            if (owner.phone) {
              const ownerPhone = owner.phone.replace(/\D/g, '').slice(-10);
              if (ownerPhone === normalizedPhone) {
                matchedOwnerId = owner.id;
                matchedName = owner.name;
                console.log(`✓ Matched to owner: ${owner.name}`);
                break;
              }
            }
          }
        }
        
        // Try to match to lead if no owner match
        if (!matchedOwnerId) {
          const phonePatterns = normalizePhone(normalizedPhone);
          const phoneOrConditions = phonePatterns.map(p => 
            `phone.ilike.%${p.replace(/\D/g, '').slice(-10)}%`
          ).join(',');
          
          const { data: leadByPhone } = await supabase
            .from("leads")
            .select("id, name")
            .or(phoneOrConditions)
            .limit(1);

          if (leadByPhone && leadByPhone.length > 0) {
            matchedLeadId = leadByPhone[0].id;
            matchedName = leadByPhone[0].name;
            console.log(`✓ Matched to lead: ${leadByPhone[0].name}`);
          }
        }
      }
      
      // Also try email match
      if (!matchedOwnerId && !matchedLeadId && contactEmail) {
        const { data: ownerByEmail } = await supabase
          .from("property_owners")
          .select("id, name")
          .ilike("email", contactEmail)
          .limit(1);

        if (ownerByEmail && ownerByEmail.length > 0) {
          matchedOwnerId = ownerByEmail[0].id;
          matchedName = ownerByEmail[0].name;
          console.log(`✓ Matched to owner by email: ${ownerByEmail[0].name}`);
        } else {
          const { data: leadByEmail } = await supabase
            .from("leads")
            .select("id, name")
            .ilike("email", contactEmail)
            .limit(1);

          if (leadByEmail && leadByEmail.length > 0) {
            matchedLeadId = leadByEmail[0].id;
            matchedName = leadByEmail[0].name;
            console.log(`✓ Matched to lead by email: ${leadByEmail[0].name}`);
          }
        }
      }
      
      // Get transcript if available
      let callBody = "";
      let callSummary = String(call.summary || "");
      
      // Try to get transcript from GHL
      try {
        const transcriptResponse = await fetch(
          `https://services.leadconnectorhq.com/conversations/locations/${ghlLocationId}/messages/${callId}/transcription`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${ghlApiKey}`,
              "Version": "2021-04-15",
            },
          }
        );
        
        if (transcriptResponse.ok) {
          const transcriptData = await transcriptResponse.json();
          if (Array.isArray(transcriptData)) {
            callBody = transcriptData.map((t: { sentence?: string; text?: string }) => 
              t.sentence || t.text || ""
            ).join(" ").trim();
          } else if (transcriptData.transcription) {
            callBody = transcriptData.transcription;
          } else if (transcriptData.text) {
            callBody = transcriptData.text;
          }
          if (callBody) {
            console.log(`Got transcript: ${callBody.slice(0, 100)}...`);
          }
        }
      } catch (_e) {
        console.log(`No transcript for call ${callId}`);
      }
      
      // Check body field on the message itself
      if (!callBody) {
        const bodyFields: (keyof GHLCall)[] = ['body', 'text', 'message', 'content', 'transcript', 'snippet'];
        for (const field of bodyFields) {
          const value = call[field];
          if (typeof value === 'string' && value.trim() && value.length > callBody.length) {
            callBody = value.trim();
          }
        }
      }
      
      // Build fallback body if no transcript
      const duration = Number(call.duration || call.callDuration || 0);
      const durationMins = duration > 0 ? Math.round(duration / 60) : 0;
      const direction = call.direction === "outbound" ? "outbound" : "inbound";
      
      if (!callBody || callBody.length < 20) {
        callBody = `Phone call ${direction === "inbound" ? "from" : "to"} ${matchedName}. Duration: ${durationMins > 0 ? durationMins + ' min' : 'Unknown'}. ${callSummary}`.trim();
      }
      
      // Get call date
      const dateAddedStr = call.dateAdded || call.createdAt || call.date;
      const callDate = dateAddedStr 
        ? new Date(dateAddedStr).toISOString()
        : new Date().toISOString();

      // Create communication record - ALWAYS store, even unmatched
      const communicationData = {
        lead_id: matchedOwnerId ? null : (matchedLeadId || null),
        owner_id: matchedOwnerId || null,
        communication_type: "call",
        direction: direction,
        body: callBody,
        subject: callSummary || `Call ${direction === "inbound" ? "from" : "to"} ${matchedName}`,
        status: "completed",
        ghl_call_id: callId,
        ghl_message_id: callId,
        ghl_conversation_id: call.conversationId || null,
        ghl_contact_id: call.contactId || null,
        external_id: callId,
        call_duration: duration || null,
        call_recording_url: call.recordingUrl || null,
        created_at: callDate,
        metadata: {
          ghl_data: {
            contactId: call.contactId,
            contactName: matchedName,
            contactPhone: contactPhone,
            contactEmail: contactEmail,
            conversationId: call.conversationId,
            callType: "human",
            unmatched: !matchedOwnerId && !matchedLeadId,
            rawType: call.type,
            rawMessageType: call.messageType,
          }
        },
      };

      const { data: inserted, error: insertError } = await supabase
        .from("lead_communications")
        .insert(communicationData)
        .select()
        .single();

      if (insertError) {
        console.error(`Error inserting call ${callId}:`, insertError);
      } else {
        console.log(`✓ Synced call from ${matchedName}: ${callBody.slice(0, 50)}...`);
        syncedCalls.push({
          id: inserted.id,
          ghl_call_id: callId,
          contact_name: matchedName,
          matched_owner: matchedOwnerId ? true : false,
          matched_lead: matchedLeadId ? true : false,
          has_transcript: callBody.length > 50,
        });

        // Trigger analysis for calls with transcripts
        if (callBody && callBody.length > 100 && (matchedOwnerId || matchedLeadId)) {
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
                matchedName: matchedName,
                callDuration: duration,
                transcript: callBody,
                ghlCallId: callId,
              }),
            }).catch(e => console.error("Analysis trigger failed:", e));
          } catch (e) {
            console.error("Analysis error:", e);
          }
        }
      }
    }

    console.log(`=== Sync Complete: ${syncedCalls.length} calls synced ===`);

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount: syncedCalls.length,
        calls: syncedCalls,
        totalFound: allCalls.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error syncing GHL calls:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
