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
      .select('id, name, property_address, property_type, phone, stage')
      .or(`phone.eq.${fromNumber},phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone},phone.ilike.%${normalizedPhone}%`)
      .maybeSingle();

    const statusCallbackUrl = `${SUPABASE_URL}/functions/v1/twilio-call-status`;
    // Convert https:// to wss:// for WebSocket URL
    const bridgeUrl = SUPABASE_URL?.replace('https://', 'wss://') + '/functions/v1/twilio-elevenlabs-bridge';

    // Check if there's a scheduled discovery call within the next 30 minutes
    let hasScheduledCall = false;
    let discoveryCallId: string | null = null;
    
    if (lead) {
      const now = new Date();
      const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      
      const { data: scheduledCall } = await supabase
        .from('discovery_calls')
        .select('id, scheduled_at')
        .eq('lead_id', lead.id)
        .eq('status', 'scheduled')
        .gte('scheduled_at', thirtyMinutesAgo.toISOString())
        .lte('scheduled_at', thirtyMinutesFromNow.toISOString())
        .maybeSingle();
      
      if (scheduledCall) {
        hasScheduledCall = true;
        discoveryCallId = scheduledCall.id;
        console.log('Found scheduled discovery call:', discoveryCallId);
      }
    }

    if (lead) {
      console.log('Found lead for inbound call:', lead.id, lead.name, 'scheduled call:', hasScheduledCall);

      // Record the inbound call in lead_communications
      await supabase.from('lead_communications').insert({
        lead_id: lead.id,
        communication_type: 'call',
        direction: 'inbound',
        body: hasScheduledCall 
          ? 'Inbound call - scheduled discovery call connected to AI agent'
          : 'Inbound call - connected to AI agent',
        external_id: callSid,
        status: 'answered',
      });

      // Add timeline entry
      await supabase.from('lead_timeline').insert({
        lead_id: lead.id,
        action: hasScheduledCall ? 'scheduled_discovery_call_answered' : 'inbound_call_received',
        metadata: { 
          call_sid: callSid,
          from_number: fromNumber,
          discovery_call_id: discoveryCallId,
          had_scheduled_call: hasScheduledCall,
        },
      });

      // If this was a scheduled call, update the discovery call status and advance lead stage
      if (hasScheduledCall && discoveryCallId) {
        await supabase
          .from('discovery_calls')
          .update({ status: 'completed' })
          .eq('id', discoveryCallId);
        
        // Auto-advance to call_attended if currently at call_scheduled
        if (lead.stage === 'call_scheduled') {
          await supabase
            .from('leads')
            .update({ 
              stage: 'call_attended',
              stage_changed_at: new Date().toISOString(),
              last_response_at: new Date().toISOString(),
            })
            .eq('id', lead.id);
          
          await supabase.from('lead_timeline').insert({
            lead_id: lead.id,
            action: 'Stage auto-advanced to Call Attended (discovery call completed)',
            previous_stage: 'call_scheduled',
            new_stage: 'call_attended',
          });
          
          console.log('Auto-advanced lead to call_attended stage');
        }
      }
    } else {
      console.log('No lead found for phone:', fromNumber);
    }

    // Return TwiML that connects to our WebSocket bridge for ElevenLabs
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${bridgeUrl}">
      <Parameter name="caller_number" value="${fromNumber}" />
      <Parameter name="call_sid" value="${callSid}" />
      ${lead ? `<Parameter name="lead_name" value="${lead.name}" />` : ''}
      ${lead?.property_address ? `<Parameter name="property_address" value="${lead.property_address}" />` : ''}
    </Stream>
  </Connect>
</Response>`;

    console.log('Returning TwiML with ElevenLabs bridge stream:', bridgeUrl);

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error: unknown) {
    console.error('Inbound voice error:', error);
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const statusCallbackUrl = `${SUPABASE_URL}/functions/v1/twilio-call-status`;
    
    // Return a graceful fallback TwiML with voicemail
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
