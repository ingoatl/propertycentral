import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Check if current time is within allowed sending window (11am-5pm EST)
function isWithinSendingWindow(): { allowed: boolean; currentHourEST: number; message: string } {
  // Get current time in EST/EDT
  const now = new Date();
  const estFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
  });
  
  const currentHourEST = parseInt(estFormatter.format(now), 10);
  
  // Allowed window: 11am (11) to 5pm (17) EST
  const START_HOUR = 11;
  const END_HOUR = 17;
  
  const allowed = currentHourEST >= START_HOUR && currentHourEST < END_HOUR;
  
  const message = allowed 
    ? `Within sending window (${currentHourEST}:00 EST, allowed ${START_HOUR}:00-${END_HOUR}:00)`
    : `Outside sending window (${currentHourEST}:00 EST, allowed ${START_HOUR}:00-${END_HOUR}:00 EST)`;
  
  return { allowed, currentHourEST, message };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];
    console.log(`=== HOLIDAY EMAIL SCHEDULER - ${today} ===`);

    // Check if we're within the sending window (11am-5pm EST)
    const { allowed, currentHourEST, message: windowMessage } = isWithinSendingWindow();
    console.log(windowMessage);
    
    if (!allowed) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Skipping: ${windowMessage}. Will retry later.`,
          sent: 0,
          currentHourEST,
          windowStart: 11,
          windowEnd: 17
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all pending emails scheduled for today from the queue
    const { data: pendingEmails, error: queueError } = await supabase
      .from('holiday_email_queue')
      .select(`
        id,
        owner_id,
        property_id,
        template_id,
        recipient_email,
        recipient_name,
        scheduled_date,
        holiday_email_templates(id, holiday_name, subject_template, message_template, emoji, image_prompt_template)
      `)
      .eq('scheduled_date', today)
      .eq('status', 'pending');

    if (queueError) {
      throw new Error(`Failed to fetch queue: ${queueError.message}`);
    }

    console.log(`Found ${pendingEmails?.length || 0} emails to send today`);

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No emails scheduled for today', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group by template to batch process
    const templateGroups = new Map<string, typeof pendingEmails>();
    for (const email of pendingEmails) {
      const templateId = email.template_id;
      if (!templateGroups.has(templateId)) {
        templateGroups.set(templateId, []);
      }
      templateGroups.get(templateId)!.push(email);
    }

    const results: { sent: number; failed: number; errors: string[] } = { sent: 0, failed: 0, errors: [] };

    // Process each template group
    for (const [templateId, emails] of templateGroups) {
      const templateData = emails[0].holiday_email_templates as any;
      if (!templateData) {
        console.error(`Template not found for ${templateId}`);
        continue;
      }

      console.log(`Processing ${emails.length} emails for ${templateData.holiday_name}`);

      // Call send-holiday-email for this batch
      for (const queueItem of emails) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/send-holiday-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              holidayTemplateId: templateId,
              ownerIds: [queueItem.owner_id],
            }),
          });

          if (response.ok) {
            // Mark as sent in queue
            await supabase
              .from('holiday_email_queue')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('id', queueItem.id);
            
            results.sent++;
            console.log(`✓ Sent to ${queueItem.recipient_email}`);
          } else {
            const errorText = await response.text();
            await supabase
              .from('holiday_email_queue')
              .update({ status: 'failed', error_message: errorText })
              .eq('id', queueItem.id);
            
            results.failed++;
            results.errors.push(`${queueItem.recipient_email}: ${errorText}`);
            console.error(`✗ Failed for ${queueItem.recipient_email}: ${errorText}`);
          }

          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await supabase
            .from('holiday_email_queue')
            .update({ status: 'failed', error_message: errorMsg })
            .eq('id', queueItem.id);
          
          results.failed++;
          results.errors.push(`${queueItem.recipient_email}: ${errorMsg}`);
        }
      }
    }

    console.log(`=== COMPLETE: ${results.sent} sent, ${results.failed} failed ===`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${results.sent} emails, ${results.failed} failed`,
        currentHourEST,
        ...results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scheduler error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
