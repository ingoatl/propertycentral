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

    console.log("Processing scheduled follow-ups...");

    // Get all pending follow-ups that are due
    const { data: pendingFollowUps, error: fetchError } = await supabase
      .from("lead_follow_up_schedules")
      .select(`
        *,
        leads!inner(*),
        lead_follow_up_sequences(*),
        lead_follow_up_steps(*)
      `)
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching pending follow-ups:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingFollowUps?.length || 0} pending follow-ups to process`);

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const followUp of pendingFollowUps || []) {
      try {
        const lead = followUp.leads;
        const step = followUp.lead_follow_up_steps;
        const sequence = followUp.lead_follow_up_sequences;

        // Check if lead has responded (should skip remaining follow-ups)
        if (sequence?.stop_on_response && lead.last_response_at) {
          const responseDate = new Date(lead.last_response_at);
          const scheduleDate = new Date(followUp.created_at);
          
          if (responseDate > scheduleDate) {
            console.log(`Skipping follow-up for lead ${lead.id} - response received`);
            await supabase
              .from("lead_follow_up_schedules")
              .update({ status: "skipped", updated_at: new Date().toISOString() })
              .eq("id", followUp.id);
            skipped++;
            continue;
          }
        }

        // Check if follow-ups are paused for this lead
        if (lead.follow_up_paused) {
          console.log(`Skipping follow-up for lead ${lead.id} - paused`);
          skipped++;
          continue;
        }

        // Process template variables
        const processTemplate = (template: string) => {
          return template
            .replace(/\{\{name\}\}/g, lead.name || "")
            .replace(/\{\{email\}\}/g, lead.email || "")
            .replace(/\{\{phone\}\}/g, lead.phone || "")
            .replace(/\{\{property_address\}\}/g, lead.property_address || "")
            .replace(/\{\{opportunity_value\}\}/g, lead.opportunity_value?.toString() || "0")
            .replace(/\{\{ach_link\}\}/g, `https://peachhaus.co/payment-setup`)
            .replace(/\{\{onboarding_link\}\}/g, `https://peachhaus.co/onboard/existing-str`);
        };

        const messageBody = step ? processTemplate(step.template_content) : "";
        const actionType = step?.action_type || "sms";

        let sendSuccess = false;

        // Send SMS if applicable
        if ((actionType === "sms" || actionType === "both") && lead.phone) {
          const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
          const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
          const twilioPhone = Deno.env.get("TWILIO_VENDOR_PHONE_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");

          if (twilioAccountSid && twilioAuthToken && twilioPhone) {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
            
            const formData = new URLSearchParams();
            formData.append("To", lead.phone);
            formData.append("From", twilioPhone);
            formData.append("Body", messageBody);
            formData.append("StatusCallback", `${supabaseUrl}/functions/v1/twilio-status-callback`);

            const twilioResponse = await fetch(twilioUrl, {
              method: "POST",
              headers: {
                "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: formData.toString(),
            });

            const twilioResult = await twilioResponse.json();
            
            // Record communication
            await supabase.from("lead_communications").insert({
              lead_id: lead.id,
              communication_type: "sms",
              direction: "outbound",
              body: messageBody,
              status: twilioResponse.ok ? "sent" : "failed",
              external_id: twilioResult.sid,
              error_message: twilioResult.error_message,
              sequence_id: sequence?.id,
              step_number: step?.step_number,
              delivery_status: twilioResponse.ok ? "sent" : "failed",
            });

            sendSuccess = twilioResponse.ok;
            console.log(`SMS ${twilioResponse.ok ? "sent" : "failed"} for lead ${lead.id}`);
          }
        }

        // Send email if applicable
        if ((actionType === "email" || actionType === "both") && lead.email) {
          const resendApiKey = Deno.env.get("RESEND_API_KEY");
          
          if (resendApiKey) {
            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "PeachHaus <hello@peachhaus.co>",
                to: [lead.email],
                subject: step?.template_subject || "Message from PeachHaus",
                text: messageBody,
              }),
            });

            const emailResult = await emailResponse.json();

            // Record communication
            await supabase.from("lead_communications").insert({
              lead_id: lead.id,
              communication_type: "email",
              direction: "outbound",
              subject: step?.template_subject,
              body: messageBody,
              status: emailResponse.ok ? "sent" : "failed",
              external_id: emailResult.id,
              error_message: emailResult.message,
              sequence_id: sequence?.id,
              step_number: step?.step_number,
              delivery_status: emailResponse.ok ? "sent" : "failed",
            });

            sendSuccess = sendSuccess || emailResponse.ok;
            console.log(`Email ${emailResponse.ok ? "sent" : "failed"} for lead ${lead.id}`);
          }
        }

        // Update follow-up status
        await supabase
          .from("lead_follow_up_schedules")
          .update({
            status: sendSuccess ? "sent" : "failed",
            sent_at: sendSuccess ? new Date().toISOString() : null,
            attempt_count: followUp.attempt_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", followUp.id);

        // Update lead's last contacted time
        if (sendSuccess) {
          await supabase
            .from("leads")
            .update({ last_contacted_at: new Date().toISOString() })
            .eq("id", lead.id);

          // Add timeline entry
          await supabase.from("lead_timeline").insert({
            lead_id: lead.id,
            action: `Automated follow-up sent (Step ${step?.step_number} of ${sequence?.name || 'sequence'})`,
            metadata: { 
              sequence_id: sequence?.id, 
              step_number: step?.step_number,
              action_type: actionType 
            },
          });

          processed++;
        } else {
          failed++;
        }

      } catch (err) {
        console.error(`Error processing follow-up ${followUp.id}:`, err);
        
        // Mark as failed
        await supabase
          .from("lead_follow_up_schedules")
          .update({
            status: "failed",
            error_message: err instanceof Error ? err.message : "Unknown error",
            attempt_count: followUp.attempt_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", followUp.id);
        
        failed++;
      }
    }

    console.log(`Follow-up processing complete: ${processed} sent, ${skipped} skipped, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed, 
        skipped, 
        failed,
        total: pendingFollowUps?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error processing scheduled follow-ups:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
