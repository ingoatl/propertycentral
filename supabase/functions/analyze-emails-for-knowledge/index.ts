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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { limit = 50 } = await req.json();

    // Fetch recent outbound emails
    const { data: emails, error: emailError } = await supabase
      .from("lead_communications")
      .select("*")
      .eq("type", "email")
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (emailError) throw emailError;

    if (!emails || emails.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No emails found to analyze",
          emailsProcessed: 0,
          knowledgeCreated: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Analyze emails with AI to extract common patterns
    const emailContents = emails
      .filter(e => e.body && e.body.length > 50)
      .slice(0, 20)
      .map(e => `Subject: ${e.subject || 'N/A'}\nBody: ${e.body?.slice(0, 500)}`)
      .join("\n---\n");

    const analysisPrompt = `Analyze these sent emails from a property management company (PeachHaus Group) and extract reusable knowledge patterns.

EMAILS:
${emailContents}

Extract 3-5 knowledge entries that could help an AI generate better responses. For each entry, provide:
1. category: one of [services, pricing, policies, scripts, objections]
2. title: descriptive title (e.g., "Response to Pricing Questions")
3. content: the reusable knowledge/template (generalized, not specific to any recipient)
4. keywords: array of search keywords

Return JSON array:
[{"category": "...", "title": "...", "content": "...", "keywords": ["..."]}]

Focus on:
- Common questions and how they were answered
- Persuasive language that worked
- Objection handling patterns
- Call-to-action phrases used`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: "You are a knowledge extraction assistant. Return only valid JSON." },
          { role: "user", content: analysisPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("AI analysis failed");
    }

    const aiData = await response.json();
    let extractedContent = aiData.choices?.[0]?.message?.content || "[]";

    // Clean up the response
    extractedContent = extractedContent
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let extractedKnowledge;
    try {
      extractedKnowledge = JSON.parse(extractedContent);
    } catch {
      console.error("Failed to parse AI response:", extractedContent);
      extractedKnowledge = [];
    }

    if (!Array.isArray(extractedKnowledge) || extractedKnowledge.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No patterns extracted from emails",
          emailsProcessed: emails.length,
          knowledgeCreated: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing entries
    const { data: existingEntries } = await supabase
      .from("company_knowledge_base")
      .select("title")
      .eq("source", "email_analysis");

    const existingTitles = new Set(existingEntries?.map(e => e.title) || []);

    // Filter and prepare new entries
    const newEntries = extractedKnowledge
      .filter((k: any) => k.title && k.content && !existingTitles.has(k.title))
      .map((k: any) => ({
        category: k.category || "scripts",
        title: k.title,
        content: k.content,
        keywords: Array.isArray(k.keywords) ? k.keywords : [],
        source: "email_analysis",
        use_in_contexts: ["all"],
        priority: 70,
        is_active: true,
        created_by: user.id,
      }));

    if (newEntries.length > 0) {
      const { error: insertError } = await supabase
        .from("company_knowledge_base")
        .insert(newEntries);

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        message: "Email analysis complete",
        emailsProcessed: emails.length,
        knowledgeCreated: newEntries.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error analyzing emails:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
