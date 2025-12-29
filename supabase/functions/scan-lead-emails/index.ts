import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting lead email scan...');

    // Get all active leads with email addresses
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, name, email, stage, last_response_at, follow_up_paused')
      .not('email', 'is', null)
      .not('stage', 'in', '(ops_handoff,contract_signed,ach_form_signed)')
      .order('last_contacted_at', { ascending: true });

    if (leadsError) {
      throw leadsError;
    }

    console.log(`Found ${leads?.length || 0} leads to check for email responses`);

    // Get recent email insights that might be from leads
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: recentEmails, error: emailError } = await supabase
      .from('email_insights')
      .select('id, sender_email, subject, summary, email_date, category, sentiment')
      .gte('email_date', oneDayAgo.toISOString())
      .order('email_date', { ascending: false });

    if (emailError) {
      console.error('Error fetching email insights:', emailError);
    }

    let matchedCount = 0;
    let stageChanges = 0;

    // Match emails to leads
    for (const lead of leads || []) {
      if (!lead.email) continue;

      const leadEmailLower = lead.email.toLowerCase();
      
      // Find emails from this lead
      const matchingEmails = recentEmails?.filter(e => 
        e.sender_email.toLowerCase() === leadEmailLower
      ) || [];

      if (matchingEmails.length > 0) {
        matchedCount++;
        console.log(`Found ${matchingEmails.length} emails from lead: ${lead.name} (${lead.email})`);

        const mostRecentEmail = matchingEmails[0];

        // Update lead with response info
        const updateData: Record<string, unknown> = {
          last_response_at: mostRecentEmail.email_date,
        };

        // Analyze email sentiment and content for potential stage changes
        const positiveKeywords = ['interested', 'yes', 'let\'s', 'schedule', 'ready', 'proceed', 'agree', 'sign'];
        const negativeKeywords = ['not interested', 'no thanks', 'unsubscribe', 'stop', 'remove', 'cancel'];
        
        const emailContent = `${mostRecentEmail.subject} ${mostRecentEmail.summary}`.toLowerCase();
        
        const hasPositiveSignal = positiveKeywords.some(kw => emailContent.includes(kw));
        const hasNegativeSignal = negativeKeywords.some(kw => emailContent.includes(kw));

        // Cancel pending follow-ups if lead responded
        const { error: cancelError } = await supabase
          .from('lead_follow_up_schedules')
          .update({ status: 'cancelled' })
          .eq('lead_id', lead.id)
          .eq('status', 'pending');

        if (!cancelError) {
          console.log(`Cancelled pending follow-ups for lead ${lead.id} due to email response`);
        }

        // If negative signal, pause follow-ups
        if (hasNegativeSignal) {
          updateData.follow_up_paused = true;
          console.log(`Pausing follow-ups for lead ${lead.name} - negative response detected`);
        }

        // Add AI summary based on response
        if (mostRecentEmail.sentiment) {
          updateData.ai_summary = `Email response: ${mostRecentEmail.sentiment} sentiment. ${mostRecentEmail.summary?.substring(0, 200) || ''}`;
        }

        // Update the lead
        await supabase
          .from('leads')
          .update(updateData)
          .eq('id', lead.id);

        // Add timeline entry
        await supabase.from('lead_timeline').insert({
          lead_id: lead.id,
          action: 'email_response_detected',
          metadata: {
            email_id: mostRecentEmail.id,
            subject: mostRecentEmail.subject,
            sentiment: mostRecentEmail.sentiment,
            has_positive_signal: hasPositiveSignal,
            has_negative_signal: hasNegativeSignal,
          },
        });

        // Log the event
        await supabase.from('lead_event_log').insert({
          lead_id: lead.id,
          event_type: 'email_response_detected',
          event_source: 'scan-lead-emails',
          event_data: {
            email_id: mostRecentEmail.id,
            subject: mostRecentEmail.subject,
            sentiment: mostRecentEmail.sentiment,
            email_date: mostRecentEmail.email_date,
          },
          processed: true,
        });

        // Record the communication
        await supabase.from('lead_communications').insert({
          lead_id: lead.id,
          communication_type: 'email',
          direction: 'inbound',
          subject: mostRecentEmail.subject,
          body: mostRecentEmail.summary,
          status: 'received',
          sent_at: mostRecentEmail.email_date,
        });
      }
    }

    console.log(`Scan complete. Matched ${matchedCount} leads with email responses. ${stageChanges} stage changes.`);

    return new Response(
      JSON.stringify({
        success: true,
        leadsChecked: leads?.length || 0,
        matchedResponses: matchedCount,
        stageChanges,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in scan-lead-emails:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
