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

    // Normalize mime type (remove codecs parameter which can cause issues)
    let normalizedMimeType = audioMimeType || "audio/mpeg";
    if (normalizedMimeType.includes(";")) {
      normalizedMimeType = normalizedMimeType.split(";")[0].trim();
    }

    // Determine file extension and upload content type
    // Use application/octet-stream for upload to avoid mime type restrictions
    // but keep the correct extension for playback
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

    // Format phone number for GHL (E.164)
    let formattedPhone = recipientPhone.replace(/\D/g, "");
    if (formattedPhone.length === 10) {
      formattedPhone = "+1" + formattedPhone;
    } else if (formattedPhone.length === 11 && formattedPhone.startsWith("1")) {
      formattedPhone = "+" + formattedPhone;
    } else if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+" + formattedPhone;
    }

    // Send SMS via GoHighLevel (404-800-5932 number)
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");

    if (!ghlApiKey || !ghlLocationId) {
      throw new Error("GHL credentials not configured");
    }

    const smsBody = `🎙️ ${senderName || "Peachhaus"} left you a voice message.\n\nTap to listen:\n${playerUrl}\n\nReply to this text or call (404) 800-5932`;
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
        body: messageText || "(Voice message)",
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
        ghl_contact_id: contactId,
        ghl_conversation_id: sendData.conversationId,
        metadata: {
          voicemail_id: voicemail.id,
          audio_url: audioUrl,
          player_url: playerUrl,
          provider: "gohighlevel",
          ghl_message_id: messageId,
          from_number: fromNumber,
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
