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
      // GHL can return: { messages: [...] } OR { messages: { messages: [...] } }
      let messages: Array<Record<string, unknown>> = [];
      if (Array.isArray(messagesData)) {
        messages = messagesData;
      } else if (messagesData.messages?.messages && Array.isArray(messagesData.messages.messages)) {
        // Nested structure: { messages: { messages: [...] } }
        messages = messagesData.messages.messages;
      } else if (messagesData.messages && Array.isArray(messagesData.messages)) {
        messages = messagesData.messages;
      } else if (messagesData.data?.messages && Array.isArray(messagesData.data.messages)) {
        messages = messagesData.data.messages;
      } else {
        console.log(`Unexpected messages response structure for conversation ${conversation.id}:`, JSON.stringify(messagesData).slice(0, 300));
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
          const contactPhone = contact?.phone?.replace(/\D/g, '').slice(-10) || '';
          const contactEmail = contact?.email?.toLowerCase() || '';
          
          // PRIORITY 1: Match to property owner by phone or email using normalized formats
          if (contactPhone) {
            const phonePatterns = normalizePhone(contactPhone);
            const phoneOrConditions = phonePatterns.map(p => {
              const last10 = p.replace(/\D/g, '').slice(-10);
              return `phone.ilike.%${last10}%`;
            }).join(',');
            
            const { data: ownerByPhone } = await supabase
              .from("property_owners")
              .select("id, name, phone")
              .or(phoneOrConditions)
              .limit(1);

            if (ownerByPhone && ownerByPhone.length > 0) {
              matchedOwnerId = ownerByPhone[0].id;
              matchedOwnerName = ownerByPhone[0].name;
              console.log(`Matched to owner by phone: ${ownerByPhone[0].name}`);
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
          
          // PRIORITY 2: If no owner match, try leads with normalized phone
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
          
          // PRIORITY 3: If still no match, try by ghl_contact_id or email
          if (!matchedOwnerId && !matchedLeadId) {
            // Match by ghl_contact_id first
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
        // Debug: Log raw message structure for first few messages to understand call format
        if (messages.indexOf(message) < 3) {
          console.log(`Raw message sample:`, JSON.stringify({
            type: message.type,
            messageType: message.messageType,
            contentType: message.contentType,
            direction: message.direction,
            body: (message.body as string || "").slice(0, 50),
          }));
        }
        
        // Skip if already synced
        const { data: existing } = await supabase
          .from("lead_communications")
          .select("id")
          .eq("ghl_message_id", message.id)
          .single();

        if (existing) {
          continue;
        }

        // Determine communication type - check multiple GHL message type formats
        // GHL uses: type field with "TYPE_CALL", "TYPE_SMS", etc OR messageType with numeric codes
        // Numeric codes: 1=SMS, 2=SMS, 3=Email, 7=Call, 10=Call/Voicemail
        // IMPORTANT: message.type can be an object, number, or string - safely convert
        const rawType = message.type;
        const rawMessageType = message.messageType;
        const rawContentType = message.contentType;
        
        // Safely convert to strings - handle objects/numbers
        const msgType = (typeof rawType === 'string' ? rawType : String(rawType ?? '')).toUpperCase();
        const msgMessageType = (typeof rawMessageType === 'number' ? String(rawMessageType) : String(rawMessageType ?? ''));
        const contentType = (typeof rawContentType === 'string' ? rawContentType : String(rawContentType ?? '')).toLowerCase();
        
        let commType = "sms";
        // Check string type first (TYPE_CALL format)
        if (msgType === "TYPE_CALL" || msgType === "CALL" || 
            msgType.includes("CALL") || contentType === "call") {
          commType = "call";
        } else if (msgType === "TYPE_EMAIL" || msgType === "EMAIL" ||
            contentType.includes("email") || msgMessageType === "3") {
          commType = "email";
        } else if (msgType === "TYPE_VOICEMAIL" || msgType.includes("VOICEMAIL")) {
          commType = "call"; // Treat voicemails as calls
        }
        // Also check numeric messageType for calls (7, 10 are typically call types)
        else if (msgMessageType === "7" || msgMessageType === "10") {
          commType = "call";
        }
        
        // Log when we detect a call
        if (commType === "call") {
          console.log(`Detected human call: type=${msgType}, messageType=${msgMessageType}`);
        }

        // Determine direction
        const direction = message.direction === "outbound" ? "outbound" : "inbound";

        // Try to extract caller name from transcript if we don't have a match name
        let callerDisplayName = matchedOwnerName || matchedLeadName || (conversation.contactName as string) || null;
        
        // For calls, try to extract name from transcript/body if still unknown
        if (!callerDisplayName && commType === "call") {
          const transcriptText = (message.body as string) || (message.text as string) || "";
          const extractedName = extractCallerNameFromTranscript(transcriptText);
          if (extractedName) {
            callerDisplayName = extractedName;
            console.log(`Extracted caller name from transcript: ${extractedName}`);
          }
        }
        
        // Build communication record - prioritize owner_id over lead_id
        // Provide default body for calls without content to avoid null constraint violation
        const messageBody = (message.body as string) || (message.text as string) || 
          (commType === "call" 
            ? `Phone call ${direction === "inbound" ? "from" : "to"} ${callerDisplayName || "Contact"}. Duration: ${message.duration ? Math.round((message.duration as number) / 60) + ' min' : 'Unknown'}.`
            : `${commType.toUpperCase()} message`);
        
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
          body: messageBody, // Use default body if empty
          subject: commType === "call" 
            ? `Call ${direction === "inbound" ? "from" : "to"} ${callerDisplayName || "Contact"}`
            : null,
          status: message.status || "delivered",
          ghl_message_id: message.id,
          ghl_conversation_id: conversation.id,
          external_id: message.id,
          created_at: messageDate, // Use parsed date from GHL
          metadata: {
            ghl_data: {
              conversationId: conversation.id,
              contactId: conversation.contactId,
              contactName: callerDisplayName || conversation.contactName,
              messageType: message.type || message.messageType,
              attachments: message.attachments,
              contentType: message.contentType,
              callType: commType === "call" ? "human" : undefined, // Mark as human call
              dateAdded: message.dateAdded,
              createdAt: message.createdAt,
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
