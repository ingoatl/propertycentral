import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Alex's routing info
const ALEX_USER_ID = "fbd13e57-3a59-4c53-bb3b-14ab354b3420";
const ALEX_PHONE_NUMBER = "+14043415202";

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(audioUrl: string): Promise<string | null> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not set, skipping transcription");
    return null;
  }

  try {
    // Download audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
    }
    const audioBlob = await audioResponse.blob();

    // Prepare form data for Whisper API
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "en");

    const whisperResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      }
    );

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error("Whisper API error:", errorText);
      return null;
    }

    const result = await whisperResponse.json();
    return result.text || null;
  } catch (error) {
    console.error("Transcription error:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workOrderId, vendorId, vendorName, vendorPhone, audioBase64, duration, mimeType } = await req.json();

    if (!workOrderId || !audioBase64) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get work order details
    const { data: workOrder } = await supabase
      .from("work_orders")
      .select("title, property:properties(name, address)")
      .eq("id", workOrderId)
      .single();

    const property = Array.isArray(workOrder?.property) 
      ? workOrder.property[0] 
      : workOrder?.property;
    const propertyName = property?.name || "Unknown Property";

    // Decode and upload audio
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const ext = mimeType?.includes("webm") ? "webm" : "mp3";
    const fileName = `vendor-messages/${workOrderId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("message-attachments")
      .upload(fileName, bytes, {
        contentType: mimeType || "audio/webm",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("message-attachments")
      .getPublicUrl(fileName);

    // Transcribe the audio
    const transcript = await transcribeAudio(publicUrl);

    // Create communication record routed to Alex
    const { error: commError } = await supabase
      .from("lead_communications")
      .insert({
        communication_type: "voicemail",
        direction: "inbound",
        body: transcript || "[Voice message - transcription pending]",
        received_on_number: ALEX_PHONE_NUMBER,
        assigned_user_id: ALEX_USER_ID,
        recipient_user_id: ALEX_USER_ID,
        status: "received",
        call_recording_url: publicUrl,
        call_duration: duration,
        metadata: {
          work_order_id: workOrderId,
          vendor_id: vendorId,
          vendor_name: vendorName,
          vendor_phone: vendorPhone || "vendor_portal",
          property_name: propertyName,
          message_source: "vendor_portal",
          alex_routed: true,
          display_name: `${vendorName} (Vendor)`,
          transcript: transcript,
          audio_url: publicUrl,
          duration_seconds: duration,
        },
      });

    if (commError) {
      console.error("Failed to create communication:", commError);
      throw commError;
    }

    // Add to work order timeline
    await supabase.from("work_order_timeline").insert({
      work_order_id: workOrderId,
      action: "vendor_voice_message",
      description: `${vendorName} left a voice message (${duration}s)${transcript ? `: "${transcript.substring(0, 100)}${transcript.length > 100 ? "..." : ""}"` : ""}`,
      performed_by: vendorName,
      user_type: "vendor",
    });

    console.log(`Vendor voice message from ${vendorName} routed to Alex for work order ${workOrderId}`);

    return new Response(
      JSON.stringify({ success: true, transcript }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in vendor-voice-message:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
