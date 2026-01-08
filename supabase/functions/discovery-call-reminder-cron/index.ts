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
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
    const in75Min = new Date(now.getTime() + 75 * 60 * 1000);

    const results = {
      reminder24h: 0,
      reminder1h: 0,
      errors: [] as string[],
    };

    // Find calls needing 24h reminder (scheduled between 24-25 hours from now)
    const { data: calls24h } = await supabase
      .from("discovery_calls")
      .select("id")
      .eq("status", "scheduled")
      .eq("reminder_24h_sent", false)
      .gte("scheduled_at", in24Hours.toISOString())
      .lt("scheduled_at", in25Hours.toISOString());

    for (const call of calls24h || []) {
      try {
        await supabase.functions.invoke("discovery-call-notifications", {
          body: { discoveryCallId: call.id, notificationType: "reminder_24h" },
        });
        results.reminder24h++;
      } catch (e: any) {
        results.errors.push(`24h reminder for ${call.id}: ${e.message}`);
      }
    }

    // Find calls needing 1h reminder (scheduled between 60-75 minutes from now)
    const { data: calls1h } = await supabase
      .from("discovery_calls")
      .select("id")
      .eq("status", "scheduled")
      .eq("reminder_1h_sent", false)
      .gte("scheduled_at", in1Hour.toISOString())
      .lt("scheduled_at", in75Min.toISOString());

    for (const call of calls1h || []) {
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
