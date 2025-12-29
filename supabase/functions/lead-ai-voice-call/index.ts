import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Lead AI Voice Call - Uses ElevenLabs Conversational AI for intelligent follow-up calls
 * 
 * This function initiates an outbound voice call to a lead using Twilio,
 * with ElevenLabs handling the conversation via WebSocket streaming.
 * 
 * The AI can:
 * - Introduce PeachHaus and its services
 * - Answer questions about property management
 * - Overcome objections with psychology-driven responses
 * - Schedule callback times
 * - Qualify the lead based on conversation
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, callType, customPrompt } = await req.json();

    if (!leadId) {
      throw new Error('leadId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      throw new Error('Lead not found');
    }

    if (!lead.phone) {
      throw new Error('Lead has no phone number');
    }

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhone) {
      throw new Error('Twilio credentials not configured');
    }

    // Format phone number for Twilio
    let formattedPhone = lead.phone.replace(/\D/g, '');
    if (formattedPhone.length === 10) {
      formattedPhone = '+1' + formattedPhone;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    // Determine call context based on lead stage
    const callContexts: Record<string, { intro: string; goal: string }> = {
      new_lead: {
        intro: "reaching out to discuss how PeachHaus can help maximize your rental income",
        goal: "schedule a discovery call to learn about their property and goals"
      },
      unreached: {
        intro: "following up on your property management inquiry",
        goal: "connect with the owner and understand their current situation"
      },
      call_scheduled: {
        intro: "confirming your upcoming call with our team",
        goal: "confirm the scheduled call time and answer any preliminary questions"
      },
      call_attended: {
        intro: "following up on our recent conversation",
        goal: "address any remaining questions and move toward contract signing"
      },
      send_contract: {
        intro: "ready to get started with your property management agreement",
        goal: "guide them through the contract process and answer questions"
      },
      contract_out: {
        intro: "checking in about the management agreement we sent",
        goal: "address any concerns and encourage contract completion"
      }
    };

    const context = callContexts[lead.stage] || callContexts.new_lead;
    const firstName = lead.name?.split(' ')[0] || 'there';

    // Build the WebSocket bridge URL with lead context
    const bridgeUrl = supabaseUrl.replace('https://', 'wss://') + '/functions/v1/twilio-elevenlabs-bridge';
    
    // The TwiML that will connect to ElevenLabs via WebSocket
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${bridgeUrl}">
      <Parameter name="lead_id" value="${lead.id}" />
      <Parameter name="lead_name" value="${lead.name}" />
      <Parameter name="lead_first_name" value="${firstName}" />
      <Parameter name="lead_phone" value="${lead.phone}" />
      <Parameter name="lead_stage" value="${lead.stage}" />
      <Parameter name="property_address" value="${lead.property_address || ''}" />
      <Parameter name="call_type" value="${callType || 'follow_up'}" />
      <Parameter name="call_intro" value="${context.intro}" />
      <Parameter name="call_goal" value="${context.goal}" />
      ${customPrompt ? `<Parameter name="custom_prompt" value="${customPrompt.replace(/"/g, '&quot;')}" />` : ''}
    </Stream>
  </Connect>
</Response>`;

    // Initiate the outbound call via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`;
    
    const formData = new URLSearchParams();
    formData.append('To', formattedPhone);
    formData.append('From', twilioPhone);
    formData.append('Twiml', twiml);
    formData.append('StatusCallback', `${supabaseUrl}/functions/v1/twilio-call-status`);
    formData.append('StatusCallbackEvent', 'initiated ringing answered completed');
    formData.append('Record', 'true');
    formData.append('RecordingStatusCallback', `${supabaseUrl}/functions/v1/twilio-call-status`);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioResult);
      throw new Error(`Failed to initiate call: ${twilioResult.message || 'Unknown error'}`);
    }

    console.log('AI voice call initiated:', twilioResult.sid);

    // Record the outbound call in lead_communications
    const { error: commError } = await supabase.from('lead_communications').insert({
      lead_id: leadId,
      communication_type: 'voice_call',
      direction: 'outbound',
      body: `AI follow-up call initiated (${callType || 'general follow-up'})`,
      external_id: twilioResult.sid,
      status: 'initiated',
    });

    if (commError) {
      console.error('Error recording communication:', commError);
    }

    // Update lead's last contacted time
    await supabase
      .from('leads')
      .update({ last_contacted_at: new Date().toISOString() })
      .eq('id', leadId);

    // Add timeline entry
    await supabase.from('lead_timeline').insert({
      lead_id: leadId,
      action: `AI voice call initiated to ${formattedPhone}`,
      metadata: { 
        call_sid: twilioResult.sid,
        call_type: callType || 'follow_up',
        lead_stage: lead.stage
      },
    });

    return new Response(JSON.stringify({
      success: true,
      callSid: twilioResult.sid,
      message: 'AI voice call initiated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in lead-ai-voice-call:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
