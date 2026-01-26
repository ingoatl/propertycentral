import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appointmentId, action } = await req.json();

    if (!appointmentId) {
      return new Response(
        JSON.stringify({ error: "appointmentId is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the appointment details
    const { data: appointment, error: aptError } = await supabase
      .from("team_appointments")
      .select(`
        *,
        property:properties(id, name, address),
        assigned_profile:profiles(id, first_name, email)
      `)
      .eq("id", appointmentId)
      .single();

    if (aptError || !appointment) {
      console.error("Error fetching appointment:", aptError);
      return new Response(
        JSON.stringify({ error: "Appointment not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // If no assigned user, skip calendar sync
    if (!appointment.assigned_to) {
      console.log("No assigned user, skipping calendar sync");
      return new Response(
        JSON.stringify({ success: true, message: "No assigned user" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the assigned user's Google Calendar token
    const { data: tokenData, error: tokenError } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .eq("user_id", appointment.assigned_to)
      .single();

    // If user has no calendar token, use the shared calendar sync user
    let calendarToken = tokenData;
    if (!tokenData) {
      const calendarSyncUserId = Deno.env.get("CALENDAR_SYNC_USER_ID");
      if (calendarSyncUserId) {
        const { data: sharedToken } = await supabase
          .from("google_calendar_tokens")
          .select("*")
          .eq("user_id", calendarSyncUserId)
          .single();
        calendarToken = sharedToken;
      }
    }

    if (!calendarToken) {
      console.log("No calendar token available");
      return new Response(
        JSON.stringify({ success: true, message: "No calendar configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh token if needed
    let accessToken = calendarToken.access_token;
    const expiresAt = new Date(calendarToken.expires_at);

    if (expiresAt <= new Date()) {
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          refresh_token: calendarToken.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        accessToken = refreshData.access_token;

        await supabase
          .from("google_calendar_tokens")
          .update({
            access_token: accessToken,
            expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          })
          .eq("id", calendarToken.id);
      } else {
        console.error("Failed to refresh token");
        return new Response(
          JSON.stringify({ success: false, error: "Failed to refresh calendar token" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    const calendarId = calendarToken.calendar_id || "primary";

    // Handle delete action
    if (action === "delete" && appointment.google_calendar_event_id) {
      const deleteUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(appointment.google_calendar_event_id)}`;

      const deleteResponse = await fetch(deleteUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (deleteResponse.ok || deleteResponse.status === 204 || deleteResponse.status === 404) {
        console.log("Calendar event deleted");
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Build event details
    const assigneeName = appointment.assigned_profile?.first_name || "Team Member";
    const propertyName = appointment.property?.name || "";
    const propertyAddress = appointment.property?.address || appointment.location_address || "";

    const eventTitle = `[${assigneeName}] ${appointment.title}`;
    const eventDescription = [
      appointment.description || "",
      "",
      propertyName ? `Property: ${propertyName}` : "",
      propertyAddress ? `Address: ${propertyAddress}` : "",
      appointment.contact_name ? `Contact: ${appointment.contact_name}` : "",
      appointment.contact_phone ? `Phone: ${appointment.contact_phone}` : "",
      appointment.notes ? `Notes: ${appointment.notes}` : "",
    ].filter(Boolean).join("\n");

    const startTime = new Date(appointment.scheduled_at);
    const endTime = appointment.end_time 
      ? new Date(appointment.end_time)
      : new Date(startTime.getTime() + (appointment.duration_minutes || 60) * 60000);

    const calendarEvent = {
      summary: eventTitle,
      description: eventDescription,
      location: propertyAddress,
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
          { method: "popup", minutes: 60 },
          { method: "popup", minutes: 15 },
        ],
      },
    };

    // Include assigned user as attendee if we have their email
    if (appointment.assigned_profile?.email) {
      (calendarEvent as any).attendees = [
        { email: appointment.assigned_profile.email },
      ];
    }

    let googleEventId = appointment.google_calendar_event_id;

    if (googleEventId) {
      // Update existing event
      const updateUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`;

      const updateResponse = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(calendarEvent),
      });

      if (!updateResponse.ok) {
        // If update fails (event might be deleted), create new
        console.log("Update failed, creating new event");
        googleEventId = null;
      } else {
        console.log("Calendar event updated");
      }
    }

    if (!googleEventId) {
      // Create new event
      const createUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

      const createResponse = await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(calendarEvent),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error("Failed to create calendar event:", errorText);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create calendar event" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      const createdEvent = await createResponse.json();
      googleEventId = createdEvent.id;

      // Save the event ID back to the appointment
      await supabase
        .from("team_appointments")
        .update({ google_calendar_event_id: googleEventId })
        .eq("id", appointmentId);

      console.log("Calendar event created:", googleEventId);
    }

    return new Response(
      JSON.stringify({ success: true, googleEventId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in sync-team-appointment-calendar:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
