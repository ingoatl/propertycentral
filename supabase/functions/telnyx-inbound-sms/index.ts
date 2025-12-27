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

    // Parse Telnyx webhook payload
    const payload = await req.json();
    console.log('Telnyx inbound SMS webhook:', JSON.stringify(payload, null, 2));

    const eventType = payload.data?.event_type;
    
    if (eventType !== 'message.received') {
      console.log('Ignoring non-message event:', eventType);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const message = payload.data?.payload;
    const fromNumber = message?.from?.phone_number;
    const toNumber = message?.to?.[0]?.phone_number;
    const body = message?.text;
    const externalId = message?.id;
    const mediaUrls = message?.media?.map((m: any) => m.url) || [];

    console.log(`SMS received: from=${fromNumber}, to=${toNumber}, body=${body?.substring(0, 50)}`);

    // Find which user owns this phone number
    const { data: phoneAssignment, error: assignmentError } = await supabase
      .from('user_phone_assignments')
      .select('id, user_id, phone_number')
      .eq('phone_number', toNumber)
      .eq('is_active', true)
      .single();

    if (assignmentError || !phoneAssignment) {
      console.log('No user assignment found for number:', toNumber);
      // Store in a general unassigned queue if needed
      return new Response(JSON.stringify({ success: true, message: 'No assignment found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Found phone assignment for user:', phoneAssignment.user_id);

    // Store the message in user's inbox
    const { data: insertedMessage, error: insertError } = await supabase
      .from('user_phone_messages')
      .insert({
        user_id: phoneAssignment.user_id,
        phone_assignment_id: phoneAssignment.id,
        direction: 'inbound',
        from_number: fromNumber,
        to_number: toNumber,
        body: body,
        media_urls: mediaUrls,
        status: 'received',
        external_id: externalId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store message:', insertError);
      throw insertError;
    }

    console.log('Message stored successfully:', insertedMessage.id);

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: insertedMessage.id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Telnyx SMS webhook error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
