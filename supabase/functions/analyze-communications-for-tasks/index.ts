import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailInsight {
  id: string;
  subject: string;
  summary: string;
  category: string;
  action_required: boolean;
  suggested_actions: string | null;
  sender_email: string;
  email_date: string;
}

interface PhoneCall {
  id: string;
  transcription: string | null;
  from_number: string;
  to_number: string;
  started_at: string;
}

interface ExtractedTask {
  title: string;
  description: string;
  priority: "urgent" | "high" | "medium" | "low";
  category: string;
  assigned_to: "peachhaus" | "owner";
  source_type: "email" | "phone" | "document";
  source_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { propertyId, propertyName } = await req.json();

    if (!propertyId) {
      throw new Error("propertyId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Analyzing communications for property: ${propertyId}`);

    // Fetch all relevant data sources
    const [emailsResult, callsResult, existingConvResult] = await Promise.all([
      supabase
        .from("email_insights")
        .select("*")
        .eq("property_id", propertyId)
        .order("email_date", { ascending: false })
        .limit(50),
      supabase
        .from("user_phone_calls")
        .select("*")
        .eq("property_id", propertyId)
        .order("started_at", { ascending: false })
        .limit(20),
      supabase
        .from("owner_conversations")
        .select("id")
        .eq("property_id", propertyId)
        .limit(1),
    ]);

    const emails = (emailsResult.data || []) as EmailInsight[];
    const calls = (callsResult.data || []) as PhoneCall[];
    const existingConversation = existingConvResult.data?.[0];

    console.log(`Found ${emails.length} emails, ${calls.length} calls`);

    // Create or get conversation record
    let conversationId: string;
    if (existingConversation) {
      conversationId = existingConversation.id;
    } else {
      const { data: newConv, error: convError } = await supabase
        .from("owner_conversations")
        .insert({
          property_id: propertyId,
          title: `${propertyName || "Property"} - Owner Intel`,
          status: "active",
          conversation_date: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (convError) throw convError;
      conversationId = newConv.id;
      console.log(`Created new conversation: ${conversationId}`);
    }

    // Build context for AI analysis
    const emailContext = emails.map((e) => ({
      date: e.email_date,
      from: e.sender_email,
      subject: e.subject,
      summary: e.summary,
      category: e.category,
      action_required: e.action_required,
      suggested_actions: e.suggested_actions,
    }));

    const callContext = calls
      .filter((c) => c.transcription)
      .map((c) => ({
        date: c.started_at,
        from: c.from_number,
        to: c.to_number,
        transcript: c.transcription?.substring(0, 2000), // Limit length
      }));

    // Prepare prompt for AI
    const analysisPrompt = `You are analyzing communications (emails and phone calls) for a property onboarding. 
Extract actionable setup tasks that need to be completed. Focus on:
- Action items mentioned in emails
- Follow-up tasks from phone conversations
- Pending deliverables from either party
- Things the owner needs to provide (documents, info, access)
- Things the property manager (PeachHaus) needs to complete

Property: ${propertyName || "Unknown"}

EMAILS:
${JSON.stringify(emailContext, null, 2)}

PHONE CALLS:
${JSON.stringify(callContext, null, 2)}

Based on this communication history, extract a list of actionable setup tasks. For each task provide:
- title: Clear, actionable task title (max 60 chars)
- description: Brief description of what needs to be done
- priority: "urgent", "high", "medium", or "low"
- category: One of: "documents", "access", "utilities", "photos", "listing", "cleaning", "maintenance", "legal", "financial", "other"
- assigned_to: "owner" if the owner needs to do it, "peachhaus" if PeachHaus team needs to do it

IMPORTANT RULES:
1. Only extract ACTIONABLE tasks that are still pending or unclear
2. Skip tasks that appear to be already completed based on the conversation flow
3. Prioritize tasks mentioned in recent emails
4. Be specific - don't create vague tasks
5. Limit to 15 most important tasks

Return a JSON array of tasks. Example:
[
  {
    "title": "Upload insurance policy document",
    "description": "Owner needs to provide copy of homeowner's insurance policy listing PeachHaus as additional insured",
    "priority": "high",
    "category": "documents",
    "assigned_to": "owner"
  }
]

Return ONLY the JSON array, no other text.`;

    // Call OpenAI for analysis
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting actionable tasks from business communications. Always respond with valid JSON only.",
          },
          { role: "user", content: analysisPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const aiResponseText = openaiData.choices[0]?.message?.content || "[]";

    console.log("AI Response:", aiResponseText);

    // Parse the AI response
    let extractedTasks: ExtractedTask[] = [];
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedResponse = aiResponseText.trim();
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.slice(7);
      }
      if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith("```")) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      extractedTasks = JSON.parse(cleanedResponse.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      throw new Error("Failed to parse AI response as JSON");
    }

    console.log(`Extracted ${extractedTasks.length} tasks`);

    // Check for existing tasks to avoid duplicates
    const { data: existingTasks } = await supabase
      .from("owner_conversation_actions")
      .select("title")
      .eq("conversation_id", conversationId)
      .eq("action_type", "task");

    const existingTitles = new Set((existingTasks || []).map((t) => t.title.toLowerCase()));

    // Insert new tasks
    const newTasks = extractedTasks
      .filter((task) => !existingTitles.has(task.title.toLowerCase()))
      .map((task) => ({
        conversation_id: conversationId,
        action_type: "task",
        title: task.title,
        description: task.description,
        priority: task.priority,
        category: task.category,
        assigned_to: task.assigned_to,
        status: "pending",
      }));

    if (newTasks.length > 0) {
      const { error: insertError } = await supabase
        .from("owner_conversation_actions")
        .insert(newTasks);

      if (insertError) {
        console.error("Error inserting tasks:", insertError);
        throw insertError;
      }

      console.log(`Inserted ${newTasks.length} new tasks`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversationId,
        tasksExtracted: extractedTasks.length,
        tasksInserted: newTasks.length,
        tasks: newTasks,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
