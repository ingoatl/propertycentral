import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface TransferRequest {
  callSid: string;
  targetUserId?: string;
  targetNumber?: string;
  teamMemberName?: string;
  transferType: 'browser' | 'phone' | 'voicemail';
  announcementText?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { callSid, targetUserId, targetNumber, teamMemberName, transferType, announcementText } = await req.json() as TransferRequest;
    
    console.log('Transfer request:', { callSid, targetUserId, targetNumber, teamMemberName, transferType });

    if (!callSid) {
      return new Response(JSON.stringify({ error: 'callSid is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve team member if name provided
    let resolvedUserId = targetUserId;
    let resolvedNumber = targetNumber;
    let teamMemberInfo: { display_name: string; mobile_number?: string; user_id: string } | null = null;

    if (teamMemberName) {
      const { data: teamMember } = await supabase
        .from('team_routing')
        .select('user_id, display_name, forward_to_number, mobile_number, ghl_number')
        .ilike('display_name', `%${teamMemberName}%`)
        .eq('is_active', true)
        .maybeSingle();

      if (teamMember) {
        teamMemberInfo = {
          display_name: teamMember.display_name,
          mobile_number: teamMember.mobile_number || teamMember.forward_to_number || teamMember.ghl_number,
          user_id: teamMember.user_id,
        };
        resolvedUserId = teamMember.user_id;
        resolvedNumber = teamMember.mobile_number || teamMember.forward_to_number || teamMember.ghl_number;
        console.log('Resolved team member:', teamMemberInfo);
      } else {
        console.warn('Team member not found:', teamMemberName);
        return new Response(JSON.stringify({ 
          error: 'Team member not found',
          teamMemberName 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check user availability if transferring to browser
    if (transferType === 'browser' && resolvedUserId) {
      const { data: presence } = await supabase
        .from('user_presence')
        .select('is_available, status')
        .eq('user_id', resolvedUserId)
        .maybeSingle();

      if (!presence?.is_available || presence.status === 'dnd' || presence.status === 'offline') {
        console.log('User not available, falling back to voicemail');
        // Fall back to voicemail
        return await handleVoicemailTransfer(callSid, resolvedUserId, teamMemberInfo?.display_name || 'team member');
      }
    }

    // Generate the TwiML for the transfer
    const statusCallbackUrl = `${SUPABASE_URL}/functions/v1/twilio-call-status`;
    let twiml: string;

    if (transferType === 'browser' && resolvedUserId) {
      // Transfer to browser client
      const announcement = announcementText || `Transferring you to ${teamMemberInfo?.display_name || 'a team member'}. Please hold.`;
      
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">${announcement}</Say>
  <Dial record="record-from-answer-dual" recordingStatusCallback="${statusCallbackUrl}" recordingStatusCallbackEvent="completed" timeout="30" action="${SUPABASE_URL}/functions/v1/twilio-voicemail?targetUser=${resolvedUserId}&targetName=${encodeURIComponent(teamMemberInfo?.display_name || 'Team Member')}">
    <Client statusCallback="${statusCallbackUrl}" statusCallbackEvent="initiated ringing answered completed">${resolvedUserId}</Client>
  </Dial>
</Response>`;
    } else if (transferType === 'phone' && resolvedNumber) {
      // Transfer to phone number
      const announcement = announcementText || `Transferring you to ${teamMemberInfo?.display_name || 'a team member'}. Please hold.`;
      
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">${announcement}</Say>
  <Dial record="record-from-answer-dual" recordingStatusCallback="${statusCallbackUrl}" recordingStatusCallbackEvent="completed" timeout="30" action="${SUPABASE_URL}/functions/v1/twilio-voicemail?targetUser=${resolvedUserId}&targetName=${encodeURIComponent(teamMemberInfo?.display_name || 'Team Member')}">
    <Number statusCallback="${statusCallbackUrl}" statusCallbackEvent="initiated ringing answered completed">${resolvedNumber}</Number>
  </Dial>
</Response>`;
    } else if (transferType === 'voicemail') {
      return await handleVoicemailTransfer(callSid, resolvedUserId || '', teamMemberInfo?.display_name || 'team member');
    } else {
      return new Response(JSON.stringify({ error: 'Invalid transfer configuration' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update the call with new TwiML using Twilio REST API
    const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    
    const updateResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          Twiml: twiml,
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Twilio API error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to update call', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updateResult = await updateResponse.json();
    console.log('Call updated successfully:', updateResult.sid);

    // Log the transfer attempt
    await supabase.from('lead_communications').insert({
      communication_type: 'call',
      direction: 'internal',
      body: `Call transfer initiated to ${teamMemberInfo?.display_name || resolvedNumber || 'team member'}`,
      external_id: callSid,
      status: 'transferring',
      metadata: {
        transfer_type: transferType,
        target_user_id: resolvedUserId,
        target_number: resolvedNumber,
        target_name: teamMemberInfo?.display_name,
      }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      callSid,
      transferType,
      targetUser: teamMemberInfo?.display_name,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Transfer error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleVoicemailTransfer(callSid: string, targetUserId: string, targetName: string) {
  const statusCallbackUrl = `${SUPABASE_URL}/functions/v1/twilio-call-status`;
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">${targetName} is not available right now. Please leave a message after the beep and they will get back to you as soon as possible.</Say>
  <Record 
    maxLength="120" 
    playBeep="true"
    recordingStatusCallback="${statusCallbackUrl}?targetUser=${targetUserId}&targetName=${encodeURIComponent(targetName)}"
    recordingStatusCallbackEvent="completed"
    transcribe="true"
    transcribeCallback="${statusCallbackUrl}"
  />
  <Say voice="Polly.Matthew">Thank you for your message. Goodbye.</Say>
</Response>`;

  const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  
  const updateResponse = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        Twiml: twiml,
      }),
    }
  );

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    console.error('Voicemail transfer error:', errorText);
    return new Response(JSON.stringify({ error: 'Failed to transfer to voicemail', details: errorText }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    transferType: 'voicemail',
    targetName,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
