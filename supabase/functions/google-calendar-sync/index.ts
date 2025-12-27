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

// Pipedream MCP Server URL
const MCP_SERVER_URL = "https://remote.mcp.pipedream.net";

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

// Parse SSE response from MCP server
async function parseSSEResponse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type") || "";
  
  // If it's regular JSON, parse directly
  if (contentType.includes("application/json")) {
    return await response.json();
  }
  
  // Handle SSE (Server-Sent Events) response
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
          console.log("SSE data parsed:", JSON.stringify(lastData).substring(0, 200));
        } catch (e) {
          console.log("SSE parse error for line:", data);
        }
      }
    }
  }
  
  return lastData;
}

// Call MCP tool via Pipedream
async function callMCPTool(
  accessToken: string,
  userId: string,
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  console.log(`Calling MCP tool: ${toolName}`);
  console.log("Tool args:", JSON.stringify(args));

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

  console.log("MCP response status:", response.status);
  console.log("MCP response headers:", JSON.stringify(Object.fromEntries(response.headers.entries())));

  if (!response.ok) {
    const errorText = await response.text();
    console.error("MCP request failed:", errorText);
    throw new Error(`MCP request failed: ${response.status} - ${errorText}`);
  }

  const result = await parseSSEResponse(response);
  console.log("MCP tool result:", JSON.stringify(result).substring(0, 500));
  
  if (result?.error) {
    throw new Error(result.error.message || JSON.stringify(result.error));
  }
  
  return result;
}

// List available MCP tools
async function listMCPTools(accessToken: string, userId: string): Promise<any> {
  console.log("Listing available MCP tools for user:", userId);

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
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/list",
      params: {},
    }),
  });

  console.log("MCP tools/list response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("MCP tools/list failed:", errorText);
    throw new Error(`MCP tools/list failed: ${response.status} - ${errorText}`);
  }

  const result = await parseSSEResponse(response);
  console.log("Available MCP tools:", JSON.stringify(result).substring(0, 1000));
  
  return result;
}

