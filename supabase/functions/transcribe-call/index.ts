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

// Spam/noise detection patterns
const SPAM_PATTERNS = [
  /^(hello|hi|hey)[\s.,!?]*$/i,
  /^(bye|goodbye|thanks|thank you)[\s.,!?]*$/i,
  /^(yes|no|ok|okay|yeah|yep|nope)[\s.,!?]*$/i,
  /^[\s.,!?]*$/,
  /this call (may be|is being) (recorded|monitored)/i,
  /press \d+ (to|for)/i,
  /your call is important/i,
  /please hold/i,
  /leave a message after the (beep|tone)/i,
  /the person you are trying to reach/i,
  /mailbox is full/i,
  /not available/i,
];

function isSpamOrNoise(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  
  // Too short (under 20 chars is likely just noise)
  if (trimmed.length < 20) return true;
  
  // Word count too low (less than 5 words)
  const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 5) return true;
  
  // Check spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { callSid, recordingUrl, fromNumber, toNumber, duration } = await req.json();

    console.log('Transcribing call:', { callSid, recordingUrl, fromNumber, toNumber, duration });

    // Skip very short calls (under 5 seconds) - likely spam/hangups
    const callDuration = parseInt(duration) || 0;
    if (callDuration < 5) {
      console.log('Skipping very short call:', callDuration, 'seconds');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Call too short' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Check if transcript is spam/noise - skip AI analysis if so
    if (isSpamOrNoise(transcriptText)) {
      console.log('Transcript identified as spam/noise, skipping AI analysis');
      
      // Still save the transcript if we have a lead, but don't analyze
      if (lead) {
        await supabase.from('lead_communications').upsert({
          lead_id: lead.id,
          communication_type: 'call',
          direction: 'inbound',
          body: transcriptText || 'Short call - no meaningful content',
          external_id: callSid,
          status: 'completed',
          sent_at: new Date().toISOString(),
        }, { onConflict: 'external_id' });
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true, 
          reason: 'Spam or noise detected',
          transcription: transcriptText 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only analyze meaningful transcriptions with AI
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
                content: `You are analyzing a phone call transcript or voicemail between a property management company (Peachhaus) and a potential lead interested in their short-term rental management services. Extract key insights from the conversation.

Return a JSON object with these fields:
- caller_name: name of the caller if mentioned (first and last if available)
- property_address: any property address mentioned in the call
- interest_level: "high", "medium", "low", or "none"
- property_details: any details mentioned about their property (bedrooms, type, location, etc.)
- concerns: array of any concerns or objections mentioned
- timeline: when they're looking to start (if mentioned) - be specific about dates/timeframes
- delay_requested: boolean - true if the caller asks to wait, call back later, or mentions needing more time
- delay_until: if delay_requested is true, specify when to follow up (e.g., "next week", "after holidays", "in 2 weeks")
- budget_expectations: any pricing or fee discussions
- next_steps: what was agreed upon for follow-up
- key_points: array of 2-5 bullet points summarizing the conversation
- sentiment: "positive", "neutral", or "negative"
- recommended_stage: suggested lead stage ("new_lead", "contacted", "qualifying", "proposal_sent", "negotiating", "closed_won", "closed_lost")
- pause_follow_ups: boolean - true if the lead explicitly asked to stop contact or needs a break

Always include at least caller_name (if mentioned), interest_level, sentiment, key_points, and recommended_stage.`
              },
              {
                role: 'user',
                content: `Analyze this call transcript or voicemail:\n\n${transcriptText}`
              }
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (analysisResponse.ok) {
          const analysisResult = await analysisResponse.json();
          insights = JSON.parse(analysisResult.choices[0].message.content);
          console.log('Call analysis insights:', insights);
        } else {
          console.error('AI analysis failed:', await analysisResponse.text());
        }
      } catch (analysisError) {
        console.error('Error analyzing call:', analysisError);
      }
    } else {
      console.log('Transcript too short for detailed analysis:', transcriptText?.length || 0, 'chars');
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

        // Handle follow-up pausing if requested
        if (insights.pause_follow_ups === true) {
          updateData.follow_up_paused = true;
          console.log('Pausing follow-ups as requested by lead');
        }

        await supabase
          .from('leads')
          .update(updateData)
          .eq('id', lead.id);

        // If delay was requested, update pending follow-up schedules
        if (insights.delay_requested === true && insights.delay_until) {
          console.log('Lead requested delay until:', insights.delay_until);
          
          // Calculate new follow-up date based on delay_until
          let delayDays = 7; // Default to 1 week
          const delayText = (insights.delay_until as string).toLowerCase();
          
          if (delayText.includes('2 week') || delayText.includes('two week')) {
            delayDays = 14;
          } else if (delayText.includes('month')) {
            delayDays = 30;
          } else if (delayText.includes('holiday') || delayText.includes('new year')) {
            delayDays = 14;
          } else if (delayText.includes('tomorrow')) {
            delayDays = 1;
          } else if (delayText.includes('few days') || delayText.includes('couple days')) {
            delayDays = 3;
          }

          const newScheduleDate = new Date();
          newScheduleDate.setDate(newScheduleDate.getDate() + delayDays);

          // Update pending follow-up schedules
          const { error: scheduleError } = await supabase
            .from('lead_follow_up_schedules')
            .update({ 
              scheduled_for: newScheduleDate.toISOString(),
            })
            .eq('lead_id', lead.id)
            .eq('status', 'pending');

          if (scheduleError) {
            console.error('Error updating follow-up schedules:', scheduleError);
          } else {
            console.log(`Rescheduled pending follow-ups to ${newScheduleDate.toISOString()}`);
          }

          // Add timeline entry about the delay
          await supabase.from('lead_timeline').insert({
            lead_id: lead.id,
            action: 'follow_up_delayed',
            metadata: {
              reason: 'Lead requested delay',
              delay_until: insights.delay_until,
              new_date: newScheduleDate.toISOString(),
            },
          });
        }
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
