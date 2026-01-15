import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduleBotRequest {
  discoveryCallId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const recallApiKey = Deno.env.get("RECALL_API_KEY");

    if (!recallApiKey) {
      console.log("RECALL_API_KEY not configured - skipping bot scheduling");
      return new Response(
        JSON.stringify({ message: "Recall.ai not configured, skipping" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { discoveryCallId }: ScheduleBotRequest = await req.json();

    if (!discoveryCallId) {
      return new Response(
        JSON.stringify({ error: "discoveryCallId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the discovery call details
    const { data: call, error: callError } = await supabase
      .from("discovery_calls")
      .select(`
        *,
        leads(id, name, email, phone)
      `)
      .eq("id", discoveryCallId)
      .single();

    if (callError || !call) {
      console.error("Discovery call not found:", discoveryCallId);
      return new Response(
        JSON.stringify({ error: "Discovery call not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only schedule bot for video meetings with Google Meet link
    if (call.meeting_type !== "video" || !call.google_meet_link) {
      console.log("Not a video meeting or no Google Meet link - skipping bot");
      return new Response(
        JSON.stringify({ message: "Not a video meeting, skipping bot" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if bot already scheduled for this call
    const { data: existingRecording } = await supabase
      .from("meeting_recordings")
      .select("id")
      .eq("discovery_call_id", discoveryCallId)
      .maybeSingle();

    if (existingRecording) {
      console.log("Bot already scheduled for this call");
      return new Response(
        JSON.stringify({ message: "Bot already scheduled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate when to join - 1 minute before scheduled time
    const scheduledAt = new Date(call.scheduled_at);
    const joinAt = new Date(scheduledAt.getTime() - 60 * 1000); // 1 minute early
    const now = new Date();

    // If meeting is in the past, don't schedule
    if (scheduledAt < now) {
      console.log("Meeting is in the past - skipping bot");
      return new Response(
        JSON.stringify({ message: "Meeting is in the past" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const leadName = call.leads?.name || "Discovery Call";
    const meetingTitle = `Discovery Call with ${leadName}`;

    // Schedule the bot via Recall.ai API
    // Recall.ai will join at the specified time
    // Use regional endpoint - default to us-west-2 for pay-as-you-go accounts
    const recallRegion = Deno.env.get("RECALL_REGION") || "us-west-2";
    const recallBaseUrl = `https://${recallRegion}.recall.ai`;
    
    const recallPayload: Record<string, unknown> = {
      meeting_url: call.google_meet_link,
      bot_name: "PeachHaus Notes",
      transcription_options: {
        provider: "meeting_captions",
      },
      real_time_transcription: {
        destination_url: `${supabaseUrl}/functions/v1/recall-meeting-webhook`,
        partial_results: false,
      },
      recording_mode: "speaker_view",
      automatic_leave: {
        waiting_room_timeout: 600, // 10 minutes
        noone_joined_timeout: 300, // 5 minutes  
        everyone_left_timeout: 60, // 1 minute
      },
    };

    // If meeting is more than 5 minutes away, schedule for later
    const minutesUntilMeeting = (scheduledAt.getTime() - now.getTime()) / (1000 * 60);
    if (minutesUntilMeeting > 5) {
      recallPayload.join_at = joinAt.toISOString();
    }

    console.log("Creating Recall bot for meeting:", call.google_meet_link, "region:", recallRegion, "join_at:", recallPayload.join_at || "immediately");

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
      console.error("Recall API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create bot", details: errorText }),
        { status: recallResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botData = await recallResponse.json();
    console.log("Bot scheduled:", botData.id, "for meeting at", call.scheduled_at);

    // Create meeting_recordings entry linked to discovery call
    const { data: recording, error: insertError } = await supabase
      .from("meeting_recordings")
      .insert({
        recall_bot_id: botData.id,
        recall_meeting_id: botData.meeting_id,
        platform: "google_meet",
        meeting_url: call.google_meet_link,
        meeting_title: meetingTitle,
        host_user_id: call.scheduled_by,
        lead_id: call.lead_id,
        discovery_call_id: discoveryCallId,
        status: "scheduled",
        started_at: call.scheduled_at,
        metadata: {
          bot_name: "PeachHaus Notes",
          created_via: "auto_schedule",
          lead_name: leadName,
          lead_email: call.leads?.email,
          lead_phone: call.leads?.phone,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating meeting recording:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save meeting recording", details: insertError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        botId: botData.id,
        recordingId: recording?.id,
        scheduledJoinAt: recallPayload.join_at || "immediately",
        message: `Bot scheduled to join at ${joinAt.toISOString()}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-schedule bot error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});