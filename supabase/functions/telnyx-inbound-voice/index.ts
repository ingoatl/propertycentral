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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse Telnyx webhook payload
    const payload = await req.json();
    console.log('Telnyx inbound voice webhook:', JSON.stringify(payload, null, 2));

    const eventType = payload.data?.event_type;
    const callPayload = payload.data?.payload;
    
    const callControlId = callPayload?.call_control_id;
    const fromNumber = callPayload?.from;
    const toNumber = callPayload?.to;
    const callState = callPayload?.state;
    const externalId = callPayload?.call_leg_id || callControlId;

    console.log(`Call event: type=${eventType}, from=${fromNumber}, to=${toNumber}, state=${callState}`);

    // Find which user owns this phone number
    const { data: phoneAssignment, error: assignmentError } = await supabase
      .from('user_phone_assignments')
      .select('id, user_id, phone_number, phone_type')
      .eq('phone_number', toNumber)
      .eq('is_active', true)
      .single();

    if (assignmentError || !phoneAssignment) {
      console.log('No user assignment found for number:', toNumber);
      // Return TeXML to handle unassigned calls (play message and hang up)
      const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="female">We're sorry, but this number is not currently available. Please try again later.</Say>
  <Hangup />
</Response>`;
      return new Response(texml, {
        headers: { 'Content-Type': 'application/xml' }
      });
    }

    console.log('Found phone assignment for user:', phoneAssignment.user_id, 'type:', phoneAssignment.phone_type);

    // Handle different call events
    if (eventType === 'call.initiated' || eventType === 'call.answered') {
      // Log the call in user's call history
      const { error: insertError } = await supabase
        .from('user_phone_calls')
        .upsert({
          user_id: phoneAssignment.user_id,
          phone_assignment_id: phoneAssignment.id,
          direction: 'inbound',
          from_number: fromNumber,
          to_number: toNumber,
          status: callState || 'initiated',
          external_id: externalId,
          started_at: new Date().toISOString(),
        }, {
          onConflict: 'external_id'
        });

      if (insertError) {
        console.error('Failed to log call:', insertError);
      }

      // For personal numbers, we'll ring via WebRTC (using Telnyx TeXML)
      // This connects the call to the user's browser
      const supabaseProjectUrl = Deno.env.get('SUPABASE_URL')!;
      const telnyxAppId = Deno.env.get('TELNYX_APP_ID'); // WebRTC app for browser calling

      // Generate TeXML to handle the call
      // Option 1: Ring the user's browser via SIP
      // Option 2: Forward to a backup number
      // Option 3: Go to voicemail after timeout
      
      const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="female">Please hold while we connect your call.</Say>
  <Dial timeout="30" callerId="${toNumber}">
    <Sip>sip:${phoneAssignment.user_id}@sip.telnyx.com</Sip>
  </Dial>
  <Say voice="female">The person you're trying to reach is not available. Please leave a message after the beep.</Say>
  <Record maxLength="120" action="${supabaseProjectUrl}/functions/v1/telnyx-voicemail" />
</Response>`;

      return new Response(texml, {
        headers: { 'Content-Type': 'application/xml' }
      });
    }

    if (eventType === 'call.hangup') {
      // Update call record with end time and duration
      const { error: updateError } = await supabase
        .from('user_phone_calls')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: callPayload?.duration_secs || 0,
        })
        .eq('external_id', externalId);

      if (updateError) {
        console.error('Failed to update call record:', updateError);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Telnyx voice webhook error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
