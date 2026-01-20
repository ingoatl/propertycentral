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

    // Update the communication record with the call status and duration
    if (callSid && callStatus) {
      const updateData: Record<string, unknown> = {
        status: callStatus,
        delivery_status: callStatus,
        delivery_updated_at: new Date().toISOString(),
      };
      
      // Add call duration if available
      if (callDuration) {
        updateData.call_duration = parseInt(callDuration);
      }
      
      const { error: updateError } = await supabase
        .from('lead_communications')
        .update(updateData)
        .eq('external_id', callSid);

      if (updateError) {
        console.error('Error updating communication:', updateError);
      } else {
        console.log('Updated communication status to:', callStatus, 'duration:', callDuration);
      }
    }
    
    // Store recording URL immediately when recording is completed (before transcription)
    if (recordingStatus === 'completed' && recordingUrl && callSid) {
      console.log('Storing recording URL for call:', callSid);
      const recordingWithFormat = `${recordingUrl}.mp3`;
      
      const { error: recordingError } = await supabase
        .from('lead_communications')
        .update({
          call_recording_url: recordingWithFormat,
          call_duration: recordingDuration ? parseInt(recordingDuration) : null,
        })
        .eq('external_id', callSid);
        
      if (recordingError) {
        console.error('Error storing recording URL:', recordingError);
      } else {
        console.log('Recording URL stored successfully:', recordingWithFormat);
      }
    }

    // If recording is complete, trigger transcription
    if (recordingStatus === 'completed' && recordingUrl) {
      console.log('Recording completed, triggering transcription');
      console.log('Recording URL:', recordingUrl);
      console.log('Recording Duration:', recordingDuration);
      
      // The recording URL from Twilio needs .mp3 extension for the audio file
      const recordingWithFormat = `${recordingUrl}.mp3`;
      
      // Get phone numbers - first from callback, then from DB
      let phoneFrom = fromNumber;
      let phoneTo = toNumber;
      
      // Get the parent call SID if this is a child call
      const parentCallSid = formData.get('ParentCallSid') as string;
      const effectiveCallSid = parentCallSid || callSid;
      
      console.log('Looking up communication record for CallSid:', effectiveCallSid);
      
      // Try to get phone from the lead_communications record or metadata
      if (!phoneTo && effectiveCallSid) {
        const { data: comm } = await supabase
          .from('lead_communications')
          .select('lead_id, owner_id, metadata')
          .eq('external_id', effectiveCallSid)
          .maybeSingle();
        
        console.log('Found communication record:', comm);
        
        // Try to get phone from metadata first (set when call was initiated)
        if (comm?.metadata && typeof comm.metadata === 'object') {
          const meta = comm.metadata as Record<string, unknown>;
          if (meta.to_number) {
            phoneTo = meta.to_number as string;
            console.log('Got phone from metadata:', phoneTo);
          }
        }
        
        // If still no phone, try to get from lead
        if (!phoneTo && comm?.lead_id) {
          const { data: lead } = await supabase
            .from('leads')
            .select('phone')
            .eq('id', comm.lead_id)
            .maybeSingle();
          
          if (lead?.phone) {
            phoneTo = lead.phone;
            console.log('Found lead phone from communication record:', phoneTo);
          }
        }
        
        // Try from owner if no lead
        if (!phoneTo && comm?.owner_id) {
          const { data: owner } = await supabase
            .from('property_owners')
            .select('phone')
            .eq('id', comm.owner_id)
            .maybeSingle();
          
          if (owner?.phone) {
            phoneTo = owner.phone;
            console.log('Found owner phone from communication record:', phoneTo);
          }
        }
      }
      
      // Also update recording URL on parent call SID if different
      if (parentCallSid && parentCallSid !== callSid) {
        console.log('Updating parent call with recording:', parentCallSid);
        await supabase
          .from('lead_communications')
          .update({
            call_recording_url: recordingWithFormat,
            call_duration: recordingDuration ? parseInt(recordingDuration) : null,
          })
          .eq('external_id', parentCallSid);
      }
      
      console.log('Triggering transcription with:', { effectiveCallSid, phoneFrom, phoneTo });
      
      // Trigger transcription
      try {
        const { data, error } = await supabase.functions.invoke('transcribe-call', {
          body: {
            callSid: effectiveCallSid,
            recordingUrl: recordingWithFormat,
            fromNumber: phoneFrom,
            toNumber: phoneTo,
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