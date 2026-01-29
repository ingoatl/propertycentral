import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Main Twilio number for AI-first routing
const MAIN_TWILIO_NUMBER = "+17709885286";

// How many times to ring before forwarding to AI (each ring ~3 seconds)
const MAX_RING_COUNT = 2;
const RING_TIMEOUT_SECONDS = 10; // ~2 rings worth of time

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

    // Normalize phone numbers for comparison
    const normalizePhone = (phone: string) => phone?.replace(/\D/g, '').slice(-10);
    const isMainNumber = normalizePhone(toNumber) === normalizePhone(MAIN_TWILIO_NUMBER);

    // ========================================
    // ROUTING DECISION LOGIC
    // ========================================
    
    // Priority 1: Check if this is a call to a team member's assigned GHL number
    // If so, ring their browser directly (AI backup if no answer)
    const { data: phoneAssignment } = await supabase
      .from('user_phone_assignments')
      .select('user_id, display_name')
      .eq('phone_number', toNumber)
      .eq('is_active', true)
      .maybeSingle();

    if (phoneAssignment && !isMainNumber) {
      console.log('Call to team member GHL number:', toNumber, 'assigned to:', phoneAssignment.display_name);

      // Try to identify the caller
      let callerName = fromNumber;
      let leadId: string | null = null;
      
      // Check if caller is a lead
      const { data: leadData } = await supabase
        .from('leads')
        .select('id, name')
        .or(`phone.eq.${fromNumber},phone.ilike.%${fromNumber.replace('+1', '')}%`)
        .maybeSingle();

      if (leadData) {
        callerName = leadData.name;
        leadId = leadData.id;
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

      // Check if user is available in browser
      const { data: presence } = await supabase
        .from('user_presence')
        .select('is_available, status')
        .eq('user_id', phoneAssignment.user_id)
        .maybeSingle();

      const isAvailable = presence?.is_available && presence?.status !== 'offline' && presence?.status !== 'dnd';

      // Create incoming call notification for the browser modal
      await supabase.from('incoming_call_notifications').insert({
        call_sid: callSid,
        to_user_id: phoneAssignment.user_id,
        from_number: fromNumber,
        from_name: callerName !== fromNumber ? callerName : null,
        to_number: toNumber,
        status: 'ringing',
        ring_count: 0,
        metadata: { 
          lead_id: leadId,
          assigned_user: phoneAssignment.display_name,
          is_available: isAvailable,
        }
      });

      // Log the inbound call
      await supabase.from('lead_communications').insert({
        communication_type: 'call',
        direction: 'inbound',
        body: `Inbound call from ${callerName} to ${phoneAssignment.display_name}`,
        external_id: callSid,
        status: 'ringing',
        lead_id: leadId,
        metadata: { 
          from_number: fromNumber,
          to_number: toNumber,
          assigned_user_id: phoneAssignment.user_id,
          routing: 'direct_to_ghl_number',
        }
      });

      if (isAvailable) {
        // Forward to the assigned user's browser client
        // Falls back to AI voicemail if no answer after 30 seconds
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Incoming call from ${callerName.replace(/[^a-zA-Z0-9\s]/g, '')}. Please hold.</Say>
  <Dial record="record-from-answer-dual" recordingStatusCallback="${statusCallbackUrl}" recordingStatusCallbackEvent="completed" timeout="30" action="${SUPABASE_URL}/functions/v1/twilio-voicemail?targetUser=${phoneAssignment.user_id}&targetName=${encodeURIComponent(phoneAssignment.display_name)}">
    <Client statusCallback="${statusCallbackUrl}" statusCallbackEvent="initiated ringing answered completed">${phoneAssignment.user_id}</Client>
  </Dial>
</Response>`;
        
        console.log('Forwarding to browser client:', phoneAssignment.user_id);
        return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
      } else {
        // User not available - route to AI agent as backup
        console.log('User not available, routing to AI agent backup');
        
        // Update notification status
        await supabase
          .from('incoming_call_notifications')
          .update({ status: 'forwarded', expired_at: new Date().toISOString() })
          .eq('call_sid', callSid);
        
        return await routeToAIAgent(supabase, fromNumber, toNumber, callSid, SUPABASE_URL!, statusCallbackUrl, `${phoneAssignment.display_name} is currently unavailable`);
      }
    }

    // Priority 2: Check if this call is forwarded from a GHL team member number
    // If so, route to IVR operator (existing behavior)
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

    // Priority 3: Main number - Ring briefly (2 rings), then forward to ElevenLabs AI Agent
    console.log('Main number call - brief ring then AI agent');
    
    // Try to identify the caller for notification purposes
    let callerName = fromNumber;
    const { data: leadData } = await supabase
      .from('leads')
      .select('id, name')
      .or(`phone.eq.${fromNumber},phone.ilike.%${fromNumber.replace('+1', '')}%`)
      .maybeSingle();

    if (leadData) {
      callerName = leadData.name;
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

    // Create notification for ALL available admins (brief ring on their screens)
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      for (const admin of admins) {
        await supabase.from('incoming_call_notifications').insert({
          call_sid: callSid,
          to_user_id: admin.user_id,
          from_number: fromNumber,
          from_name: callerName !== fromNumber ? callerName : null,
          to_number: toNumber,
          status: 'ringing',
          ring_count: 0,
          metadata: { 
            routing: 'main_number',
            max_rings: MAX_RING_COUNT,
          }
        });
      }
    }

    // Generate TwiML that:
    // 1. Briefly rings available team members (10 seconds = ~2 rings)
    // 2. If no answer, forwards to ElevenLabs AI Agent
    const aiActionUrl = `${SUPABASE_URL}/functions/v1/twilio-forward-to-ai?from=${encodeURIComponent(fromNumber)}&callSid=${callSid}`;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${RING_TIMEOUT_SECONDS}" action="${aiActionUrl}">
    ${admins?.map(a => `<Client>${a.user_id}</Client>`).join('\n    ') || ''}
  </Dial>
</Response>`;

    console.log('Returning TwiML with brief ring then AI fallback');
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });

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

// Route call to ElevenLabs AI Agent with full context
async function routeToAIAgent(
  supabase: any,
  fromNumber: string,
  toNumber: string,
  callSid: string,
  supabaseUrl: string,
  statusCallbackUrl: string,
  contextNote?: string
) {
  // Normalize phone number for lookup
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

  // Also check property owners
  let ownerData: any = null;
  if (!lead) {
    const { data: owner } = await supabase
      .from('property_owners')
      .select('id, name, phone')
      .or(`phone.eq.${fromNumber},phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone},phone.ilike.%${normalizedPhone}%`)
      .maybeSingle();
    ownerData = owner;
  }

  // Convert https:// to wss:// for WebSocket URL
  const bridgeUrl = supabaseUrl?.replace('https://', 'wss://') + '/functions/v1/twilio-elevenlabs-bridge';

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

  const contactName = lead?.name || ownerData?.name || null;
  const contactType = lead ? 'lead' : ownerData ? 'owner' : 'unknown';

  if (lead || ownerData) {
    console.log('Found contact for inbound call:', contactName, 'type:', contactType, 'scheduled call:', hasScheduledCall);

    // Record the inbound call in lead_communications
    await supabase.from('lead_communications').insert({
      lead_id: lead?.id || null,
      communication_type: 'call',
      direction: 'inbound',
      body: hasScheduledCall 
        ? 'Inbound call - scheduled discovery call connected to AI agent'
        : `Inbound call - connected to AI agent${contextNote ? ` (${contextNote})` : ''}`,
      external_id: callSid,
      status: 'answered',
      metadata: {
        contact_type: contactType,
        routing: 'ai_agent_main',
        context_note: contextNote,
      }
    });

    // Add timeline entry for leads
    if (lead) {
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
    }
  } else {
    console.log('No contact found for phone:', fromNumber, '- routing as new caller');
    
    // Log unknown caller
    await supabase.from('lead_communications').insert({
      communication_type: 'call',
      direction: 'inbound',
      body: `Inbound call from unknown caller${contextNote ? ` (${contextNote})` : ''} - connected to AI agent`,
      external_id: callSid,
      status: 'answered',
      metadata: {
        from_number: fromNumber,
        to_number: toNumber,
        routing: 'ai_agent_new_caller',
        context_note: contextNote,
      }
    });
  }

  // Return TwiML that connects to our WebSocket bridge for ElevenLabs
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${bridgeUrl}">
      <Parameter name="caller_number" value="${fromNumber}" />
      <Parameter name="call_sid" value="${callSid}" />
      ${contactName ? `<Parameter name="lead_name" value="${contactName}" />` : ''}
      ${lead?.property_address ? `<Parameter name="property_address" value="${lead.property_address}" />` : ''}
      ${contextNote ? `<Parameter name="context_note" value="${contextNote}" />` : ''}
    </Stream>
  </Connect>
</Response>`;

  console.log('Returning TwiML with ElevenLabs bridge stream');

  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}
