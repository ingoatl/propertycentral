import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize phone for matching
function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");

    if (!ghlApiKey || !ghlLocationId) {
      throw new Error("GHL_API_KEY and GHL_LOCATION_ID are required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { startTime, endTime, calendarId } = body;

    // Default to current time and 30 days ahead if not specified
    const now = Date.now();
    const thirtyDaysLater = now + (30 * 24 * 60 * 60 * 1000);
    const queryStartTime = startTime || now;
    const queryEndTime = endTime || thirtyDaysLater;

    console.log(`[GHL Calendar Sync] Fetching appointments from ${new Date(queryStartTime).toISOString()} to ${new Date(queryEndTime).toISOString()}`);

    // First, get all calendars in this location
    const calendarsUrl = `https://services.leadconnectorhq.com/calendars/?locationId=${ghlLocationId}`;
    console.log(`[GHL Calendar Sync] Fetching calendars from: ${calendarsUrl}`);

    const calendarsResponse = await fetch(calendarsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${ghlApiKey}`,
        "Version": "2021-04-15",
        "Content-Type": "application/json",
      },
    });

    if (!calendarsResponse.ok) {
      const errorText = await calendarsResponse.text();
      console.error("[GHL Calendar Sync] Calendars API error:", errorText);
      throw new Error(`GHL Calendars API error: ${calendarsResponse.status}`);
    }

    const calendarsData = await calendarsResponse.json();
    const calendars = calendarsData.calendars || [];
    console.log(`[GHL Calendar Sync] Found ${calendars.length} calendars`);

    // Store calendars for reference
    const calendarMap: Record<string, string> = {};
    for (const cal of calendars) {
      calendarMap[cal.id] = cal.name || "Unknown Calendar";
    }

    // Fetch events from each calendar (or specific one if provided)
    const allAppointments: Array<Record<string, unknown>> = [];
    const calendarIds = calendarId ? [calendarId] : calendars.map((c: { id: string }) => c.id);

    for (const calId of calendarIds) {
      const eventsUrl = `https://services.leadconnectorhq.com/calendars/events?locationId=${ghlLocationId}&calendarId=${calId}&startTime=${queryStartTime}&endTime=${queryEndTime}`;
      console.log(`[GHL Calendar Sync] Fetching events from calendar ${calId}: ${eventsUrl}`);

      const eventsResponse = await fetch(eventsUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-04-15",
          "Content-Type": "application/json",
        },
      });

      if (!eventsResponse.ok) {
        const errorText = await eventsResponse.text();
        console.error(`[GHL Calendar Sync] Events API error for calendar ${calId}:`, errorText);
        continue;
      }

      const eventsData = await eventsResponse.json();
      const events = eventsData.events || [];
      console.log(`[GHL Calendar Sync] Found ${events.length} events in calendar ${calId}`);

      for (const event of events) {
        // Enrich with calendar name
        event.calendarName = calendarMap[calId] || "Unknown Calendar";
        event.calendarId = calId;
        allAppointments.push(event);
      }
    }

    console.log(`[GHL Calendar Sync] Total appointments: ${allAppointments.length}`);

    // For each appointment, try to match to a lead and extract contact details
    const enrichedAppointments: Array<Record<string, unknown>> = [];

    for (const apt of allAppointments) {
      const contactId = apt.contactId as string;
      let contactDetails: Record<string, unknown> = {};
      let matchedLeadId: string | null = null;
      let matchedLeadDetails: Record<string, unknown> | null = null;

      // Fetch contact details from GHL
      if (contactId) {
        try {
          const contactResponse = await fetch(
            `https://services.leadconnectorhq.com/contacts/${contactId}`,
            {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${ghlApiKey}`,
                "Version": "2021-07-28",
                "Content-Type": "application/json",
              },
            }
          );

          if (contactResponse.ok) {
            const contactData = await contactResponse.json();
            const contact = contactData.contact;
            contactDetails = {
              name: contact?.name || contact?.firstName || `${contact?.firstName || ""} ${contact?.lastName || ""}`.trim(),
              email: contact?.email?.toLowerCase() || null,
              phone: contact?.phone || null,
              address: contact?.address1 || null,
              city: contact?.city || null,
              state: contact?.state || null,
              source: contact?.source || null,
              tags: contact?.tags || [],
              customFields: contact?.customField || {},
              dateAdded: contact?.dateAdded || null,
            };
            console.log(`[GHL Calendar Sync] Contact: ${contactDetails.name}, Phone: ${contactDetails.phone}, Email: ${contactDetails.email}`);
          }
        } catch (e) {
          console.log(`[GHL Calendar Sync] Failed to fetch contact ${contactId}`);
        }
      }

      // Try to match to a lead in our database
      const phone = contactDetails.phone as string;
      const email = contactDetails.email as string;
      const normalizedPhone = normalizePhone(phone || "");

      // First try by GHL contact ID
      const { data: leadByGhlId } = await supabase
        .from("leads")
        .select("id, name, email, phone, property_address, property_type, stage, source, notes, ghl_contact_id")
        .eq("ghl_contact_id", contactId)
        .single();

      if (leadByGhlId) {
        matchedLeadId = leadByGhlId.id;
        matchedLeadDetails = leadByGhlId;
        console.log(`[GHL Calendar Sync] Matched to lead by GHL ID: ${leadByGhlId.name}`);
      }

      // Try by phone
      if (!matchedLeadId && normalizedPhone && normalizedPhone.length >= 10) {
        const { data: leads } = await supabase
          .from("leads")
          .select("id, name, email, phone, property_address, property_type, stage, source, notes")
          .ilike("phone", `%${normalizedPhone.slice(-7)}%`)
          .limit(10);

        if (leads && leads.length > 0) {
          for (const lead of leads) {
            const leadPhone = normalizePhone(lead.phone || "");
            if (leadPhone === normalizedPhone) {
              matchedLeadId = lead.id;
              matchedLeadDetails = lead;
              console.log(`[GHL Calendar Sync] Matched to lead by phone: ${lead.name}`);
              break;
            }
          }
        }
      }

      // Try by email
      if (!matchedLeadId && email) {
        const { data: leadByEmail } = await supabase
          .from("leads")
          .select("id, name, email, phone, property_address, property_type, stage, source, notes")
          .ilike("email", email)
          .limit(1);

        if (leadByEmail && leadByEmail.length > 0) {
          matchedLeadId = leadByEmail[0].id;
          matchedLeadDetails = leadByEmail[0];
          console.log(`[GHL Calendar Sync] Matched to lead by email: ${leadByEmail[0].name}`);
        }
      }

      // Extract meeting link from various GHL fields
      let meetingLink: string | null = null;
      const meetLinkSources = [
        apt.meetUrl,
        apt.conferenceUrl,
        apt.hangoutLink,
        apt.locationUrl,
        apt.address as string,
        apt.location as string,
        apt.notes as string,
        apt.title as string,
        (contactDetails.customFields as Record<string, unknown>)?.meeting_link,
        (contactDetails.customFields as Record<string, unknown>)?.zoom_link,
        (contactDetails.customFields as Record<string, unknown>)?.google_meet,
      ];
      
      for (const source of meetLinkSources) {
        if (source && typeof source === 'string') {
          // Google Meet
          const meetMatch = source.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i);
          if (meetMatch) {
            meetingLink = meetMatch[0];
            break;
          }
          // Zoom
          const zoomMatch = source.match(/https:\/\/[\w.-]*zoom\.us\/[a-z0-9/?=&-]+/i);
          if (zoomMatch) {
            meetingLink = zoomMatch[0];
            break;
          }
          // Teams
          const teamsMatch = source.match(/https:\/\/teams\.microsoft\.com\/[a-z0-9/?=&-]+/i);
          if (teamsMatch) {
            meetingLink = teamsMatch[0];
            break;
          }
        }
      }

      if (meetingLink) {
        console.log(`[GHL Calendar Sync] Found meeting link: ${meetingLink}`);
      }

      // Build enriched appointment
      const enrichedApt = {
        ghl_event_id: apt.id,
        ghl_calendar_id: apt.calendarId,
        calendar_name: apt.calendarName,
        title: apt.title || apt.appointmentStatus || "Appointment",
        status: apt.appointmentStatus || apt.status || "confirmed",
        scheduled_at: apt.startTime,
        end_time: apt.endTime,
        assigned_user_id: apt.assignedUserId,
        notes: apt.notes || null,
        location: apt.address || null,
        meeting_link: meetingLink,
        
        // Contact details from GHL
        contact_id: contactId,
        contact_name: contactDetails.name || null,
        contact_email: contactDetails.email || null,
        contact_phone: contactDetails.phone || null,
        contact_address: contactDetails.address || null,
        contact_city: contactDetails.city || null,
        contact_state: contactDetails.state || null,
        contact_source: contactDetails.source || null,
        contact_tags: contactDetails.tags || [],
        contact_custom_fields: contactDetails.customFields || {},
        
        // Matched lead details
        lead_id: matchedLeadId,
        lead_name: matchedLeadDetails?.name || null,
        lead_email: matchedLeadDetails?.email || null,
        lead_phone: matchedLeadDetails?.phone || null,
        lead_property_address: matchedLeadDetails?.property_address || null,
        lead_property_type: matchedLeadDetails?.property_type || null,
        lead_stage: matchedLeadDetails?.stage || null,
        lead_source: matchedLeadDetails?.source || null,
        lead_notes: matchedLeadDetails?.notes || null,
        
        // Raw GHL data for reference
        raw_ghl_data: apt,
      };

      enrichedAppointments.push(enrichedApt);

      // Optionally sync to discovery_calls table if it's a discovery/consultation call
      const aptTitle = apt.title as string | undefined;
      const titleLower = (aptTitle || "").toLowerCase();
      const isDiscoveryCall = titleLower.includes("discovery") || titleLower.includes("consultation") || 
                              titleLower.includes("intro") || titleLower.includes("call") ||
                              titleLower.includes("meeting") || titleLower.includes("demo");

      if (isDiscoveryCall && matchedLeadId) {
        // Check if this event already exists in discovery_calls
        const { data: existingCall } = await supabase
          .from("discovery_calls")
          .select("id")
          .eq("lead_id", matchedLeadId)
          .gte("scheduled_at", new Date(apt.startTime as string).toISOString())
          .lte("scheduled_at", new Date(new Date(apt.startTime as string).getTime() + 60000).toISOString())
          .single();

        if (!existingCall) {
          // Create discovery call entry
          const { error: insertError } = await supabase
            .from("discovery_calls")
            .insert({
              lead_id: matchedLeadId,
              scheduled_at: new Date(apt.startTime as string).toISOString(),
              status: apt.appointmentStatus === "cancelled" ? "cancelled" : "scheduled",
              meeting_type: "video",
              meeting_notes: apt.notes || `Synced from GHL Calendar: ${apt.calendarName}`,
            });

          if (insertError) {
            console.error(`[GHL Calendar Sync] Error creating discovery call:`, insertError);
          } else {
            console.log(`[GHL Calendar Sync] Created discovery call for lead ${matchedLeadDetails?.name}`);
          }
        }
      }
    }

    console.log(`[GHL Calendar Sync] Completed. ${enrichedAppointments.length} appointments enriched`);

    return new Response(
      JSON.stringify({
        success: true,
        calendars: calendars.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })),
        appointmentCount: enrichedAppointments.length,
        appointments: enrichedAppointments,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[GHL Calendar Sync] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
