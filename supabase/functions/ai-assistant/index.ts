import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { prompt, type } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    // System prompt based on follow-up best practices from HubSpot, Zillow, etc.
    const systemPrompt = `You are an expert property management communication assistant for PeachHaus Group. 

Your job is to generate warm, professional follow-up messages that:
1. Feel personal, not automated - reference specific details from conversations
2. Add value in every message - never just "check in" without purpose
3. Are concise but complete - especially for SMS (under 160 chars when possible)
4. Create urgency without pressure - use questions that invite response
5. Show you remember the relationship - mention previous interactions naturally

Best practices you follow:
- Start with the person's first name (not "Dear" or "Hello")
- Reference something specific from your last conversation
- Include a clear call-to-action or question
- Keep the tone professional but friendly
- Always sign off with "- PeachHaus"
- For SMS: Keep it short, punchy, conversational
- For Email: Can be longer but still focused and scannable

Avoid:
- Generic "just checking in" messages
- Overly formal or stiff language
- Multiple CTAs in one message
- Pressure tactics or urgency without reason
- Mentioning competitors or other options`;

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
          { role: "user", content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(
      JSON.stringify({ 
        success: true, 
        message,
        type 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("AI assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
