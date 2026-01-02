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
  source_type: "email" | "phone" | "sms" | "document";
  source_quote?: string;
  confidence: number; // 0-100 confidence score
  phase_suggestion?: number;
}

// Auto-approve threshold - tasks with confidence >= this are auto-approved
const AUTO_APPROVE_THRESHOLD = 80;

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

    console.log(`Analyzing ALL communications for property: ${propertyId}`);

    // Get property and owner info
    const { data: property } = await supabase
      .from("properties")
      .select("id, name, address, owner_id")
      .eq("id", propertyId)
      .single();

    if (!property) {
      throw new Error("Property not found");
    }

    // Fetch ALL relevant data sources in parallel
    const [emailsResult, callsResult, smsResult, existingConvResult] = await Promise.all([
      supabase
        .from("email_insights")
        .select("*")
        .eq("property_id", propertyId)
        .order("email_date", { ascending: false })
        .limit(100), // Increased limit
      supabase
        .from("user_phone_calls")
        .select("*")
        .eq("property_id", propertyId)
        .order("started_at", { ascending: false })
        .limit(50),
      supabase
        .from("lead_communications")
        .select("*")
        .eq("communication_type", "sms")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("owner_conversations")
        .select("id")
        .eq("property_id", propertyId)
        .limit(1),
    ]);

    const emails = (emailsResult.data || []) as EmailInsight[];
    const calls = (callsResult.data || []) as PhoneCall[];
    const smsList = smsResult.data || [];
    const existingConversation = existingConvResult.data?.[0];

    console.log(`Found: ${emails.length} emails, ${calls.length} calls, ${smsList.length} SMS`);

    // Create or get conversation record for auto-approved tasks
    let conversationId: string;
    if (existingConversation) {
      conversationId = existingConversation.id;
    } else {
      const { data: newConv, error: convError } = await supabase
        .from("owner_conversations")
        .insert({
          property_id: propertyId,
          title: `${property.name || "Property"} - Setup Tasks`,
          conversation_date: new Date().toISOString().split('T')[0],
          ai_summary: "Auto-generated from communications analysis",
          status: "pending",
        })
        .select("id")
        .single();

      if (convError) throw convError;
      conversationId = newConv.id;
      console.log(`Created new conversation: ${conversationId}`);
    }

    // Build comprehensive context for AI analysis
    const emailContext = emails.map((e) => ({
      id: e.id,
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
        id: c.id,
        date: c.started_at,
        from: c.from_number,
        to: c.to_number,
        transcript: c.transcription?.substring(0, 3000),
      }));

    const smsContext = smsList
      .filter((s: any) => s.body)
      .map((s: any) => ({
        id: s.id,
        date: s.created_at,
        direction: s.direction,
        body: s.body?.substring(0, 500),
      }));

    // Comprehensive AI analysis prompt
    const analysisPrompt = `You are an expert property management AI analyzing ALL communications for a property setup/onboarding.

PROPERTY: ${property.name || "Unknown"} at ${property.address || "Unknown address"}

COMMUNICATIONS DATA:

=== EMAILS (${emails.length} total) ===
${JSON.stringify(emailContext, null, 2)}

=== PHONE CALLS (${calls.length} total) ===
${JSON.stringify(callContext, null, 2)}

=== SMS MESSAGES (${smsList.length} total) ===
${JSON.stringify(smsContext, null, 2)}

TASK EXTRACTION RULES:

1. **HIGH CONFIDENCE (80-100%)** - Auto-approve these:
   - Explicit action items directly stated: "Please set up WiFi code as 12345"
   - Clear instructions from owner: "The lockbox code is 4567"
   - Specific requests: "I need you to coordinate with the photographer"
   - Confirmed appointments or deadlines

2. **MEDIUM CONFIDENCE (50-79%)** - Need confirmation:
   - Implied tasks: "The lawn needs attention"
   - Follow-up items from discussions
   - Tasks mentioned but not explicitly assigned
   - Vague references to needed work

3. **LOW CONFIDENCE (0-49%)** - Need verification:
   - Assumptions based on property type
   - General best practices not explicitly mentioned
   - Tasks that might already be done

TASK CATEGORIES & PHASES:
- Phase 1 (Legal): contracts, insurance, permits
- Phase 2 (Access): keys, lockbox, gate codes, smart locks
- Phase 3 (Technology): WiFi, smart home, cameras
- Phase 4 (Utilities): electric, water, gas, internet, trash
- Phase 5 (Operations): cleaning, maintenance vendors
- Phase 6 (Guest Experience): house rules, amenities
- Phase 7 (Property Details): furnishings, inventory
- Phase 8 (Marketing): photos, listing, pricing

EXTRACT TASKS AS JSON:
{
  "tasks": [
    {
      "title": "Clear actionable task title (max 60 chars)",
      "description": "Specific description with details from communications",
      "priority": "urgent" | "high" | "medium" | "low",
      "category": "documents" | "access" | "wifi" | "utilities" | "cleaning" | "photos" | "listing" | "legal" | "hoa" | "smart_home" | "maintenance" | "other",
      "assigned_to": "peachhaus" | "owner",
      "confidence": 0-100,
      "source_quote": "Exact quote from communication if available",
      "phase_suggestion": 1-8
    }
  ],
  "analysis_summary": "Brief summary of key findings"
}

IMPORTANT:
- Be thorough - extract ALL actionable items
- Include specific values/codes/names from communications
- Higher confidence = more explicit the task was stated
- Prioritize tasks mentioned in recent communications
- Maximum 25 tasks, ordered by priority then confidence`;

    // Call OpenAI for comprehensive analysis
    console.log("Calling OpenAI for comprehensive analysis...");
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
            content: "You are an expert property management task extractor. Analyze communications thoroughly and extract actionable setup tasks with confidence scores. Always respond with valid JSON only.",
          },
          { role: "user", content: analysisPrompt },
        ],
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const aiResponseText = openaiData.choices[0]?.message?.content || "{}";

    console.log("AI Analysis complete");

    // Parse the AI response
    let analysisResult: { tasks: ExtractedTask[]; analysis_summary?: string };
    try {
      analysisResult = JSON.parse(aiResponseText);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      throw new Error("Failed to parse AI response as JSON");
    }

    const extractedTasks = analysisResult.tasks || [];
    console.log(`Extracted ${extractedTasks.length} tasks`);

    // Get existing tasks and pending confirmations to avoid duplicates
    const [existingTasksResult, pendingConfirmationsResult] = await Promise.all([
      supabase
        .from("owner_conversation_actions")
        .select("title")
        .eq("conversation_id", conversationId),
      supabase
        .from("pending_task_confirmations")
        .select("task_title")
        .eq("property_id", propertyId)
        .in("status", ["pending", "approved"]),
    ]);

    const existingTitles = new Set([
      ...(existingTasksResult.data || []).map((t) => t.title.toLowerCase()),
      ...(pendingConfirmationsResult.data || []).map((t) => t.task_title.toLowerCase()),
    ]);

    // Separate tasks by confidence
    const highConfidenceTasks: ExtractedTask[] = [];
    const lowConfidenceTasks: ExtractedTask[] = [];

    for (const task of extractedTasks) {
      // Skip duplicates
      if (existingTitles.has(task.title.toLowerCase())) {
        console.log(`Skipping duplicate: ${task.title}`);
        continue;
      }

      if (task.confidence >= AUTO_APPROVE_THRESHOLD) {
        highConfidenceTasks.push(task);
      } else {
        lowConfidenceTasks.push(task);
      }
    }

    console.log(`High confidence (auto-approve): ${highConfidenceTasks.length}`);
    console.log(`Low confidence (need confirmation): ${lowConfidenceTasks.length}`);

    // AUTO-APPROVE high confidence tasks - insert directly to owner_conversation_actions
    const autoApprovedTasks = [];
    if (highConfidenceTasks.length > 0) {
      const tasksToInsert = highConfidenceTasks.map((task) => ({
        conversation_id: conversationId,
        action_type: "task",
        title: task.title,
        description: `${task.description}${task.source_quote ? `\n\nSource: "${task.source_quote}"` : ""}`,
        priority: task.priority,
        category: task.category,
        assigned_to: task.assigned_to,
        status: "created",
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("owner_conversation_actions")
        .insert(tasksToInsert)
        .select();

      if (insertError) {
        console.error("Error auto-approving tasks:", insertError);
      } else {
        autoApprovedTasks.push(...(inserted || []));
        console.log(`Auto-approved ${inserted?.length || 0} high-confidence tasks`);
      }
    }

    // Create pending confirmations for low confidence tasks
    const pendingConfirmations = [];
    if (lowConfidenceTasks.length > 0) {
      const confirmationsToInsert = lowConfidenceTasks.map((task) => ({
        property_id: propertyId,
        owner_id: property.owner_id,
        source_type: task.source_type || "email",
        task_title: task.title,
        task_description: task.description,
        task_category: task.category,
        priority: task.priority,
        source_quote: task.source_quote,
        phase_suggestion: task.phase_suggestion,
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("pending_task_confirmations")
        .insert(confirmationsToInsert)
        .select();

      if (insertError) {
        console.error("Error creating pending confirmations:", insertError);
      } else {
        pendingConfirmations.push(...(inserted || []));
        console.log(`Created ${inserted?.length || 0} pending confirmations`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        propertyId,
        propertyName: property.name,
        conversationId,
        summary: analysisResult.analysis_summary,
        stats: {
          emailsAnalyzed: emails.length,
          callsAnalyzed: calls.length,
          smsAnalyzed: smsList.length,
          totalTasksExtracted: extractedTasks.length,
          autoApproved: autoApprovedTasks.length,
          pendingConfirmation: pendingConfirmations.length,
        },
        autoApprovedTasks,
        pendingConfirmations,
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
