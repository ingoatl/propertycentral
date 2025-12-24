import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to normalize phone numbers for comparison
function normalizePhone(phone: string | null | undefined): string[] {
  if (!phone) return [];
  
  const cleaned = phone.replace(/\D/g, '');
  const variants = [cleaned];
  
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    variants.push(cleaned.substring(1));
  }
  if (cleaned.length === 10) {
    variants.push('1' + cleaned);
  }
  
  // Add formatted versions
  variants.push(`+${cleaned}`);
  variants.push(`+1${cleaned.length === 10 ? cleaned : cleaned.substring(1)}`);
  
  return [...new Set(variants)];
}

// Fuzzy match helper - simple string similarity
function fuzzyMatch(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Simple word overlap score
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const overlap = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
  return overlap.length / Math.max(words1.length, words2.length);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { callSid, recordingUrl, fromNumber, toNumber, duration } = await req.json();

    console.log('Transcribing call:', { callSid, recordingUrl, fromNumber, toNumber, duration });

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

    // Get all phone variants to search
    const phoneVariants = [...normalizePhone(fromNumber), ...normalizePhone(toNumber)];
    console.log('Searching for lead with phone variants:', phoneVariants);

    // Try to find lead by phone number first
    let lead = null;
    if (phoneVariants.length > 0) {
      const phoneConditions = phoneVariants.map(p => `phone.ilike.%${p}%`).join(',');
      const { data: phoneLead } = await supabase
        .from('leads')
        .select('id, name, property_address, stage, phone')
        .or(phoneConditions)
        .maybeSingle();
      
      if (phoneLead) {
        lead = phoneLead;
        console.log('Found lead by phone:', lead.name);
      }
    }

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
- caller_name: name of the caller if mentioned (first and last if available)
- property_address: any property address mentioned in the call
- interest_level: "high", "medium", "low", or "none"
- property_details: any details mentioned about their property (bedrooms, type, location, etc.)
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

    // If no lead found by phone, try matching by name or property from transcript
    if (!lead && insights) {
      // Try matching by caller name
      if (insights.caller_name) {
        console.log('Attempting to match by caller name:', insights.caller_name);
        const { data: leads } = await supabase
          .from('leads')
          .select('id, name, property_address, stage, phone')
          .limit(100);
        
        if (leads) {
          const nameMatch = leads.find(l => fuzzyMatch(l.name, insights.caller_name) > 0.7);
          if (nameMatch) {
            lead = nameMatch;
            console.log('Found lead by name match:', lead.name);
          }
        }
      }
      
      // Try matching by property address
      if (!lead && insights.property_address) {
        console.log('Attempting to match by property address:', insights.property_address);
        const { data: leads } = await supabase
          .from('leads')
          .select('id, name, property_address, stage, phone')
          .not('property_address', 'is', null)
          .limit(100);
        
        if (leads) {
          const addressMatch = leads.find(l => 
            l.property_address && fuzzyMatch(l.property_address, insights.property_address) > 0.6
          );
          if (addressMatch) {
            lead = addressMatch;
            console.log('Found lead by address match:', lead.name);
          }
        }
      }
    }

    // Update the lead with transcription and insights
    if (lead) {
      // Update/create the communication record with the transcription
      const { data: existingComm } = await supabase
        .from('lead_communications')
        .select('id')
        .eq('external_id', callSid)
        .maybeSingle();
      
      if (existingComm) {
        await supabase
          .from('lead_communications')
          .update({
            body: transcriptText || 'Call completed - no transcription available',
            status: 'transcribed',
          })
          .eq('id', existingComm.id);
      } else {
        // Create new communication record
        await supabase
          .from('lead_communications')
          .insert({
            lead_id: lead.id,
            communication_type: 'call',
            direction: 'outbound',
            body: transcriptText || 'Call completed - no transcription available',
            external_id: callSid,
            status: 'transcribed',
            sent_at: new Date().toISOString(),
          });
      }

      // Add timeline entry with transcription
      await supabase.from('lead_timeline').insert({
        lead_id: lead.id,
        action: 'call_transcribed',
        metadata: {
          call_sid: callSid,
          duration: duration,
          transcript_preview: transcriptText?.substring(0, 500),
          insights: insights,
          recording_url: recordingUrl,
        },
      });

      // Update lead with AI summary if insights available
      if (insights) {
        const updateData: Record<string, unknown> = {
          last_contacted_at: new Date().toISOString(),
          ai_summary: `Call Analysis: ${insights.interest_level || 'Unknown'} interest. ${insights.key_points?.join(' ') || ''}`,
        };

        // Update property address if we discovered it
        if (insights.property_address && !lead.property_address) {
          updateData.property_address = insights.property_address;
        }

        // Update stage if recommended
        if (insights.recommended_stage && insights.interest_level !== 'none') {
          updateData.stage = insights.recommended_stage;
        }

        await supabase
          .from('leads')
          .update(updateData)
          .eq('id', lead.id);
      }

      console.log('Updated lead with call transcription and insights:', lead.id);
    } else {
      // No lead matched - create an unmatched call record in timeline or log
      console.log('No matching lead found for call. Creating orphan record.');
      
      // Log the unmatched call for review
      console.log('Unmatched call details:', {
        call_sid: callSid,
        from_number: fromNumber,
        to_number: toNumber,
        duration: duration,
        transcript_preview: transcriptText?.substring(0, 200),
        caller_name: insights?.caller_name,
        property_address: insights?.property_address,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcription: transcriptText,
        insights: insights,
        leadId: lead?.id,
        matched: !!lead,
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
