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
    const { callId, newScheduledAt } = await req.json();

    if (!callId || !newScheduledAt) {
      return new Response(
        JSON.stringify({ error: "Call ID and new scheduled time are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the current call
    const { data: call, error: callError } = await supabase
      .from("discovery_calls")
      .select(`
        *,
        lead:leads!discovery_calls_lead_id_fkey (*)
      `)
      .eq("id", callId)
      .single();

    if (callError || !call) {
      console.error("Error fetching call:", callError);
      return new Response(
        JSON.stringify({ error: "Discovery call not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the call can be rescheduled
    if (call.status === "cancelled" || call.status === "completed") {
      return new Response(
        JSON.stringify({ error: "This call cannot be rescheduled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const oldScheduledAt = call.scheduled_at;
    const newTime = new Date(newScheduledAt);
    const now = new Date();

    // Ensure new time is in the future
    if (newTime <= now) {
      return new Response(
        JSON.stringify({ error: "New time must be in the future" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for conflicts
    const duration = call.duration_minutes || 30;
    const newEndTime = new Date(newTime.getTime() + duration * 60 * 1000);

    const { data: conflicts } = await supabase
      .from("discovery_calls")
      .select("id, scheduled_at")
      .neq("id", callId)
      .in("status", ["scheduled", "confirmed"])
      .gte("scheduled_at", new Date(newTime.getTime() - duration * 60 * 1000).toISOString())
      .lte("scheduled_at", newEndTime.toISOString());

    if (conflicts && conflicts.length > 0) {
      return new Response(
        JSON.stringify({ error: "This time slot conflicts with another appointment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the discovery call
    const { error: updateError } = await supabase
      .from("discovery_calls")
      .update({
        scheduled_at: newScheduledAt,
        rescheduled_at: now.toISOString(),
        rescheduled_from: oldScheduledAt,
        reschedule_count: (call.reschedule_count || 0) + 1,
        // Reset reminder flags for new reminders
        reminder_48h_sent: false,
        reminder_24h_sent: false,
        reminder_1h_sent: false,
        last_reminder_scheduled_at: newScheduledAt,
        meeting_notes: `${call.meeting_notes || ""}\n\n[${now.toISOString()}] Rescheduled by client from ${new Date(oldScheduledAt).toLocaleString()} to ${newTime.toLocaleString()}`.trim(),
      })
      .eq("id", callId);

    if (updateError) {
      console.error("Error updating call:", updateError);
      throw updateError;
    }

    // Update Google Calendar event if exists
    if (call.google_calendar_event_id) {
      try {
        const pipedreamClientId = Deno.env.get("PIPEDREAM_CLIENT_ID");
        const pipedreamClientSecret = Deno.env.get("PIPEDREAM_CLIENT_SECRET");
        const pipedreamProjectId = Deno.env.get("PIPEDREAM_PROJECT_ID");

        if (pipedreamClientId && pipedreamClientSecret && pipedreamProjectId) {
          // Get access token
          const tokenResponse = await fetch("https://api.pipedream.com/v1/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              grant_type: "client_credentials",
              client_id: pipedreamClientId,
              client_secret: pipedreamClientSecret,
            }),
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            const lead = call.lead as any;
            const endTime = new Date(newTime.getTime() + duration * 60 * 1000);

            // Update Google Calendar event
            const mcpResponse = await fetch(
              `https://api.pipedream.com/v1/connect/${pipedreamProjectId}/mcp`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                  "x-pd-external-user-id": "system",
                },
                body: JSON.stringify({
                  method: "tools/call",
                  params: {
                    name: "google_calendar-update-event",
                    arguments: {
                      calendarId: "primary",
                      eventId: call.google_calendar_event_id,
                      start: {
                        dateTime: newTime.toISOString(),
                        timeZone: "America/New_York",
                      },
                      end: {
                        dateTime: endTime.toISOString(),
                        timeZone: "America/New_York",
                      },
                      summary: `[RESCHEDULED] Discovery Call - ${lead?.first_name || "Guest"} ${lead?.last_name || ""}`,
                      description: `Rescheduled discovery call with ${lead?.first_name || "Guest"}\n\nOriginal time: ${new Date(oldScheduledAt).toLocaleString()}\nNew time: ${newTime.toLocaleString()}\n\nReschedule count: ${(call.reschedule_count || 0) + 1}`,
                    },
                  },
                }),
              }
            );

            if (!mcpResponse.ok) {
              console.error("Failed to update Google Calendar event:", await mcpResponse.text());
            } else {
              console.log("Google Calendar event updated successfully");
            }
          }
        }
      } catch (calError) {
        console.error("Error updating Google Calendar:", calError);
        // Don't fail the reschedule if calendar update fails
      }
    }

    // Add timeline entry
    if (call.lead_id) {
      await supabase.from("lead_timeline").insert({
        lead_id: call.lead_id,
        event_type: "call_rescheduled",
        title: "Discovery Call Rescheduled",
        description: `Call rescheduled from ${new Date(oldScheduledAt).toLocaleString()} to ${newTime.toLocaleString()}`,
        metadata: {
          old_time: oldScheduledAt,
          new_time: newScheduledAt,
          reschedule_count: (call.reschedule_count || 0) + 1,
          rescheduled_by: "client",
        },
      });
    }

    // Send reschedule confirmation notification
    try {
      await supabase.functions.invoke("discovery-call-notifications", {
        body: {
          discoveryCallId: callId,
          notificationType: "reschedule_confirmation",
          oldScheduledAt: oldScheduledAt,
        },
      });
      console.log("Reschedule confirmation sent");
    } catch (notifError) {
      console.error("Error sending reschedule notification:", notifError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Call rescheduled successfully",
        newScheduledAt: newScheduledAt,
        oldScheduledAt: oldScheduledAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in reschedule-discovery-call:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
