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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("Calendar webhook received:", JSON.stringify(payload, null, 2));

    // Check if this is a website booking (direct call with all data)
    const isWebsiteBooking = payload.scheduled_at && payload.name;

    let leadData: {
      name: string;
      email?: string;
      phone?: string;
      eventId?: string;
      source?: string;
      propertyAddress?: string;
      propertyType?: string;
      notes?: string;
    } = { name: "" };

    let discoveryCallData: {
      scheduled_at?: string;
      duration_minutes?: number;
      meeting_type?: string;
      rental_strategy?: string;
      existing_listing_url?: string;
      current_situation?: string;
      start_timeline?: string;
      google_meet_link?: string;
      meeting_notes?: string;
    } | null = null;

    // Server-side validation: Enforce EST business hours (11 AM - 4 PM EST on weekdays)
    const validateBookingTime = (scheduledAtStr: string): { valid: boolean; error?: string } => {
      const scheduledAt = new Date(scheduledAtStr);
      
      // Convert to EST/EDT
      const estOptions: Intl.DateTimeFormatOptions = { 
        timeZone: 'America/New_York', 
        hour: 'numeric', 
        minute: 'numeric',
        weekday: 'long',
        hour12: false 
      };
      const estFormatter = new Intl.DateTimeFormat('en-US', estOptions);
      const estParts = estFormatter.formatToParts(scheduledAt);
      
      const hourPart = estParts.find(p => p.type === 'hour');
      const weekdayPart = estParts.find(p => p.type === 'weekday');
      
      const estHour = hourPart ? parseInt(hourPart.value) : 0;
      const weekday = weekdayPart?.value || '';
      
      // Block weekends
      if (weekday === 'Saturday' || weekday === 'Sunday') {
        return { valid: false, error: 'Bookings are not available on weekends' };
      }
      
      // Block outside business hours (11 AM - 4 PM EST means last slot is 3:30 PM)
      // end_time is 16:00, so slots go up to 15:30
      if (estHour < 11 || estHour >= 16) {
        return { valid: false, error: `Bookings are only available 11 AM - 4 PM EST. Requested: ${estHour}:00 EST` };
      }
      
      return { valid: true };
    };

    if (isWebsiteBooking) {
      // Website booking format - direct data
      
      // Validate booking time for website bookings
      if (payload.scheduled_at) {
        const validation = validateBookingTime(payload.scheduled_at);
        if (!validation.valid) {
          console.error("Booking time validation failed:", validation.error);
          return new Response(
            JSON.stringify({ success: false, error: validation.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      leadData = {
        name: payload.name || "Unknown",
        email: payload.email,
        phone: payload.phone,
        source: payload.source || "Website Booking",
        propertyAddress: payload.property_address,
        propertyType: payload.property_type,
        notes: payload.notes,
      };

      discoveryCallData = {
        scheduled_at: payload.scheduled_at,
        duration_minutes: payload.duration_minutes || 30,
        meeting_type: payload.meeting_type,
        rental_strategy: payload.rental_strategy,
        existing_listing_url: payload.existing_listing_url,
        current_situation: payload.current_situation,
        start_timeline: payload.start_timeline,
        google_meet_link: payload.google_meet_link,
        meeting_notes: payload.notes,
      };
    }
    // Calendly format
    else if (payload.event === "invitee.created" || payload.payload?.event) {
      const invitee = payload.payload?.invitee || payload.invitee;
      const event = payload.payload?.event || payload.event;
      
      leadData = {
        name: invitee?.name || invitee?.email?.split("@")[0] || "Unknown",
        email: invitee?.email,
        phone: invitee?.text_reminder_number,
        eventId: event?.uuid,
        source: `Calendly - ${event?.name || "Discovery Call"}`,
        notes: invitee?.questions_and_answers?.map((qa: { question: string; answer: string }) => 
          `${qa.question}: ${qa.answer}`
        ).join("\n"),
      };
    }
    // Cal.com format
    else if (payload.triggerEvent === "BOOKING_CREATED" || payload.payload?.bookingId) {
      const booking = payload.payload || payload;
      const attendee = booking.attendees?.[0] || booking;
      
      leadData = {
        name: attendee?.name || attendee?.email?.split("@")[0] || "Unknown",
        email: attendee?.email,
        phone: booking.responses?.phone || attendee?.phone,
        eventId: booking.bookingId || booking.uid,
        source: `Cal.com - ${booking.title || booking.eventType?.title || "Discovery Call"}`,
        propertyAddress: booking.responses?.property_address || booking.responses?.address,
        notes: booking.description || booking.responses?.notes,
      };
    }
    // Generic/custom format
    else {
      leadData = {
        name: payload.name || payload.guest_name || payload.attendee_name || "Unknown Lead",
        email: payload.email || payload.guest_email || payload.attendee_email,
        phone: payload.phone || payload.guest_phone || payload.attendee_phone,
        eventId: payload.event_id || payload.booking_id || payload.id,
        source: payload.source || payload.event_type || "Calendar Booking",
        propertyAddress: payload.property_address || payload.address,
        notes: payload.notes || payload.description,
      };
    }

    console.log("Extracted lead data:", leadData);

    // Check for existing lead by email or event ID
    let existingLeadId: string | null = null;
    if (leadData.email || leadData.eventId) {
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .or(`email.eq.${leadData.email || ""},calendar_event_id.eq.${leadData.eventId || ""}`)
        .single();

      if (existing) {
        console.log("Existing lead found:", existing.id);
        existingLeadId = existing.id;
        
        // For website bookings, we still need to create the discovery call for existing leads
        if (isWebsiteBooking && discoveryCallData) {
          let discoveryCallId: string | null = null;
          
          // Update lead with new property address if provided
          if (leadData.propertyAddress) {
            console.log("Updating existing lead property address to:", leadData.propertyAddress);
            await supabase
              .from("leads")
              .update({
                property_address: leadData.propertyAddress,
                property_type: leadData.propertyType || undefined,
                notes: leadData.notes || undefined,
              })
              .eq("id", existing.id);
          }
          
          // Create discovery call for existing lead
          const { data: newCall, error: callError } = await supabase
            .from("discovery_calls")
            .insert({
              lead_id: existing.id,
              scheduled_at: discoveryCallData.scheduled_at,
              duration_minutes: discoveryCallData.duration_minutes || 30,
              status: "scheduled",
              meeting_type: discoveryCallData.meeting_type,
              rental_strategy: discoveryCallData.rental_strategy,
              existing_listing_url: discoveryCallData.existing_listing_url,
              current_situation: discoveryCallData.current_situation,
              start_timeline: discoveryCallData.start_timeline,
              google_meet_link: discoveryCallData.google_meet_link,
              meeting_notes: discoveryCallData.meeting_notes,
            })
            .select()
            .single();

          if (callError) {
            console.error("Discovery call insert error for existing lead:", callError);
            throw callError;
          } else {
            discoveryCallId = newCall.id;
            console.log("Discovery call created for existing lead:", discoveryCallId);
          }

          // Add timeline entry
          await supabase.from("lead_timeline").insert({
            lead_id: existing.id,
            action: "New discovery call scheduled from website",
            new_stage: "call_scheduled",
            metadata: { source: leadData.source },
          });

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Discovery call created for existing lead",
              leadId: existing.id,
              discoveryCallId: discoveryCallId,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // For non-website bookings with existing leads, just skip
        return new Response(
          JSON.stringify({ success: true, message: "Duplicate lead, skipped", leadId: existing.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create the lead
    const { data: newLead, error: insertError } = await supabase
      .from("leads")
      .insert({
        name: leadData.name,
        email: leadData.email,
        phone: leadData.phone,
        opportunity_source: leadData.source,
        property_address: leadData.propertyAddress,
        property_type: leadData.propertyType,
        calendar_event_id: leadData.eventId,
        notes: leadData.notes,
        stage: discoveryCallData ? "call_scheduled" : "new_lead",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Lead insert error:", insertError);
      throw insertError;
    }

    console.log("Lead created:", newLead.id);

    let discoveryCallId: string | null = null;

    // Create discovery call if we have the data
    if (discoveryCallData && discoveryCallData.scheduled_at) {
      const { data: newCall, error: callError } = await supabase
        .from("discovery_calls")
        .insert({
          lead_id: newLead.id,
          scheduled_at: discoveryCallData.scheduled_at,
          duration_minutes: discoveryCallData.duration_minutes || 30,
          status: "scheduled",
          meeting_type: discoveryCallData.meeting_type,
          rental_strategy: discoveryCallData.rental_strategy,
          existing_listing_url: discoveryCallData.existing_listing_url,
          current_situation: discoveryCallData.current_situation,
          start_timeline: discoveryCallData.start_timeline,
          google_meet_link: discoveryCallData.google_meet_link,
          meeting_notes: discoveryCallData.meeting_notes,
        })
        .select()
        .single();

      if (callError) {
        console.error("Discovery call insert error:", callError);
      } else {
        discoveryCallId = newCall.id;
        console.log("Discovery call created:", discoveryCallId);
      }
    }

    // Add timeline entry
    await supabase.from("lead_timeline").insert({
      lead_id: newLead.id,
      action: discoveryCallData ? "Discovery call scheduled from website" : "Lead created from calendar booking",
      new_stage: discoveryCallData ? "call_scheduled" : "new_lead",
      metadata: { source: leadData.source, eventId: leadData.eventId },
    });

    // Trigger automation for new lead (only for non-website bookings, as website handles notifications)
    if (!isWebsiteBooking) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/process-lead-stage-change`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            leadId: newLead.id,
            newStage: discoveryCallData ? "call_scheduled" : "new_lead",
            previousStage: null,
          }),
        });
      } catch (e) {
        console.log("Automation trigger queued");
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        leadId: newLead.id,
        discoveryCallId: discoveryCallId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error processing calendar webhook:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
