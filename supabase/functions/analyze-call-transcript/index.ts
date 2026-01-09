import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CallData {
  communicationId: string;
  ownerId?: string;
  leadId?: string;
  propertyId?: string;
  matchedName?: string;
  matchedEmail?: string;
  callDuration?: number;
  transcript: string;
  ghlCallId: string;
}

interface ExtractedTask {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: string;
  source_quote?: string;
}

interface AnalysisResult {
  key_topics: string[];
  action_items: ExtractedTask[];
  recap_email: {
    subject: string;
    body: string;
  };
  transcript_summary: string;
  sentiment: "positive" | "neutral" | "negative";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const callData: CallData = await req.json();
    console.log(`Analyzing call transcript for communication: ${callData.communicationId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine recipient type
    const recipientType = callData.ownerId ? "owner" : callData.leadId ? "lead" : "unknown";
    const recipientName = callData.matchedName || "Caller";

    // Build AI prompt
    const systemPrompt = `You are a professional property management assistant analyzing call transcripts.
Your job is to:
1. Extract key topics discussed
2. Identify actionable tasks mentioned in the conversation
3. Generate a professional recap email for the caller
4. Summarize the call
5. Assess the overall sentiment

The caller is ${recipientType === "owner" ? "a property owner we manage for" : recipientType === "lead" ? "a prospective client" : "someone who called our office"}.
Their name is: ${recipientName}

Return a JSON object with this structure:
{
  "key_topics": ["topic1", "topic2", ...],
  "action_items": [
    {
      "title": "Task title",
      "description": "Detailed description of what needs to be done",
      "priority": "high|medium|low",
      "category": "Insurance|Utilities|Documentation|Inspection|Maintenance|Communication|Other",
      "source_quote": "Relevant quote from transcript"
    }
  ],
  "recap_email": {
    "subject": "Email subject line",
    "body": "HTML formatted email body"
  },
  "transcript_summary": "2-3 sentence summary",
  "sentiment": "positive|neutral|negative"
}

For the recap email:
- Be professional but warm
- Reference specific topics discussed
- List action items clearly
- Include next steps
- Sign off as "PeachHaus Team"
${recipientType === "owner" ? "- Reference their property and our management relationship" : ""}
${recipientType === "lead" ? "- Focus on how we can help them with their property management needs" : ""}`;

    const userPrompt = `Analyze this call transcript and extract tasks, generate a recap email, and summarize:

TRANSCRIPT:
${callData.transcript}

CALL DURATION: ${callData.callDuration ? Math.round(callData.callDuration / 60) + " minutes" : "Unknown"}`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI analysis failed:", errorText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse AI response
    let analysis: AnalysisResult;
    try {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1] || content;
      analysis = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI analysis response");
    }

    console.log(`Analysis complete. Found ${analysis.action_items?.length || 0} tasks`);

    // Insert pending call recap
    const { data: recapData, error: recapError } = await supabase
      .from("pending_call_recaps")
      .insert({
        communication_id: callData.communicationId,
        owner_id: callData.ownerId || null,
        lead_id: callData.leadId || null,
        property_id: callData.propertyId || null,
        recipient_name: recipientName,
        recipient_email: callData.matchedEmail || null,
        recipient_type: recipientType,
        call_date: new Date().toISOString(),
        call_duration: callData.callDuration || null,
        subject: analysis.recap_email?.subject || `Call Summary - ${new Date().toLocaleDateString()}`,
        email_body: analysis.recap_email?.body || `<p>Thank you for your call. We'll follow up soon.</p>`,
        key_topics: analysis.key_topics || [],
        action_items: analysis.action_items || [],
        transcript_summary: analysis.transcript_summary || "",
        sentiment: analysis.sentiment || "neutral",
        status: "pending",
      })
      .select()
      .single();

    if (recapError) {
      console.error("Error inserting pending recap:", recapError);
    } else {
      console.log(`Created pending recap: ${recapData.id}`);
    }

    // Insert pending task confirmations for each action item
    const insertedTasks = [];
    for (const task of analysis.action_items || []) {
      const { data: taskData, error: taskError } = await supabase
        .from("pending_task_confirmations")
        .insert({
          property_id: callData.propertyId || null,
          owner_id: callData.ownerId || null,
          source_type: "call_transcript",
          source_id: callData.communicationId,
          task_title: task.title,
          task_description: task.description,
          priority: task.priority || "medium",
          task_category: task.category || "Other",
          source_quote: task.source_quote || null,
          confidence_score: 75, // AI-extracted tasks get medium confidence
          status: "pending",
          ghl_call_id: callData.ghlCallId,
        })
        .select()
        .single();

      if (taskError) {
        console.error("Error inserting task confirmation:", taskError);
      } else {
        insertedTasks.push(taskData);
      }
    }

    console.log(`Inserted ${insertedTasks.length} task confirmations`);

    return new Response(
      JSON.stringify({
        success: true,
        recapId: recapData?.id,
        tasksCreated: insertedTasks.length,
        summary: analysis.transcript_summary,
        sentiment: analysis.sentiment,
        keyTopics: analysis.key_topics,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error analyzing call transcript:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
