import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lead stages for reference
type LeadStage = 'new_lead' | 'unreached' | 'call_scheduled' | 'call_attended' | 'send_contract' | 
  'contract_out' | 'contract_signed' | 'ach_form_signed' | 'onboarding' | 'insurance_requested' | 'ops_handoff';

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

// Determine if we should auto-advance to call_attended
function shouldAdvanceToCallAttended(insights: any, callDuration: number): { shouldAdvance: boolean; reason: string } {
  // Must have meaningful call duration (> 3 minutes)
  if (callDuration < 180) {
    return { shouldAdvance: false, reason: 'Call duration under 3 minutes' };
  }
  
  // Check for positive engagement signals
  if (insights?.interest_level === 'high' || insights?.interest_level === 'medium') {
    if (insights?.sentiment === 'positive' || insights?.sentiment === 'neutral') {
      return { 
        shouldAdvance: true, 
        reason: `${insights.interest_level} interest with ${insights.sentiment} sentiment, ${Math.floor(callDuration/60)}min call` 
      };
    }
  }
  
  // Check for SPIN selling signals
  if (insights?.buying_signals && insights.buying_signals.length > 0) {
    return { 
      shouldAdvance: true, 
      reason: `Detected buying signals: ${insights.buying_signals.slice(0, 2).join(', ')}` 
    };
  }
  
  // Check for agreed next steps
  if (insights?.next_steps && insights.next_steps.toLowerCase().includes('contract')) {
    return { 
      shouldAdvance: true, 
      reason: 'Next steps include contract discussion' 
    };
  }
  
  return { shouldAdvance: false, reason: 'No advancement criteria met' };
}

// Determine recommended stage based on call analysis
function getRecommendedStage(insights: any, currentStage: string, callDuration: number): LeadStage | null {
  // If lead requested to stop contact
  if (insights?.pause_follow_ups === true || insights?.interest_level === 'none') {
    return null; // Don't change stage, just pause
  }
  
  // If delay was requested, stay in current stage
  if (insights?.delay_requested === true) {
    return null;
  }
  
  // Determine if call was successful/attended
  const { shouldAdvance } = shouldAdvanceToCallAttended(insights, callDuration);
  
  if (shouldAdvance && ['new_lead', 'unreached', 'call_scheduled'].includes(currentStage)) {
    return 'call_attended';
  }
  
  // If contract was discussed and ready to send
  if (insights?.next_steps?.toLowerCase().includes('send contract') || 
      insights?.recommended_stage === 'send_contract') {
    if (currentStage === 'call_attended') {
      return 'send_contract';
    }
  }
  
  return null;
}

