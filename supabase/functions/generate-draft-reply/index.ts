import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Advanced conversational UX guidelines for human-like AI communication
const humanLikeGuidelines = `
CONVERSATIONAL INTELLIGENCE FRAMEWORK:

1. CONTEXT-FIRST RESPONSE DESIGN:
   - Read their MOST RECENT message first - this is what needs addressing
   - Review the full conversation thread to understand the relationship arc
   - Identify their emotional state: Are they frustrated? Excited? Confused? Rushed?
   - Match their energy level - if they're brief, be brief; if they're detailed, provide detail

2. CHANNEL-ADAPTIVE COMMUNICATION:
   FOR SMS (Text Messages):
   - Maximum 160 characters ideal, 280 absolute max
   - Lead with the answer/action, not context
   - One clear next step per message
   - Use informal punctuation: periods feel abrupt, use line breaks or dashes
   - Emoji sparingly (🏠 👍 ✓) - only if they use them first
   - Sound like texting a colleague, not a customer service bot
   
   FOR EMAIL:
   - Open with their name, skip "hope this finds you well" 
   - First sentence = direct response to what they asked
   - 2-3 short paragraphs maximum for most replies
   - Clear next step at the end
   - Sign off naturally (Thanks, Best, Talk soon) not formally

3. TONE CALIBRATION:
   Property Owners (VIPs):
   - Proactive and partnership-oriented: "Here's what I'm handling for you..."
   - Acknowledge their investment and trust
   - Be thorough but respectful of their time
   
   Leads (Prospective Clients):
   - Warm and welcoming, not salesy
   - Answer their question first, build relationship second
   - Guide naturally toward next steps without pressure
   
   Tenants:
   - Helpful and responsive
   - Clear timelines and expectations
   - Professional but approachable

4. BANNED PHRASES (sound robotic/corporate):
   ❌ "Just checking in" / "Just wanted to touch base"
   ❌ "I hope this email finds you well"
   ❌ "Please don't hesitate to reach out"
   ❌ "At your earliest convenience"
   ❌ "Per our conversation" / "As per your request"
   ❌ "Moving forward" / "Going forward"
   ❌ "Circle back" / "Touch base" / "Synergy"
   ❌ "We apologize for any inconvenience"
   ❌ "Thank you for your patience"
   ❌ "It would be my pleasure to assist you"

5. NATURAL ALTERNATIVES:
   Instead of → Use:
   "I apologize for the delay" → "Sorry for the slow reply"
   "Please find attached" → "I've attached" or "Here's"
   "Do not hesitate to contact me" → "Just let me know"
   "I would like to inform you" → "Wanted to let you know"
   "Thank you for reaching out" → "Thanks for the message" or skip it entirely
   "We appreciate your patience" → "Thanks for hanging in there"

6. RESPONSE STRUCTURE BY INTENT:
   Question Asked → Answer first, context second
   Issue Reported → Acknowledge + immediate action + timeline
   Information Shared → Thank briefly + confirm receipt + next step
   Scheduling Request → Specific times/link immediately
   Complaint → Empathy (not apology script) + specific resolution
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { communicationId, leadId, ownerId, contactPhone, contactEmail, messageType } = await req.json();

    console.log("Generate draft reply request:", { communicationId, leadId, ownerId, messageType });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const MEM0_API_KEY = Deno.env.get("MEM0_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if draft already exists for this communication
    if (communicationId) {
      const { data: existingDraft } = await supabase
        .from("ai_draft_replies")
        .select("id")
        .eq("communication_id", communicationId)
        .eq("status", "pending")
        .maybeSingle();

      if (existingDraft) {
        console.log("Draft already exists for this communication");
        return new Response(
          JSON.stringify({ success: true, message: "Draft already exists", draftId: existingDraft.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch the communication that needs a reply
    let inboundMessage = "";
    let contactName = "there";
    let fullContext = "";
    let commHistory = "";
    let contactMemories = "";

    // Build contact identifier and fetch memories from Mem0
    let contactIdentifier = "";
    if (leadId) {
      contactIdentifier = `lead_${leadId}`;
    } else if (ownerId) {
      contactIdentifier = `owner_${ownerId}`;
    }

    // Fetch memories from Mem0 if available
    if (MEM0_API_KEY && contactIdentifier) {
      try {
        const mem0Response = await fetch(`https://api.mem0.ai/v1/memories/?user_id=${encodeURIComponent(contactIdentifier)}&limit=15`, {
          method: "GET",
          headers: {
            "Authorization": `Token ${MEM0_API_KEY}`,
            "Content-Type": "application/json",
          },
        });

        if (mem0Response.ok) {
          const mem0Data = await mem0Response.json();
          const memories = mem0Data.results || mem0Data || [];
          
          if (memories.length > 0) {
            contactMemories = "\n\nREMEMBERED ABOUT THIS CONTACT:\n";
            const grouped: Record<string, string[]> = {};
            
            for (const m of memories) {
              const category = m.metadata?.category || "general";
              const memory = m.memory || m.text || m.content;
              if (memory) {
                if (!grouped[category]) grouped[category] = [];
                grouped[category].push(memory);
              }
            }
            
            for (const [category, items] of Object.entries(grouped)) {
              for (const item of items) {
                contactMemories += `- ${item}\n`;
              }
            }
            
            contactMemories += "\nUse this to personalize the response naturally.\n";
            console.log(`Loaded ${memories.length} memories for draft generation`);
          }
        }
      } catch (e) {
        console.error("Error fetching memories:", e);
      }
    }

    if (communicationId) {
      const { data: comm } = await supabase
        .from("lead_communications")
        .select("*, leads(id, name, phone, email, property_address, stage, ai_summary), property_owners(id, name, email, phone)")
        .eq("id", communicationId)
        .single();

      if (comm) {
        inboundMessage = comm.body || "";
        
        if (comm.leads) {
          const lead = comm.leads as { id: string; name: string; phone: string | null; email: string | null; property_address: string | null; stage: string; ai_summary: string | null };
          contactName = lead.name?.split(" ")[0] || "there";
          fullContext = `Lead: ${lead.name}\nPhone: ${lead.phone || "N/A"}\nEmail: ${lead.email || "N/A"}\nProperty: ${lead.property_address || "N/A"}\nStage: ${lead.stage}`;
          if (lead.ai_summary) fullContext += `\nNotes: ${lead.ai_summary}`;
        } else if (comm.property_owners) {
          const owner = comm.property_owners as { id: string; name: string; email: string | null; phone: string | null };
          contactName = owner.name?.split(" ")[0] || "there";
          fullContext = `Owner: ${owner.name}\nEmail: ${owner.email || "N/A"}\nPhone: ${owner.phone || "N/A"}`;
        }
      }
    }

    // Fetch recent conversation history
    const historyQuery = supabase
      .from("lead_communications")
      .select("direction, body, communication_type, created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    if (leadId) {
      historyQuery.eq("lead_id", leadId);
    } else if (ownerId) {
      historyQuery.eq("owner_id", ownerId);
    } else if (contactPhone) {
      // For external contacts, match by phone in metadata
      historyQuery.contains("metadata", { unmatched_phone: contactPhone });
    }

    const { data: recentComms } = await historyQuery;

    if (recentComms && recentComms.length > 0) {
      commHistory = "\n\nCONVERSATION HISTORY (newest first):\n";
      for (const c of recentComms) {
        const dir = c.direction === "outbound" ? "WE SENT" : "THEY REPLIED";
        const preview = (c.body || "").substring(0, 200);
        commHistory += `[${dir}]: ${preview}${preview.length >= 200 ? "..." : ""}\n`;
      }
    }

    // Analyze the inbound message for context
    const msgLower = (inboundMessage || "").toLowerCase();
    const isQuestion = msgLower.includes("?") || msgLower.startsWith("how") || msgLower.startsWith("what") || msgLower.startsWith("when") || msgLower.startsWith("can");
    const isUrgent = msgLower.includes("urgent") || msgLower.includes("asap") || msgLower.includes("emergency") || msgLower.includes("immediately");
    const isFrustrated = msgLower.includes("still waiting") || msgLower.includes("no response") || msgLower.includes("frustrated") || msgLower.includes("disappointed");
    const isThankYou = msgLower.includes("thank") || msgLower.includes("appreciate") || msgLower.includes("great job");

    // Build system prompt
    const systemPrompt = `You are an experienced property manager at PeachHaus Group, a premium mid-term rental management company in Atlanta. You're composing a ${messageType === "email" ? "email" : "text message"} reply.

${humanLikeGuidelines}

YOUR COMMUNICATION PERSONA:
- Name: Ingo
- Role: Property management professional who genuinely cares about both owners and guests
- Style: Warm, efficient, knowledgeable - like a trusted advisor, not a call center rep
- You remember details and follow through on commitments

CURRENT CONVERSATION CONTEXT:
Contact Name: ${contactName}
${fullContext}
${commHistory}
${contactMemories}

MESSAGE ANALYSIS:
- Is this a question needing an answer? ${isQuestion ? "YES" : "NO"}
- Does this feel urgent? ${isUrgent ? "YES - prioritize speed and clarity" : "NO"}
- Is the sender frustrated? ${isFrustrated ? "YES - acknowledge their frustration with empathy, not scripted apologies" : "NO"}
- Is this expressing gratitude? ${isThankYou ? "YES - keep response brief and warm" : "NO"}

RESPONSE REQUIREMENTS:
1. Start by addressing what they ACTUALLY asked or said - be specific
2. Reference details from their message to show you read it carefully
3. If the conversation history is relevant, use it to provide continuity
4. ${messageType === "sms" ? "Keep under 160 characters ideal, 200 max - every word must earn its place" : "2-3 short paragraphs maximum"}
5. End with a clear next step or natural close
6. Sign as: "- Ingo"

WHAT NOT TO DO:
- Don't offer things they didn't ask for (calls, reports, tours)
- Don't use placeholder text like "[specific detail]" - if you don't know, don't guess
- Don't start with "I" - vary your sentence openings
- Don't be overly formal or stiff
- Don't ask multiple questions in one message`;

    const userPrompt = `THEIR MESSAGE TO REPLY TO:
"${inboundMessage}"

Generate a natural, human ${messageType === "email" ? "email" : "text message"} reply that directly addresses what they said. Write ONLY the reply text - no explanations, no options, just the actual message to send.`;

    // Call AI to generate draft
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: messageType === "sms" ? 150 : 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let draftContent = data.choices?.[0]?.message?.content?.trim();

    if (!draftContent) {
      throw new Error("No draft generated");
    }

    // Clean up - remove quotes if wrapped
    if (draftContent.startsWith('"') && draftContent.endsWith('"')) {
      draftContent = draftContent.slice(1, -1);
    }

    // Calculate confidence based on context availability
    let confidenceScore = 0.7; // Base confidence
    if (commHistory.length > 100) confidenceScore += 0.1; // Has conversation history
    if (fullContext.length > 50) confidenceScore += 0.1; // Has contact context
    if (inboundMessage.length > 20) confidenceScore += 0.1; // Clear message to reply to
    confidenceScore = Math.min(confidenceScore, 0.99);

    // Store the draft
    const { data: newDraft, error: insertError } = await supabase
      .from("ai_draft_replies")
      .insert({
        communication_id: communicationId || null,
        lead_id: leadId || null,
        owner_id: ownerId || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        draft_content: draftContent,
        message_type: messageType || "sms",
        confidence_score: confidenceScore,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error storing draft:", insertError);
      throw insertError;
    }

    console.log("Draft generated successfully:", newDraft.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        draftId: newDraft.id,
        draftContent,
        confidenceScore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error generating draft reply:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
