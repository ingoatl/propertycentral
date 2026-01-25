import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ComposeRequest {
  messageType: "email" | "sms";
  action: "compose" | "improve" | "shorter" | "professional" | "friendly" | "reply" | "from_bullets";
  recipientName?: string;
  recipientEmail?: string;
  context?: string; // Rough notes or bullet points
  currentMessage?: string; // For improvement actions
  conversationHistory?: Array<{ role: string; content: string; timestamp?: string }>;
  leadId?: string;
  ownerId?: string;
  includeCalendarLink?: boolean;
}

// Scheduling link
const SCHEDULING_LINK = "https://propertycentral.lovable.app/book-discovery-call";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ComposeRequest = await req.json();
    const { 
      messageType, 
      action, 
      recipientName, 
      recipientEmail, 
      context, 
      currentMessage,
      conversationHistory,
      leadId,
      ownerId,
      includeCalendarLink 
    } = request;

    console.log("Smart compose request:", { messageType, action, leadId });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch tone profile
    const { data: toneProfile } = await supabase
      .from("user_tone_profiles")
      .select("*")
      .in("channel", [messageType, "all"])
      .order("last_analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch company knowledge for context
    const { data: companyKnowledge } = await supabase
      .from("company_knowledge_base")
      .select("category, title, content, keywords, referral_link")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(15);

    console.log(`[Smart Compose] Loaded ${companyKnowledge?.length || 0} knowledge entries`);

    // Fetch conversation history if we have a lead/owner
    let fullHistory = conversationHistory || [];
    if ((leadId || ownerId) && fullHistory.length === 0) {
      const { data: comms } = await supabase
        .from("lead_communications")
        .select("direction, body, subject, created_at, communication_type")
        .or(`lead_id.eq.${leadId || 'none'},owner_id.eq.${ownerId || 'none'}`)
        .order("created_at", { ascending: true })
        .limit(20);

      if (comms) {
        fullHistory = comms.map(c => ({
          role: c.direction === "inbound" ? "them" : "us",
          content: c.communication_type === "email" 
            ? `Subject: ${c.subject || ''}\n${c.body || ''}` 
            : c.body || '',
          timestamp: c.created_at
        }));
      }
    }

    // Build tone instructions
    let toneInstructions = "";
    if (toneProfile) {
      toneInstructions = `
WRITE IN THIS EXACT VOICE (learned from the user's past messages):

TONE PROFILE:
${toneProfile.tone_summary}

FORMALITY: ${toneProfile.formality_level}
${toneProfile.uses_contractions ? "- USE contractions (I'm, we'll, don't)" : "- AVOID contractions"}
- Exclamation marks: ${toneProfile.exclamation_frequency}
- Questions: ${toneProfile.question_frequency}
- Emoji: ${toneProfile.emoji_usage}

GREETINGS TO USE: ${(toneProfile.common_greetings || []).join(", ")}
CLOSINGS TO USE: ${(toneProfile.common_closings || []).join(", ")}
SIGNATURE PHRASES: ${(toneProfile.signature_phrases || []).join(", ")}

NEVER USE: ${(toneProfile.avoided_phrases || []).join(", ")}

WRITING DNA:
${JSON.stringify(toneProfile.writing_dna, null, 2)}

SAMPLE MESSAGES FOR REFERENCE:
${(toneProfile.sample_messages || []).slice(0, 3).join("\n---\n")}
`;
    } else {
      toneInstructions = `
No tone profile found. Write in a warm, professional tone:
- Use contractions (I'm, we'll, you're)
- Be friendly but businesslike
- Keep it concise
- End with clear next steps
`;
    }

    // Build conversation context
    let conversationContext = "";
    if (fullHistory.length > 0) {
      conversationContext = `
CONVERSATION HISTORY (most recent last):
${fullHistory.map(h => `[${h.role.toUpperCase()}]: ${h.content.substring(0, 500)}`).join("\n\n")}
`;
    }

    // Action-specific prompts
    let actionPrompt = "";
    switch (action) {
      case "compose":
        actionPrompt = `Write a new ${messageType} to ${recipientName || "the recipient"}.
Context/Intent: ${context || "General outreach"}
${includeCalendarLink ? `Include scheduling link naturally: ${SCHEDULING_LINK}` : ""}`;
        break;

      case "from_bullets":
        actionPrompt = `Transform these bullet points/notes into a polished ${messageType}:

NOTES:
${context || currentMessage}

Rules:
- Keep all the key information but make it flow naturally
- Match the user's voice perfectly
- ${messageType === "sms" ? "Keep under 300 characters" : "Keep to 2-3 paragraphs"}`;
        break;

      case "reply":
        // Extract the last inbound message to ensure we address it directly
        const lastInboundMessage = fullHistory.filter(h => h.role === "them").pop();
        const messageToReplyTo = lastInboundMessage?.content || context || "";
        
        actionPrompt = `Generate a DIRECT reply that SPECIFICALLY addresses what was asked.

THE MESSAGE YOU ARE REPLYING TO:
"${messageToReplyTo}"

CRITICAL INSTRUCTIONS:
1. READ the message above carefully - what is the person ACTUALLY asking?
2. Your FIRST paragraph MUST directly answer their specific question
3. Do NOT give a generic response - if they ask about insurance, talk about insurance
4. Do NOT pivot to unrelated topics like property management services unless asked
5. If you don't know the specific answer, acknowledge the question and offer to find out

${context ? `Additional context from user: ${context}` : ""}
${includeCalendarLink ? `Only include scheduling link if relevant: ${SCHEDULING_LINK}` : ""}

Remember: A good reply DIRECTLY addresses what was asked. Do not be generic.`;
        break;

      case "improve":
        actionPrompt = `Improve this ${messageType} while keeping the same meaning:

ORIGINAL:
${currentMessage}

Make it better match the user's natural voice while improving clarity and impact.`;
        break;

      case "shorter":
        actionPrompt = `Make this ${messageType} more concise:

ORIGINAL:
${currentMessage}

Keep the key message but cut unnecessary words. ${messageType === "sms" ? "Target under 160 characters." : "Cut by at least 30%."}`;
        break;

      case "professional":
        actionPrompt = `Make this ${messageType} more professional while keeping the user's voice:

ORIGINAL:
${currentMessage}

Elevate the professionalism without sounding stiff or generic.`;
        break;

      case "friendly":
        actionPrompt = `Make this ${messageType} warmer and more personable:

ORIGINAL:
${currentMessage}

Add warmth while staying professional. Match the user's natural friendly tone.`;
        break;
    }

    // Build company knowledge context
    let knowledgeContext = "";
    if (companyKnowledge && companyKnowledge.length > 0) {
      knowledgeContext = `
COMPANY KNOWLEDGE BASE (use this information in your responses):
${companyKnowledge.map(k => {
  let entry = `[${k.category.toUpperCase()}] ${k.title}: ${k.content}`;
  if (k.referral_link) entry += ` (Link: ${k.referral_link})`;
  return entry;
}).join("\n\n")}
`;
    }

    const systemPrompt = `You are a writing assistant that generates CONTEXT-AWARE replies in the user's voice.

CRITICAL RULE: When replying to a message, your response MUST directly address what was asked. 
- If they ask about insurance → answer about insurance using knowledge base
- If they ask about pricing → answer about pricing using knowledge base
- If they ask a question → answer that specific question FIRST
- NEVER give a generic response that ignores their question
- Use SPECIFIC details from the COMPANY KNOWLEDGE BASE below

${toneInstructions}

${conversationContext}

${knowledgeContext}

COMPANY CONTEXT:
- Company: PeachHaus Group - Premium mid-term rental property management in Atlanta
- Use the knowledge base above for accurate answers about services, pricing, insurance, etc.
- If information isn't in the knowledge base, be honest and offer to research/follow up

OUTPUT FORMAT:
${messageType === "email" ? `Return JSON: {"subject": "...", "body": "..."}` : `Return just the message text, no JSON.`}

${messageType === "sms" ? "SMS RULES: Max 300 chars. No formal greeting/closing. Jump right in." : "EMAIL RULES: 2-3 short paragraphs max. Clear subject line."}`;

    // Try multiple models with fallback - using Gemini 3.0 flash for cost efficiency
    const models = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash"];
    let content = "";
    let lastError = "";

    for (const model of models) {
      try {
        console.log(`[Smart Compose] Trying model: ${model}`);
        
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: actionPrompt },
            ],
            max_tokens: messageType === "sms" ? 300 : 800,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit exceeded" }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (response.status === 402) {
            return new Response(
              JSON.stringify({ error: "AI credits exhausted" }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          const errorText = await response.text();
          console.error(`[Smart Compose] ${model} error:`, errorText);
          lastError = errorText;
          continue;
        }

        const data = await response.json();
        content = data.choices?.[0]?.message?.content?.trim() || "";
        
        if (content) {
          console.log(`[Smart Compose] Success with ${model}:`, content.substring(0, 100));
          break;
        } else {
          lastError = "Empty response from AI";
        }
      } catch (modelError) {
        console.error(`[Smart Compose] ${model} exception:`, modelError);
        lastError = modelError instanceof Error ? modelError.message : "Unknown error";
      }
    }

    if (!content) {
      console.error(`[Smart Compose] All models failed. Last error: ${lastError}`);
      throw new Error("Failed to generate content from AI");
    }

    // Parse response based on message type
    let result: { message?: string; subject?: string; body?: string };

    if (messageType === "email") {
      // Clean markdown and parse JSON
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      try {
        const parsed = JSON.parse(content);
        result = { subject: parsed.subject, body: parsed.body };
      } catch {
        // Try to extract subject and body
        const subjectMatch = content.match(/"subject":\s*"([^"]+)"/);
        const bodyMatch = content.match(/"body":\s*"([\s\S]+?)"\s*}/);
        if (subjectMatch && bodyMatch) {
          result = {
            subject: subjectMatch[1],
            body: bodyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
          };
        } else {
          result = { body: content, subject: "Follow up" };
        }
      }
    } else {
      result = { message: content };
    }

    console.log("Smart compose result:", { action, messageType, hasProfile: !!toneProfile });

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...result,
        usedToneProfile: !!toneProfile,
        conversationLength: fullHistory.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Smart compose error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
