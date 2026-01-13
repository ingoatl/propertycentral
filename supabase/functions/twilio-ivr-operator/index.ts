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
    const digits = formData.get('Digits') as string;
    const speechResult = formData.get('SpeechResult') as string;
    const callSid = formData.get('CallSid') as string;
    const fromNumber = formData.get('From') as string;
    const forwardedFrom = formData.get('ForwardedFrom') as string; // GHL number that was called

    console.log('IVR Operator received:', { callSid, digits, speechResult, fromNumber, forwardedFrom });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get team routing configuration
    const { data: teamMembers } = await supabase
      .from('team_routing')
      .select('*')
      .eq('is_active', true)
      .order('dtmf_digit');

    if (!teamMembers || teamMembers.length === 0) {
      // No team routing configured, fallback to voicemail
      const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Thank you for calling PeachHaus. Please leave a message after the beep.</Say>
  <Record maxLength="120" playBeep="true" />
</Response>`;
      return new Response(fallbackTwiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // If we have digits or speech, route to the selected team member
    if (digits || speechResult) {
      let selectedMember = null;

      // Check for DTMF digit input
      if (digits) {
        selectedMember = teamMembers.find(m => m.dtmf_digit === digits);
      }

      // Check for speech input (e.g., "Alex", "connect me with Anja")
      if (!selectedMember && speechResult) {
        const speech = speechResult.toLowerCase();
        for (const member of teamMembers) {
          if (speech.includes(member.display_name.toLowerCase())) {
            selectedMember = member;
            break;
          }
        }
      }

      if (selectedMember) {
        console.log(`Routing call to ${selectedMember.display_name} at ${selectedMember.forward_to_number}`);
        
        // Log the routing decision
        await supabase.from('lead_timeline').insert({
          lead_id: null,
          action: `Call routed to ${selectedMember.display_name}`,
          metadata: {
            call_sid: callSid,
            from_number: fromNumber,
            forwarded_from: forwardedFrom,
            routed_to: selectedMember.display_name,
            routed_to_number: selectedMember.forward_to_number,
          }
        }).maybeSingle();

        // Route to selected team member
        const routeTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Connecting you to ${selectedMember.display_name} now.</Say>
  <Dial callerId="${forwardedFrom || Deno.env.get('TWILIO_PHONE_NUMBER')}">
    <Number>${selectedMember.forward_to_number}</Number>
  </Dial>
  <Say voice="Polly.Matthew">${selectedMember.display_name} is unavailable. Please leave a message after the beep.</Say>
  <Record maxLength="120" playBeep="true" />
</Response>`;
        return new Response(routeTwiml, { headers: { 'Content-Type': 'text/xml' } });
      } else {
        // Invalid selection, replay menu
        const invalidTwiml = buildMenuTwiml(teamMembers, "Sorry, I didn't understand that. ");
        return new Response(invalidTwiml, { headers: { 'Content-Type': 'text/xml' } });
      }
    }

    // No input yet, play the main menu
    const menuTwiml = buildMenuTwiml(teamMembers);
    return new Response(menuTwiml, { headers: { 'Content-Type': 'text/xml' } });

  } catch (error) {
    console.error('IVR Operator error:', error);
    
    // Fallback TwiML
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">We're experiencing technical difficulties. Please try again later or leave a message after the beep.</Say>
  <Record maxLength="120" playBeep="true" />
</Response>`;
    
    return new Response(fallbackTwiml, { headers: { 'Content-Type': 'text/xml' } });
  }
});

function buildMenuTwiml(teamMembers: any[], prefix: string = ""): string {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const actionUrl = `${SUPABASE_URL}/functions/v1/twilio-ivr-operator`;
  
  // Build the menu options dynamically
  const menuOptions = teamMembers
    .filter(m => m.dtmf_digit)
    .map(m => `Press ${m.dtmf_digit} for ${m.display_name}`)
    .join('. ');
  
  const names = teamMembers.map(m => m.display_name).join(', ');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf speech" timeout="5" numDigits="1" action="${actionUrl}" method="POST" speechTimeout="auto">
    <Say voice="Polly.Matthew">${prefix}Thank you for calling PeachHaus. ${menuOptions}. Or say the name of the person you'd like to speak with: ${names}.</Say>
  </Gather>
  <Say voice="Polly.Matthew">We didn't receive any input. Please try again.</Say>
  <Redirect>${actionUrl}</Redirect>
</Response>`;
}
