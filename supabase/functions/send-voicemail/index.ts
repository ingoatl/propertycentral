import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Function to transcribe audio using OpenAI Whisper
async function transcribeAudio(audioBytes: Uint8Array, mimeType: string): Promise<string | null> {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    console.log("OpenAI API key not configured, skipping transcription");
    return null;
  }

  try {
    // Determine the file extension
    let extension = "mp3";
    if (mimeType.includes("webm")) extension = "webm";
    else if (mimeType.includes("mp4") || mimeType.includes("m4a")) extension = "m4a";
    else if (mimeType.includes("wav")) extension = "wav";
    else if (mimeType.includes("ogg")) extension = "ogg";

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array(audioBytes)], { type: mimeType });
    formData.append("file", audioBlob, `audio.${extension}`);
    formData.append("model", "whisper-1");
    formData.append("language", "en");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Whisper transcription error:", response.status, errorText);
      return null;
    }

    const result = await response.json();
    console.log("Transcription result:", result.text?.substring(0, 100));
    return result.text || null;
  } catch (error) {
    console.error("Transcription failed:", error);
    return null;
  }
}

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
      vendorId,
      senderName,
      messageText,
      audioBase64,
      audioMimeType,
      audioSource,
      voiceId,
      durationSeconds,
      // Video fields
      mediaType = "audio",
      videoUrl,
      videoStoragePath,
    } = await req.json();

    if (!recipientPhone) {
      throw new Error("Recipient phone is required");
    }

    // For audio, require audio data; for video, require video URL
    if (mediaType === "audio" && !audioBase64) {
      throw new Error("Audio data is required for audio messages");
    }
    if (mediaType === "video" && !videoUrl) {
      throw new Error("Video URL is required for video messages");
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

    // Variables for the final message
    let audioUrl = "";
    let finalMessageText = messageText;
    
    if (mediaType === "video") {
      // VIDEO MESSAGE: Video was already uploaded by the client
      console.log("Processing video message with URL:", videoUrl);
      
      // Note: Whisper doesn't support video files directly, so we skip transcription for videos
      // The user should speak clearly in the video - we'll use the provided messageText or default
      finalMessageText = messageText || "(Video message)";
      // audioUrl stays empty for video
    } else {
      // AUDIO MESSAGE: Need to process and upload audio
      
      // Convert base64 to Uint8Array
      const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));

      // Normalize mime type (remove codecs parameter which can cause issues)
      let normalizedMimeType = audioMimeType || "audio/mpeg";
      if (normalizedMimeType.includes(";")) {
        normalizedMimeType = normalizedMimeType.split(";")[0].trim();
      }

      // Transcribe if it's a recording without text
      if (audioSource === "recording" || !messageText || messageText === "(Voice recording)") {
        console.log("Transcribing recorded audio...");
        const transcript = await transcribeAudio(audioBytes, normalizedMimeType);
        if (transcript) {
          finalMessageText = transcript;
          console.log("Transcription complete:", transcript.substring(0, 100));
        } else {
          finalMessageText = messageText || "(Voice recording)";
        }
      }

      // Determine file extension and upload content type
      let extension = "mp3";
      let uploadContentType = "audio/mpeg";
      
      if (normalizedMimeType.includes("webm")) {
        extension = "webm";
        uploadContentType = "application/octet-stream";
      } else if (normalizedMimeType.includes("mp4") || normalizedMimeType.includes("m4a")) {
        extension = "m4a";
        uploadContentType = "audio/mp4";
      } else if (normalizedMimeType.includes("wav")) {
        extension = "wav";
        uploadContentType = "audio/wav";
      } else if (normalizedMimeType.includes("ogg")) {
        extension = "ogg";
        uploadContentType = "application/octet-stream";
      } else if (normalizedMimeType.includes("mpeg") || normalizedMimeType.includes("mp3")) {
        extension = "mp3";
        uploadContentType = "audio/mpeg";
      }

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `voicemail_${timestamp}.${extension}`;
      const storagePath = `voicemails/${filename}`;

      console.log(`Uploading audio: ${storagePath}, contentType: ${uploadContentType}, originalMime: ${audioMimeType}`);

      // Upload audio to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(storagePath, audioBytes, {
          contentType: uploadContentType,
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

      audioUrl = urlData.publicUrl;
    }

    // Create voicemail record with actual transcript
    // Ensure duration_seconds is an integer
    const durationInt = durationSeconds ? Math.round(durationSeconds) : null;
    
    const { data: voicemail, error: voicemailError } = await supabase
      .from("voicemail_messages")
      .insert({
        lead_id: leadId || null,
        owner_id: ownerId || null,
        recipient_phone: recipientPhone,
        recipient_name: recipientName || null,
        sender_user_id: senderUserId,
        sender_name: senderName || null,
        message_text: finalMessageText,
        audio_url: mediaType === "audio" ? audioUrl : null,
        video_url: mediaType === "video" ? videoUrl : null,
        media_type: mediaType,
        audio_source: audioSource || "ai_generated",
        voice_id: voiceId || "HXPJDxQ2YWg0wT4IBlof",
        duration_seconds: durationInt,
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

    // Format phone number for GHL (E.164) with validation
    let formattedPhone = recipientPhone.replace(/\D/g, "");
    
    // Validate phone number - must be exactly 10 or 11 digits for US
    if (formattedPhone.length > 11) {
      console.error(`Invalid phone number - too many digits: ${formattedPhone} (${formattedPhone.length} digits)`);
      // Truncate to first 10 digits (assuming area code + number)
      formattedPhone = formattedPhone.substring(0, 10);
      console.log(`Truncated to: ${formattedPhone}`);
    }
    
    if (formattedPhone.length === 10) {
      formattedPhone = "+1" + formattedPhone;
    } else if (formattedPhone.length === 11 && formattedPhone.startsWith("1")) {
      formattedPhone = "+" + formattedPhone;
    } else {
      console.error(`Invalid phone number format: ${formattedPhone}`);
      throw new Error(`Invalid phone number: must be 10 digits, got ${formattedPhone.length}`);
    }
    
    console.log(`Validated phone: ${recipientPhone} -> ${formattedPhone}`);

    // Send SMS via GoHighLevel (404-800-5932 number)
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");

    if (!ghlApiKey || !ghlLocationId) {
      throw new Error("GHL credentials not configured");
    }

    // Craft SMS with transcript preview for credibility
    const hasRealTranscript = finalMessageText && finalMessageText !== "(Voice recording)" && finalMessageText !== "(Video message)" && finalMessageText.trim().length > 0;
    
    const transcriptPreview = hasRealTranscript
      ? (finalMessageText.length > 100 
          ? finalMessageText.substring(0, 100).trim() + "..." 
          : finalMessageText)
      : null;
    
    // Format sender display
    const senderDisplay = senderName || "Your property manager";
    
    // Different SMS format for video vs audio
    const isVideo = mediaType === "video";
    const emoji = isVideo ? "🎬" : "🎙️";
    const actionVerb = isVideo ? "sent you a video message" : "left you a voice message";
    const watchOrListen = isVideo ? "Watch now" : "Listen to full message";
    
    const smsBody = transcriptPreview
      ? `${emoji} ${senderDisplay} from PeachHaus Property Management just ${actionVerb}:\n\n"${transcriptPreview}"\n\n▶️ ${watchOrListen}:\n${playerUrl}`
      : `${emoji} ${senderDisplay} from PeachHaus Property Management just ${actionVerb}.\n\nTap to ${isVideo ? "watch" : "listen"}:\n${playerUrl}`;
    
    const fromNumber = "+14048005932";

    console.log(`Sending voicemail SMS via GHL to ${formattedPhone} from ${fromNumber}`);

    // Step 1: Find or create contact in GHL
    const searchResponse = await fetch(
      `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${ghlLocationId}&phone=${encodeURIComponent(formattedPhone)}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-07-28",
          "Content-Type": "application/json",
        },
      }
    );

    let contactId = null;
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.contact?.id) {
        contactId = searchData.contact.id;
        console.log(`Found existing GHL contact: ${contactId}`);
      }
    }

    // If no contact found, create one
    if (!contactId) {
      const createContactResponse = await fetch(
        `https://services.leadconnectorhq.com/contacts/`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${ghlApiKey}`,
            "Version": "2021-07-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            locationId: ghlLocationId,
            phone: formattedPhone,
            name: recipientName || "Contact",
            source: "PropertyCentral Voicemail",
          }),
        }
      );

      if (createContactResponse.ok) {
        const createData = await createContactResponse.json();
        contactId = createData.contact?.id;
        console.log(`Created new GHL contact: ${contactId}`);
      } else {
        const errorText = await createContactResponse.text();
        console.error("Error creating GHL contact:", errorText);
        throw new Error(`Failed to create GHL contact: ${createContactResponse.status}`);
      }
    }

    if (!contactId) {
      throw new Error("Failed to find or create GHL contact");
    }

    // Step 2: Send SMS message via GHL
    const sendResponse = await fetch(
      `https://services.leadconnectorhq.com/conversations/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-04-15",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "SMS",
          contactId: contactId,
          message: smsBody,
          fromNumber: fromNumber,
        }),
      }
    );

    const sendResponseText = await sendResponse.text();
    console.log(`GHL send response: ${sendResponse.status} - ${sendResponseText}`);

    if (!sendResponse.ok) {
      console.error("GHL SMS send error:", sendResponseText);
      
      // Update voicemail status to failed
      await supabase
        .from("voicemail_messages")
        .update({ status: "failed" })
        .eq("id", voicemail.id);

      throw new Error(`Failed to send SMS via GHL: ${sendResponse.status}`);
    }

    let sendData;
    try {
      sendData = JSON.parse(sendResponseText);
    } catch (e) {
      sendData = { messageId: "unknown" };
    }

    const messageId = sendData.messageId || sendData.conversationId || "sent";

    // Update voicemail with SMS info
    await supabase
      .from("voicemail_messages")
      .update({
        sms_sent_at: new Date().toISOString(),
        sms_message_sid: messageId,
        status: "sent",
      })
      .eq("id", voicemail.id);

    // Also log to lead_communications if we have a lead ID
    if (leadId) {
      await supabase.from("lead_communications").insert({
        lead_id: leadId,
        communication_type: "voicemail",
        direction: "outbound",
        body: finalMessageText || "(Voice recording)",
        status: "sent",
        ghl_contact_id: contactId,
        ghl_conversation_id: sendData.conversationId,
        metadata: {
          voicemail_id: voicemail.id,
          audio_url: audioUrl,
          player_url: playerUrl,
          provider: "gohighlevel",
          ghl_message_id: messageId,
          from_number: fromNumber,
          transcript: finalMessageText,
        },
      });
    }

    // Log to lead_communications for owner if we have owner ID
    if (ownerId) {
      await supabase.from("lead_communications").insert({
        owner_id: ownerId,
        communication_type: "voicemail",
        direction: "outbound",
        body: finalMessageText || "(Voice recording)",
        status: "sent",
        ghl_contact_id: contactId,
        ghl_conversation_id: sendData.conversationId,
        metadata: {
          voicemail_id: voicemail.id,
          audio_url: audioUrl,
          player_url: playerUrl,
          provider: "gohighlevel",
          ghl_message_id: messageId,
          from_number: fromNumber,
          transcript: finalMessageText,
        },
      });
    }

    // Log to lead_communications for vendors if we have vendor ID
    if (vendorId) {
      await supabase.from("lead_communications").insert({
        communication_type: "voicemail",
        direction: "outbound",
        body: finalMessageText || "(Voice recording)",
        status: "sent",
        ghl_contact_id: contactId,
        ghl_conversation_id: sendData.conversationId,
        assigned_user_id: senderUserId, // Track who sent this (for inbox view)
        metadata: {
          voicemail_id: voicemail.id,
          audio_url: audioUrl,
          video_url: mediaType === "video" ? videoUrl : null,
          player_url: playerUrl,
          provider: "gohighlevel",
          ghl_message_id: messageId,
          from_number: fromNumber,
          transcript: finalMessageText,
          vendor_id: vendorId,
          vendor_phone: formattedPhone,
          contact_type: "vendor",
          media_type: mediaType,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        voicemailId: voicemail.id,
        token: voicemail.token,
        playerUrl,
        messageId: messageId,
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
