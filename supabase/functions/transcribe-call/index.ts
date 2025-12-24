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
    const { callSid, recordingUrl, fromNumber, toNumber, duration } = await req.json();

    console.log('Transcribing call:', { callSid, recordingUrl, fromNumber });

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Normalize phone number for lead lookup
    let normalizedPhone = fromNumber;
    if (normalizedPhone?.startsWith('+1')) {
      normalizedPhone = normalizedPhone.substring(2);
    } else if (normalizedPhone?.startsWith('+')) {
      normalizedPhone = normalizedPhone.substring(1);
    }

    // Find the lead
    const { data: lead } = await supabase
      .from('leads')
      .select('id, name, property_address, stage')
      .or(`phone.eq.${fromNumber},phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone}`)
      .maybeSingle();

    // Download the recording from Twilio (with authentication)
    let audioBlob: Blob;
    try {
      const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
      const recordingResponse = await fetch(recordingUrl, {
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
        },
      });

      if (!recordingResponse.ok) {
        throw new Error(`Failed to download recording: ${recordingResponse.status}`);
      }

      audioBlob = await recordingResponse.blob();
      console.log('Downloaded recording:', audioBlob.size, 'bytes');
    } catch (downloadError) {
      console.error('Error downloading recording:', downloadError);
      throw downloadError;
    }

    // Transcribe using OpenAI Whisper
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error('Transcription error:', errorText);
      throw new Error(`Transcription failed: ${errorText}`);
    }

    const transcriptionResult = await transcriptionResponse.json();
    const transcriptText = transcriptionResult.text;

    console.log('Transcription complete:', transcriptText?.substring(0, 200));

    // Analyze the transcription for key insights using AI
    let insights = null;
    if (transcriptText && transcriptText.length > 50) {
      try {
        const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are analyzing a phone call transcript between a property management company (Peachhaus) and a potential lead interested in their short-term rental management services. Extract key insights from the conversation.

Return a JSON object with these fields:
- interest_level: "high", "medium", "low", or "none"
- property_details: any details mentioned about their property (address, bedrooms, type, etc.)
- concerns: array of any concerns or objections mentioned
- timeline: when they're looking to start (if mentioned)
- budget_expectations: any pricing or fee discussions
- next_steps: what was agreed upon for follow-up
- key_points: array of 2-5 bullet points summarizing the conversation
- sentiment: "positive", "neutral", or "negative"
- recommended_stage: suggested lead stage ("new_lead", "contacted", "qualifying", "proposal_sent", "negotiating", "closed_won", "closed_lost")

Only include fields that have relevant information from the call.`
              },
              {
                role: 'user',
                content: `Analyze this call transcript:\n\n${transcriptText}`
              }
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (analysisResponse.ok) {
          const analysisResult = await analysisResponse.json();
          insights = JSON.parse(analysisResult.choices[0].message.content);
          console.log('Call analysis insights:', insights);
        }
      } catch (analysisError) {
        console.error('Error analyzing call:', analysisError);
      }
    }

    // Update the lead with transcription and insights
    if (lead) {
      // Update the communication record with the transcription
      await supabase
        .from('lead_communications')
        .update({
          body: transcriptText || 'Call completed - no transcription available',
        })
        .eq('external_id', callSid);

      // Add timeline entry with transcription
      await supabase.from('lead_timeline').insert({
        lead_id: lead.id,
        action: 'call_transcribed',
        metadata: {
          call_sid: callSid,
          duration: duration,
          transcript_preview: transcriptText?.substring(0, 500),
          insights: insights,
        },
      });

      // Update lead with AI summary if insights available
      if (insights) {
        const updateData: Record<string, unknown> = {
          last_contacted_at: new Date().toISOString(),
          ai_summary: `Call Analysis: ${insights.interest_level} interest. ${insights.key_points?.join(' ') || ''}`,
        };

        // Update stage if recommended
        if (insights.recommended_stage && insights.interest_level !== 'none') {
          updateData.stage = insights.recommended_stage;
        }

        await supabase
          .from('leads')
          .update(updateData)
          .eq('id', lead.id);
      }

      console.log('Updated lead with call transcription and insights');
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcription: transcriptText,
        insights: insights,
        leadId: lead?.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Transcription error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
