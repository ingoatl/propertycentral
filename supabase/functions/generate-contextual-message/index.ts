import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Human-like writing guidelines based on research
const humanLikeGuidelines = `
WRITING STYLE RULES:
1. Write like you talk - use contractions (I'm, we'll, you're, don't, can't)
2. Use shorter sentences - mix lengths but favor brevity
3. Be direct - get to the point immediately
4. Avoid jargon and formal business speak
5. Use specific details over generic statements
6. Use informal language markers: "honestly", "actually", "just wanted to"
7. Sound warm and genuine, not robotic or salesy

PHRASES TO NEVER USE:
- "I hope this email finds you well"
- "Just checking in" or "Just wanted to touch base"
- "Per our conversation" or "As per your request"
- "Please don't hesitate to reach out"
- "We apologize for any inconvenience"
- "At your earliest convenience"
- "I wanted to follow up" (at the START of a message)
- "Synergy", "leverage", "circle back", "touch base"
- "Looking forward to hearing from you" (overused)

NATURAL ALTERNATIVES:
- Instead of "following up" → Reference specific value or question
- Instead of "reaching out" → Be specific about why
- Instead of "touch base" → "Wanted to share" or "Quick question"
- Instead of "I hope you're well" → Jump straight to value

FOR SMS SPECIFICALLY:
- Keep under 160 characters when possible (max 320)
- Lead with the most important info
- One clear call-to-action
- Casual but professional
- Use first name only
- Skip formal greetings/closings
`;

