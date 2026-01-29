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
    const { callSid, userId } = await req.json();

    if (!callSid) {
      return new Response(
        JSON.stringify({ error: 'callSid is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Decline call request:', { callSid, userId });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Update the notification status
    await supabase
      .from('incoming_call_notifications')
      .update({ 
        status: 'declined',
        expired_at: new Date().toISOString()
      })
      .eq('call_sid', callSid);

    // The call will automatically fall through to the action URL 
    // defined in the TwiML (voicemail or AI agent) since we're not answering

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Call declined, forwarding to voicemail/AI',
        callSid 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Decline call error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
