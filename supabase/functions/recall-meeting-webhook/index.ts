import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecallWebhookPayload {
  event: string;
  data: {
    bot_id: string;
    meeting_id?: string;
    meeting_url?: string;
    status?: string;
    transcript?: {
      segments: Array<{
        speaker: string;
        text: string;
        start_time: number;
        end_time: number;
      }>;
    };
    participants?: Array<{
      name: string;
      email?: string;
    }>;
    recording_url?: string;
    duration_seconds?: number;
    meeting_title?: string;
    platform?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: RecallWebhookPayload = await req.json();
    console.log("Recall webhook received:", payload.event, payload.data.bot_id);

    const { event, data } = payload;

    // Handle different webhook events
    switch (event) {
      case "bot.status_change": {
        // Update meeting recording status
        await supabase
          .from("meeting_recordings")
          .update({
            status: data.status === "done" ? "completed" : data.status,
            updated_at: new Date().toISOString(),
          })
          .eq("recall_bot_id", data.bot_id);
        break;
      }

      case "transcript.completed":
      case "bot.done": {
        // Get the meeting recording
        const { data: recording, error: recordingError } = await supabase
          .from("meeting_recordings")
          .select("*")
          .eq("recall_bot_id", data.bot_id)
          .single();

        if (recordingError || !recording) {
          console.error("Meeting recording not found:", data.bot_id);
          return new Response(
            JSON.stringify({ error: "Meeting recording not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Build full transcript from segments
        const transcriptText = data.transcript?.segments
          ?.map((s) => `${s.speaker}: ${s.text}`)
          .join("\n") || "";

        // Update meeting recording with transcript
        await supabase
          .from("meeting_recordings")
          .update({
            transcript: transcriptText,
            transcript_segments: data.transcript?.segments || [],
            participants: data.participants || [],
            duration_seconds: data.duration_seconds,
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("recall_bot_id", data.bot_id);

        // Match participants to owners/leads
        let matchedOwnerId: string | null = null;
        let matchedLeadId: string | null = null;
        let propertyId: string | null = null;

        if (data.participants) {
          for (const participant of data.participants) {
            if (participant.email) {
              // Try to match to owner
              const { data: owner } = await supabase
                .from("property_owners")
                .select("id, properties(id)")
                .eq("email", participant.email.toLowerCase())
                .limit(1)
                .maybeSingle();

              if (owner) {
                matchedOwnerId = owner.id;
                if (owner.properties && owner.properties.length > 0) {
                  propertyId = owner.properties[0].id;
                }
                break;
              }

              // Try to match to lead
              const { data: lead } = await supabase
                .from("leads")
                .select("id, property_id")
                .eq("email", participant.email.toLowerCase())
                .limit(1)
                .maybeSingle();

              if (lead) {
                matchedLeadId = lead.id;
                propertyId = lead.property_id;
                break;
              }
            }
          }
        }

        // Create lead_communications record with correct column names
        const { data: commRecord, error: commError } = await supabase
          .from("lead_communications")
          .insert({
            communication_type: "voice_call",
            direction: "outbound",
            body: transcriptText,
            call_duration: data.duration_seconds,
            owner_id: matchedOwnerId,
            lead_id: matchedLeadId,
            status: "delivered",
            metadata: {
              platform: recording.platform,
              meeting_title: recording.meeting_title,
              participants: data.participants,
              recall_bot_id: data.bot_id,
              transcript_source: "recall.ai",
              is_video_meeting: true,
            },
          })
          .select()
          .single();

        if (commError) {
          console.error("Error creating communication:", commError);
        } else {
          // Update meeting recording with communication link
          await supabase
            .from("meeting_recordings")
            .update({
              communication_id: commRecord?.id,
              matched_owner_id: matchedOwnerId,
              matched_lead_id: matchedLeadId,
              property_id: propertyId,
              analyzed: false,
            })
            .eq("recall_bot_id", data.bot_id);

          // Trigger transcript analysis if we have a transcript
          if (transcriptText && transcriptText.length > 50) {
            const recipientName = data.participants?.[0]?.name || "Meeting Participant";
            const recipientEmail = data.participants?.[0]?.email || null;

            try {
              const analysisResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-call-transcript`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  communicationId: commRecord?.id,
                  transcript: transcriptText,
                  callDuration: data.duration_seconds,
                  callerUserId: recording.host_user_id,
                  recipientName,
                  recipientEmail,
                  recipientType: matchedOwnerId ? "owner" : matchedLeadId ? "lead" : "unknown",
                  ownerId: matchedOwnerId,
                  leadId: matchedLeadId,
                  propertyId,
                  platform: recording.platform,
                }),
              });

              // Create pending_call_recap for video meetings
              if (recipientEmail) {
                const recapTitle = `Video Meeting Recap: ${recording.meeting_title || "Untitled Meeting"}`;
                const recapBody = `Meeting with ${recipientName}\nDuration: ${Math.round((data.duration_seconds || 0) / 60)} minutes\n\nTranscript Summary:\n${transcriptText.slice(0, 500)}...`;

                await supabase
                  .from("pending_call_recaps")
                  .insert({
                    communication_id: commRecord?.id,
                    recipient_email: recipientEmail,
                    recipient_name: recipientName,
                    subject: recapTitle,
                    body: recapBody,
                    status: "pending",
                    owner_id: matchedOwnerId,
                    lead_id: matchedLeadId,
                  });

                console.log(`Created pending_call_recap for video meeting ${data.bot_id}`);
              }

              // Mark as analyzed
              await supabase
                .from("meeting_recordings")
                .update({ analyzed: true })
                .eq("recall_bot_id", data.bot_id);
            } catch (analysisError) {
              console.error("Error triggering analysis:", analysisError);
            }
          }
        }
        break;
      }

      case "bot.error": {
        await supabase
          .from("meeting_recordings")
          .update({
            status: "failed",
            error_message: JSON.stringify(data),
            updated_at: new Date().toISOString(),
          })
          .eq("recall_bot_id", data.bot_id);
        break;
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
