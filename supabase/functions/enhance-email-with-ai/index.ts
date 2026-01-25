import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface LeadContext {
  lead: {
    name: string;
    email: string | null;
    property_address: string | null;
    property_type: string | null;
    stage: string;
    notes: string | null;
  };
  communication_history: {
    total_emails_sent: number;
    total_sms_sent: number;
    total_calls_made: number;
    emails_opened: number;
    last_response_type: string | null;
    last_response_date: string | null;
    days_since_last_contact: number | null;
    days_since_last_response: number | null;
  };
  discovery_call: {
    scheduled_at: string | null;
    status: string | null;
    duration_minutes: number | null;
    meeting_notes: string | null;
  } | null;
  engagement_level: "high" | "medium" | "low" | "unresponsive";
  personalization_hints: string[];
}

interface EnhanceRequest {
  template: string;
  leadName: string;
  propertyAddress: string;
  protectedSections: string[];
  aiPrompt: string;
  creativityLevel: number;
  leadContext?: LeadContext;
}

// Build context summary for AI
function buildContextSummary(context: LeadContext): string {
  const lines: string[] = [];
  
  lines.push(`Lead: ${context.lead.name}`);
  if (context.lead.property_address) {
    lines.push(`Property: ${context.lead.property_address}`);
  }
  if (context.lead.property_type) {
    lines.push(`Property Type: ${context.lead.property_type}`);
  }
  
  lines.push("");
  lines.push("COMMUNICATION HISTORY:");
  lines.push(`- Emails sent: ${context.communication_history.total_emails_sent} (${context.communication_history.emails_opened} opened)`);
  lines.push(`- SMS sent: ${context.communication_history.total_sms_sent}`);
  lines.push(`- Calls made: ${context.communication_history.total_calls_made}`);
  
  if (context.communication_history.last_response_date) {
    lines.push(`- Last response: ${context.communication_history.last_response_type || "unknown"} on ${new Date(context.communication_history.last_response_date).toLocaleDateString()}`);
  }
  if (context.communication_history.days_since_last_response !== null) {
    lines.push(`- Days since last response: ${context.communication_history.days_since_last_response}`);
  }
  
  lines.push("");
  lines.push(`ENGAGEMENT LEVEL: ${context.engagement_level.toUpperCase()}`);
  
  if (context.discovery_call) {
    lines.push("");
    lines.push("DISCOVERY CALL:");
    if (context.discovery_call.duration_minutes) {
      lines.push(`- Duration: ${context.discovery_call.duration_minutes} minutes`);
    }
    if (context.discovery_call.meeting_notes) {
      lines.push(`- Notes: ${context.discovery_call.meeting_notes}`);
    }
  }
  
  if (context.lead.notes) {
    lines.push("");
    lines.push(`ADDITIONAL NOTES: ${context.lead.notes}`);
  }
  
  if (context.personalization_hints.length > 0) {
    lines.push("");
    lines.push("PERSONALIZATION HINTS:");
    context.personalization_hints.forEach(hint => {
      lines.push(`- ${hint}`);
    });
  }
  
  return lines.join("\n");
}

// Validate protected sections are still present in the enhanced content
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
      leadContext,
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

    // Build the AI prompt with strict guardrails and full context
    const temperature = (creativityLevel || 50) / 100 * 0.7; // Max 0.7 temperature
    
    // Build context section if available
    const contextSection = leadContext 
      ? `\n\nLEAD CONTEXT:\n${buildContextSummary(leadContext)}\n`
      : "";
    
    // Dynamic tone adjustment based on engagement
    let toneGuidance = "";
    if (leadContext) {
      switch (leadContext.engagement_level) {
        case "high":
          toneGuidance = "The lead is highly engaged and responsive. Match their enthusiasm and energy. They're excited to work with you.";
          break;
        case "medium":
          toneGuidance = "The lead has moderate engagement. Keep the tone warm and encouraging without being overwhelming.";
          break;
        case "low":
          toneGuidance = "The lead has been quiet lately. Be understanding, not pushy. Acknowledge they may be busy and make it easy for them to re-engage.";
          break;
        case "unresponsive":
          toneGuidance = "Haven't heard back in a while. Be warm and understanding. Gently remind them you're here to help without any pressure.";
          break;
      }
    }

    const systemPrompt = `You are writing as Anja from PeachHaus Group, a property management company. Your job is to personalize emails to feel like they were written specifically for this person, while keeping ALL factual content intact.

You write like a real person - warm, professional, and genuinely helpful. Not corporate or robotic. Each email should feel like Anja personally typed it for this specific owner.
${contextSection}
${toneGuidance ? `\nTONE GUIDANCE:\n${toneGuidance}\n` : ""}
CRITICAL RULES - VIOLATION OF ANY RULE MEANS FAILURE:
1. DO NOT change, remove, or paraphrase any URLs or links
2. DO NOT change any specific requirements, deadlines, or legal text
3. DO NOT invent new information, facts, or requirements
4. DO NOT change company names, phone numbers, or email addresses
5. DO NOT modify any text that appears in the protected sections list
6. KEEP the same overall structure and all bullet points/lists
7. ONLY improve warmth, flow, transitions, and personalization
8. Keep the same greeting format (Hi {{name}},)
9. Reference their communication history naturally if relevant
10. If there are discovery call notes, subtly reference something discussed

The following sections MUST appear EXACTLY as written (do not modify these at all):
${protectedSections.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

Enhancement instructions from the template author:
${aiPrompt || "Make the email warm and professional. Add personalization where appropriate. Sound like a real person wrote this specifically for them."}`;

    const userPrompt = `Personalize this email for ${leadName}${propertyAddress ? ` about their property at ${propertyAddress}` : ""}.

Original email:
${template}

Return ONLY the enhanced email text, nothing else. Preserve ALL formatting, structure, and protected content exactly.`;

    console.log("Calling OpenAI for email enhancement with context...", {
      hasContext: !!leadContext,
      engagementLevel: leadContext?.engagement_level,
      protectedSectionsCount: protectedSections.length,
    });
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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

    console.log("Email enhanced successfully with context awareness");
    
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
