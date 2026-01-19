import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(audioUrl: string): Promise<string | null> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    console.log("No OpenAI API key, skipping transcription");
    return null;
  }

  try {
    console.log("Fetching audio for transcription:", audioUrl);
    
    // Fetch the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error("Failed to fetch audio:", audioResponse.status);
      return null;
    }
    
    const audioBlob = await audioResponse.blob();
    console.log("Audio blob size:", audioBlob.size, "type:", audioBlob.type);
    
    // Create form data for Whisper API
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "en");
    
    // Call OpenAI Whisper
    const transcribeResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: formData,
    });
    
    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error("Whisper API error:", transcribeResponse.status, errorText);
      return null;
    }
    
    const result = await transcribeResponse.json();
    console.log("Transcription result:", result.text?.substring(0, 100));
    return result.text || null;
  } catch (err) {
    console.error("Transcription error:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, voicemailId, audioBase64, duration, mimeType } = await req.json();

    if (!token || !voicemailId || !audioBase64) {
      throw new Error("Missing required fields: token, voicemailId, audioBase64");
    }

    console.log("Processing voicemail reply for token:", token);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the voicemail exists and matches the token
    const { data: voicemail, error: fetchError } = await supabase
      .from("voicemail_messages")
      .select("*, leads(id, name, email, phone)")
      .eq("id", voicemailId)
      .eq("token", token)
      .single();

    if (fetchError || !voicemail) {
      console.error("Voicemail not found or token mismatch:", fetchError);
      throw new Error("Voicemail not found or invalid token");
    }

    // Check if already replied
    if (voicemail.reply_audio_url) {
      throw new Error("A reply has already been sent for this voicemail");
    }

    // Decode base64 audio
    const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
    
    // Determine file extension from mime type - strip codec info that causes issues
    // e.g. "audio/webm; codecs=opus" -> "audio/webm"
    const cleanMimeType = mimeType?.split(';')[0]?.trim() || "audio/webm";
    const extension = cleanMimeType.includes("webm") ? "webm" : 
                      cleanMimeType.includes("mp4") ? "mp4" :
                      cleanMimeType.includes("mp3") ? "mp3" : "webm";
    const fileName = `voicemail-replies/${voicemailId}-reply-${Date.now()}.${extension}`;

    console.log(`Uploading reply audio: ${fileName} with content type: ${cleanMimeType}`);

    // Upload to storage with clean MIME type
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("message-attachments")
      .upload(fileName, audioBytes, {
        contentType: cleanMimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload reply audio");
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("message-attachments")
      .getPublicUrl(fileName);

    const replyAudioUrl = urlData.publicUrl;
    console.log("Reply audio uploaded:", replyAudioUrl);

    // Transcribe the audio
    const transcript = await transcribeAudio(replyAudioUrl);
    console.log("Transcript generated:", transcript ? "yes" : "no");

    // Update voicemail record with reply info
    // Note: status 'replied' must be in the voicemail_messages_status_check constraint
    const { error: updateError } = await supabase
      .from("voicemail_messages")
      .update({
        reply_audio_url: replyAudioUrl,
        reply_recorded_at: new Date().toISOString(),
        reply_duration_seconds: duration || 0,
        reply_transcript: transcript,
        status: "replied",
        updated_at: new Date().toISOString(),
      })
      .eq("id", voicemailId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(`Failed to update voicemail record: ${updateError.message}`);
    }

    console.log("Voicemail record updated successfully");

    // Create a lead communication entry to track the reply and show in sender's inbox
    // recipient_user_id = original sender, so they see it in their inbox
    const { error: commError } = await supabase
      .from("lead_communications")
      .insert({
        lead_id: voicemail.lead_id,
        owner_id: voicemail.owner_id,
        communication_type: "voicemail",
        direction: "inbound",
        subject: `Voice reply from ${voicemail.recipient_name || "Property Owner"}`,
        body: transcript || `🎙️ Voice reply received (${duration || 0}s) - Click to play`,
        status: "received",
        is_read: false,
        media_urls: [replyAudioUrl],
        recipient_user_id: voicemail.sender_user_id, // Show in original sender's inbox
        metadata: {
          voicemail_id: voicemailId,
          reply_audio_url: replyAudioUrl,
          reply_duration: duration,
          original_sender_name: voicemail.sender_name,
          is_voicemail_reply: true,
          transcript: transcript,
        },
      });

    if (commError) {
      console.error("Failed to create communication record:", commError);
      // Log more details for debugging
      console.error("Insert payload:", {
        lead_id: voicemail.lead_id,
        owner_id: voicemail.owner_id,
        sender_user_id: voicemail.sender_user_id,
      });
    } else {
      console.log("Communication record created for sender's inbox");
    }

    // Send Slack notification if configured
    const slackToken = Deno.env.get("SLACK_BOT_TOKEN");
    if (slackToken) {
      try {
        const recipientName = voicemail.recipient_name || "An owner";
        const propertyAddress = voicemail.property_address || "Unknown property";
        
        const slackMessage = {
          channel: "#owner-communications", // Update channel as needed
          text: `🎙️ *Voice Reply Received*\n\n*From:* ${recipientName}\n*Property:* ${propertyAddress}\n*Duration:* ${duration}s\n${transcript ? `\n*Transcript:* ${transcript.substring(0, 500)}${transcript.length > 500 ? '...' : ''}` : ''}\n\n<${replyAudioUrl}|Listen to Reply>`,
        };

        await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${slackToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(slackMessage),
        });
        console.log("Slack notification sent");
      } catch (slackErr) {
        console.error("Failed to send Slack notification:", slackErr);
        // Don't throw - Slack is optional
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        replyAudioUrl,
        transcript,
        message: "Reply sent successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Voicemail reply error:", error);
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
