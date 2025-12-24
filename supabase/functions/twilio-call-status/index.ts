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
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const callDuration = formData.get('CallDuration') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    const recordingSid = formData.get('RecordingSid') as string;
    const fromNumber = formData.get('From') as string;
    const toNumber = formData.get('To') as string;

    console.log('Call status update:', { callSid, callStatus, callDuration, recordingUrl });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update the communication record with the call status
    const { error: updateError } = await supabase
      .from('lead_communications')
      .update({
        status: callStatus,
        delivery_status: callStatus,
        delivery_updated_at: new Date().toISOString(),
      })
      .eq('external_id', callSid);

    if (updateError) {
      console.error('Error updating communication:', updateError);
    }

    // If call completed and there's a recording, trigger transcription
    if (callStatus === 'completed' && recordingUrl) {
      console.log('Call completed with recording, triggering transcription');
      
      // Trigger transcription in background
      const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
      const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
      
      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
        // Get recording with authentication
        const recordingWithAuth = `${recordingUrl}.mp3`;
        
        // Call our transcription function
        try {
          await supabase.functions.invoke('transcribe-call', {
            body: {
              callSid,
              recordingUrl: recordingWithAuth,
              fromNumber,
              toNumber,
              duration: callDuration,
            },
          });
        } catch (transcribeError) {
          console.error('Error invoking transcription:', transcribeError);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Call status error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
