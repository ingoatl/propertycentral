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

    console.log('Accept call request:', { callSid, userId });

    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Update the notification status
    await supabase
      .from('incoming_call_notifications')
      .update({ 
        status: 'answered',
        answered_at: new Date().toISOString()
      })
      .eq('call_sid', callSid);

    // Note: The actual call connection happens through the Twilio Device SDK
    // in the browser. This endpoint just updates the status and could be used
    // to redirect the call if needed via Twilio's REST API.
    
    // For now, we just confirm the acceptance - the browser's Twilio Device
    // will handle the actual audio connection.

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Call accepted, connecting via browser',
        callSid 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Accept call error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
