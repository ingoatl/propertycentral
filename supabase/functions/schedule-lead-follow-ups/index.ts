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
        // Calculate scheduled time
        const scheduledFor = new Date(now);
        scheduledFor.setDate(scheduledFor.getDate() + (step.delay_days || 0));
        scheduledFor.setHours(scheduledFor.getHours() + (step.delay_hours || 0));
        
        // Set to preferred send time (default 11:00 AM)
        if (step.send_time) {
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

      // Add timeline entry
      await supabase.from("lead_timeline").insert({
        lead_id: leadId,
        action: `Follow-up sequence "${sequence.name}" started (${steps.length} steps scheduled)`,
        metadata: { sequence_id: sequence.id, steps_scheduled: steps.length },
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