// Retry helper for transient failures
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Attempt ${i + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
  throw lastError;
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all phone variants to search
    const phoneVariants = [...normalizePhone(fromNumber), ...normalizePhone(toNumber)];
    console.log('Searching for lead with phone variants:', phoneVariants);

    // Try to find lead by phone number first
    let lead = null;
    if (phoneVariants.length > 0) {
      // Build a more comprehensive phone search
      const phoneConditions = phoneVariants.map(p => `phone.ilike.%${p.slice(-10)}%`).join(',');
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

    // Download the recording from Twilio (with authentication and retry)
    let audioBlob: Blob;
    try {
      audioBlob = await withRetry(async () => {
        const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
        const recordingResponse = await fetch(recordingUrl, {
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
          },
        });

        if (!recordingResponse.ok) {
          throw new Error(`Failed to download recording: ${recordingResponse.status}`);
        }

        return await recordingResponse.blob();
      }, 3, 2000);
      
      console.log('Downloaded recording:', audioBlob.size, 'bytes');
    } catch (downloadError) {
      console.error('Error downloading recording after retries:', downloadError);
      
      // Log the failed transcription attempt
      if (lead) {
        await supabase.from('lead_timeline').insert({
          lead_id: lead.id,
          action: 'transcription_failed',
          metadata: {
            call_sid: callSid,
            error: downloadError instanceof Error ? downloadError.message : 'Download failed',
            recording_url: recordingUrl,
          },
        });
      }
      throw downloadError;
    }

    // Transcribe using OpenAI Whisper with retry
    let transcriptText = '';
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.mp3');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');

      const transcriptionResult = await withRetry(async () => {
        const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: formData,
        });

        if (!transcriptionResponse.ok) {
          const errorText = await transcriptionResponse.text();
          throw new Error(`Transcription failed: ${errorText}`);
        }

        return await transcriptionResponse.json();
      }, 3, 2000);

      transcriptText = transcriptionResult.text;
      console.log('Transcription complete:', transcriptText?.substring(0, 200));
    } catch (transcriptionError) {
      console.error('Transcription failed after retries:', transcriptionError);
      
      // Still create a communication record with the error
      if (lead) {
        await supabase.from('lead_communications').upsert({
          lead_id: lead.id,
          communication_type: 'call',
          direction: 'outbound',
          body: `[Transcription failed: ${transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error'}]`,
          external_id: callSid,
          status: 'transcription_failed',
          sent_at: new Date().toISOString(),
        }, { onConflict: 'external_id' });

        await supabase.from('lead_timeline').insert({
          lead_id: lead.id,
          action: 'transcription_failed',
          metadata: {
            call_sid: callSid,
            error: transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error',
            duration: duration,
          },
        });
      }
      
      throw transcriptionError;
    }

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

    // Enhanced AI analysis with SPIN selling and psychology-driven insights
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
                content: `You are an expert sales analyst analyzing a phone call transcript between a property management company (Peachhaus) and a potential lead interested in their short-term rental management services.

Your goal is to extract key insights using SPIN Selling methodology and psychological sales principles.

Return a JSON object with these fields:

BASIC INFO:
- caller_name: name of the caller if mentioned (first and last if available)
- property_address: any property address mentioned in the call
- property_details: any details mentioned about their property (bedrooms, type, location, etc.)
- budget_expectations: any pricing or fee discussions

INTEREST & ENGAGEMENT:
- interest_level: "high", "medium", "low", or "none" - based on engagement signals
- sentiment: "positive", "neutral", or "negative"
- engagement_score: 1-10 rating of how engaged the prospect was

SPIN SELLING ANALYSIS:
- situation_discussed: What is their current property management situation?
- problems_identified: array of pain points or problems they mentioned
- implications: What are the consequences of their problems (financial, time, stress)?
- needs_payoff: What benefits got them excited? What value proposition resonated?

NEGOTIATION SIGNALS (Never Split the Difference style):
- buying_signals: array of statements indicating interest/readiness
- objections: array of specific concerns or pushback
- thats_right_moments: key agreements or "that's exactly it" moments
- mirroring_opportunities: key phrases they used that we should mirror back

FOLLOW-UP GUIDANCE:
- concerns: array of any concerns or objections mentioned
- timeline: when they're looking to start (if mentioned)
- delay_requested: boolean - true if they ask to wait or need more time
- delay_until: if delay_requested, specify when to follow up
- next_steps: what was agreed upon for follow-up
- recommended_action: "send_contract", "schedule_follow_up", "send_info", "disqualify", or "continue_nurture"
- key_points: array of 2-5 bullet points summarizing the conversation

AUTOMATION FLAGS:
- pause_follow_ups: boolean - true if lead explicitly asked to stop contact
- call_was_successful: boolean - true if meaningful conversation happened (>3min, discussed property, showed interest)
- ready_for_contract: boolean - true if they expressed readiness to move forward
- needs_more_info: boolean - true if they need additional information before deciding

Always provide at least: caller_name (if mentioned), interest_level, sentiment, key_points, call_was_successful, and recommended_action.`
              },
              {
                role: 'user',
                content: `Analyze this call transcript (${callDuration} seconds):\n\n${transcriptText}`
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

    // Track stage changes for response
    let stageChanged = false;
    let newStage: LeadStage | null = null;
    let stageChangeReason = '';

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

        // AI next action from the analysis
        if (insights.recommended_action) {
          updateData.ai_next_action = insights.recommended_action;
        }

        // Handle follow-up pausing if requested
        if (insights.pause_follow_ups === true) {
          updateData.follow_up_paused = true;
          console.log('Pausing follow-ups as requested by lead');
        }

        // === AUTO STAGE ADVANCEMENT ===
        // Determine if we should auto-advance the stage
        const recommendedStage = getRecommendedStage(insights, lead.stage, callDuration);
        const { shouldAdvance, reason } = shouldAdvanceToCallAttended(insights, callDuration);
        
        if (recommendedStage && recommendedStage !== lead.stage) {
          updateData.stage = recommendedStage;
          updateData.stage_changed_at = new Date().toISOString();
          updateData.last_stage_auto_update_at = new Date().toISOString();
          updateData.auto_stage_reason = reason;
          
          stageChanged = true;
          newStage = recommendedStage;
          stageChangeReason = reason;
          
          console.log(`Auto-advancing lead from ${lead.stage} to ${recommendedStage}: ${reason}`);
        }

        await supabase
          .from('leads')
          .update(updateData)
          .eq('id', lead.id);

        // === TRIGGER STAGE CHANGE AUTOMATION ===
        if (stageChanged && newStage) {
          // Log the event
          await supabase.from('lead_event_log').insert({
            lead_id: lead.id,
            event_type: 'stage_auto_changed',
            event_source: 'transcribe-call',
            event_data: {
              previous_stage: lead.stage,
              new_stage: newStage,
              reason: stageChangeReason,
              call_duration: callDuration,
              interest_level: insights.interest_level,
              call_was_successful: insights.call_was_successful,
            },
            processed: false,
            stage_changed_to: newStage,
          });

          // Trigger the stage change automations
          try {
            console.log(`Triggering process-lead-stage-change for ${lead.id}: ${lead.stage} -> ${newStage}`);
            await fetch(`${supabaseUrl}/functions/v1/process-lead-stage-change`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                leadId: lead.id,
                newStage: newStage,
                previousStage: lead.stage,
              }),
            });
            
            // Add timeline entry for auto-stage change
            await supabase.from('lead_timeline').insert({
              lead_id: lead.id,
              action: 'stage_auto_changed',
              metadata: {
                previous_stage: lead.stage,
                new_stage: newStage,
                reason: stageChangeReason,
                triggered_by: 'transcribe-call',
              },
            });
          } catch (stageChangeError) {
            console.error('Error triggering stage change automation:', stageChangeError);
          }
        }

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
      // No lead matched - create an unmatched call record for later manual review
      console.log('No matching lead found for call. Creating orphan record.');
      
      // Store in user_phone_messages for tracking
      await supabase.from('user_phone_messages').insert({
        direction: 'inbound',
        from_number: fromNumber,
        to_number: toNumber,
        body: transcriptText || `Call recording - ${duration}s`,
        status: 'unmatched',
        external_id: callSid,
      });
      
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
        stageChanged: stageChanged,
        newStage: newStage,
        stageChangeReason: stageChangeReason,
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
