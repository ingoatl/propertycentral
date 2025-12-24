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
    
    // Log all form data for debugging
    const formEntries: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      formEntries[key] = String(value);
    }
    console.log('Twilio callback received:', JSON.stringify(formEntries, null, 2));
    
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const callDuration = formData.get('CallDuration') as string;
    const fromNumber = formData.get('From') as string;
    const toNumber = formData.get('To') as string;
    
    // Recording-specific fields (from recordingStatusCallback)
    const recordingUrl = formData.get('RecordingUrl') as string;
    const recordingSid = formData.get('RecordingSid') as string;
    const recordingStatus = formData.get('RecordingStatus') as string;
    const recordingDuration = formData.get('RecordingDuration') as string;

    console.log('Call status update:', { 
      callSid, 
      callStatus, 
      callDuration, 
      recordingUrl, 
      recordingStatus,
      fromNumber,
      toNumber 
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update the communication record with the call status
    if (callSid && callStatus) {
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
      } else {
        console.log('Updated communication status to:', callStatus);
      }
    }

    // If recording is complete, trigger transcription
    if (recordingStatus === 'completed' && recordingUrl) {
      console.log('Recording completed, triggering transcription');
      console.log('Recording URL:', recordingUrl);
      console.log('Recording Duration:', recordingDuration);
      
      // The recording URL from Twilio needs .mp3 extension for the audio file
      const recordingWithFormat = `${recordingUrl}.mp3`;
      
      // Trigger transcription
      try {
        const { data, error } = await supabase.functions.invoke('transcribe-call', {
          body: {
            callSid,
            recordingUrl: recordingWithFormat,
            fromNumber: fromNumber || toNumber, // Use whichever we have
            toNumber: toNumber || fromNumber,
            duration: recordingDuration || callDuration,
          },
        });
        
        if (error) {
          console.error('Error invoking transcription:', error);
        } else {
          console.log('Transcription triggered successfully:', data);
        }
      } catch (transcribeError) {
        console.error('Error invoking transcription:', transcribeError);
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