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
    const forwardedFrom = formData.get('ForwardedFrom') as string; // GHL number if forwarded

    console.log('Inbound call received:', { callSid, fromNumber, toNumber, callStatus, forwardedFrom });

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

    // Initialize Supabase client to look up lead and log the call
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const statusCallbackUrl = `${SUPABASE_URL}/functions/v1/twilio-call-status`;

    // First, check if this number is assigned to a team member
    // If someone calls that team member's number, forward to their browser
    const { data: phoneAssignment } = await supabase
      .from('user_phone_assignments')
      .select('user_id, display_name')
      .eq('phone_number', toNumber)
      .eq('is_active', true)
      .maybeSingle();

    if (phoneAssignment) {
      console.log('Call to team member number:', toNumber, 'assigned to:', phoneAssignment.display_name);

      // Try to identify the caller
      let callerName = fromNumber;
      
      // Check if caller is a lead
      const { data: leadData } = await supabase
        .from('leads')
        .select('id, name')
        .or(`phone.eq.${fromNumber},phone.ilike.%${fromNumber.replace('+1', '')}%`)
        .maybeSingle();

      if (leadData) {
        callerName = leadData.name;
      } else {
        // Check if caller is a property owner
        const { data: ownerData } = await supabase
          .from('property_owners')
          .select('id, name')
          .or(`phone.eq.${fromNumber},phone.ilike.%${fromNumber.replace('+1', '')}%`)
          .maybeSingle();
        
        if (ownerData) {
          callerName = ownerData.name;
        }
      }

      // Log the inbound call
      await supabase.from('lead_communications').insert({
        communication_type: 'call',
        direction: 'inbound',
        body: `Inbound call from ${callerName} to ${phoneAssignment.display_name}`,
        external_id: callSid,
        status: 'ringing',
        lead_id: leadData?.id || null,
        metadata: { 
          from_number: fromNumber,
          to_number: toNumber,
          assigned_user_id: phoneAssignment.user_id,
        }
      });

      // Forward to the assigned user's browser client
      // Falls back to voicemail if no answer after 30 seconds
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Incoming call from ${callerName.replace(/[^a-zA-Z0-9\s]/g, '')}. Please hold.</Say>
  <Dial record="record-from-answer-dual" recordingStatusCallback="${statusCallbackUrl}" recordingStatusCallbackEvent="completed" timeout="30" action="${SUPABASE_URL}/functions/v1/twilio-voicemail">
    <Client statusCallback="${statusCallbackUrl}" statusCallbackEvent="initiated ringing answered completed">${phoneAssignment.user_id}</Client>
  </Dial>
</Response>`;
      
      console.log('Forwarding to browser client:', phoneAssignment.user_id);
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // Check if this call is forwarded from a GHL team member number
    // If so, route to IVR operator instead of AI agent
    if (forwardedFrom) {
      const { data: teamRouting } = await supabase
        .from('team_routing')
        .select('*')
        .eq('ghl_number', forwardedFrom)
        .eq('is_active', true)
        .maybeSingle();

      if (teamRouting) {
        console.log('Call forwarded from GHL number:', forwardedFrom, '- routing to IVR');
        
        // Route to IVR operator
        const ivrUrl = `${SUPABASE_URL}/functions/v1/twilio-ivr-operator`;
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${ivrUrl}</Redirect>
</Response>`;
        return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
      }
    }

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
