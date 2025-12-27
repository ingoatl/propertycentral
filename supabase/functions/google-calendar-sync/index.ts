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
  console.log("Getting Pipedream access token...");
  const response = await fetch("https://api.pipedream.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: PIPEDREAM_CLIENT_ID!,
      client_secret: PIPEDREAM_CLIENT_SECRET!,
    }),
  });

  const data = await response.json();
  console.log("Pipedream token response status:", response.status);
  
  if (data.error) {
    console.error("Pipedream token error:", data);
    throw new Error(data.error_description || data.error);
  }

  return data.access_token;
}

// Create a Pipedream Connect token for the user
async function createConnectToken(userId: string, successRedirectUri: string): Promise<{ token: string; connect_link_url: string; expires_at: string }> {
  const accessToken = await getPipedreamAccessToken();

  console.log("Creating Connect token for user:", userId);
  console.log("Success redirect URI:", successRedirectUri);
  console.log("Project ID:", PIPEDREAM_PROJECT_ID);

  const response = await fetch(`https://api.pipedream.com/v1/connect/${PIPEDREAM_PROJECT_ID}/tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-pd-environment": "development",
    },
    body: JSON.stringify({
      external_user_id: userId,
      success_redirect_uri: successRedirectUri,
      error_redirect_uri: successRedirectUri.replace("connected=true", "connected=false"),
    }),
  });

  const data = await response.json();
  console.log("Connect token response status:", response.status);
  console.log("Connect token response:", JSON.stringify(data));
  
  if (!response.ok || data.error) {
    console.error("Connect token error:", data);
    throw new Error(data.error_description || data.error || data.message || "Failed to create connect token");
  }

  return { 
    token: data.token, 
    connect_link_url: data.connect_link_url,
    expires_at: data.expires_at 
  };
}

// Get user's connected accounts from Pipedream WITH credentials
async function getUserAccountsWithCredentials(userId: string): Promise<any[]> {
  const accessToken = await getPipedreamAccessToken();

  console.log("Getting accounts with credentials for user:", userId);

  // Add include_credentials=true to get OAuth tokens
  const response = await fetch(
    `https://api.pipedream.com/v1/connect/${PIPEDREAM_PROJECT_ID}/users/${encodeURIComponent(userId)}/accounts?include_credentials=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-pd-environment": "development",
      },
    }
  );

  const data = await response.json();
  console.log("Get accounts response status:", response.status);
  console.log("Get accounts response:", JSON.stringify(data).substring(0, 500));
  
  if (data.error) {
    console.error("Get accounts error:", data);
    return [];
  }

  // Parse accounts - API can return array directly or wrapped
  let accounts: any[] = [];
  if (Array.isArray(data)) {
    accounts = data;
  } else if (data.data && Array.isArray(data.data)) {
    accounts = data.data;
  } else if (data.accounts && Array.isArray(data.accounts)) {
    accounts = data.accounts;
  }
  
  console.log("Parsed accounts count:", accounts.length);
  return accounts;
}

// Find Google Calendar account and get OAuth credentials
async function getGoogleCalendarCredentials(userId: string): Promise<{ accessToken: string; accountId: string } | null> {
  const accounts = await getUserAccountsWithCredentials(userId);
  
  // Find Google Calendar account
  const googleAccount = accounts.find((a: any) => {
    const appSlug = typeof a.app === 'object' ? a.app?.name_slug : a.app;
    return appSlug === "google_calendar" || appSlug === "google" || a.name?.toLowerCase().includes("google");
  });

  if (!googleAccount) {
    console.log("No Google Calendar account found for user");
    return null;
  }

  console.log("Found Google account:", googleAccount.id);
  console.log("Account has credentials:", !!googleAccount.credentials);
  console.log("Account structure:", JSON.stringify(googleAccount).substring(0, 500));

  // Extract OAuth token from credentials
  // Pipedream stores OAuth tokens in credentials.oauth_access_token
  const oauthToken = googleAccount.credentials?.oauth_access_token || 
                     googleAccount.oauth_access_token ||
                     googleAccount.credentials?.access_token ||
                     googleAccount.access_token;

  if (!oauthToken) {
    console.log("No OAuth token found in account. This may be because:");
    console.log("1. Using Pipedream's default OAuth (not custom OAuth app)");
    console.log("2. Credentials aren't included in the response");
    console.log("Full account object:", JSON.stringify(googleAccount));
    return null;
  }

  console.log("Successfully extracted OAuth token");
  return { accessToken: oauthToken, accountId: googleAccount.id };
}

// Make direct Google Calendar API request using OAuth token
async function googleCalendarRequest(
  oauthToken: string,
  method: string,
  endpoint: string,
  body?: any
): Promise<any> {
  const url = `https://www.googleapis.com/calendar/v3${endpoint}`;
  console.log(`Making Google Calendar API request: ${method} ${url}`);
  
  const headers: Record<string, string> = {
    Authorization: `Bearer ${oauthToken}`,
  };
  
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const data = await response.json();
  console.log("Google Calendar API response status:", response.status);
  
  if (!response.ok) {
    console.error("Google Calendar API error:", data);
    throw new Error(data.error?.message || data.message || "Google Calendar API request failed");
  }
  
  return data;
}

