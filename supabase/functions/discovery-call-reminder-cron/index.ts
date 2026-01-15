import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function should be called by a cron job every 15 minutes
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    
    // Expanded time windows to catch more calls (cron runs every 15 min)
    // 48h reminder: 47-49 hours before call
    const in47Hours = new Date(now.getTime() + 47 * 60 * 60 * 1000);
    const in49Hours = new Date(now.getTime() + 49 * 60 * 60 * 1000);
    // 24h reminder: 23-25 hours before call
    const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    // 1h reminder: 45 min to 90 min before call
    const in45Min = new Date(now.getTime() + 45 * 60 * 1000);
    const in90Min = new Date(now.getTime() + 90 * 60 * 1000);

    console.log(`[Reminder Cron] Running at ${now.toISOString()}`);
    console.log(`[Reminder Cron] 48h window: ${in47Hours.toISOString()} - ${in49Hours.toISOString()}`);
    console.log(`[Reminder Cron] 24h window: ${in23Hours.toISOString()} - ${in25Hours.toISOString()}`);
    console.log(`[Reminder Cron] 1h window: ${in45Min.toISOString()} - ${in90Min.toISOString()}`);

    const results = {
      reminder48h: 0,
      reminder24h: 0,
      reminder1h: 0,
      recallBotsScheduled: 0,
      errors: [] as string[],
    };

    // Find calls needing 48h reminder (email only) - ONLY for booking page calls (no ghl_calendar_id)
    const { data: calls48h, error: err48h } = await supabase
      .from("discovery_calls")
      .select("id, google_calendar_event_id, scheduled_at")
      .eq("status", "scheduled")
      .eq("reminder_48h_sent", false)
      .is("google_calendar_event_id", null) // Only non-Google calendar (booking page) calls - GHL calls are excluded
      .gte("scheduled_at", in47Hours.toISOString())
      .lt("scheduled_at", in49Hours.toISOString());
    
    console.log(`[Reminder Cron] 48h query result: ${calls48h?.length || 0} calls, error: ${err48h?.message || 'none'}`);

    for (const call of calls48h || []) {
      try {
        await supabase.functions.invoke("discovery-call-notifications", {
          body: { discoveryCallId: call.id, notificationType: "reminder_48h" },
        });
        await supabase.from("discovery_calls").update({ reminder_48h_sent: true }).eq("id", call.id);
        results.reminder48h++;
      } catch (e: any) {
        results.errors.push(`48h reminder for ${call.id}: ${e.message}`);
      }
    }

    // Find calls needing 24h reminder - ONLY for booking page calls (exclude GHL-synced calls)
    const { data: calls24h, error: err24h } = await supabase
      .from("discovery_calls")
      .select("id, meeting_notes, google_meet_link, scheduled_at")
      .eq("status", "scheduled")
      .eq("reminder_24h_sent", false)
      .gte("scheduled_at", in23Hours.toISOString())
      .lt("scheduled_at", in25Hours.toISOString());
    
    console.log(`[Reminder Cron] 24h query result: ${calls24h?.length || 0} calls, error: ${err24h?.message || 'none'}`);

    // Auto-schedule Recall bots for video calls in 24h window that don't have recordings yet
    for (const call of (calls24h || []).filter(c => c.google_meet_link)) {
      try {
        // Check if bot already scheduled
        const { data: existingRecording } = await supabase
          .from("meeting_recordings")
          .select("id")
          .eq("discovery_call_id", call.id)
          .single();
        
        if (!existingRecording) {
          console.log(`[Reminder Cron] Auto-scheduling Recall bot for call: ${call.id}, meet link: ${call.google_meet_link}`);
          await supabase.functions.invoke("recall-auto-schedule-bot", {
            body: { discoveryCallId: call.id },
          });
          results.recallBotsScheduled++;
        } else {
          console.log(`[Reminder Cron] Recall bot already exists for call: ${call.id}`);
        }
      } catch (e: any) {
        console.error(`Failed to auto-schedule Recall for ${call.id}:`, e.message);
      }
    }

    // Filter out GHL-synced calls (they have "Synced from GHL" in meeting_notes)
    const filteredCalls24h = (calls24h || []).filter(call => 
      !call.meeting_notes?.includes("Synced from GHL")
    );

    for (const call of filteredCalls24h) {
      try {
        await supabase.functions.invoke("discovery-call-notifications", {
          body: { discoveryCallId: call.id, notificationType: "reminder_24h" },
        });
        results.reminder24h++;
      } catch (e: any) {
        results.errors.push(`24h reminder for ${call.id}: ${e.message}`);
      }
    }

    // Find calls needing 1h reminder - ONLY for booking page calls (exclude GHL-synced calls)
    const { data: calls1h, error: err1h } = await supabase
      .from("discovery_calls")
      .select("id, meeting_notes, scheduled_at")
      .eq("status", "scheduled")
      .eq("reminder_1h_sent", false)
      .gte("scheduled_at", in45Min.toISOString())
      .lt("scheduled_at", in90Min.toISOString());
    
    console.log(`[Reminder Cron] 1h query result: ${calls1h?.length || 0} calls, error: ${err1h?.message || 'none'}`);
    const filteredCalls1h = (calls1h || []).filter(call => 
      !call.meeting_notes?.includes("Synced from GHL")
    );

    for (const call of filteredCalls1h) {
      try {
        await supabase.functions.invoke("discovery-call-notifications", {
          body: { discoveryCallId: call.id, notificationType: "reminder_1h" },
        });
        results.reminder1h++;
      } catch (e: any) {
        results.errors.push(`1h reminder for ${call.id}: ${e.message}`);
      }
    }

    console.log("Reminder cron results:", results);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in discovery-call-reminder-cron:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
