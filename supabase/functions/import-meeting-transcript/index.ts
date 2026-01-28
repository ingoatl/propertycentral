import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExtractedTask {
  title: string;
  description?: string;
  priority: "urgent" | "high" | "medium" | "low";
  due_offset_days: number;
  category: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, transcript, participantType, participantId, propertyId, autoExtractTasks } = await req.json();

    if (!title || !transcript) {
      return new Response(JSON.stringify({ error: "Title and transcript are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create meeting recording entry
    const { data: recording, error: recordingError } = await supabase
      .from("meeting_recordings")
      .insert({
        title,
        transcript,
        participant_type: participantType,
        lead_id: participantType === "lead" ? participantId : null,
        owner_id: participantType === "owner" ? participantId : null,
        property_id: propertyId || null,
        status: "completed",
        duration_seconds: Math.ceil(transcript.length / 15), // Rough estimate
        created_by: user.id,
      })
      .select()
      .single();

    if (recordingError) {
      console.error("Failed to create recording:", recordingError);
      // Continue anyway - task extraction is more important
    }

    let tasksCreated = 0;

    // Extract tasks using AI if requested
    if (autoExtractTasks) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (LOVABLE_API_KEY) {
        const extractPrompt = `You are a property management assistant. Extract actionable tasks from this meeting transcript/notes.

Meeting: ${title}
Participant: ${participantType}

Transcript:
${transcript}

Extract ALL action items, follow-ups, and tasks mentioned. For each task:
1. Create a clear, actionable title (start with a verb)
2. Determine priority: urgent (same day), high (1-2 days), medium (this week), low (later)
3. Estimate when it should be done (days from now)
4. Categorize: meeting_followup, maintenance, communication, administrative, onboarding

Return ONLY a valid JSON array (no markdown):
[
  {
    "title": "Action to take",
    "description": "Additional context if needed",
    "priority": "high",
    "due_offset_days": 1,
    "category": "meeting_followup"
  }
]

Be thorough - extract every actionable item mentioned. If no tasks found, return [].`;

        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: "You extract actionable tasks from meeting notes. Return only valid JSON arrays." },
                { role: "user", content: extractPrompt },
              ],
              temperature: 0.3,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content || "[]";
            
            // Parse JSON from response
            let jsonStr = content;
            if (content.includes("```json")) {
              jsonStr = content.split("```json")[1].split("```")[0].trim();
            } else if (content.includes("```")) {
              jsonStr = content.split("```")[1].split("```")[0].trim();
            }
            
            const extractedTasks: ExtractedTask[] = JSON.parse(jsonStr);
            
            // Create tasks in user_tasks table
            if (extractedTasks.length > 0) {
              const now = new Date();
              const tasksToInsert = extractedTasks.map(task => {
                const dueDate = new Date(now);
                dueDate.setDate(dueDate.getDate() + (task.due_offset_days || 1));
                
                return {
                  user_id: user.id,
                  title: task.title,
                  description: task.description || null,
                  priority: task.priority || "medium",
                  status: "pending",
                  due_date: dueDate.toISOString().split("T")[0],
                  source_type: "meeting",
                  source_id: recording?.id || null,
                  category: task.category || "meeting_followup",
                  related_contact_type: participantType !== "other" ? participantType : null,
                  related_contact_id: participantId || null,
                  property_id: propertyId || null,
                };
              });

              const { data: insertedTasks, error: insertError } = await supabase
                .from("user_tasks")
                .insert(tasksToInsert)
                .select();

              if (insertError) {
                console.error("Failed to insert tasks:", insertError);
              } else {
                tasksCreated = insertedTasks?.length || 0;
              }
            }
          } else {
            console.error("AI extraction failed:", await aiResponse.text());
          }
        } catch (aiError) {
          console.error("AI extraction error:", aiError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        recordingId: recording?.id,
        tasksCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error importing transcript:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to import transcript";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
