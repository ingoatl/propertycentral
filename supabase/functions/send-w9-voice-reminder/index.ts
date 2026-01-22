import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
const TELNYX_PHONE_NUMBER = Deno.env.get("TELNYX_PHONE_NUMBER");

const DEFAULT_VOICE_ID = "HXPJDxQ2YWg0wT4IBlof"; // Ingo voice

interface VoiceReminderRequest {
  type: "owner" | "vendor";
  id: string;
  senderName?: string;
}

function formatPhoneForTelnyx(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  return phone.startsWith('+') ? phone : `+${cleaned}`;
}

async function generateVoiceAudio(text: string, voiceId: string): Promise<ArrayBuffer | null> {
  try {
    console.log("Generating voice audio with ElevenLabs...");
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs error:", errorText);
      return null;
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error("Voice generation error:", error);
    return null;
  }
}

async function sendMMSWithAudio(
  phone: string,
  textMessage: string,
  audioBuffer: ArrayBuffer,
  supabase: any
): Promise<boolean> {
  if (!TELNYX_API_KEY || !TELNYX_PHONE_NUMBER) {
    console.log("Telnyx not configured, skipping MMS");
    return false;
  }

  try {
    // Upload audio to storage
    const timestamp = Date.now();
    const filePath = `voicemails/w9-reminder-${timestamp}.mp3`;
    
    const { error: uploadError } = await supabase.storage
      .from("message-attachments")
      .upload(filePath, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Audio upload error:", uploadError);
      return false;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("message-attachments")
      .getPublicUrl(filePath);

    const audioUrl = urlData?.publicUrl;
    if (!audioUrl) {
      console.error("Failed to get audio URL");
      return false;
    }

    console.log("Audio uploaded, sending MMS to:", phone);

    const formattedPhone = formatPhoneForTelnyx(phone);
    
    const response = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: TELNYX_PHONE_NUMBER,
        to: formattedPhone,
        text: textMessage,
        media_urls: [audioUrl],
        type: "MMS",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("MMS send failed:", errorText);
      
      // Fallback to SMS without audio
      console.log("Falling back to SMS without audio...");
      const smsResponse = await fetch("https://api.telnyx.com/v2/messages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: TELNYX_PHONE_NUMBER,
          to: formattedPhone,
          text: textMessage,
        }),
      });
      
      return smsResponse.ok;
    }

    console.log("MMS sent successfully");
    return true;
  } catch (error) {
    console.error("MMS error:", error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-w9-voice-reminder function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, id, senderName = "Ingo" }: VoiceReminderRequest = await req.json();
    console.log(`Processing voice reminder for ${type}:`, id);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch entity details based on type
    let entity: any;
    let phone: string | null;
    let firstName: string;
    let uploadUrl: string;
    
    const taxYear = new Date().getFullYear();

    if (type === "owner") {
      const { data: owner, error } = await supabase
        .from("property_owners")
        .select("id, name, phone")
        .eq("id", id)
        .single();

      if (error || !owner) {
        return new Response(
          JSON.stringify({ success: false, error: "Owner not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      entity = owner;
      phone = owner.phone;
      firstName = owner.name.split(' ')[0];

      // Get or create token
      const { data: token } = await supabase
        .from("owner_w9_tokens")
        .select("token")
        .eq("owner_id", id)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (token) {
        uploadUrl = `https://propertycentral.lovable.app/owner/w9-upload?token=${token.token}`;
      } else {
        uploadUrl = "https://propertycentral.lovable.app";
      }

    } else {
      const { data: vendor, error } = await supabase
        .from("vendors")
        .select("id, name, phone")
        .eq("id", id)
        .single();

      if (error || !vendor) {
        return new Response(
          JSON.stringify({ success: false, error: "Vendor not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      entity = vendor;
      phone = vendor.phone;
      firstName = vendor.name.split(' ')[0];

      // Get or create token
      const { data: token } = await supabase
        .from("vendor_w9_tokens")
        .select("token")
        .eq("vendor_id", id)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (token) {
        uploadUrl = `https://propertycentral.lovable.app/vendor/w9-upload?token=${token.token}`;
      } else {
        uploadUrl = "https://propertycentral.lovable.app";
      }
    }

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "No phone number on file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate voice message
    const voiceScript = `Hi ${firstName}, this is ${senderName} from PeachHaus Property Management. I'm calling because we still need your W-9 form for ${taxYear} tax filing. This is required by the IRS for payments over $600, and the deadline is December 15th. I've sent you an email and text with a secure link to upload it, it only takes about 2 minutes. If you have any questions at all, please call us back at 404-800-5932. Thank you so much, and I hope you have a great day!`;

    // Generate audio
    const audioBuffer = await generateVoiceAudio(voiceScript, DEFAULT_VOICE_ID);
    
    if (!audioBuffer) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate voice audio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send MMS with audio
    const textMessage = `🎙️ Voice Message from PeachHaus\n\nHi ${firstName}! We still need your W-9 form for ${taxYear} tax filing.\n\n📤 Upload here: ${uploadUrl}\n\n⏰ Deadline: Dec 15th\n📞 Questions? Call (404) 800-5932\n\n[Listen to the voice message attached]`;

    const sent = await sendMMSWithAudio(phone, textMessage, audioBuffer, supabase);

    if (!sent) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send voice reminder" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update tracking
    if (type === "owner") {
      await supabase
        .from("property_owners")
        .update({ w9_voice_reminder_sent_at: new Date().toISOString() })
        .eq("id", id);
    } else {
      await supabase
        .from("vendors")
        .update({ w9_voice_reminder_sent_at: new Date().toISOString() })
        .eq("id", id);
    }

    // Log communication
    await supabase.from("lead_communications").insert({
      owner_id: type === "owner" ? id : null,
      vendor_id: type === "vendor" ? id : null,
      direction: "outbound",
      communication_type: "voicemail",
      subject: `W-9 Voice Reminder - ${taxYear}`,
      content: voiceScript,
      status: "sent",
      metadata: { type: "w9_voice_reminder", phone },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Voice reminder sent to ${phone}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-w9-voice-reminder:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
