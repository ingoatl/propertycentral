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
    const url = new URL(req.url);
    const fromNumber = url.searchParams.get('from') || '';
    const callSid = url.searchParams.get('callSid') || '';
    
    // Parse the form data from Twilio callback
    const formData = await req.formData();
    const dialCallStatus = formData.get('DialCallStatus') as string;
    
    console.log('Forward to AI triggered:', { callSid, fromNumber, dialCallStatus });

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Update all incoming call notifications for this call to "forwarded"
    await supabase
      .from('incoming_call_notifications')
      .update({ 
        status: 'forwarded', 
        expired_at: new Date().toISOString() 
      })
      .eq('call_sid', callSid);

    // If someone answered, don't forward to AI
    if (dialCallStatus === 'completed' || dialCallStatus === 'answered') {
      console.log('Call was answered by team member, not forwarding to AI');
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Lookup caller info for AI context
    let callerName = fromNumber;
    let leadId: string | null = null;
    let propertyAddress: string | null = null;
    
    const { data: leadData } = await supabase
      .from('leads')
      .select('id, name, property_address')
      .or(`phone.eq.${fromNumber},phone.ilike.%${fromNumber.replace('+1', '')}%`)
      .maybeSingle();

    if (leadData) {
      callerName = leadData.name;
      leadId = leadData.id;
      propertyAddress = leadData.property_address;
    } else {
      const { data: ownerData } = await supabase
        .from('property_owners')
        .select('id, name')
        .or(`phone.eq.${fromNumber},phone.ilike.%${fromNumber.replace('+1', '')}%`)
        .maybeSingle();
      
      if (ownerData) {
        callerName = ownerData.name;
      }
    }

    // Log the forwarding
    await supabase.from('lead_communications').insert({
      communication_type: 'call',
      direction: 'inbound',
      body: `Call forwarded to AI agent (no answer after brief ring)`,
      external_id: callSid,
      status: 'answered',
      lead_id: leadId,
      metadata: {
        from_number: fromNumber,
        dial_status: dialCallStatus,
        routing: 'ai_agent_fallback',
      }
    });

    // Connect to ElevenLabs AI Agent via WebSocket bridge
    const bridgeUrl = SUPABASE_URL.replace('https://', 'wss://') + '/functions/v1/twilio-elevenlabs-bridge';

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Please hold while I connect you with our AI assistant.</Say>
  <Connect>
    <Stream url="${bridgeUrl}">
      <Parameter name="caller_number" value="${fromNumber}" />
      <Parameter name="call_sid" value="${callSid}" />
      ${callerName ? `<Parameter name="lead_name" value="${callerName}" />` : ''}
      ${propertyAddress ? `<Parameter name="property_address" value="${propertyAddress}" />` : ''}
      <Parameter name="context_note" value="Forwarded after brief ring - no team member answered" />
    </Stream>
  </Connect>
</Response>`;

    console.log('Forwarding to ElevenLabs AI agent');
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });

  } catch (error) {
    console.error('Forward to AI error:', error);
    
    // Fallback to voicemail
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Sorry, we're unable to take your call right now. Please leave a message.</Say>
  <Record maxLength="120" playBeep="true" />
</Response>`;
    
    return new Response(fallbackTwiml, { headers: { 'Content-Type': 'text/xml' } });
  }
});
