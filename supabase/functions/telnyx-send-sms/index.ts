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
    const telnyxApiKey = Deno.env.get('TELNYX_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get JWT token to identify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { to, message, from } = body;

    if (!to || !message) {
      return new Response(JSON.stringify({ error: 'Missing to or message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's phone assignment to use as caller ID
    let fromNumber = from;
    let phoneAssignmentId = null;

    if (!fromNumber) {
      const { data: assignment } = await supabase
        .from('user_phone_assignments')
        .select('id, phone_number')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('phone_type', 'personal')
        .single();

      if (assignment) {
        fromNumber = assignment.phone_number;
        phoneAssignmentId = assignment.id;
      }
    }

    if (!fromNumber) {
      return new Response(JSON.stringify({ error: 'No phone number assigned to user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Format phone number
    let formattedTo = to;
    if (!formattedTo.startsWith('+')) {
      formattedTo = formattedTo.startsWith('1') ? `+${formattedTo}` : `+1${formattedTo}`;
    }

    console.log(`Sending SMS from ${fromNumber} to ${formattedTo}`);

    // Send via Telnyx API
    const telnyxResponse = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${telnyxApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromNumber,
        to: formattedTo,
        text: message,
        messaging_profile_id: Deno.env.get('TELNYX_MESSAGING_PROFILE_ID'),
      }),
    });

    const telnyxData = await telnyxResponse.json();
    console.log('Telnyx response:', JSON.stringify(telnyxData, null, 2));

    if (!telnyxResponse.ok) {
      throw new Error(telnyxData.errors?.[0]?.detail || 'Failed to send SMS');
    }

    const messageId = telnyxData.data?.id;

    // Store the outbound message
    const { data: insertedMessage, error: insertError } = await supabase
      .from('user_phone_messages')
      .insert({
        user_id: user.id,
        phone_assignment_id: phoneAssignmentId,
        direction: 'outbound',
        from_number: fromNumber,
        to_number: formattedTo,
        body: message,
        status: 'sent',
        external_id: messageId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store outbound message:', insertError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: messageId,
      local_id: insertedMessage?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Telnyx send SMS error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
