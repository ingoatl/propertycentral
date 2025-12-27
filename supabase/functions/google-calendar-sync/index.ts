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

// Get Pipedream access token using OAuth client credentials
async function getPipedreamAccessToken(): Promise<string> {
  const response = await fetch("https://api.pipedream.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: PIPEDREAM_CLIENT_ID!,
      client_secret: PIPEDREAM_CLIENT_SECRET!,
    }),
  });

  const data = await response.json();
  if (data.error) {
    console.error("Pipedream token error:", data);
    throw new Error(data.error_description || data.error);
  }

  return data.access_token;
}

// Create a Pipedream Connect token for the user
async function createConnectToken(userId: string, redirectUrl: string): Promise<{ token: string; expires_at: string }> {
  const accessToken = await getPipedreamAccessToken();

  const response = await fetch("https://api.pipedream.com/v1/connect/tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_user_id: userId,
      redirect_uri: redirectUrl,
    }),
  });

  const data = await response.json();
  if (data.error) {
    console.error("Connect token error:", data);
    throw new Error(data.error_description || data.error);
  }

  return { token: data.token, expires_at: data.expires_at };
}

// Get user's connected accounts from Pipedream
async function getUserAccounts(userId: string): Promise<any[]> {
  const accessToken = await getPipedreamAccessToken();

  const response = await fetch(
    `https://api.pipedream.com/v1/connect/${PIPEDREAM_PROJECT_ID}/users/${encodeURIComponent(userId)}/accounts`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();
  if (data.error) {
    console.error("Get accounts error:", data);
    return [];
  }

  return data.data || [];
}

// Get Google Calendar credentials from Pipedream for a user
async function getGoogleCalendarCredentials(userId: string): Promise<{ access_token: string; refresh_token?: string } | null> {
  const accessToken = await getPipedreamAccessToken();

  // First get the user's accounts
  const accounts = await getUserAccounts(userId);
  console.log("User accounts:", accounts);

  // Find Google Calendar account
  const googleAccount = accounts.find((a: any) => 
    a.app === "google_calendar" || a.app === "google" || a.name?.toLowerCase().includes("google")
  );

  if (!googleAccount) {
    console.log("No Google Calendar account found for user");
    return null;
  }

  console.log("Found Google account:", googleAccount.id);

  // Get the OAuth credentials for this account
  const credResponse = await fetch(
    `https://api.pipedream.com/v1/connect/${PIPEDREAM_PROJECT_ID}/accounts/${googleAccount.id}/credentials`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const credData = await credResponse.json();
  if (credData.error) {
    console.error("Get credentials error:", credData);
    return null;
  }

  return {
    access_token: credData.oauth_access_token,
    refresh_token: credData.oauth_refresh_token,
  };
}

// Delete a user's Google Calendar connection
async function deleteUserAccount(userId: string): Promise<boolean> {
  const accessToken = await getPipedreamAccessToken();

  const accounts = await getUserAccounts(userId);
  const googleAccount = accounts.find((a: any) => 
    a.app === "google_calendar" || a.app === "google" || a.name?.toLowerCase().includes("google")
  );

  if (!googleAccount) {
    return true; // Already disconnected
  }

  const response = await fetch(
    `https://api.pipedream.com/v1/connect/${PIPEDREAM_PROJECT_ID}/accounts/${googleAccount.id}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.ok;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);

  // Check for action in URL params first (for OAuth callback)
  let action = url.searchParams.get("action");

  try {
    // Pipedream callback after OAuth (redirect from Pipedream Connect)
    if (action === "oauth-callback") {
      const success = url.searchParams.get("success");
      const state = url.searchParams.get("state");

      let stateData: { userId: string; redirectUrl: string } = { userId: "", redirectUrl: "" };
      if (state) {
        try {
          stateData = JSON.parse(decodeURIComponent(state));
        } catch (e) {
          console.log("Failed to parse state:", e);
        }
      }

      // Redirect back to the frontend app
      const redirectUrl = stateData.redirectUrl || "https://peachhaus.lovable.app";
      const connected = success === "true" ? "true" : "false";
      const finalRedirect = `${redirectUrl}/admin?tab=calendar&connected=${connected}`;
      console.log("Pipedream OAuth callback - redirecting to:", finalRedirect);

      return new Response(null, {
        status: 302,
        headers: {
          Location: finalRedirect,
        },
      });
    }

    // For other actions, parse from body
    const body = await req.json();
    action = body.action || action;
    const { userId } = body;

    console.log("Action:", action, "UserId:", userId);

    // Get Pipedream Connect URL for Google Calendar OAuth
    if (action === "get-auth-url") {
      const { redirectUrl } = body;

      if (!PIPEDREAM_CLIENT_ID || !PIPEDREAM_CLIENT_SECRET || !PIPEDREAM_PROJECT_ID) {
        throw new Error("Pipedream credentials not configured.");
      }

      // Check if user already has Google Calendar connected
      const credentials = await getGoogleCalendarCredentials(userId);
      if (credentials) {
        // Test the connection
        const testRes = await fetch(
          "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
          { headers: { Authorization: `Bearer ${credentials.access_token}` } }
        );
        if (testRes.ok) {
          return new Response(JSON.stringify({ 
            success: true, 
            message: "Google Calendar is already connected" 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Create a Pipedream Connect token
      const callbackUrl = `${SUPABASE_URL}/functions/v1/google-calendar-sync?action=oauth-callback`;
      const stateData = JSON.stringify({ userId, redirectUrl: redirectUrl || "" });
      const encodedState = encodeURIComponent(stateData);

      // Build Pipedream Connect URL
      const connectToken = await createConnectToken(userId, callbackUrl);
      
      // The Pipedream Connect URL with Google Calendar app
      const authUrl = `https://pipedream.com/connect/${PIPEDREAM_PROJECT_ID}/google_calendar?token=${connectToken.token}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${encodedState}`;

      console.log("Generated Pipedream Connect auth URL for user:", userId);

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create calendar event for discovery call
    if (action === "create-event") {
      const { callId } = body;

      // Get credentials from Pipedream
      const credentials = await getGoogleCalendarCredentials(userId);
      if (!credentials) {
        throw new Error("Google Calendar not connected via Pipedream");
      }

      // Get call details
      const { data: call, error: callError } = await supabase
        .from("discovery_calls")
        .select("*, leads(name, email, phone)")
        .eq("id", callId)
        .single();

      if (callError || !call) {
        throw new Error("Call not found");
      }

      const startTime = new Date(call.scheduled_at);
      const endTime = new Date(startTime.getTime() + (call.duration_minutes || 15) * 60000);

      const event = {
        summary: `Discovery Call: ${call.leads?.name || "Unknown"}`,
        description: `Discovery call with ${call.leads?.name}\nPhone: ${call.leads?.phone || "N/A"}\nEmail: ${call.leads?.email || "N/A"}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: "America/New_York",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "America/New_York",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 1440 },
            { method: "popup", minutes: 60 },
          ],
        },
        attendees: call.leads?.email ? [{ email: call.leads.email }] : [],
      };

      // Create event in Google Calendar
      const calendarRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credentials.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      const calendarEvent = await calendarRes.json();
      if (calendarEvent.error) {
        throw new Error(calendarEvent.error.message);
      }

      // Update call with event ID
      await supabase
        .from("discovery_calls")
        .update({
          google_calendar_event_id: calendarEvent.id,
          confirmation_email_sent: true,
        })
        .eq("id", callId);

      return new Response(JSON.stringify({ success: true, eventId: calendarEvent.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check calendar availability
    if (action === "check-availability") {
      const { date } = body;

      const credentials = await getGoogleCalendarCredentials(userId);
      if (!credentials) {
        return new Response(JSON.stringify({ events: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get events for the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const eventsRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
          `timeMin=${startOfDay.toISOString()}&timeMax=${endOfDay.toISOString()}&singleEvents=true`,
        {
          headers: { Authorization: `Bearer ${credentials.access_token}` },
        }
      );

      const eventsData = await eventsRes.json();

      return new Response(
        JSON.stringify({
          events:
            eventsData.items?.map((e: any) => ({
              id: e.id,
              summary: e.summary,
              start: e.start?.dateTime || e.start?.date,
              end: e.end?.dateTime || e.end?.date,
            })) || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check connection status via Pipedream
    if (action === "check-status" || action === "verify-connection") {
      if (!PIPEDREAM_CLIENT_ID || !PIPEDREAM_CLIENT_SECRET || !PIPEDREAM_PROJECT_ID) {
        return new Response(
          JSON.stringify({ connected: false, verified: false, error: "Pipedream not configured" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const credentials = await getGoogleCalendarCredentials(userId);
        if (!credentials) {
          return new Response(
            JSON.stringify({ connected: false, verified: false }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify the connection by making a test API call
        const testRes = await fetch(
          "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=10",
          {
            headers: { Authorization: `Bearer ${credentials.access_token}` },
          }
        );

        if (!testRes.ok) {
          const errData = await testRes.json();
          console.error("Calendar verification failed:", errData);
          return new Response(
            JSON.stringify({ connected: true, verified: false, error: errData.error?.message || "API error" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const calendarData = await testRes.json();
        console.log("Calendar verification successful, found calendars:", calendarData.items?.length || 0);

        return new Response(
          JSON.stringify({ 
            connected: true, 
            verified: true,
            calendarCount: calendarData.items?.length || 0
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error: any) {
        console.error("Verification error:", error);
        return new Response(
          JSON.stringify({ connected: false, verified: false, error: error.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Disconnect Google Calendar via Pipedream
    if (action === "disconnect") {
      const deleted = await deleteUserAccount(userId);
      return new Response(
        JSON.stringify({ success: deleted, message: deleted ? "Google Calendar disconnected" : "Failed to disconnect" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Calendar sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
