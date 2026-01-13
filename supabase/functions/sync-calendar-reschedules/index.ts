import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pipedream credentials
const PIPEDREAM_CLIENT_ID = Deno.env.get("PIPEDREAM_CLIENT_ID");
const PIPEDREAM_CLIENT_SECRET = Deno.env.get("PIPEDREAM_CLIENT_SECRET");
const PIPEDREAM_PROJECT_ID = Deno.env.get("PIPEDREAM_PROJECT_ID");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CALENDAR_SYNC_USER_ID = Deno.env.get("CALENDAR_SYNC_USER_ID");

const MCP_SERVER_URL = "https://remote.mcp.pipedream.net";

async function getPipedreamAccessToken(): Promise<string> {
  const response = await fetch("https://api.pipedream.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: PIPEDREAM_CLIENT_ID!,
      client_secret: PIPEDREAM_CLIENT_SECRET!,
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }
  return data.access_token;
}

async function parseSSEResponse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type") || "";
  
  if (contentType.includes("application/json")) {
    return await response.json();
  }
  
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastData: any = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          lastData = JSON.parse(data);
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
  
  return lastData;
}

async function callMCPTool(
  accessToken: string,
  userId: string,
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  console.log(`Calling MCP tool: ${toolName}`);

  const response = await fetch(MCP_SERVER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json, text/event-stream",
      "Content-Type": "application/json",
      "x-pd-project-id": PIPEDREAM_PROJECT_ID!,
      "x-pd-environment": "development",
      "x-pd-external-user-id": userId,
      "x-pd-app-slug": "google_calendar",
      "x-pd-app-discovery": "true",
      "x-pd-tool-mode": "sub-agent",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MCP request failed: ${response.status} - ${errorText}`);
  }

  const result = await parseSSEResponse(response);
  if (result?.error) {
    throw new Error(result.error.message || JSON.stringify(result.error));
  }
  
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const userId = body.userId || CALENDAR_SYNC_USER_ID;

    if (!userId) {
      throw new Error("No user ID provided and CALENDAR_SYNC_USER_ID not configured");
    }

    console.log("[Calendar Reschedule Sync] Starting sync...");

    // Get all discovery calls with google_calendar_event_id that are scheduled
    const { data: discoveryCallsWithEvents, error: callsError } = await supabase
      .from("discovery_calls")
      .select("id, scheduled_at, google_calendar_event_id, status, leads(id, name, email)")
      .not("google_calendar_event_id", "is", null)
      .in("status", ["scheduled", "confirmed"])
      .gte("scheduled_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days + future
      .order("scheduled_at", { ascending: true });

    if (callsError) {
      throw new Error(`Failed to fetch discovery calls: ${callsError.message}`);
    }

    console.log(`[Calendar Reschedule Sync] Found ${discoveryCallsWithEvents?.length || 0} calls with calendar events`);

    if (!discoveryCallsWithEvents || discoveryCallsWithEvents.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No calendar events to sync",
        updated: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch events from Google Calendar
    const accessToken = await getPipedreamAccessToken();
    
    // Get events for the next 60 days and past 7 days
    const timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`[Calendar Reschedule Sync] Fetching Google Calendar events from ${timeMin} to ${timeMax}`);

    const result = await callMCPTool(
      accessToken,
      userId,
      "google_calendar-list-events",
      {
        calendarId: "primary",
        timeMin: timeMin,
        timeMax: timeMax,
        singleEvents: true,
        maxResults: 250,
        instruction: `List all calendar events from ${timeMin} to ${timeMax}. Return the events as a JSON array with id, summary, start, end, and status fields.`
      }
    );

    // Parse events from MCP response - handle various response formats
    let googleEvents: any[] = [];
    try {
      const content = result?.result?.content?.[0]?.text || result?.content?.[0]?.text;
      if (content) {
        // Try to find JSON in the response
        const jsonMatch = content.match(/\[[\s\S]*\]|\{[\s\S]*"items"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          googleEvents = Array.isArray(parsed) ? parsed : (parsed.items || parsed.events || []);
        } else {
          console.log("[Calendar Reschedule Sync] No JSON found in response, will fetch events individually");
        }
      } else if (result?.items) {
        googleEvents = result.items;
      }
    } catch (e) {
      console.log("[Calendar Reschedule Sync] Could not parse events list, will fetch individually:", e);
    }

    console.log(`[Calendar Reschedule Sync] Found ${googleEvents.length} Google Calendar events from list`);

    // Create a map of Google Calendar events by ID
    const eventMap = new Map<string, any>();
    for (const event of googleEvents) {
      if (event.id) {
        eventMap.set(event.id, event);
      }
    }

    // For events not found in the list, try to fetch them individually
    const eventsToFetch = discoveryCallsWithEvents.filter(call => {
      const eventId = call.google_calendar_event_id;
      // Skip MCP-generated IDs as they won't exist in Google Calendar
      if (eventId?.startsWith("mcp-event-")) return false;
      return !eventMap.has(eventId);
    });

    console.log(`[Calendar Reschedule Sync] Fetching ${eventsToFetch.length} events individually`);

    for (const call of eventsToFetch) {
      const eventId = call.google_calendar_event_id;
      if (!eventId) continue;

      try {
        const eventResult = await callMCPTool(
          accessToken,
          userId,
          "google_calendar-get-event",
          {
            calendarId: "primary",
            eventId: eventId,
            instruction: `Get the Google Calendar event with ID ${eventId}. Return the event details including id, summary, start time, end time, and status as JSON.`
          }
        );

        const eventContent = eventResult?.result?.content?.[0]?.text || eventResult?.content?.[0]?.text;
        if (eventContent) {
          // Try to extract event data
          const jsonMatch = eventContent.match(/\{[\s\S]*"id"[\s\S]*\}|\{[\s\S]*"start"[\s\S]*\}/);
          if (jsonMatch) {
            const eventData = JSON.parse(jsonMatch[0]);
            if (eventData.id || eventData.start) {
              eventMap.set(eventId, eventData);
              console.log(`[Calendar Reschedule Sync] Fetched event ${eventId}: ${eventData.summary || "Unknown"}`);
            }
          } else {
            // Try to parse the time from text response
            const startMatch = eventContent.match(/start[:\s]+([^,\n]+)/i);
            const statusMatch = eventContent.match(/status[:\s]+([^\s,\n]+)/i);
            const cancelledMatch = eventContent.toLowerCase().includes("cancelled") || eventContent.toLowerCase().includes("canceled");
            
            if (startMatch || cancelledMatch) {
              eventMap.set(eventId, {
                id: eventId,
                start: startMatch ? { dateTime: startMatch[1].trim() } : null,
                status: cancelledMatch ? "cancelled" : (statusMatch ? statusMatch[1].trim() : "confirmed")
              });
              console.log(`[Calendar Reschedule Sync] Parsed event ${eventId} from text response`);
            }
          }
        }
      } catch (e) {
        console.log(`[Calendar Reschedule Sync] Could not fetch event ${eventId}:`, e);
      }
    }

    console.log(`[Calendar Reschedule Sync] Total events in map: ${eventMap.size}`)

    // Check each discovery call against Google Calendar
    const updates: any[] = [];
    const cancelled: any[] = [];

    for (const call of discoveryCallsWithEvents) {
      const eventId = call.google_calendar_event_id;
      
      // Handle MCP-generated event IDs that might not match exactly
      let googleEvent = eventMap.get(eventId);
      
      // Try to find by partial match if exact match fails
      if (!googleEvent && eventId) {
        for (const [gEventId, gEvent] of eventMap) {
          if (eventId.includes(gEventId) || gEventId.includes(eventId)) {
            googleEvent = gEvent;
            break;
          }
        }
      }

      if (!googleEvent) {
        // Event not found in Google Calendar - might have been deleted
        console.log(`[Calendar Reschedule Sync] Event ${eventId} not found in Google Calendar`);
        continue;
      }

      // Check if event was cancelled
      if (googleEvent.status === "cancelled") {
        console.log(`[Calendar Reschedule Sync] Event ${eventId} was cancelled in Google Calendar`);
        cancelled.push({
          callId: call.id,
          leadName: call.leads?.name,
          eventId: eventId
        });
        
        // Update discovery call status
        await supabase
          .from("discovery_calls")
          .update({ 
            status: "cancelled",
            meeting_notes: `${call.meeting_notes || ""}\n\n[Auto-updated] Call cancelled in Google Calendar on ${new Date().toLocaleDateString()}`
          })
          .eq("id", call.id);
        
        continue;
      }

      // Get the event start time from Google Calendar
      const googleStartTime = googleEvent.start?.dateTime || googleEvent.start?.date;
      if (!googleStartTime) continue;

      const googleDate = new Date(googleStartTime);
      const callDate = new Date(call.scheduled_at);

      // Check if times differ by more than 1 minute (accounting for timezone/rounding)
      const timeDiff = Math.abs(googleDate.getTime() - callDate.getTime());
      
      if (timeDiff > 60 * 1000) { // More than 1 minute difference
        console.log(`[Calendar Reschedule Sync] Detected reschedule for call ${call.id}:`);
        console.log(`  - Original: ${callDate.toISOString()}`);
        console.log(`  - New: ${googleDate.toISOString()}`);
        console.log(`  - Lead: ${call.leads?.name}`);

        // Update the discovery call with new time
        const { error: updateError } = await supabase
          .from("discovery_calls")
          .update({ 
            scheduled_at: googleDate.toISOString(),
            meeting_notes: `${call.meeting_notes || ""}\n\n[Auto-updated] Rescheduled via Google Calendar from ${callDate.toLocaleString()} to ${googleDate.toLocaleString()} on ${new Date().toLocaleDateString()}`
          })
          .eq("id", call.id);

        if (updateError) {
          console.error(`[Calendar Reschedule Sync] Failed to update call ${call.id}:`, updateError);
        } else {
          updates.push({
            callId: call.id,
            leadName: call.leads?.name,
            originalTime: callDate.toISOString(),
            newTime: googleDate.toISOString()
          });

          // Add to lead timeline
          if (call.leads?.id) {
            await supabase
              .from("lead_timeline")
              .insert({
                lead_id: call.leads.id,
                event_type: "call_rescheduled",
                description: `Discovery call rescheduled from ${callDate.toLocaleString()} to ${googleDate.toLocaleString()} (updated via Google Calendar sync)`,
                metadata: {
                  original_time: callDate.toISOString(),
                  new_time: googleDate.toISOString(),
                  discovery_call_id: call.id
                }
              });
          }
        }
      }
    }

    console.log(`[Calendar Reschedule Sync] Completed. Updated: ${updates.length}, Cancelled: ${cancelled.length}`);

    return new Response(JSON.stringify({ 
      success: true, 
      updated: updates.length,
      cancelled: cancelled.length,
      updates,
      cancelledCalls: cancelled
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[Calendar Reschedule Sync] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
