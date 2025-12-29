import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { leadId, action } = await req.json();
    console.log(`AI Assistant processing ${action} for lead ${leadId}`);

    // Fetch the lead with all related data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found");
    }

    // Fetch timeline for context
    const { data: timeline } = await supabase
      .from("lead_timeline")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Fetch communications for context
    const { data: communications } = await supabase
      .from("lead_communications")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true })
      .limit(20);

    let aiPrompt = "";
    let updateFields: Record<string, unknown> = {};

    if (action === "qualify") {
      aiPrompt = `You are a property management lead qualification expert for PeachHaus, a short-term rental management company.

Analyze this lead and provide:
1. A qualification score from 0-100 (higher = more likely to convert)
2. A brief summary of the lead (2-3 sentences max)
3. The single most important next action to take

Lead Information:
- Name: ${lead.name}
- Email: ${lead.email || "Not provided"}
- Phone: ${lead.phone || "Not provided"}
- Opportunity Source: ${lead.opportunity_source || "Unknown"}
- Opportunity Value: $${lead.opportunity_value || 0}
- Property Address: ${lead.property_address || "Not provided"}
- Property Type: ${lead.property_type || "Not specified"}
- Current Stage: ${lead.stage}
- Created: ${lead.created_at}
- Notes: ${lead.notes || "None"}

Timeline (${timeline?.length || 0} events):
${timeline?.map(t => `- ${t.action} (${new Date(t.created_at).toLocaleDateString()})`).join("\n") || "No timeline entries"}

Communications (${communications?.length || 0} messages):
${communications?.map(c => `- ${c.communication_type.toUpperCase()} ${c.direction}: ${c.body?.substring(0, 100)}...`).join("\n") || "No communications yet"}

Respond in this exact JSON format:
{
  "score": <number 0-100>,
  "summary": "<2-3 sentence summary>",
  "nextAction": "<single most important action to take>"
}`;

    } else if (action === "generate_followup") {
      aiPrompt = `You are a property management sales expert for PeachHaus. Generate a personalized follow-up message for this lead.

Lead: ${lead.name}
Source: ${lead.opportunity_source}
Property: ${lead.property_address || "Not specified"}
Stage: ${lead.stage}
Last contact: ${communications?.[communications.length - 1]?.created_at || lead.created_at}

Recent communications:
${communications?.slice(-3).map(c => `${c.direction}: ${c.body}`).join("\n") || "No recent communications"}

Generate a warm, professional follow-up SMS message (under 160 chars). Respond with just the message text.`;
    }

    // Call OpenAI
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "user", content: aiPrompt }
        ],
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error("AI API request failed");
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices?.[0]?.message?.content || "";
    console.log("AI Response:", aiContent);

    if (action === "qualify") {
      try {
        // Extract JSON from response
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          updateFields = {
            ai_qualification_score: parsed.score,
            ai_summary: parsed.summary,
            ai_next_action: parsed.nextAction,
            updated_at: new Date().toISOString(),
          };

          // Update the lead
          await supabase
            .from("leads")
            .update(updateFields)
            .eq("id", leadId);

          // Add timeline entry
          await supabase.from("lead_timeline").insert({
            lead_id: leadId,
            action: `AI qualified lead with score ${parsed.score}/100`,
            metadata: { score: parsed.score, summary: parsed.summary, nextAction: parsed.nextAction },
          });
        }
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        action,
        result: aiContent,
        updates: updateFields 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in lead AI assistant:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
