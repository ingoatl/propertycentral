import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This cron function processes scheduled emails that are due to be sent
// It should be triggered every 5 minutes by a scheduler

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Processing scheduled emails...");

    // Find all pending scheduled emails that are due
    const { data: scheduledEmails, error: fetchError } = await supabase
      .from("lead_scheduled_emails")
      .select("*, leads(*)")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${scheduledEmails?.length || 0} scheduled emails to process`);

    const results: any[] = [];

    for (const scheduled of scheduledEmails || []) {
      try {
        console.log(`Processing scheduled email ${scheduled.id} of type ${scheduled.email_type} for lead ${scheduled.lead_id}`);

        const lead = scheduled.leads;
        if (!lead) {
          console.error(`Lead not found for scheduled email ${scheduled.id}`);
          await supabase
            .from("lead_scheduled_emails")
            .update({ status: "failed", error_message: "Lead not found" })
            .eq("id", scheduled.id);
          continue;
        }

        // Process based on email type
        if (scheduled.email_type === "payment_setup") {
          // Trigger the payment setup email by calling process-lead-stage-change
          // with the welcome_email_w9 stage
          console.log(`Sending payment setup email for lead ${lead.id}`);
          
          // First update the lead stage to welcome_email_w9
          await supabase
            .from("leads")
            .update({ 
              stage: "welcome_email_w9",
              stage_changed_at: new Date().toISOString()
            })
            .eq("id", lead.id);

          // Trigger stage change processing which will send the payment email
          const stageChangeResponse = await fetch(`${supabaseUrl}/functions/v1/process-lead-stage-change`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              leadId: lead.id,
              newStage: "welcome_email_w9",
              previousStage: "contract_signed",
              autoTriggered: true,
              triggerSource: "scheduled_email",
            }),
          });

          const stageChangeResult = await stageChangeResponse.json();
          console.log(`Stage change processing result:`, stageChangeResult);

          // Update scheduled email status
          await supabase
            .from("lead_scheduled_emails")
            .update({ 
              status: "sent", 
              sent_at: new Date().toISOString(),
              metadata: { ...scheduled.metadata, stage_change_result: stageChangeResult }
            })
            .eq("id", scheduled.id);

          // Add timeline entry
          await supabase.from("lead_timeline").insert({
            lead_id: lead.id,
            action: "Scheduled payment setup email sent (1-hour delay)",
            metadata: { 
              scheduled_email_id: scheduled.id,
              email_type: scheduled.email_type,
              scheduled_for: scheduled.scheduled_for,
            },
          });

          results.push({ id: scheduled.id, status: "sent", lead_id: lead.id });
        } else {
          console.log(`Unknown email type: ${scheduled.email_type}`);
          await supabase
            .from("lead_scheduled_emails")
            .update({ status: "failed", error_message: `Unknown email type: ${scheduled.email_type}` })
            .eq("id", scheduled.id);
          results.push({ id: scheduled.id, status: "failed", reason: "Unknown email type" });
        }

      } catch (emailError: any) {
        console.error(`Error processing scheduled email ${scheduled.id}:`, emailError);
        await supabase
          .from("lead_scheduled_emails")
          .update({ 
            status: "failed", 
            error_message: emailError.message 
          })
          .eq("id", scheduled.id);
        results.push({ id: scheduled.id, status: "failed", error: emailError.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error processing scheduled emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
