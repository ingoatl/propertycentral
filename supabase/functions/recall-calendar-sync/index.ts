import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PEACHHAUS_MEETING_URL = "https://meet.google.com/jww-deey-iaa";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const recallApiKey = Deno.env.get("RECALL_API_KEY");
    
    if (!recallApiKey) {
      console.log("[Calendar Sync] RECALL_API_KEY not configured, skipping");
      return new Response(
        JSON.stringify({ error: "RECALL_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log("[Calendar Sync] Checking for upcoming meetings to auto-record...");
    
    // Get the current time and look ahead 24 hours
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Query discovery calls that:
    // 1. Have a Google Meet link matching our permanent room
    // 2. Are scheduled within the next 24 hours
    // 3. Haven't been cancelled
    // 4. Don't already have a recording scheduled
    const { data: upcomingCalls, error: queryError } = await supabase
      .from("discovery_calls")
      .select(`
        id,
        scheduled_at,
        google_meet_link,
        meeting_type,
        lead_id,
        leads (
          name,
          email
        )
      `)
      .eq("google_meet_link", PEACHHAUS_MEETING_URL)
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", in24Hours.toISOString())
      .in("status", ["scheduled", "confirmed"])
      .order("scheduled_at", { ascending: true });

    if (queryError) {
      console.error("[Calendar Sync] Error querying discovery calls:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query discovery calls", details: queryError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Calendar Sync] Found ${upcomingCalls?.length || 0} upcoming meetings with permanent room`);
    
    const results: { callId: string; status: string; botId?: string; error?: string }[] = [];
    
    for (const call of upcomingCalls || []) {
      // Check if a recording bot is already scheduled for this call
      const { data: existingRecording } = await supabase
        .from("meeting_recordings")
        .select("id, recall_bot_id")
        .eq("metadata->>discovery_call_id", call.id)
        .single();

      if (existingRecording) {
        console.log(`[Calendar Sync] Recording already scheduled for call ${call.id}`);
        results.push({ callId: call.id, status: "already_scheduled", botId: existingRecording.recall_bot_id });
        continue;
      }

      // Calculate join time - 2 minutes before scheduled start
      const scheduledAt = new Date(call.scheduled_at);
      const joinAt = new Date(scheduledAt.getTime() - 2 * 60 * 1000);
      
      // Only schedule if meeting is at least 5 minutes away
      const minutesUntilMeeting = (scheduledAt.getTime() - now.getTime()) / (1000 * 60);
      if (minutesUntilMeeting < 5) {
        console.log(`[Calendar Sync] Meeting ${call.id} is too soon (${minutesUntilMeeting.toFixed(1)} min), scheduling immediate join`);
      }

      // Schedule the bot via Recall.ai
      const recallRegion = Deno.env.get("RECALL_REGION") || "us-west-2";
      const recallBaseUrl = `https://${recallRegion}.recall.ai`;
      
      const leadName = (call.leads as { name?: string } | null)?.name || "Unknown Lead";
      const meetingTitle = `Discovery Call with ${leadName}`;

      const recallPayload: Record<string, unknown> = {
        meeting_url: PEACHHAUS_MEETING_URL,
        bot_name: "PeachHaus Assistant",
        transcription_options: {
          provider: "meeting_captions",
        },
        real_time_transcription: {
          destination_url: `${supabaseUrl}/functions/v1/recall-meeting-webhook`,
          partial_results: false,
        },
        recording_mode: "speaker_view",
        automatic_leave: {
          waiting_room_timeout: 600,
          noone_joined_timeout: 300,
          everyone_left_timeout: 60,
        },
      };

      // If meeting is more than 5 minutes away, schedule the join time
      if (minutesUntilMeeting >= 5) {
        recallPayload.join_at = joinAt.toISOString();
      }

      try {
        const recallResponse = await fetch(`${recallBaseUrl}/api/v1/bot`, {
          method: "POST",
          headers: {
            "Authorization": `Token ${recallApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(recallPayload),
        });

        if (!recallResponse.ok) {
          const errorText = await recallResponse.text();
          console.error(`[Calendar Sync] Recall API error for call ${call.id}:`, errorText);
          results.push({ callId: call.id, status: "error", error: errorText });
          continue;
        }

        const botData = await recallResponse.json();
        console.log(`[Calendar Sync] Bot scheduled for call ${call.id}:`, botData.id);

        // Create meeting_recordings entry
        const { error: insertError } = await supabase
          .from("meeting_recordings")
          .insert({
            recall_bot_id: botData.id,
            recall_meeting_id: botData.meeting_id,
            platform: "google_meet",
            meeting_url: PEACHHAUS_MEETING_URL,
            meeting_title: meetingTitle,
            status: "pending",
            metadata: {
              bot_name: "PeachHaus Assistant",
              created_via: "auto_calendar_sync",
              discovery_call_id: call.id,
              lead_id: call.lead_id,
              scheduled_join_at: minutesUntilMeeting >= 5 ? joinAt.toISOString() : null,
            },
          });

        if (insertError) {
          console.error(`[Calendar Sync] Error saving recording for call ${call.id}:`, insertError);
          results.push({ callId: call.id, status: "bot_created_db_error", botId: botData.id, error: insertError.message });
        } else {
          results.push({ callId: call.id, status: "scheduled", botId: botData.id });
        }
      } catch (err) {
        console.error(`[Calendar Sync] Error scheduling bot for call ${call.id}:`, err);
        results.push({ callId: call.id, status: "error", error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        meetingsChecked: upcomingCalls?.length || 0,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Calendar Sync] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
