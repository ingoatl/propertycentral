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
    const { token, event, duration } = await req.json();

    if (!token) {
      throw new Error("Token is required");
    }

    if (!event) {
      throw new Error("Event is required");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current voicemail record
    const { data: voicemail, error: fetchError } = await supabase
      .from("voicemail_messages")
      .select("*")
      .eq("token", token)
      .single();

    if (fetchError || !voicemail) {
      throw new Error("Voicemail not found");
    }

    // Build update object based on event type
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    switch (event) {
      case "open":
        if (!voicemail.opened_at) {
          updateData.opened_at = new Date().toISOString();
          updateData.status = "opened";
        }
        break;

      case "play":
        if (!voicemail.played_at) {
          updateData.played_at = new Date().toISOString();
          updateData.status = "played";
        }
        updateData.play_count = (voicemail.play_count || 0) + 1;
        
        if (duration && typeof duration === "number") {
          updateData.total_listen_time = (voicemail.total_listen_time || 0) + duration;
        }
        break;

      case "callback":
        updateData.callback_clicked = true;
        break;

      case "reply":
        updateData.reply_clicked = true;
        break;

      case "voice_reply_started":
        // Track when user starts recording a voice reply
        console.log("Voice reply recording started for token:", token);
        break;

      case "voice_reply_completed":
        // This is handled by voicemail-reply function
        console.log("Voice reply completed for token:", token);
        break;

      case "voice_reply_cancelled":
        // Track when user cancels voice reply
        console.log("Voice reply cancelled for token:", token);
        break;

      default:
        console.log("Unknown event type:", event);
    }

    // Update voicemail record
    const { error: updateError } = await supabase
      .from("voicemail_messages")
      .update(updateData)
      .eq("id", voicemail.id);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error("Failed to update voicemail tracking");
    }

    return new Response(
      JSON.stringify({ success: true, event }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Voicemail track error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
