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
    const { content, subject, sender } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `Summarize this communication in 2-3 concise sentences. Include:
- Who it's from (${sender})
- Key decision/action needed
- Any important dates or amounts mentioned

${subject ? `Subject: ${subject}\n` : ""}
Content: ${content?.slice(0, 2000)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a concise business assistant that summarizes communications. Keep summaries brief and actionable." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate summary");
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "Unable to generate summary";

    // Also try to extract category
    const categoryPrompt = `Based on this message, categorize it as ONE of: deal_contract, action_item, client_decision, support_problem, price_quote, communication_record

Message: ${content?.slice(0, 1000)}

Respond with ONLY the category name, nothing else.`;

    const categoryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "user", content: categoryPrompt },
        ],
      }),
    });

    let category = "communication_record";
    if (categoryResponse.ok) {
      const categoryData = await categoryResponse.json();
      const rawCategory = categoryData.choices?.[0]?.message?.content?.trim().toLowerCase();
      const validCategories = ["deal_contract", "action_item", "client_decision", "support_problem", "price_quote", "communication_record"];
      if (validCategories.includes(rawCategory)) {
        category = rawCategory;
      }
    }

    return new Response(
      JSON.stringify({ summary, category }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in summarize-communication:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
