import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // This endpoint handles TwiML for outgoing calls from the browser
  // Twilio's TwiML App will POST to this endpoint when a call is initiated
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER'); // Fallback number
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Parse the request - can be form data or JSON
    let toNumber = '';
    let fromIdentity = '';
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      toNumber = formData.get('To') as string || '';
      fromIdentity = formData.get('From') as string || '';
      // Twilio also passes Caller which contains the identity from the token
      const caller = formData.get('Caller') as string || '';
      if (caller && caller.startsWith('client:')) {
        fromIdentity = caller.replace('client:', '');
      }
      console.log('Form data - To:', toNumber, 'From/Caller:', fromIdentity);
    } else {
      const body = await req.json().catch(() => ({}));
      toNumber = body.To || body.to || '';
      fromIdentity = body.From || body.from || body.userId || '';
      console.log('JSON body - To:', toNumber, 'From:', fromIdentity);
    }

    if (!toNumber) {
      console.error('No phone number provided');
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>No phone number was provided for this call.</Say>
</Response>`;
      return new Response(errorTwiml, {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    // Format phone number
    let formattedPhone = toNumber;
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.startsWith('1') ? `+${formattedPhone}` : `+1${formattedPhone}`;
    }

    // Look up the user's assigned phone number based on their identity (userId)
    let callerIdNumber = TWILIO_PHONE_NUMBER;
    
    if (fromIdentity) {
      // The identity from the token is the userId - look up their assigned phone
      const { data: assignment } = await supabase
        .from('user_phone_assignments')
        .select('phone_number, display_name')
        .eq('user_id', fromIdentity)
        .eq('is_active', true)
        .single();

      if (assignment?.phone_number) {
        callerIdNumber = assignment.phone_number;
        console.log(`Using user's assigned phone: ${callerIdNumber} (${assignment.display_name})`);
      } else {
        console.log(`No active phone assignment found for user ${fromIdentity}, using default: ${TWILIO_PHONE_NUMBER}`);
      }
    }

    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status`;

    console.log(`Creating TwiML to dial ${formattedPhone} from ${callerIdNumber}`);
    console.log(`Status callback URL: ${statusCallbackUrl}`);

    // Generate TwiML to connect the browser call to the phone number
    // record="record-from-answer-dual" records both sides of the call
    // statusCallbackEvent triggers our webhook on call completion with recording URL
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerIdNumber}" record="record-from-answer-dual" recordingStatusCallback="${statusCallbackUrl}" recordingStatusCallbackEvent="completed">
    <Number statusCallback="${statusCallbackUrl}" statusCallbackEvent="initiated ringing answered completed">${formattedPhone}</Number>
  </Dial>
</Response>`;

    console.log('TwiML response:', twiml);

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (error: unknown) {
    console.error('TwiML generation error:', error);
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred processing your call.</Say>
</Response>`;
    return new Response(errorTwiml, {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
});
