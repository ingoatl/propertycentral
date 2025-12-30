import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface EnhanceRequest {
  template: string;
  leadName: string;
  propertyAddress: string;
  protectedSections: string[];
  aiPrompt: string;
  creativityLevel: number;
}

// Extract protected sections from template and create markers
function extractProtectedContent(template: string, protectedSections: string[]): Map<string, string> {
  const markers = new Map<string, string>();
  protectedSections.forEach((section, index) => {
    const marker = `__PROTECTED_${index}__`;
    markers.set(marker, section);
  });
  return markers;
}

// Verify all protected sections are still present in the enhanced content
function validateProtectedContent(
  enhanced: string,
  protectedSections: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const section of protectedSections) {
    if (!enhanced.includes(section)) {
      missing.push(section);
    }
  }
  return { valid: missing.length === 0, missing };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      template,
      leadName,
      propertyAddress,
      protectedSections,
      aiPrompt,
      creativityLevel,
    }: EnhanceRequest = await req.json();

    if (!template) {
      throw new Error("Template is required");
    }

    if (!OPENAI_API_KEY) {
      console.log("No OpenAI API key, returning original template");
      return new Response(
        JSON.stringify({ enhanced: template, wasEnhanced: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build the AI prompt with strict guardrails
    const temperature = (creativityLevel || 50) / 100 * 0.7; // Max 0.7 temperature
    
    const systemPrompt = `You are an email personalization assistant for PeachHaus Group, a property management company. Your job is to improve the warmth, flow, and personalization of emails while keeping ALL factual content intact.

CRITICAL RULES - VIOLATION OF ANY RULE MEANS FAILURE:
1. DO NOT change, remove, or paraphrase any URLs or links
2. DO NOT change any specific requirements, deadlines, or legal text
3. DO NOT invent new information, facts, or requirements
4. DO NOT change company names, phone numbers, or email addresses
5. DO NOT modify any text that appears in the protected sections list
6. KEEP the same overall structure and all bullet points/lists
7. ONLY improve warmth, flow, transitions, and personalization
8. Keep the same greeting format (Hi {{name}},)

The following sections MUST appear EXACTLY as written (do not modify these at all):
${protectedSections.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

Enhancement instructions from the template author:
${aiPrompt || "Make the email warm and professional. Add personalization where appropriate."}`;

    const userPrompt = `Personalize this email for ${leadName} about their property at ${propertyAddress}.

Original email:
${template}

Return ONLY the enhanced email text, nothing else. Preserve ALL formatting, structure, and protected content exactly.`;

    console.log("Calling OpenAI for email enhancement...");
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ enhanced: template, wasEnhanced: false, error: "AI enhancement failed" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const data = await response.json();
    const enhanced = data.choices[0]?.message?.content?.trim();

    if (!enhanced) {
      console.error("No content returned from OpenAI");
      return new Response(
        JSON.stringify({ enhanced: template, wasEnhanced: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate protected sections are preserved
    const validation = validateProtectedContent(enhanced, protectedSections);
    
    if (!validation.valid) {
      console.warn("AI modified protected content, falling back to original. Missing:", validation.missing);
      return new Response(
        JSON.stringify({ 
          enhanced: template, 
          wasEnhanced: false, 
          warning: `AI modified protected content: ${validation.missing.join(", ")}` 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email enhanced successfully");
    
    return new Response(
      JSON.stringify({ enhanced, wasEnhanced: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error enhancing email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