interface GenerateMessageRequest {
  leadId: string;
  messageType: "sms" | "email";
  purpose: "first_touch" | "follow_up" | "reminder" | "no_show" | "nurture";
  templateHint?: string;
  stepNumber?: number;
  sequenceName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, messageType, purpose, templateHint, stepNumber, sequenceName } = await req.json() as GenerateMessageRequest;

    console.log("Generate contextual message:", { leadId, messageType, purpose, stepNumber });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch lead with all context
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(`
        *,
        discovery_calls (
          id, scheduled_at, status, google_meet_link, meeting_notes, meeting_type
        )
      `)
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      console.error("Lead not found:", leadError);
      throw new Error("Lead not found");
    }

    // Fetch communication history
    const { data: communications } = await supabase
      .from("lead_communications")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(15);

    // Fetch timeline for additional context
    const { data: timeline } = await supabase
      .from("lead_timeline")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Calculate engagement level
    const totalComms = communications?.length || 0;
    const inboundComms = communications?.filter(c => c.direction === "inbound")?.length || 0;
    const daysSinceCreated = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceContact = lead.last_contacted_at 
      ? Math.floor((Date.now() - new Date(lead.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24))
      : daysSinceCreated;
    const hasResponded = !!lead.last_response_at;

    let engagementLevel: "high" | "medium" | "low" | "unresponsive" = "medium";
    if (inboundComms >= 2 || hasResponded) {
      engagementLevel = "high";
    } else if (totalComms > 3 && inboundComms === 0) {
      engagementLevel = "unresponsive";
    } else if (daysSinceContact > 7) {
      engagementLevel = "low";
    }

    // Build communication history context
    let commHistory = "";
    if (communications && communications.length > 0) {
      commHistory = "\nPREVIOUS COMMUNICATIONS:\n";
      for (const comm of communications.slice(0, 8)) {
        const dir = comm.direction === "outbound" ? "SENT" : "RECEIVED";
        const type = comm.communication_type?.toUpperCase() || "MSG";
        const date = new Date(comm.created_at).toLocaleDateString();
        const preview = (comm.body || comm.subject || "").substring(0, 150);
        
        commHistory += `[${date}] ${dir} ${type}: ${preview}${preview.length >= 150 ? "..." : ""}\n`;
        
        // Include call transcripts if available
        if (comm.transcript) {
          commHistory += `[CALL TRANSCRIPT]: ${comm.transcript.substring(0, 300)}...\n`;
        }
      }
    }

    // Build discovery call context
    let callContext = "";
    if (lead.discovery_calls && lead.discovery_calls.length > 0) {
      const upcomingCall = lead.discovery_calls.find((c: any) => 
        c.status === "scheduled" && new Date(c.scheduled_at) > new Date()
      );
      const pastCall = lead.discovery_calls.find((c: any) => c.status === "completed");
      
      if (upcomingCall) {
        const callDate = new Date(upcomingCall.scheduled_at);
        callContext = `\nSCHEDULED CALL: ${callDate.toLocaleDateString()} at ${callDate.toLocaleTimeString()}`;
        if (upcomingCall.google_meet_link) {
          callContext += `\nMeeting Link: ${upcomingCall.google_meet_link}`;
        }
      }
      if (pastCall && pastCall.meeting_notes) {
        callContext += `\nCALL NOTES: ${pastCall.meeting_notes.substring(0, 300)}`;
      }
    }

    // Build personalization hints
    const personalizations: string[] = [];
    if (lead.property_address) personalizations.push(`Property: ${lead.property_address}`);
    if (lead.property_type) personalizations.push(`Type: ${lead.property_type}`);
    if (lead.opportunity_source === "referral") personalizations.push("Referred (mention this warmly)");
    if (lead.ai_summary) personalizations.push(`Key info: ${lead.ai_summary}`);
    if (lead.ai_next_action) personalizations.push(`Focus: ${lead.ai_next_action}`);

    // Purpose-specific instructions
    let purposeInstructions = "";
    switch (purpose) {
      case "first_touch":
        purposeInstructions = `
PURPOSE: FIRST CONTACT
- This is our FIRST message to this lead - make it count!
- Be warm and welcoming
- Reference how they found us or why they reached out
- ${messageType === "sms" ? "Keep it brief but friendly - under 160 chars ideal" : "Keep email to 2-3 short paragraphs"}
- Clear, easy next step (confirm call time, or ask simple question)
- DO NOT start with "Just following up" or similar - this is first contact!`;
        break;
        
      case "follow_up":
        purposeInstructions = `
PURPOSE: FOLLOW-UP (Step ${stepNumber || "N/A"} of ${sequenceName || "sequence"})
- They haven't responded yet - acknowledge the gap naturally
- Lead with NEW value (insight, tip, or genuine question) not just "checking in"
- ${engagementLevel === "unresponsive" ? "Be more direct about whether they're still interested" : "Stay warm and helpful"}
- ${daysSinceContact > 7 ? "Acknowledge it's been a while" : "Don't mention time gaps"}
- ${messageType === "sms" ? "Very brief - one clear value prop and soft CTA" : "Keep concise - 2 paragraphs max"}`;
        break;
        
      case "reminder":
        purposeInstructions = `
PURPOSE: REMINDER
- Friendly reminder about upcoming call/meeting
- ${messageType === "sms" ? "Just time, link, and friendly note" : "Brief confirmation with any prep info"}
- DO NOT be pushy or guilt-trip`;
        break;
        
      case "no_show":
        purposeInstructions = `
PURPOSE: MISSED CALL/NO-SHOW
- They missed a scheduled call - be understanding, not accusatory
- "Did something come up?" tone, not "You missed our call"
- Make rescheduling EASY
- ${messageType === "sms" ? "Very short - offer to reschedule" : "Short and understanding"}`;
        break;
        
      case "nurture":
        purposeInstructions = `
PURPOSE: NURTURE/EDUCATIONAL
- Share value without direct ask
- Tips, insights, or helpful content
- Position us as helpful experts
- Soft reminder we're here when ready`;
        break;
    }

    const firstName = lead.name?.split(" ")[0] || "there";

    const systemPrompt = `You are writing a ${messageType.toUpperCase()} for PeachHaus Group, a premium short-term rental property management company in Atlanta.

${humanLikeGuidelines}

${purposeInstructions}

LEAD CONTEXT:
- Name: ${lead.name} (use "${firstName}")
- Engagement Level: ${engagementLevel}
- Days Since Contact: ${daysSinceContact}
- Has Responded Before: ${hasResponded ? "Yes" : "No"}
- Stage: ${lead.stage}
${personalizations.length > 0 ? "\nPERSONALIZATION:\n- " + personalizations.join("\n- ") : ""}
${callContext}
${commHistory}

${templateHint ? `TEMPLATE HINT (use as inspiration, but make it natural and contextual):\n${templateHint}` : ""}

REMEMBER:
- ${messageType === "sms" ? "SMS: Under 160 chars ideal, max 320. No greeting/closing needed. Just \"Hey [name]\" or jump in." : "Email: 2-3 short paragraphs max. Subject line if needed."}
- Sound like a real person, not a bot or template
- Reference specific details from their history when relevant
- One clear next step`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a ${messageType} for ${lead.name}.${purpose === "first_touch" ? " This is our first message to them." : ""}` },
        ],
        max_tokens: messageType === "sms" ? 100 : 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limited");
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded", fallback: true }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.error("Credits exhausted");
        return new Response(
          JSON.stringify({ error: "AI credits exhausted", fallback: true }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate AI message");
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content?.trim() || "";

    if (!message) {
      throw new Error("No message generated");
    }

    console.log("Generated contextual message:", message.substring(0, 100) + "...");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message,
        context: {
          engagementLevel,
          daysSinceContact,
          hasResponded,
          communicationCount: totalComms
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate contextual message error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        fallback: true 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
