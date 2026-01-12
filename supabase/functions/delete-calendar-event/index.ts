import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId } = await req.json();
    
    if (!eventId) {
      return new Response(
        JSON.stringify({ error: "eventId is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the Google Calendar token for the sync user
    const calendarSyncUserId = Deno.env.get("CALENDAR_SYNC_USER_ID");
    if (!calendarSyncUserId) {
      console.log("CALENDAR_SYNC_USER_ID not configured, skipping calendar deletion");
      return new Response(
        JSON.stringify({ success: true, message: "Calendar sync not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: tokenData, error: tokenError } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .eq("user_id", calendarSyncUserId)
      .single();

    if (tokenError || !tokenData) {
      console.log("No Google Calendar token found:", tokenError);
      return new Response(
        JSON.stringify({ success: true, message: "No calendar token found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token needs refresh
    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);
    
    if (expiresAt <= new Date()) {
      // Token expired, refresh it
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
      
      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          refresh_token: tokenData.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        accessToken = refreshData.access_token;
        
        // Update token in database
        await supabase
          .from("google_calendar_tokens")
          .update({
            access_token: accessToken,
            expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          })
          .eq("id", tokenData.id);
      } else {
        console.error("Failed to refresh token");
        return new Response(
          JSON.stringify({ success: false, error: "Failed to refresh calendar token" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    // Delete the event from Google Calendar
    const calendarId = tokenData.calendar_id || "primary";
    const deleteUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
    
    console.log(`Deleting calendar event: ${eventId} from calendar: ${calendarId}`);
    
    const deleteResponse = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (deleteResponse.ok || deleteResponse.status === 204) {
      console.log("Successfully deleted calendar event");
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (deleteResponse.status === 404) {
      // Event not found, consider it deleted
      console.log("Calendar event not found (already deleted)");
      return new Response(
        JSON.stringify({ success: true, message: "Event not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorText = await deleteResponse.text();
      console.error("Failed to delete calendar event:", deleteResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Calendar API error: ${deleteResponse.status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in delete-calendar-event:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
