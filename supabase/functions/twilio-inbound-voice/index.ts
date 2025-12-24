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
    const ELEVENLABS_AGENT_ID = Deno.env.get('ELEVENLABS_AGENT_ID');
    
    if (!ELEVENLABS_AGENT_ID) {
      console.error('ELEVENLABS_AGENT_ID not configured');
      throw new Error('ElevenLabs Agent ID not configured');
    }

    // Parse the incoming Twilio request
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const fromNumber = formData.get('From') as string;
    const toNumber = formData.get('To') as string;
    const callStatus = formData.get('CallStatus') as string;

    console.log('Inbound call received:', { callSid, fromNumber, toNumber, callStatus });

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
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name, property_address, property_type')
      .or(`phone.eq.${fromNumber},phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone}`)
      .maybeSingle();

    if (lead) {
      console.log('Found lead for inbound call:', lead.id, lead.name);

      // Record the inbound call in lead_communications
      await supabase.from('lead_communications').insert({
        lead_id: lead.id,
        communication_type: 'voice_call',
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
          connected_to: 'elevenlabs_agent'
        },
      });
    } else {
      console.log('No lead found for phone:', fromNumber);
    }

    // Get the signed URL for ElevenLabs Conversational AI
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    
    if (!ELEVENLABS_API_KEY) {
      console.error('ELEVENLABS_API_KEY not configured');
      // Fallback TwiML if ElevenLabs isn't configured
      const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Thank you for calling Peachhaus. We are currently unavailable. Please leave a message after the beep.</Say>
  <Record maxLength="120" transcribe="true" />
</Response>`;
      return new Response(fallbackTwiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Get signed URL for ElevenLabs
    const signedUrlResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!signedUrlResponse.ok) {
      const errorText = await signedUrlResponse.text();
      console.error('Failed to get ElevenLabs signed URL:', errorText);
      throw new Error('Failed to get ElevenLabs signed URL');
    }

    const { signed_url } = await signedUrlResponse.json();
    console.log('Got ElevenLabs signed URL for call');

    // Create TwiML that connects to ElevenLabs via WebSocket
    // Using <Connect><Stream> to connect Twilio to ElevenLabs
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${signed_url}">
      <Parameter name="call_sid" value="${callSid}" />
      <Parameter name="from_number" value="${fromNumber}" />
      ${lead ? `<Parameter name="lead_id" value="${lead.id}" />` : ''}
      ${lead ? `<Parameter name="lead_name" value="${lead.name || ''}" />` : ''}
    </Stream>
  </Connect>
</Response>`;

    console.log('Returning TwiML with ElevenLabs stream');

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error: unknown) {
    console.error('Inbound voice error:', error);
    
    // Return a graceful fallback TwiML
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Thank you for calling Peachhaus. We are experiencing technical difficulties. Please try again later or leave a message after the beep.</Say>
  <Record maxLength="120" />
</Response>`;
    
    return new Response(fallbackTwiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
});
