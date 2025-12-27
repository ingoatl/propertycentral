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

    // Parse Telnyx recording callback payload
    const payload = await req.json();
    console.log('Telnyx voicemail webhook:', JSON.stringify(payload, null, 2));

    const recordingUrl = payload.data?.payload?.recording_urls?.mp3;
    const callControlId = payload.data?.payload?.call_control_id;
    const toNumber = payload.data?.payload?.to;
    const fromNumber = payload.data?.payload?.from;

    if (!recordingUrl) {
      console.log('No recording URL in payload');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Voicemail received: from=${fromNumber}, to=${toNumber}, url=${recordingUrl}`);

    // Find which user owns this phone number
    const { data: phoneAssignment } = await supabase
      .from('user_phone_assignments')
      .select('id, user_id')
      .eq('phone_number', toNumber)
      .eq('is_active', true)
      .single();

    if (!phoneAssignment) {
      console.log('No user assignment found for number:', toNumber);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update call record with voicemail recording
    const { error: updateError } = await supabase
      .from('user_phone_calls')
      .update({
        recording_url: recordingUrl,
        status: 'voicemail',
      })
      .eq('external_id', callControlId);

    if (updateError) {
      console.error('Failed to update call with voicemail:', updateError);
    }

    // TODO: Optionally transcribe the voicemail using ElevenLabs or Whisper

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Telnyx voicemail webhook error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
