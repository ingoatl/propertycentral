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
  callerUserId?: string; // The user who made/received the call
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
  follow_up_suggestion?: {
    recommended_days: number;
    reason: string;
    suggested_message: string;
  };
}

// Team member IDs for smart routing
const TEAM_MEMBERS: Record<string, string> = {
  'anja': 'b2f495ac-2062-446e-bfa0-2197a82114c1',
  'ingo': '8f7c8f43-536f-4587-99dc-5086c144a045',
};

// Detect if transcript mentions wanting to speak with a specific team member
function detectAssignedUser(transcript: string): string | null {
  const transcriptLower = transcript.toLowerCase();
  
  // Check for Anja mentions
  const anjaPatterns = [
    'speak with anja',
    'talk to anja',
    'connect me to anja',
    'is anja available',
    'speak to anja',
    'get anja',
    'can i speak with anja',
    'anja please',
    'transfer to anja',
    'reach anja',
  ];
  
  if (anjaPatterns.some(pattern => transcriptLower.includes(pattern))) {
    return TEAM_MEMBERS['anja'];
  }
  
  // Check for Ingo mentions
  const ingoPatterns = [
    'speak with ingo',
    'talk to ingo',
    'connect me to ingo',
    'is ingo available',
    'speak to ingo',
    'get ingo',
    'can i speak with ingo',
    'ingo please',
    'transfer to ingo',
    'reach ingo',
    'connect you to ingo',
  ];
  
  if (ingoPatterns.some(pattern => transcriptLower.includes(pattern))) {
    return TEAM_MEMBERS['ingo'];
  }
  
  return null;
}

// Smart greeting that avoids "Hi Unknown"
function createSmartGreeting(name: string | null): string {
  if (!name) return 'Hi,';
  
  const nameLower = name.toLowerCase();
  // Check for unknown/invalid name patterns
  if (
    nameLower.includes('unknown') ||
    nameLower.includes('caller') ||
    nameLower === 'n/a' ||
    nameLower === 'na' ||
    name.length < 2
  ) {
    return 'Hi,';
  }
  
  // Extract first name
  const parts = name.split(' ').filter(p => 
    !['mr.', 'mrs.', 'ms.', 'dr.', 'mr', 'mrs', 'ms', 'dr'].includes(p.toLowerCase())
  );
  const firstName = parts[0];
  
  if (!firstName || firstName.length < 2) return 'Hi,';
  
  return `Hi ${firstName},`;
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
    
    // Create smart greeting for email
    const greeting = createSmartGreeting(callData.matchedName || null);

    // Build AI prompt with smart greeting instruction
    const systemPrompt = `You are a professional property management assistant analyzing call transcripts.
Your job is to:
1. Extract key topics discussed
2. Identify actionable tasks mentioned in the conversation
3. Generate a professional recap email for the caller
4. Summarize the call
5. Assess the overall sentiment
6. Suggest follow-up timing based on the conversation

The caller is ${recipientType === "owner" ? "a property owner we manage for" : recipientType === "lead" ? "a prospective client" : "someone who called our office"}.
Their name is: ${recipientName}

IMPORTANT FOR EMAIL:
- Use "${greeting}" as the greeting - NEVER say "Hi Unknown" or "Hi Unknown Caller"
- If the name appears to be unknown/invalid, just use "Hi," without a name

CRITICAL FOR TASK EXTRACTION:
Look for these types of action items and ALWAYS create tasks for them:
1. **Discovery Call / Meeting Scheduling**: If the caller expresses interest in learning more, wants to discuss property management, mentions scheduling a call, or says things like:
   - "I'd like to learn more"
   - "Can we schedule a call?"
   - "I want to discuss my property"
   - "Let's talk about management"
   - "I'm interested in your services"
   Create a task with category "Scheduling" and title like "Schedule discovery call with [name]"

2. **Property Information Requests**: If they mention wanting an income report, analysis, or property evaluation

3. **Document Requests**: If they need contracts, agreements, or documentation

4. **Follow-up Actions**: Any promises made during the call that need follow-through

5. **Maintenance/Service Requests**: Any property issues or service requests mentioned

Return a JSON object with this structure:
{
  "key_topics": ["topic1", "topic2", ...],
  "action_items": [
    {
      "title": "Task title",
      "description": "Detailed description of what needs to be done",
      "priority": "high|medium|low",
      "category": "Insurance|Utilities|Documentation|Inspection|Maintenance|Communication|Scheduling|Other",
      "source_quote": "Relevant quote from transcript"
    }
  ],
  "recap_email": {
    "subject": "Email subject line",
    "body": "HTML formatted email body"
  },
  "transcript_summary": "2-3 sentence summary",
  "sentiment": "positive|neutral|negative",
  "follow_up_suggestion": {
    "recommended_days": 3,
    "reason": "Brief reason for this timing, e.g. 'Caller mentioned wanting to think it over'",
    "suggested_message": "Short follow-up message to send"
  }
}

For follow_up_suggestion:
- If caller said "call me back next week" or similar, set recommended_days to 7
- If caller said "I need to think about it", set recommended_days to 3
- If caller expressed strong interest but needs more info, set recommended_days to 1-2
- If call was very positive with clear next steps, recommended_days can be null (no follow-up needed)

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
        model: "google/gemini-3-flash-preview",
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

    // Detect if caller wants to speak with a specific team member
    const assignedToUserId = detectAssignedUser(callData.transcript);
    if (assignedToUserId) {
      const teamMemberName = Object.entries(TEAM_MEMBERS).find(([_, id]) => id === assignedToUserId)?.[0];
      console.log(`Caller requested to speak with ${teamMemberName}, assigning recap to user ${assignedToUserId}`);
    }

    // Insert pending call recap with assigned_to_user_id
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
        caller_user_id: callData.callerUserId || null,
        assigned_to_user_id: assignedToUserId, // Smart routing based on transcript
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

    // If lead has "Unknown Caller" name and we found a real name from analysis, update the lead
    if (callData.leadId && recipientName.includes("Unknown Caller")) {
      // Try to extract caller name from transcript
      const namePattern = /(?:this is|my name is|i'm|i am|human:)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi;
      const matches = [...callData.transcript.matchAll(namePattern)];
      const teamMembers = ['ingo', 'tom', 'anja', 'jason', 'peachhaus'];
      
      for (const match of matches) {
        const extractedName = match[1]?.trim();
        if (extractedName && extractedName.length >= 2 && extractedName.length <= 30) {
          const nameLower = extractedName.toLowerCase();
          if (!teamMembers.some(tm => nameLower.includes(tm))) {
            console.log(`Updating lead ${callData.leadId} name from transcript: ${extractedName}`);
            await supabase
              .from("leads")
              .update({ name: extractedName })
              .eq("id", callData.leadId);
            
            // Also update the recap recipient name
            if (recapData) {
              await supabase
                .from("pending_call_recaps")
                .update({ recipient_name: extractedName })
                .eq("id", recapData.id);
            }
            break;
          }
        }
      }
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
        assignedToUserId: assignedToUserId,
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
