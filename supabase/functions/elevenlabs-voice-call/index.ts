import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, message, voiceId, isTest } = await req.json();

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      throw new Error('Lead not found');
    }

    console.log(`Generating voice message for lead ${leadId}`);

    // Process template variables in the message
    let processedMessage = message
      .replace(/\{\{name\}\}/g, lead.name || 'there')
      .replace(/\{\{first_name\}\}/g, (lead.name || 'there').split(' ')[0])
      .replace(/\{\{property_address\}\}/g, lead.property_address || 'your property')
      .replace(/\{\{property_type\}\}/g, lead.property_type || 'property');

    // Generate voice audio using ElevenLabs TTS
    // Using "Sarah" voice (professional female voice) as default
    const selectedVoiceId = voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Sarah voice
    
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: processedMessage,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs TTS error:', errorText);
      throw new Error(`ElevenLabs TTS failed: ${errorText}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    console.log(`Generated audio: ${audioBuffer.byteLength} bytes`);

    // For test mode, return audio as base64
    if (isTest) {
      const uint8Array = new Uint8Array(audioBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Audio = btoa(binary);

      return new Response(
        JSON.stringify({ 
          success: true, 
          audioContent: base64Audio,
          message: 'Test voice message generated successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For actual calls, we need to:
    // 1. Upload audio to storage
    // 2. Make a Twilio call with the audio URL

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error('Twilio credentials not configured');
    }

    if (!lead.phone) {
      throw new Error('Lead has no phone number');
    }

    // Upload audio to Supabase storage
    const fileName = `voice-calls/${leadId}-${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from('lead-assets')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      // Continue without storage if bucket doesn't exist
    }

    // Get public URL for the audio
    const { data: urlData } = supabase.storage
      .from('lead-assets')
      .getPublicUrl(fileName);

    const audioUrl = urlData?.publicUrl;

    // Make Twilio call
    const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    
    // Create TwiML that plays the audio
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
</Response>`;

    const callResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: lead.phone,
          From: TWILIO_PHONE_NUMBER,
          Twiml: twiml,
        }),
      }
    );

    const callData = await callResponse.json();

    if (!callResponse.ok) {
      console.error('Twilio call error:', callData);
      throw new Error(callData.message || 'Failed to initiate call');
    }

    console.log('Call initiated:', callData.sid);

    // Record communication
    await supabase.from('lead_communications').insert({
      lead_id: leadId,
      communication_type: 'voice_call',
      direction: 'outbound',
      body: processedMessage,
      external_id: callData.sid,
      status: 'initiated',
    });

    // Update lead
    await supabase
      .from('leads')
      .update({ last_contacted_at: new Date().toISOString() })
      .eq('id', leadId);

    // Add timeline entry
    await supabase.from('lead_timeline').insert({
      lead_id: leadId,
      action: 'voice_call_sent',
      metadata: { call_sid: callData.sid },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        callSid: callData.sid,
        message: 'Voice call initiated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Voice call error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
