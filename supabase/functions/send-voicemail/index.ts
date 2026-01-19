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
    const {
      recipientPhone,
      recipientName,
      leadId,
      ownerId,
      senderName,
      messageText,
      audioBase64,
      audioMimeType,
      audioSource,
      voiceId,
      durationSeconds,
    } = await req.json();

    if (!recipientPhone) {
      throw new Error("Recipient phone is required");
    }

    if (!audioBase64) {
      throw new Error("Audio data is required");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from auth header
    const authHeader = req.headers.get("Authorization");
    let senderUserId = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      senderUserId = user?.id;
    }

    // Convert base64 to Uint8Array
    const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));

    // Determine file extension from mime type
    let extension = "mp3";
    if (audioMimeType?.includes("webm")) extension = "webm";
    else if (audioMimeType?.includes("mp4")) extension = "mp4";
    else if (audioMimeType?.includes("wav")) extension = "wav";

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `voicemail_${timestamp}.${extension}`;
    const storagePath = `voicemails/${filename}`;

    // Upload audio to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("message-attachments")
      .upload(storagePath, audioBytes, {
        contentType: audioMimeType || "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload audio: " + uploadError.message);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("message-attachments")
      .getPublicUrl(storagePath);

    const audioUrl = urlData.publicUrl;

    // Create voicemail record
    const { data: voicemail, error: voicemailError } = await supabase
      .from("voicemail_messages")
      .insert({
        lead_id: leadId || null,
        owner_id: ownerId || null,
        recipient_phone: recipientPhone,
        recipient_name: recipientName || null,
        sender_user_id: senderUserId,
        sender_name: senderName || null,
        message_text: messageText || "",
        audio_url: audioUrl,
        audio_source: audioSource || "ai_generated",
        voice_id: voiceId || "nPczCjzI2devNBz1zQrb",
        duration_seconds: durationSeconds || null,
        status: "pending",
      })
      .select()
      .single();

    if (voicemailError) {
      console.error("Voicemail insert error:", voicemailError);
      throw new Error("Failed to create voicemail record: " + voicemailError.message);
    }

    // Build the player URL
    const playerUrl = `https://propertycentral.lovable.app/vm/${voicemail.token}`;

    // Format phone number for Twilio
    let formattedPhone = recipientPhone.replace(/\D/g, "");
    if (formattedPhone.length === 10) {
      formattedPhone = "+1" + formattedPhone;
    } else if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+" + formattedPhone;
    }

    // Send SMS via Twilio
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error("Twilio credentials not configured");
    }

    const smsBody = `🎙️ ${senderName || "Peachhaus"} left you a voice message.\n\nTap to listen:\n${playerUrl}\n\nReply to this text or call (404) 800-5932`;

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        },
        body: new URLSearchParams({
          To: formattedPhone,
          From: twilioPhoneNumber,
          Body: smsBody,
        }),
      }
    );

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioData);
      
      // Update voicemail status to failed
      await supabase
        .from("voicemail_messages")
        .update({ status: "failed" })
        .eq("id", voicemail.id);

      throw new Error(twilioData.message || "Failed to send SMS");
    }

    // Update voicemail with SMS info
    await supabase
      .from("voicemail_messages")
      .update({
        sms_sent_at: new Date().toISOString(),
        sms_message_sid: twilioData.sid,
        status: "sent",
      })
      .eq("id", voicemail.id);

    // Also log to lead_communications if we have a lead ID
    if (leadId) {
      await supabase.from("lead_communications").insert({
        lead_id: leadId,
        communication_type: "voicemail",
        direction: "outbound",
        body: messageText || "(Voice message)",
        status: "sent",
        metadata: {
          voicemail_id: voicemail.id,
          audio_url: audioUrl,
          player_url: playerUrl,
          sms_sid: twilioData.sid,
        },
      });
    }

    // Log to lead_communications for owner if we have owner ID
    if (ownerId) {
      await supabase.from("lead_communications").insert({
        owner_id: ownerId,
        communication_type: "voicemail",
        direction: "outbound",
        body: messageText || "(Voice message)",
        status: "sent",
        metadata: {
          voicemail_id: voicemail.id,
          audio_url: audioUrl,
          player_url: playerUrl,
          sms_sid: twilioData.sid,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        voicemailId: voicemail.id,
        token: voicemail.token,
        playerUrl,
        smsSid: twilioData.sid,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Send voicemail error:", error);
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
