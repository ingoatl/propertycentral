import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple JWT creation for Twilio Access Token
async function createTwilioAccessToken(
  accountSid: string,
  apiKey: string,
  apiSecret: string,
  identity: string,
  twimlAppSid: string
): Promise<string> {
  const header = {
    typ: 'JWT',
    alg: 'HS256',
    cty: 'twilio-fpa;v=1'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    jti: `${apiKey}-${now}`,
    iss: apiKey,
    sub: accountSid,
    exp: now + 3600, // 1 hour
    grants: {
      identity: identity,
      voice: {
        outgoing: {
          application_sid: twimlAppSid
        }
      }
    }
  };

  const base64Header = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const base64Payload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const signatureInput = `${base64Header}.${base64Payload}`;
  
  // Create HMAC-SHA256 signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiSecret);
  const messageData = encoder.encode(signatureInput);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const signatureArray = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < signatureArray.length; i++) {
    binary += String.fromCharCode(signatureArray[i]);
  }
  const base64Signature = btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${signatureInput}.${base64Signature}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
    const TWILIO_API_SECRET = Deno.env.get('TWILIO_API_SECRET');
    const TWILIO_TWIML_APP_SID = Deno.env.get('TWILIO_TWIML_APP_SID');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET || !TWILIO_TWIML_APP_SID) {
      console.error('Missing Twilio credentials:', {
        hasAccountSid: !!TWILIO_ACCOUNT_SID,
        hasApiKey: !!TWILIO_API_KEY,
        hasApiSecret: !!TWILIO_API_SECRET,
        hasTwimlAppSid: !!TWILIO_TWIML_APP_SID
      });
      throw new Error('Twilio credentials not fully configured');
    }

    const { identity, userId } = await req.json();
    
    // Use userId as identity for tracking which user is making calls
    // This allows twilio-voice to look up their assigned phone number
    const userIdentity = userId || identity || `user-${Date.now()}`;

    console.log(`Generating token for identity: ${userIdentity}`);

    const token = await createTwilioAccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      userIdentity,
      TWILIO_TWIML_APP_SID
    );

    // If userId provided, look up their assigned phone number
    let assignedPhone = null;
    if (userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: assignment } = await supabase
        .from('user_phone_assignments')
        .select('phone_number, display_name')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (assignment) {
        assignedPhone = assignment.phone_number;
        console.log(`User ${userId} has assigned phone: ${assignedPhone} (${assignment.display_name})`);
      }
    }

    console.log('Token generated successfully');

    return new Response(
      JSON.stringify({ token, identity: userIdentity, assignedPhone }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Token generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
