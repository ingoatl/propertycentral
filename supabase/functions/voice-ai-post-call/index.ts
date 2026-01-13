import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface PostCallRequest {
  callSid: string;
  callerPhone: string;
  callerName: string | null;
  callerStage: string | null;
  propertyAddress: string | null;
  transcript?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { callSid, callerPhone, callerName, callerStage, propertyAddress, transcript }: PostCallRequest = await req.json();
    
    console.log("Post-call processing started:", { callSid, callerPhone, callerName });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Normalize phone for lookup
    let normalizedPhone = callerPhone;
    if (normalizedPhone?.startsWith('+1')) {
      normalizedPhone = normalizedPhone.substring(2);
    } else if (normalizedPhone?.startsWith('+')) {
      normalizedPhone = normalizedPhone.substring(1);
    }

    // Look up the lead
    const { data: lead } = await supabase
      .from('leads')
      .select('id, name, email, phone, stage, property_address')
      .or(`phone.eq.${callerPhone},phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone},phone.ilike.%${normalizedPhone}%`)
      .maybeSingle();

    // Get the communication record for this call
    const { data: communication } = await supabase
      .from('lead_communications')
      .select('id, body, metadata')
      .eq('external_id', callSid)
      .maybeSingle();

    // Try to get transcript from communication metadata or passed in
    let callTranscript = transcript;
    if (!callTranscript && communication?.metadata) {
      const metadata = communication.metadata as Record<string, unknown>;
      callTranscript = metadata.transcript as string || metadata.ghl_transcript as string;
    }

    // If we have a transcript, analyze it with AI
    if (callTranscript && LOVABLE_API_KEY) {
      console.log("Analyzing call transcript with AI...");
      
      const analysisPrompt = `Analyze this phone call transcript and extract actionable items.

CALLER: ${callerName || 'Unknown'}
CALLER STAGE: ${callerStage || 'Unknown'}
PROPERTY: ${propertyAddress || 'Not specified'}

TRANSCRIPT:
${callTranscript}

Extract the following in JSON format:
{
  "summary": "Brief 2-3 sentence summary of the call",
  "caller_sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "topics_discussed": ["array of main topics"],
  "action_items": [
    {
      "title": "Task title",
      "description": "Brief description",
      "priority": "high" | "medium" | "low",
      "due_in_days": number (0-7),
      "assigned_to": "team" | "ai" | null
    }
  ],
  "follow_up_needed": boolean,
  "follow_up_reason": "Why follow-up is needed (if any)",
  "should_schedule_call": boolean,
  "key_quotes": ["Notable quotes from the caller"],
  "objections_raised": ["Any concerns or objections mentioned"],
  "next_stage_recommendation": "suggested lead stage" | null
}

Focus on extracting concrete action items that should be followed up on.`;

      try {
        const aiResponse = await fetch('https://api.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',
            messages: [
              { role: 'system', content: 'You are an expert at analyzing sales and customer service calls. Extract actionable insights.' },
              { role: 'user', content: analysisPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
          }),
        });

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          const analysisText = aiResult.choices?.[0]?.message?.content;
          
          if (analysisText) {
            const analysis = JSON.parse(analysisText);
            console.log("AI Analysis result:", analysis);

            // Create action items as pending task confirmations
            if (analysis.action_items?.length > 0 && lead?.id) {
              for (const item of analysis.action_items) {
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + (item.due_in_days || 1));

                await supabase.from('pending_task_confirmations').insert({
                  lead_id: lead.id,
                  communication_id: communication?.id,
                  task_title: item.title,
                  task_description: item.description,
                  suggested_due_date: dueDate.toISOString().split('T')[0],
                  priority: item.priority || 'medium',
                  source: 'voice_ai_call',
                  status: 'pending',
                  metadata: {
                    call_sid: callSid,
                    caller_sentiment: analysis.caller_sentiment,
                    assigned_to: item.assigned_to,
                  },
                });
              }

              console.log(`Created ${analysis.action_items.length} pending task confirmations`);
            }

            // Update communication with analysis
            if (communication?.id) {
              const existingMetadata = (communication.metadata || {}) as Record<string, unknown>;
              await supabase
                .from('lead_communications')
                .update({
                  metadata: {
                    ...existingMetadata,
                    ai_analysis: {
                      summary: analysis.summary,
                      sentiment: analysis.caller_sentiment,
                      topics: analysis.topics_discussed,
                      action_items_count: analysis.action_items?.length || 0,
                      follow_up_needed: analysis.follow_up_needed,
                      key_quotes: analysis.key_quotes,
                      analyzed_at: new Date().toISOString(),
                    },
                  },
                })
                .eq('id', communication.id);
            }

            // Add timeline entry
            if (lead?.id) {
              await supabase.from('lead_timeline').insert({
                lead_id: lead.id,
                action: 'voice_ai_call_analyzed',
                details: analysis.summary,
                metadata: {
                  call_sid: callSid,
                  sentiment: analysis.caller_sentiment,
                  action_items_created: analysis.action_items?.length || 0,
                  topics: analysis.topics_discussed,
                },
              });

              // Update lead stage if recommended
              if (analysis.next_stage_recommendation && lead.stage !== analysis.next_stage_recommendation) {
                console.log(`Recommending stage change: ${lead.stage} -> ${analysis.next_stage_recommendation}`);
                // Don't auto-change stage, just log the recommendation
                await supabase.from('lead_timeline').insert({
                  lead_id: lead.id,
                  action: 'ai_stage_recommendation',
                  details: `AI recommends moving lead from ${lead.stage} to ${analysis.next_stage_recommendation}`,
                  metadata: {
                    current_stage: lead.stage,
                    recommended_stage: analysis.next_stage_recommendation,
                    reason: analysis.follow_up_reason,
                  },
                });
              }
            }

            return new Response(JSON.stringify({
              success: true,
              analysis: {
                summary: analysis.summary,
                sentiment: analysis.caller_sentiment,
                actionItemsCreated: analysis.action_items?.length || 0,
                followUpNeeded: analysis.follow_up_needed,
              },
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (aiError) {
        console.error("AI analysis error:", aiError);
      }
    }

    // If no transcript available, create a basic follow-up task
    if (lead?.id) {
      await supabase.from('pending_task_confirmations').insert({
        lead_id: lead.id,
        communication_id: communication?.id,
        task_title: `Follow up on Voice AI call with ${callerName || 'caller'}`,
        task_description: `Review the Voice AI call and follow up as needed. Property: ${propertyAddress || 'Not specified'}`,
        suggested_due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 'medium',
        source: 'voice_ai_call',
        status: 'pending',
        metadata: { call_sid: callSid },
      });

      await supabase.from('lead_timeline').insert({
        lead_id: lead.id,
        action: 'voice_ai_call_completed',
        details: `Voice AI call completed. Follow-up task created.`,
        metadata: { call_sid: callSid },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Post-call processing completed',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Post-call processing error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
