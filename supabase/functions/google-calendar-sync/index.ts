import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Helper to refresh tokens if expired
async function getValidAccessToken(supabase: any, userId: string, tokenData: any, tokenTable: string) {
  if (new Date(tokenData.expires_at) > new Date()) {
    return tokenData.access_token;
  }

  console.log("Token expired, refreshing...");
  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: tokenData.refresh_token,
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  const newTokens = await refreshRes.json();
  if (newTokens.error) {
    console.error("Token refresh failed:", newTokens);
    // If invalid_grant, tokens are revoked - delete them
    if (newTokens.error === "invalid_grant") {
      await supabase.from(tokenTable).delete().eq("user_id", userId);
      throw new Error("Token expired or revoked. Please reconnect Google Calendar.");
    }
    throw new Error(`Token refresh failed: ${newTokens.error_description || newTokens.error}`);
  }

  const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

  // Update the token table
  await supabase.from(tokenTable).update({
    access_token: newTokens.access_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  return newTokens.access_token;
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
    // OAuth callback from Google (comes via URL redirect)
    if (action === "oauth-callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state"); // user_id

      if (!code || !state) {
        throw new Error("Missing code or state");
      }

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${SUPABASE_URL}/functions/v1/google-calendar-sync?action=oauth-callback`,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenRes.json();
      if (tokens.error) {
        throw new Error(tokens.error_description || tokens.error);
      }

      // Save tokens
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      await supabase.from("google_calendar_tokens").upsert({
        user_id: state,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      });

      // Redirect back to app
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/admin?tab=calendar&connected=true`,
        },
      });
    }

    // For other actions, parse from body
    const body = await req.json();
    action = body.action || action;
    const { userId } = body;

    console.log("Action:", action, "UserId:", userId);

    if (action === "get-auth-url") {
      // Check if user already has valid calendar tokens
      const { data: existingTokens } = await supabase
        .from("google_calendar_tokens")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingTokens) {
        // Try to verify the existing tokens work
        try {
          const accessToken = await getValidAccessToken(supabase, userId, existingTokens, "google_calendar_tokens");
          // Test the connection
          const testRes = await fetch(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (testRes.ok) {
            return new Response(JSON.stringify({ 
              success: true, 
              message: "Google Calendar is already connected" 
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (e) {
          console.log("Existing tokens invalid, need re-auth:", e);
          // Delete invalid tokens
          await supabase.from("google_calendar_tokens").delete().eq("user_id", userId);
        }
      }

      // Need fresh OAuth
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        throw new Error("Google Calendar credentials not configured.");
      }
      
      const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-sync?action=oauth-callback`;
      const scope = encodeURIComponent(
        "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events"
      );
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${scope}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${userId}`;

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create calendar event for discovery call
    if (action === "create-event") {
      const { callId } = body;

      // Try google_calendar_tokens first, then fall back to gmail_oauth_tokens
      let tokenData = await supabase
        .from("google_calendar_tokens")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!tokenData.data) {
        tokenData = await supabase
          .from("gmail_oauth_tokens")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
      }

      if (!tokenData.data) {
        throw new Error("Google Calendar not connected");
      }

      const accessToken = await getValidAccessToken(supabase, userId, tokenData.data, "google_calendar_tokens");

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
            { method: "email", minutes: 1440 }, // 24 hours
            { method: "popup", minutes: 60 }, // 1 hour
          ],
        },
        attendees: call.leads?.email ? [{ email: call.leads.email }] : [],
      };

      // Create event in Google Calendar
      const calendarRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${tokenData.data?.calendar_id || "primary"}/events?sendUpdates=all`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
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

      const { data: tokenData } = await supabase
        .from("google_calendar_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!tokenData) {
        return new Response(JSON.stringify({ events: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Refresh token if needed
      let accessToken = tokenData.access_token;
      if (new Date(tokenData.expires_at) < new Date()) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            refresh_token: tokenData.refresh_token,
            client_id: GOOGLE_CLIENT_ID!,
            client_secret: GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
          }),
        });
        const newTokens = await refreshRes.json();
        accessToken = newTokens.access_token;
      }

      // Get events for the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const eventsRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${tokenData.calendar_id || "primary"}/events?` +
          `timeMin=${startOfDay.toISOString()}&timeMax=${endOfDay.toISOString()}&singleEvents=true`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
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

    // Check connection status and verify it works
    if (action === "check-status" || action === "verify-connection") {
      // Only use google_calendar_tokens - don't fallback to gmail tokens
      const { data: tokenData } = await supabase
        .from("google_calendar_tokens")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!tokenData) {
        return new Response(
          JSON.stringify({ connected: false, verified: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Actually verify the connection by making a test API call
      try {
        const accessToken = await getValidAccessToken(supabase, userId, tokenData, "google_calendar_tokens");
        
        // Test the connection by fetching calendar list
        const testRes = await fetch(
          "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=10",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!testRes.ok) {
          const errData = await testRes.json();
          console.error("Calendar verification failed:", errData);
          // If unauthorized, delete invalid tokens
          if (testRes.status === 401) {
            await supabase.from("google_calendar_tokens").delete().eq("user_id", userId);
            return new Response(
              JSON.stringify({ connected: false, verified: false, error: "Tokens expired. Please reconnect." }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
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
        // Delete bad tokens on error
        await supabase.from("google_calendar_tokens").delete().eq("user_id", userId);
        return new Response(
          JSON.stringify({ connected: false, verified: false, error: error.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Disconnect Google Calendar
    if (action === "disconnect") {
      await supabase.from("google_calendar_tokens").delete().eq("user_id", userId);
      return new Response(
        JSON.stringify({ success: true, message: "Google Calendar disconnected" }),
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
