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
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const in49Hours = new Date(now.getTime() + 49 * 60 * 60 * 1000);
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
    const in75Min = new Date(now.getTime() + 75 * 60 * 1000);

    const results = {
      reminder48h: 0,
      reminder24h: 0,
      reminder1h: 0,
      errors: [] as string[],
    };

    // Find calls needing 48h reminder (email only) - ONLY for booking page calls (no ghl_calendar_id)
    const { data: calls48h } = await supabase
      .from("discovery_calls")
      .select("id, google_calendar_event_id")
      .eq("status", "scheduled")
      .eq("reminder_48h_sent", false)
      .is("google_calendar_event_id", null) // Only non-Google calendar (booking page) calls - GHL calls are excluded
      .gte("scheduled_at", in48Hours.toISOString())
      .lt("scheduled_at", in49Hours.toISOString());

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
    const { data: calls24h } = await supabase
      .from("discovery_calls")
      .select("id, meeting_notes, google_meet_link")
      .eq("status", "scheduled")
      .eq("reminder_24h_sent", false)
      .gte("scheduled_at", in24Hours.toISOString())
      .lt("scheduled_at", in25Hours.toISOString());

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
          console.log("Auto-scheduling Recall bot for 24h reminder call:", call.id);
          await supabase.functions.invoke("recall-auto-schedule-bot", {
            body: { discoveryCallId: call.id },
          });
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
    const { data: calls1h } = await supabase
      .from("discovery_calls")
      .select("id, meeting_notes")
      .eq("status", "scheduled")
      .eq("reminder_1h_sent", false)
      .gte("scheduled_at", in1Hour.toISOString())
      .lt("scheduled_at", in75Min.toISOString());

    // Filter out GHL-synced calls
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
