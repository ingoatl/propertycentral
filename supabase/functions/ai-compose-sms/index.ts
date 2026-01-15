import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEDULING_LINK = "https://propertycentral.lovable.app/book-discovery-call";

const companyKnowledge = `
COMPANY: PeachHaus Group
BUSINESS: Premium mid-term rental property management in Atlanta, Georgia

KEY VALUE PROPS:
- FREE rental income analysis for any property
- Specialized in mid-term rentals (30-365 day stays)
- Corporate housing, traveling nurses, relocations
- Full-service management - truly hands-off
- Local Atlanta expertise

BRAND VOICE:
- Professional yet warm
- Conversational (not corporate)
- Helpful and solutions-focused
- Never pushy
`;

const smsGuidelines = `
SMS WRITING RULES:
1. Keep under 160 characters when possible (1 segment)
2. Be direct and conversational
3. Use natural language - sound human
4. Include ONE clear call-to-action
5. No formal greetings or sign-offs needed for follow-ups
6. Use contractions and casual tone

GOOD SMS EXAMPLES:
- "Hi [Name], wanted to follow up on your property inquiry. Would love to chat when you have a few minutes!"
- "Hey [Name]! Just finished your free income analysis - looks great! Want me to send it over?"
- "Hi [Name], checking in to see if you had any questions about mid-term rentals. Happy to help!"

AVOID:
- Multiple questions in one message
- Long formal sentences
- "Dear" or "Sincerely" style greetings
- URLs unless specifically needed
- All caps or excessive punctuation

TONE OPTIONS:
- professional: Business-appropriate but friendly
- friendly: Warm and casual, like a helpful neighbor
- urgent: Prompt action needed but not alarming
- follow_up: Gentle reminder without being pushy
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientName, context, tone, includeLink } = await req.json();

    console.log("AI Compose SMS request:", { recipientName, contextLength: context?.length, tone });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const firstName = recipientName?.split(" ")[0] || "there";

    const systemPrompt = `You are an expert SMS copywriter for PeachHaus Group, a premium mid-term rental property management company in Atlanta.

${companyKnowledge}

${smsGuidelines}

Your task is to compose a concise, effective SMS message based on the context provided.
The message should feel natural and conversational.

CRITICAL: Keep the message under 160 characters when possible. Maximum 300 characters.
${includeLink ? `If a scheduling link is needed, you can include: ${SCHEDULING_LINK}` : "Do NOT include any links unless the context specifically requires it."}

Respond with ONLY a JSON object:
{"message": "Your SMS text here"}

Do not include any other text or explanation.`;

    const userPrompt = `Write an SMS to ${recipientName || "the recipient"}.

Context: ${context}
Tone: ${tone || "professional"}
First name to use: ${firstName}

Remember:
- Under 160 characters preferred
- One clear action/question
- Sound human, not robotic
- ${tone === "urgent" ? "Convey importance without being alarming" : ""}
- ${tone === "friendly" ? "Be warm and casual" : ""}
- ${tone === "follow_up" ? "Gentle and not pushy" : ""}

JSON response only: {"message": "..."}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 200,
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
      const errorText = await response.text();
      console.error("AI gateway error:", errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let generatedContent = data.choices?.[0]?.message?.content?.trim();

    if (!generatedContent) {
      throw new Error("No content generated");
    }

    // Clean and parse response
    generatedContent = generatedContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let parsed;
    try {
      parsed = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", generatedContent);
      const messageMatch = generatedContent.match(/"message":\s*"([^"]+)"/);
      if (messageMatch) {
        parsed = { message: messageMatch[1] };
      } else {
        // If parsing fails, use the raw content as the message
        parsed = { message: generatedContent.substring(0, 300) };
      }
    }

    console.log("Generated SMS:", { messageLength: parsed.message?.length });

    return new Response(
      JSON.stringify({
        message: parsed.message || "",
        characterCount: parsed.message?.length || 0,
        segmentCount: Math.ceil((parsed.message?.length || 0) / 160) || 1,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("AI Compose SMS error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