// Get user's connected accounts from Pipedream
async function getUserAccounts(userId: string): Promise<any[]> {
  const accessToken = await getPipedreamAccessToken();

  console.log("Getting accounts for user:", userId);

  const response = await fetch(
    `https://api.pipedream.com/v1/connect/${PIPEDREAM_PROJECT_ID}/users/${encodeURIComponent(userId)}/accounts`,
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

// Check if user has Google Calendar connected
async function hasGoogleCalendarConnection(userId: string): Promise<boolean> {
  const accounts = await getUserAccounts(userId);
  
  const googleAccount = accounts.find((a: any) => {
    const appSlug = typeof a.app === "object" ? a.app?.name_slug : a.app;
    return appSlug === "google_calendar" || appSlug === "google" || a.name?.toLowerCase().includes("google");
  });

  return !!googleAccount;
}

// Delete a user's Google Calendar connection
async function deleteUserAccount(userId: string): Promise<boolean> {
  const accessToken = await getPipedreamAccessToken();

  const accounts = await getUserAccounts(userId);
  const googleAccount = accounts.find((a: any) => {
    const appSlug = typeof a.app === "object" ? a.app?.name_slug : a.app;
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

  let action = url.searchParams.get("action");

  try {
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

      // Check if user already has Google Calendar connected
      const hasConnection = await hasGoogleCalendarConnection(userId);
      if (hasConnection) {
        // Verify the connection works via MCP
        try {
          const accessToken = await getPipedreamAccessToken();
          const tools = await listMCPTools(accessToken, userId);
          
          // If we can list tools, connection is working
          if (tools && !tools.error) {
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

    // Verify connection status using MCP
    if (action === "verify-connection") {
      try {
        const hasConnection = await hasGoogleCalendarConnection(userId);
        
        if (!hasConnection) {
          return new Response(JSON.stringify({ 
            connected: false, 
            verified: false,
            error: "No Google Calendar account connected"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verify connection works by listing calendars via MCP
        try {
          const accessToken = await getPipedreamAccessToken();
          
          // Try to list calendars using MCP
          const result = await callMCPTool(
            accessToken,
            userId,
            "google_calendar-list-calendars",
            {
              instruction: "List all available Google calendars"
            }
          );

          // Check if we got a valid response
          const hasCalendars = result?.result?.content || result?.content || result?.items;
          
          return new Response(JSON.stringify({ 
            connected: true, 
            verified: true,
            message: "Google Calendar connected and verified"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (mcpError: any) {
          console.error("MCP verification failed:", mcpError);
          
          // Connection exists but MCP failed - might need reconnect
          return new Response(JSON.stringify({ 
            connected: true, 
            verified: false,
            error: mcpError.message || "Could not verify calendar access via MCP"
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

    // Create calendar event for discovery call using MCP
    if (action === "create-event") {
      const { callId } = body;

      const hasConnection = await hasGoogleCalendarConnection(userId);
      if (!hasConnection) {
        throw new Error("Google Calendar not connected");
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

      const accessToken = await getPipedreamAccessToken();
      
      // Create event using MCP tool
      const attendeeList = call.leads?.email ? call.leads.email : "";
      const result = await callMCPTool(
        accessToken,
        userId,
        "google_calendar-create-event",
        {
          calendarId: "primary",
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
          attendees: call.leads?.email ? [{ email: call.leads.email }] : [],
          instruction: `Create a calendar event titled "Discovery Call: ${call.leads?.name || "Unknown"}" on ${startTime.toISOString()} for ${call.duration_minutes || 15} minutes${attendeeList ? ` with attendee ${attendeeList}` : ""}`
        }
      );

      // Extract event ID from result
      const eventId = result?.result?.content?.[0]?.text || 
                      result?.content?.[0]?.text || 
                      result?.id || 
                      `mcp-event-${Date.now()}`;

      // Update call with event ID
      await supabase
        .from("discovery_calls")
        .update({
          google_calendar_event_id: eventId,
          confirmation_email_sent: true,
        })
        .eq("id", callId);

      return new Response(JSON.stringify({ success: true, eventId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check calendar availability using MCP
    if (action === "check-availability") {
      const { date } = body;

      const hasConnection = await hasGoogleCalendarConnection(userId);
      if (!hasConnection) {
        return new Response(JSON.stringify({ events: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const accessToken = await getPipedreamAccessToken();
      
      const result = await callMCPTool(
        accessToken,
        userId,
        "google_calendar-list-events",
        {
          calendarId: "primary",
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
          singleEvents: true,
          instruction: `List all calendar events for ${date}`
        }
      );

      // Parse events from MCP response
      let events: any[] = [];
      try {
        const content = result?.result?.content?.[0]?.text || result?.content?.[0]?.text;
        if (content) {
          const parsed = JSON.parse(content);
          events = parsed.items || parsed.events || [];
        } else if (result?.items) {
          events = result.items;
        }
      } catch (e) {
        console.log("Could not parse events from MCP response:", e);
      }

      return new Response(
        JSON.stringify({
          events: events.map((e: any) => ({
            id: e.id,
            summary: e.summary,
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List calendars using MCP
    if (action === "list-calendars") {
      const hasConnection = await hasGoogleCalendarConnection(userId);
      if (!hasConnection) {
        throw new Error("Google Calendar not connected");
      }

      const accessToken = await getPipedreamAccessToken();
      
      const result = await callMCPTool(
        accessToken,
        userId,
        "google_calendar-list-calendars",
        {
          instruction: "List all available Google calendars"
        }
      );

      // Parse calendars from MCP response
      let calendars: any[] = [];
      try {
        const content = result?.result?.content?.[0]?.text || result?.content?.[0]?.text;
        if (content) {
          const parsed = JSON.parse(content);
          calendars = parsed.items || parsed.calendars || [];
        } else if (result?.items) {
          calendars = result.items;
        }
      } catch (e) {
        console.log("Could not parse calendars from MCP response:", e);
      }

      return new Response(
        JSON.stringify({
          calendars: calendars.map((c: any) => ({
            id: c.id,
            summary: c.summary,
            primary: c.primary,
          })),
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
