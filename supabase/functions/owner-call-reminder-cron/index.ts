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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    
    // Time windows for reminders
    const in48hStart = new Date(now.getTime() + 47 * 60 * 60 * 1000);
    const in48hEnd = new Date(now.getTime() + 49 * 60 * 60 * 1000);
    
    const in24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const in24hEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    
    const in1hStart = new Date(now.getTime() + 50 * 60 * 1000);
    const in1hEnd = new Date(now.getTime() + 70 * 60 * 1000);

    const results = {
      reminder_48h: { processed: 0, sent: 0 },
      reminder_24h: { processed: 0, sent: 0 },
      reminder_1h: { processed: 0, sent: 0 }
    };

    // 48h reminders
    const { data: calls48h } = await supabase
      .from('owner_calls')
      .select('id, contact_name, contact_email, scheduled_at')
      .in('status', ['scheduled', 'confirmed'])
      .eq('reminder_48h_sent', false)
      .gte('scheduled_at', in48hStart.toISOString())
      .lte('scheduled_at', in48hEnd.toISOString());

    if (calls48h && calls48h.length > 0) {
      for (const call of calls48h) {
        results.reminder_48h.processed++;
        try {
          await supabase.functions.invoke('owner-call-notifications', {
            body: { ownerCallId: call.id, notificationType: 'reminder_48h' }
          });
          results.reminder_48h.sent++;
          console.log(`48h reminder sent for call ${call.id} (${call.contact_name})`);
        } catch (err) {
          console.error(`Failed to send 48h reminder for ${call.id}:`, err);
        }
      }
    }

    // 24h reminders
    const { data: calls24h } = await supabase
      .from('owner_calls')
      .select('id, contact_name, contact_email, scheduled_at, meeting_type, google_meet_link')
      .in('status', ['scheduled', 'confirmed'])
      .eq('reminder_24h_sent', false)
      .gte('scheduled_at', in24hStart.toISOString())
      .lte('scheduled_at', in24hEnd.toISOString());

    if (calls24h && calls24h.length > 0) {
      for (const call of calls24h) {
        results.reminder_24h.processed++;
        try {
          await supabase.functions.invoke('owner-call-notifications', {
            body: { ownerCallId: call.id, notificationType: 'reminder_24h' }
          });
          results.reminder_24h.sent++;
          console.log(`24h reminder sent for call ${call.id} (${call.contact_name})`);

          // If video call, try to schedule recall bot
          if (call.meeting_type === 'video' && call.google_meet_link) {
            try {
              const { data: existingRecordings } = await supabase
                .from('call_recordings')
                .select('id')
                .eq('owner_call_id', call.id)
                .limit(1);

              if (!existingRecordings || existingRecordings.length === 0) {
                await supabase.functions.invoke('recall-auto-schedule-bot', {
                  body: {
                    callType: 'owner_call',
                    callId: call.id,
                    meetLink: call.google_meet_link,
                    scheduledAt: call.scheduled_at
                  }
                });
                console.log(`Recall bot scheduled for owner call ${call.id}`);
              }
            } catch (recallErr) {
              console.error(`Failed to schedule recall bot for ${call.id}:`, recallErr);
            }
          }
        } catch (err) {
          console.error(`Failed to send 24h reminder for ${call.id}:`, err);
        }
      }
    }

    // 1h reminders
    const { data: calls1h } = await supabase
      .from('owner_calls')
      .select('id, contact_name, contact_email, scheduled_at')
      .in('status', ['scheduled', 'confirmed'])
      .eq('reminder_1h_sent', false)
      .gte('scheduled_at', in1hStart.toISOString())
      .lte('scheduled_at', in1hEnd.toISOString());

    if (calls1h && calls1h.length > 0) {
      for (const call of calls1h) {
        results.reminder_1h.processed++;
        try {
          await supabase.functions.invoke('owner-call-notifications', {
            body: { ownerCallId: call.id, notificationType: 'reminder_1h' }
          });
          results.reminder_1h.sent++;
          console.log(`1h reminder sent for call ${call.id} (${call.contact_name})`);
        } catch (err) {
          console.error(`Failed to send 1h reminder for ${call.id}:`, err);
        }
      }
    }

    console.log('Owner call reminder cron completed:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        timestamp: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in owner-call-reminder-cron:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
