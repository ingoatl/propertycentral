import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
    
    // Parse the request - can be form data or JSON
    let toNumber = '';
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      toNumber = formData.get('To') as string || '';
      console.log('Form data To:', toNumber);
    } else {
      const body = await req.json().catch(() => ({}));
      toNumber = body.To || body.to || '';
      console.log('JSON body To:', toNumber);
    }

    if (!toNumber) {
      console.error('No phone number provided');
      // Return empty TwiML that says an error
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

    console.log(`Creating TwiML to dial ${formattedPhone} from ${TWILIO_PHONE_NUMBER}`);

    // Generate TwiML to connect the browser call to the phone number
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${TWILIO_PHONE_NUMBER}">
    <Number>${formattedPhone}</Number>
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
