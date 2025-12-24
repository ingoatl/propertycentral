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

    // Extract data based on calendar provider
    // Support for Calendly, Cal.com, and generic webhooks
    let leadData: {
      name: string;
      email?: string;
      phone?: string;
      eventId?: string;
      source?: string;
      propertyAddress?: string;
      notes?: string;
    } = { name: "" };

    // Calendly format
    if (payload.event === "invitee.created" || payload.payload?.event) {
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

    // Check for duplicate by email or event ID
    if (leadData.email || leadData.eventId) {
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .or(`email.eq.${leadData.email || ""},calendar_event_id.eq.${leadData.eventId || ""}`)
        .single();

      if (existing) {
        console.log("Duplicate lead detected, skipping:", existing.id);
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
        calendar_event_id: leadData.eventId,
        notes: leadData.notes,
        stage: "new_lead",
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log("Lead created:", newLead.id);

    // Add timeline entry
    await supabase.from("lead_timeline").insert({
      lead_id: newLead.id,
      action: "Lead created from calendar booking",
      new_stage: "new_lead",
      metadata: { source: leadData.source, eventId: leadData.eventId },
    });

    // Trigger automation for new lead
    try {
      await fetch(`${supabaseUrl}/functions/v1/process-lead-stage-change`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: newLead.id,
          newStage: "new_lead",
          previousStage: null,
        }),
      });
    } catch (e) {
      console.log("Automation trigger queued");
    }

    return new Response(
      JSON.stringify({ success: true, leadId: newLead.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error processing calendar webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
