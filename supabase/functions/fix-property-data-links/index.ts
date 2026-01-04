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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting property data linking...");

    // Get all properties with their ownerrez listing names for matching
    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("id, name, address")
      .is("offboarded_at", null);

    if (propError) {
      throw new Error(`Failed to fetch properties: ${propError.message}`);
    }

    console.log(`Found ${properties?.length || 0} active properties`);

    let bookingsLinked = 0;
    let reviewsLinked = 0;
    let reviewsLinkedViaBooking = 0;

    // Link orphaned ownerrez_bookings to properties
    const { data: orphanedBookings } = await supabase
      .from("ownerrez_bookings")
      .select("id, ownerrez_listing_name, property_id, booking_id")
      .is("property_id", null);

    console.log(`Found ${orphanedBookings?.length || 0} orphaned bookings`);

    for (const booking of orphanedBookings || []) {
      // Try to match by listing name
      const matchedProperty = properties?.find(p => {
        const listingName = booking.ownerrez_listing_name?.toLowerCase() || "";
        const propName = p.name?.toLowerCase() || "";
        const propAddress = p.address?.toLowerCase() || "";
        
        return listingName.includes(propName) || 
               propName.includes(listingName) ||
               listingName.includes(propAddress.split(",")[0]) ||
               propAddress.includes(listingName);
      });

      if (matchedProperty) {
        const { error } = await supabase
          .from("ownerrez_bookings")
          .update({ property_id: matchedProperty.id })
          .eq("id", booking.id);

        if (!error) {
          bookingsLinked++;
        }
      }
    }

    // Now get all bookings with property_ids for review linking
    const { data: allBookingsWithProperty } = await supabase
      .from("ownerrez_bookings")
      .select("booking_id, property_id")
      .not("property_id", "is", null);

    // Create a map of booking_id to property_id
    const bookingToPropertyMap = new Map<string, string>();
    (allBookingsWithProperty || []).forEach(b => {
      if (b.booking_id && b.property_id) {
        bookingToPropertyMap.set(b.booking_id, b.property_id);
      }
    });

    console.log(`Built booking-to-property map with ${bookingToPropertyMap.size} entries`);

    // Link orphaned ownerrez_reviews to properties via bookings
    const { data: orphanedReviews } = await supabase
      .from("ownerrez_reviews")
      .select("id, booking_id, property_id")
      .is("property_id", null);

    console.log(`Found ${orphanedReviews?.length || 0} orphaned reviews`);

    for (const review of orphanedReviews || []) {
      if (review.booking_id) {
        // First check our local map
        const mappedPropertyId = bookingToPropertyMap.get(review.booking_id);
        
        if (mappedPropertyId) {
          const { error } = await supabase
            .from("ownerrez_reviews")
            .update({ property_id: mappedPropertyId })
            .eq("id", review.id);

          if (!error) {
            reviewsLinkedViaBooking++;
            reviewsLinked++;
          }
          continue;
        }

        // Fallback: Try to find the booking and get its property_id from DB
        const { data: booking } = await supabase
          .from("ownerrez_bookings")
          .select("property_id")
          .eq("booking_id", review.booking_id)
          .not("property_id", "is", null)
          .single();

        if (booking?.property_id) {
          const { error } = await supabase
            .from("ownerrez_reviews")
            .update({ property_id: booking.property_id })
            .eq("id", review.id);

          if (!error) {
            reviewsLinked++;
          }
        }
      }
    }

    console.log(`Linking complete: ${bookingsLinked} bookings, ${reviewsLinked} reviews linked (${reviewsLinkedViaBooking} via booking map)`);

    return new Response(
      JSON.stringify({
        success: true,
        bookingsLinked,
        reviewsLinked,
        reviewsLinkedViaBooking,
        totalProperties: properties?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in fix-property-data-links:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
