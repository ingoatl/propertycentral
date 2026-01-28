import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { leadId, stage } = await req.json();
    console.log(`Scheduling follow-ups for lead ${leadId} at stage ${stage}`);

    // First, cancel any pending follow-ups for this lead (stage changed)
    const { error: cancelError } = await supabase
      .from("lead_follow_up_schedules")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("lead_id", leadId)
      .eq("status", "pending");

    if (cancelError) {
      console.error("Error cancelling pending follow-ups:", cancelError);
    }

    // Find active sequences for this stage
    const { data: sequences, error: seqError } = await supabase
      .from("lead_follow_up_sequences")
      .select(`
        *,
        lead_follow_up_steps(*)
      `)
      .eq("trigger_stage", stage)
      .eq("is_active", true);

    if (seqError) {
      console.error("Error fetching sequences:", seqError);
      throw seqError;
    }

    if (!sequences || sequences.length === 0) {
      console.log(`No active sequences found for stage ${stage}`);
      return new Response(
        JSON.stringify({ success: true, scheduled: 0, message: "No sequences for this stage" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For call_scheduled stage, fetch the discovery call time for relative scheduling
    let callScheduledAt: Date | null = null;
    let discoveryCallData: { meeting_type: string; google_meet_link: string | null } | null = null;
    
    if (stage === 'call_scheduled') {
      const { data: discoveryCall } = await supabase
        .from("discovery_calls")
        .select("scheduled_at, meeting_type, google_meet_link")
        .eq("lead_id", leadId)
        .eq("status", "scheduled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (discoveryCall?.scheduled_at) {
        callScheduledAt = new Date(discoveryCall.scheduled_at);
        discoveryCallData = {
          meeting_type: discoveryCall.meeting_type,
          google_meet_link: discoveryCall.google_meet_link
        };
        console.log(`Discovery call scheduled for ${callScheduledAt.toISOString()}, type: ${discoveryCall.meeting_type}`);
      }
    }

    let scheduledCount = 0;
    const now = new Date();

    for (const sequence of sequences) {
      const steps = sequence.lead_follow_up_steps || [];
      
      // Sort steps by step_number
      steps.sort((a: { step_number: number }, b: { step_number: number }) => a.step_number - b.step_number);

      // Update lead with active sequence
      await supabase
        .from("leads")
        .update({ active_sequence_id: sequence.id })
        .eq("id", leadId);

      for (const step of steps) {
        let scheduledFor: Date;
        
        // For call_scheduled stage, calculate timing relative to call time (before the call)
        if (stage === 'call_scheduled' && callScheduledAt) {
          scheduledFor = new Date(callScheduledAt);
          
          // Pre-call timing based on step number:
          // Step 1: 48h before call (email with Onboarding Presentation)
          // Step 2: 24h before call (SMS with Owner Portal teaser)
          // Step 3: 2h before call (SMS final reminder)
          switch (step.step_number) {
            case 1:
              scheduledFor.setHours(scheduledFor.getHours() - 48);
              break;
            case 2:
              scheduledFor.setHours(scheduledFor.getHours() - 24);
              break;
            case 3:
              scheduledFor.setHours(scheduledFor.getHours() - 2);
              break;
            default:
              // Fallback: use delay_days/delay_hours before call
              scheduledFor.setDate(scheduledFor.getDate() - (step.delay_days || 0));
              scheduledFor.setHours(scheduledFor.getHours() - (step.delay_hours || 0));
          }
          
          // Don't schedule if the time has already passed
          if (scheduledFor < now) {
            console.log(`Skipping step ${step.step_number} - scheduled time ${scheduledFor.toISOString()} already passed`);
            continue;
          }
          
          console.log(`Scheduling pre-call step ${step.step_number} for ${scheduledFor.toISOString()} (${step.step_number === 1 ? '48h' : step.step_number === 2 ? '24h' : '2h'} before call)`);
        } else {
          // Standard scheduling: relative to now (for post-call follow-ups, etc.)
          scheduledFor = new Date(now);
          scheduledFor.setDate(scheduledFor.getDate() + (step.delay_days || 0));
          scheduledFor.setHours(scheduledFor.getHours() + (step.delay_hours || 0));
          
          // Set to preferred send time if specified (doesn't apply to 2h before call)
          if (step.send_time && step.step_number !== 3) {
            const [hours, minutes] = step.send_time.split(':').map(Number);
            scheduledFor.setHours(hours, minutes, 0, 0);
          }

          // Adjust for send_days (avoid weekends if configured)
          const sendDays = step.send_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
          
          let daysToAdd = 0;
          const getDayName = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          while (!sendDays.includes(getDayName(scheduledFor)) && daysToAdd < 7) {
            scheduledFor.setDate(scheduledFor.getDate() + 1);
            daysToAdd++;
          }
        }

        // Create the scheduled follow-up
        const { error: insertError } = await supabase
          .from("lead_follow_up_schedules")
          .insert({
            lead_id: leadId,
            sequence_id: sequence.id,
            step_id: step.id,
            step_number: step.step_number,
            scheduled_for: scheduledFor.toISOString(),
            status: "pending",
          });

        if (insertError) {
          console.error(`Error scheduling step ${step.step_number}:`, insertError);
        } else {
          scheduledCount++;
          console.log(`Scheduled step ${step.step_number} for ${scheduledFor.toISOString()}`);
        }
      }

      // Add timeline entry with call type info if available
      const callTypeInfo = discoveryCallData 
        ? ` (${discoveryCallData.meeting_type === 'video' ? 'Video Call' : 'Phone Call'})`
        : '';
      
      await supabase.from("lead_timeline").insert({
        lead_id: leadId,
        action: `Follow-up sequence "${sequence.name}" started${callTypeInfo} (${scheduledCount} steps scheduled)`,
        metadata: { 
          sequence_id: sequence.id, 
          steps_scheduled: scheduledCount,
          call_type: discoveryCallData?.meeting_type,
          has_meet_link: !!discoveryCallData?.google_meet_link
        },
      });
    }

    console.log(`Scheduled ${scheduledCount} follow-ups for lead ${leadId}`);

    return new Response(
      JSON.stringify({ success: true, scheduled: scheduledCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error scheduling follow-ups:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});