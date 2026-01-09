import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PositiveEventPayload {
  owner_id: string;
  property_id?: string;
  event_type: "booking_confirmed" | "great_review" | "issue_resolved" | "monthly_summary";
  event_title: string;
  event_description?: string;
  event_data?: Record<string, unknown>;
  send_notification?: boolean;
  notification_channel?: "sms" | "email";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: PositiveEventPayload = await req.json();
    const {
      owner_id,
      property_id,
      event_type,
      event_title,
      event_description,
      event_data,
      send_notification = true,
      notification_channel = "sms",
    } = payload;

    if (!owner_id || !event_type || !event_title) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: owner_id, event_type, event_title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get owner details
    const { data: owner, error: ownerError } = await supabase
      .from("property_owners")
      .select("id, name, email, phone")
      .eq("id", owner_id)
      .single();

    if (ownerError || !owner) {
      return new Response(
        JSON.stringify({ error: "Owner not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get property name if property_id provided
    let propertyName = "";
    if (property_id) {
      const { data: property } = await supabase
        .from("properties")
        .select("name")
        .eq("id", property_id)
        .single();
      propertyName = property?.name || "";
    }

    // Create positive event record
    const { data: positiveEvent, error: eventError } = await supabase
      .from("positive_events")
      .insert({
        owner_id,
        property_id,
        event_type,
        event_title,
        event_description,
        event_data,
      })
      .select()
      .single();

    if (eventError) {
      console.error("Failed to create positive event:", eventError);
      return new Response(
        JSON.stringify({ error: "Failed to create positive event" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate notification message based on event type
    let message = "";
    let subject = "";

    switch (event_type) {
      case "booking_confirmed":
        const bookingData = event_data as { dates?: string; revenue?: number; guest_name?: string } | undefined;
        message = `Great news, ${owner.name.split(" ")[0]}! 🎉 ${
          propertyName ? `Your property "${propertyName}" just` : "Your property just"
        } received a new booking${bookingData?.dates ? ` for ${bookingData.dates}` : ""}${
          bookingData?.revenue ? ` - $${bookingData.revenue} revenue!` : "!"
        }`;
        subject = `New Booking Confirmed${propertyName ? ` - ${propertyName}` : ""}`;
        break;

      case "great_review":
        const reviewData = event_data as { rating?: number; snippet?: string } | undefined;
        message = `Amazing news, ${owner.name.split(" ")[0]}! ⭐ ${
          propertyName ? `"${propertyName}"` : "Your property"
        } just received a ${reviewData?.rating || 5}-star review${
          reviewData?.snippet ? `: "${reviewData.snippet}"` : "!"
        }`;
        subject = `5-Star Review${propertyName ? ` for ${propertyName}` : ""}!`;
        break;

      case "issue_resolved":
        const issueData = event_data as { issue_type?: string } | undefined;
        message = `All set, ${owner.name.split(" ")[0]}! ✅ ${
          issueData?.issue_type ? `The ${issueData.issue_type} issue` : "The issue"
        } at ${propertyName || "your property"} has been resolved. Everything is back to normal!`;
        subject = `Issue Resolved${propertyName ? ` - ${propertyName}` : ""}`;
        break;

      case "monthly_summary":
        const summaryData = event_data as { revenue?: number; occupancy?: number; bookings?: number } | undefined;
        message = `Monthly update for ${owner.name.split(" ")[0]}! 📊 ${
          propertyName || "Your property"
        }${summaryData?.revenue ? ` earned $${summaryData.revenue}` : ""}${
          summaryData?.occupancy ? ` with ${summaryData.occupancy}% occupancy` : ""
        }${summaryData?.bookings ? ` (${summaryData.bookings} bookings)` : ""}. Keep it up!`;
        subject = `Monthly Performance Summary${propertyName ? ` - ${propertyName}` : ""}`;
        break;

      default:
        message = event_description || event_title;
        subject = event_title;
    }

    // Create notification record
    const { data: notification, error: notifError } = await supabase
      .from("owner_notifications")
      .insert({
        owner_id,
        property_id,
        positive_event_id: positiveEvent.id,
        notification_type: event_type,
        notification_channel,
        message,
        subject,
        status: send_notification ? "pending" : "skipped",
      })
      .select()
      .single();

    if (notifError) {
      console.error("Failed to create notification:", notifError);
    }

    // Send notification if requested
    if (send_notification && notification) {
      try {
        if (notification_channel === "sms" && owner.phone) {
          // Use GHL to send SMS
          const ghlApiKey = Deno.env.get("GHL_API_KEY");
          const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");

          if (ghlApiKey && ghlLocationId) {
            const smsResponse = await fetch(
              `https://services.leadconnectorhq.com/conversations/messages`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${ghlApiKey}`,
                  "Content-Type": "application/json",
                  Version: "2021-04-15",
                },
                body: JSON.stringify({
                  type: "SMS",
                  locationId: ghlLocationId,
                  contactId: null, // Will be looked up by phone
                  phone: owner.phone,
                  message,
                }),
              }
            );

            if (smsResponse.ok) {
              await supabase
                .from("owner_notifications")
                .update({ status: "sent", sent_at: new Date().toISOString() })
                .eq("id", notification.id);
            } else {
              const errorText = await smsResponse.text();
              await supabase
                .from("owner_notifications")
                .update({ status: "failed", error_message: errorText })
                .eq("id", notification.id);
            }
          }
        } else if (notification_channel === "email" && owner.email) {
          // Use existing email function
          const { error: emailError } = await supabase.functions.invoke("send-lead-email", {
            body: {
              to: owner.email,
              toName: owner.name,
              subject,
              body: message,
              contactType: "owner",
            },
          });

          if (!emailError) {
            await supabase
              .from("owner_notifications")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", notification.id);
          } else {
            await supabase
              .from("owner_notifications")
              .update({ status: "failed", error_message: emailError.message })
              .eq("id", notification.id);
          }
        }
      } catch (sendError) {
        console.error("Failed to send notification:", sendError);
        await supabase
          .from("owner_notifications")
          .update({ 
            status: "failed", 
            error_message: sendError instanceof Error ? sendError.message : "Unknown error" 
          })
          .eq("id", notification?.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        positive_event: positiveEvent,
        notification,
        message_preview: message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in owner-positive-update:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
