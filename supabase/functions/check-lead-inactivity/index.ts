import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Inactivity thresholds by stage (in hours)
const INACTIVITY_THRESHOLDS: Record<string, { hours: number; action: 'move_to_unreached' | 'escalate' | 'reminder' }> = {
  'new_lead': { hours: 48, action: 'move_to_unreached' },
  'unreached': { hours: 168, action: 'escalate' }, // 7 days
  'call_scheduled': { hours: 24, action: 'reminder' }, // Check if call was missed
  'call_attended': { hours: 72, action: 'reminder' }, // 3 days to send contract
  'send_contract': { hours: 48, action: 'reminder' },
  'contract_out': { hours: 168, action: 'escalate' }, // 7 days without signature
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting lead inactivity check...');

    const now = new Date();
    let movedToUnreached = 0;
    let escalated = 0;
    let reminders = 0;

    // Get all active leads that aren't in final stages
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, name, email, phone, stage, stage_changed_at, last_contacted_at, last_response_at, follow_up_paused, assigned_to')
      .not('stage', 'in', '(ops_handoff,contract_signed,ach_form_signed,onboarding,insurance_requested)')
      .eq('follow_up_paused', false)
      .order('stage_changed_at', { ascending: true });

    if (leadsError) {
      throw leadsError;
    }

    console.log(`Checking ${leads?.length || 0} active leads for inactivity`);

    for (const lead of leads || []) {
      const threshold = INACTIVITY_THRESHOLDS[lead.stage];
      if (!threshold) continue;

      // Calculate hours since last activity
      const lastActivity = new Date(lead.last_contacted_at || lead.stage_changed_at || now);
      const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);

      if (hoursSinceActivity < threshold.hours) continue;

      console.log(`Lead ${lead.name} (${lead.stage}) inactive for ${Math.round(hoursSinceActivity)} hours`);

      switch (threshold.action) {
        case 'move_to_unreached':
          // Move lead to unreached stage
          await supabase
            .from('leads')
            .update({
              stage: 'unreached',
              stage_changed_at: now.toISOString(),
              last_stage_auto_update_at: now.toISOString(),
              auto_stage_reason: `No response for ${Math.round(hoursSinceActivity)} hours`,
            })
            .eq('id', lead.id);

          // Log the event
          await supabase.from('lead_event_log').insert({
            lead_id: lead.id,
            event_type: 'stage_auto_changed',
            event_source: 'check-lead-inactivity',
            event_data: {
              previous_stage: lead.stage,
              new_stage: 'unreached',
              reason: `Inactive for ${Math.round(hoursSinceActivity)} hours`,
              threshold_hours: threshold.hours,
            },
            processed: true,
            stage_changed_to: 'unreached',
          });

          // Add timeline entry
          await supabase.from('lead_timeline').insert({
            lead_id: lead.id,
            action: 'stage_auto_changed',
            metadata: {
              previous_stage: lead.stage,
              new_stage: 'unreached',
              reason: 'Inactivity threshold exceeded',
              hours_inactive: Math.round(hoursSinceActivity),
              triggered_by: 'check-lead-inactivity',
            },
          });

          // Trigger stage change automations
          try {
            await fetch(`${supabaseUrl}/functions/v1/process-lead-stage-change`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                leadId: lead.id,
                newStage: 'unreached',
                previousStage: lead.stage,
              }),
            });
          } catch (e) {
            console.error('Error triggering stage change:', e);
          }

          movedToUnreached++;
          break;

        case 'escalate':
          // Create an escalation notice for human review
          await supabase.from('lead_event_log').insert({
            lead_id: lead.id,
            event_type: 'escalation_required',
            event_source: 'check-lead-inactivity',
            event_data: {
              stage: lead.stage,
              hours_inactive: Math.round(hoursSinceActivity),
              threshold_hours: threshold.hours,
              assigned_to: lead.assigned_to,
              reason: `Lead stuck in ${lead.stage} for ${Math.round(hoursSinceActivity)} hours`,
            },
            processed: false,
          });

          // Add timeline entry
          await supabase.from('lead_timeline').insert({
            lead_id: lead.id,
            action: 'escalation_flagged',
            metadata: {
              stage: lead.stage,
              hours_inactive: Math.round(hoursSinceActivity),
              reason: 'Requires human review',
            },
          });

          // Update AI next action
          await supabase
            .from('leads')
            .update({
              ai_next_action: `ESCALATION: Stuck in ${lead.stage} for ${Math.round(hoursSinceActivity/24)} days - needs attention`,
            })
            .eq('id', lead.id);

          escalated++;
          break;

        case 'reminder':
          // For stages where we just need a reminder (call_scheduled, etc.)
          // Check if we already sent a reminder recently
          const { data: recentReminder } = await supabase
            .from('lead_event_log')
            .select('id')
            .eq('lead_id', lead.id)
            .eq('event_type', 'inactivity_reminder')
            .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
            .maybeSingle();

          if (!recentReminder) {
            // Log reminder event
            await supabase.from('lead_event_log').insert({
              lead_id: lead.id,
              event_type: 'inactivity_reminder',
              event_source: 'check-lead-inactivity',
              event_data: {
                stage: lead.stage,
                hours_inactive: Math.round(hoursSinceActivity),
                message: `Lead needs follow-up action for ${lead.stage}`,
              },
              processed: true,
            });

            // Update AI next action with reminder
            const actionMessages: Record<string, string> = {
              'call_scheduled': 'Follow up on scheduled call - may have been missed',
              'call_attended': 'Send contract to lead',
              'send_contract': 'Contract needs to be sent to lead',
            };

            await supabase
              .from('leads')
              .update({
                ai_next_action: actionMessages[lead.stage] || `Follow up needed for ${lead.stage}`,
              })
              .eq('id', lead.id);

            reminders++;
          }
          break;
      }
    }

    // Also check for missed scheduled calls
    const { data: scheduledCalls, error: callsError } = await supabase
      .from('discovery_calls')
      .select('id, lead_id, scheduled_at, status')
      .eq('status', 'scheduled')
      .lt('scheduled_at', now.toISOString());

    if (!callsError && scheduledCalls) {
      for (const call of scheduledCalls) {
        // Check if more than 2 hours past scheduled time
        const scheduledTime = new Date(call.scheduled_at);
        const hoursPast = (now.getTime() - scheduledTime.getTime()) / (1000 * 60 * 60);

        if (hoursPast > 2) {
          // Mark as missed
          await supabase
            .from('discovery_calls')
            .update({ status: 'missed' })
            .eq('id', call.id);

          if (call.lead_id) {
            // Add timeline entry
            await supabase.from('lead_timeline').insert({
              lead_id: call.lead_id,
              action: 'call_missed',
              metadata: {
                discovery_call_id: call.id,
                scheduled_at: call.scheduled_at,
                hours_past: Math.round(hoursPast),
              },
            });

            // Log the event
            await supabase.from('lead_event_log').insert({
              lead_id: call.lead_id,
              event_type: 'call_missed',
              event_source: 'check-lead-inactivity',
              event_data: {
                discovery_call_id: call.id,
                scheduled_at: call.scheduled_at,
              },
              processed: true,
            });
          }

          console.log(`Marked discovery call ${call.id} as missed`);
        }
      }
    }

    const summary = {
      success: true,
      leadsChecked: leads?.length || 0,
      movedToUnreached,
      escalated,
      reminders,
      timestamp: now.toISOString(),
    };

    console.log('Inactivity check complete:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in check-lead-inactivity:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