// Delete a user's Google Calendar connection
async function deleteUserAccount(userId: string): Promise<boolean> {
  const accessToken = await getPipedreamAccessToken();

  const accounts = await getUserAccountsWithCredentials(userId);
  const googleAccount = accounts.find((a: any) => {
    const appSlug = typeof a.app === 'object' ? a.app?.name_slug : a.app;
    return appSlug === "google_calendar" || appSlug === "google" || a.name?.toLowerCase().includes("google");
  });

  if (!googleAccount) {
    return true; // Already disconnected
  }

  const response = await fetch(
    `https://api.pipedream.com/v1/connect/${PIPEDREAM_PROJECT_ID}/accounts/${googleAccount.id}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-pd-environment": "development",
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
    // For other actions, parse from body
    const body = await req.json();
    action = body.action || action;
    const { userId } = body;

    console.log("Action:", action, "UserId:", userId);

    // Get Pipedream Connect URL for Google Calendar OAuth
    if (action === "get-auth-url") {
      const { redirectUrl } = body;

      if (!PIPEDREAM_CLIENT_ID || !PIPEDREAM_CLIENT_SECRET || !PIPEDREAM_PROJECT_ID) {
        throw new Error("Pipedream credentials not configured. Please add PIPEDREAM_CLIENT_ID, PIPEDREAM_CLIENT_SECRET, and PIPEDREAM_PROJECT_ID.");
      }

      // Check if user already has Google Calendar connected with valid credentials
      try {
        const credentials = await getGoogleCalendarCredentials(userId);
        if (credentials) {
          // Try to verify the connection works with direct API call
          try {
            const calendars = await googleCalendarRequest(
              credentials.accessToken,
              "GET",
              "/users/me/calendarList?maxResults=1"
            );
            if (calendars && !calendars.error) {
              return new Response(JSON.stringify({ 
                success: true, 
                message: "Google Calendar is already connected" 
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          } catch (e) {
            console.log("Existing connection verification failed, will prompt for reconnect:", e);
          }
        }
      } catch (e) {
        console.log("No existing connection or check failed:", e);
      }

      // Create success redirect URL
      const baseRedirect = redirectUrl || "https://peachhaus.lovable.app";
      const successRedirectUri = `${baseRedirect}/admin?tab=calendar&connected=true`;

      // Create a Pipedream Connect token
      const connectData = await createConnectToken(userId, successRedirectUri);
      
      // Build the Connect Link URL with app parameter for Google Calendar
      const authUrl = `${connectData.connect_link_url}&app=google_calendar`;

      console.log("Generated Pipedream Connect auth URL:", authUrl);

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify connection status
    if (action === "verify-connection") {
      try {
        const credentials = await getGoogleCalendarCredentials(userId);
        if (!credentials) {
          return new Response(JSON.stringify({ 
            connected: false, 
            verified: false,
            error: "No Google Calendar credentials found. You may need to set up a custom OAuth app in Pipedream."
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Test the connection with direct API call
        try {
          const calendars = await googleCalendarRequest(
            credentials.accessToken,
            "GET",
            "/users/me/calendarList?maxResults=10"
          );

          return new Response(JSON.stringify({ 
            connected: true, 
            verified: true,
            calendarCount: calendars.items?.length || 0 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (apiError: any) {
          console.error("Google Calendar API verification failed:", apiError);
          return new Response(JSON.stringify({ 
            connected: true, 
            verified: false,
            error: apiError.message || "Could not verify calendar access"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (error: any) {
        return new Response(JSON.stringify({ 
          connected: false, 
          verified: false,
          error: error.message 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create calendar event for discovery call
    if (action === "create-event") {
      const { callId } = body;

      // Get Google Calendar credentials
      const credentials = await getGoogleCalendarCredentials(userId);
      if (!credentials) {
        throw new Error("Google Calendar not connected or credentials not available");
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

      // Create event with direct API call
      const calendarEvent = await googleCalendarRequest(
        credentials.accessToken,
        "POST",
        "/calendars/primary/events?sendUpdates=all",
        event
      );

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

      const eventsData = await googleCalendarRequest(
        credentials.accessToken,
        "GET",
        `/calendars/primary/events?timeMin=${startOfDay.toISOString()}&timeMax=${endOfDay.toISOString()}&singleEvents=true`
      );

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

    // List calendars
    if (action === "list-calendars") {
      const credentials = await getGoogleCalendarCredentials(userId);
      if (!credentials) {
        throw new Error("Google Calendar not connected or credentials not available");
      }

      const calendars = await googleCalendarRequest(
        credentials.accessToken,
        "GET",
        "/users/me/calendarList"
      );

      return new Response(
        JSON.stringify({
          calendars:
            calendars.items?.map((c: any) => ({
              id: c.id,
              summary: c.summary,
              primary: c.primary,
            })) || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Disconnect Google Calendar
    if (action === "disconnect") {
      await deleteUserAccount(userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    console.error("Google Calendar Sync Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
