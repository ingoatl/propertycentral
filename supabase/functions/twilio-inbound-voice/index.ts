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
    // Parse the incoming Twilio request
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const fromNumber = formData.get('From') as string;
    const toNumber = formData.get('To') as string;
    const callStatus = formData.get('CallStatus') as string;

    console.log('Inbound call received:', { callSid, fromNumber, toNumber, callStatus });

    const ELEVENLABS_AGENT_ID = Deno.env.get('ELEVENLABS_AGENT_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

    // Initialize Supabase client to look up lead and log the call
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Normalize phone number for lookup (remove +1 prefix if present)
    let normalizedPhone = fromNumber;
    if (normalizedPhone.startsWith('+1')) {
      normalizedPhone = normalizedPhone.substring(2);
    } else if (normalizedPhone.startsWith('+')) {
      normalizedPhone = normalizedPhone.substring(1);
    }

    // Look up the lead by phone number
    const { data: lead } = await supabase
      .from('leads')
      .select('id, name, property_address, property_type, phone')
      .or(`phone.eq.${fromNumber},phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone},phone.ilike.%${normalizedPhone}%`)
      .maybeSingle();

    const statusCallbackUrl = `${SUPABASE_URL}/functions/v1/twilio-call-status`;

    if (lead) {
      console.log('Found lead for inbound call:', lead.id, lead.name);

      // Record the inbound call in lead_communications
      await supabase.from('lead_communications').insert({
        lead_id: lead.id,
        communication_type: 'call',
        direction: 'inbound',
        body: 'Inbound call - connected to AI agent',
        external_id: callSid,
        status: 'answered',
      });

      // Add timeline entry
      await supabase.from('lead_timeline').insert({
        lead_id: lead.id,
        action: 'inbound_call_received',
        metadata: { 
          call_sid: callSid,
          from_number: fromNumber,
        },
      });
    } else {
      console.log('No lead found for phone:', fromNumber);
    }

    // Check if ElevenLabs agent is configured
    if (!ELEVENLABS_AGENT_ID) {
      console.log('No ElevenLabs agent configured, falling back to voicemail');
      const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Thank you for calling Peachhaus Property Management. Please leave a message after the beep.</Say>
  <Record 
    maxLength="120" 
    playBeep="true"
    recordingStatusCallback="${statusCallbackUrl}"
    recordingStatusCallbackEvent="completed"
  />
  <Say voice="Polly.Matthew">Thank you for your message. Goodbye.</Say>
</Response>`;
      return new Response(fallbackTwiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // Get ElevenLabs signed URL for the conversation
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    
    const signedUrlResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY || '',
        },
      }
    );

    if (!signedUrlResponse.ok) {
      console.error('Failed to get ElevenLabs signed URL:', await signedUrlResponse.text());
      // Fall back to voicemail
      const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Thank you for calling Peachhaus Property Management. Please leave a message after the beep.</Say>
  <Record 
    maxLength="120" 
    playBeep="true"
    recordingStatusCallback="${statusCallbackUrl}"
    recordingStatusCallbackEvent="completed"
  />
</Response>`;
      return new Response(fallbackTwiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    const { signed_url } = await signedUrlResponse.json();
    console.log('Got ElevenLabs signed URL for agent');

    // Return TwiML that connects to ElevenLabs agent via bidirectional stream
    // Also record the call for transcription
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${signed_url}">
      <Parameter name="caller_number" value="${fromNumber}" />
      <Parameter name="call_sid" value="${callSid}" />
      ${lead ? `<Parameter name="lead_name" value="${lead.name}" />` : ''}
      ${lead?.property_address ? `<Parameter name="property_address" value="${lead.property_address}" />` : ''}
    </Stream>
  </Connect>
</Response>`;

    console.log('Returning TwiML with ElevenLabs agent stream');

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error: unknown) {
    console.error('Inbound voice error:', error);
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const statusCallbackUrl = `${SUPABASE_URL}/functions/v1/twilio-call-status`;
    
    // Return a graceful fallback TwiML
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Thank you for calling Peachhaus. Please leave a message after the beep.</Say>
  <Record 
    maxLength="120" 
    playBeep="true"
    recordingStatusCallback="${statusCallbackUrl}"
    recordingStatusCallbackEvent="completed"
  />
</Response>`;
    
    return new Response(fallbackTwiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
});
