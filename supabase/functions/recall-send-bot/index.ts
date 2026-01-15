import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendBotRequest {
  meetingUrl: string;
  meetingTitle?: string;
  platform?: "zoom" | "google_meet" | "teams" | "webex";
  userId?: string;
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
      return new Response(
        JSON.stringify({ error: "RECALL_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { meetingUrl, meetingTitle, platform, userId }: SendBotRequest = await req.json();

    if (!meetingUrl) {
      return new Response(
        JSON.stringify({ error: "Meeting URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect platform from URL if not provided
    let detectedPlatform = platform;
    if (!detectedPlatform) {
      if (meetingUrl.includes("zoom.us")) {
        detectedPlatform = "zoom";
      } else if (meetingUrl.includes("meet.google.com")) {
        detectedPlatform = "google_meet";
      } else if (meetingUrl.includes("teams.microsoft.com")) {
        detectedPlatform = "teams";
      } else if (meetingUrl.includes("webex.com")) {
        detectedPlatform = "webex";
      } else {
        detectedPlatform = "zoom"; // Default
      }
    }

    // Get user from auth header if not provided
    let hostUserId = userId;
    if (!hostUserId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(
          authHeader.replace("Bearer ", "")
        );
        hostUserId = user?.id;
      }
    }

    // Create bot via Recall.ai API
    // Use regional endpoint - default to us-west-2 for pay-as-you-go accounts
    const recallRegion = Deno.env.get("RECALL_REGION") || "us-west-2";
    const recallBaseUrl = `https://${recallRegion}.recall.ai`;
    
    const recallResponse = await fetch(`${recallBaseUrl}/api/v1/bot`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${recallApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        meeting_url: meetingUrl,
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
          waiting_room_timeout: 600, // 10 minutes
          noone_joined_timeout: 300, // 5 minutes
          everyone_left_timeout: 60, // 1 minute
        },
      }),
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
    console.log("Bot created:", botData.id);

    // Create meeting_recordings entry
    const { data: recording, error: insertError } = await supabase
      .from("meeting_recordings")
      .insert({
        recall_bot_id: botData.id,
        recall_meeting_id: botData.meeting_id,
        platform: detectedPlatform,
        meeting_url: meetingUrl,
        meeting_title: meetingTitle || "Untitled Meeting",
        host_user_id: hostUserId,
        status: "pending",
        metadata: {
          bot_name: "PeachHaus Assistant",
          created_via: "manual",
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
        message: "Bot is joining the meeting...",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send bot error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
