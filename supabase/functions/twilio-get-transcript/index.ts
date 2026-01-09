import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.log('Twilio credentials not configured - skipping transcript fetch');
      return new Response(
        JSON.stringify({ message: 'Twilio not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { callSid, communicationId, ownerId, leadId, duration, contactName } = await req.json();

    console.log('Fetching transcript for call:', { callSid, communicationId, ownerId, leadId });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If no callSid, we can't fetch the transcript
    if (!callSid) {
      console.log('No callSid provided - creating communication record with basic info');
      
      // Still create a communication record for the call
      if (ownerId || leadId) {
        const callBody = `Outbound call to ${contactName}. Duration: ${duration ? Math.round(duration / 60) : 0} minutes.`;
        
        const { error } = await supabase
          .from('lead_communications')
          .insert({
            owner_id: ownerId || null,
            lead_id: ownerId ? null : leadId || null,
            communication_type: 'call',
            direction: 'outbound',
            body: callBody,
            subject: `Call with ${contactName}`,
            call_duration: duration,
            status: 'completed',
            created_at: new Date().toISOString(),
          });

        if (error) {
          console.error('Error creating communication record:', error);
        } else {
          console.log('Created communication record for call');
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, message: 'Call logged without transcript' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch recordings for the call from Twilio
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    
    const recordingsResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}/Recordings.json`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
        }
      }
    );

    let transcript = '';
    
    if (recordingsResponse.ok) {
      const recordingsData = await recordingsResponse.json();
      const recordings = recordingsData.recordings || [];
      
      console.log(`Found ${recordings.length} recordings for call ${callSid}`);
      
      // For each recording, try to get transcription
      for (const recording of recordings) {
        // Try to get transcription if Twilio has one
        const transcriptionResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${recording.sid}/Transcriptions.json`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
            }
          }
        );
        
        if (transcriptionResponse.ok) {
          const transcriptionData = await transcriptionResponse.json();
          const transcriptions = transcriptionData.transcriptions || [];
          
          for (const t of transcriptions) {
            if (t.transcription_text) {
              transcript += t.transcription_text + '\n';
            }
          }
        }
      }
    }

    // Create or update communication record
    const callBody = transcript || `Outbound call to ${contactName}. Duration: ${duration ? Math.round(duration / 60) : 0} minutes.`;
    
    if (ownerId || leadId) {
      const { error } = await supabase
        .from('lead_communications')
        .insert({
          owner_id: ownerId || null,
          lead_id: ownerId ? null : leadId || null,
          communication_type: 'call',
          direction: 'outbound',
          body: callBody,
          subject: `Call with ${contactName}`,
          call_duration: duration,
          status: 'completed',
          created_at: new Date().toISOString(),
          external_id: callSid,
        });

      if (error) {
        console.error('Error creating communication record:', error);
        throw error;
      }
      
      console.log('Created communication record with transcript');
      
      // Trigger call analysis if we have a good transcript
      if (transcript && transcript.length > 100) {
        try {
          fetch(`${supabaseUrl}/functions/v1/analyze-call-transcript`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              ownerId,
              leadId,
              matchedName: contactName,
              callDuration: duration,
              transcript,
            }),
          }).catch(e => console.error('Analysis trigger failed:', e));
        } catch (e) {
          console.error('Analysis error:', e);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, hasTranscript: !!transcript }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error getting transcript:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
