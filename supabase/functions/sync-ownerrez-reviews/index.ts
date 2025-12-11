import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ownerrezApiKey = Deno.env.get("OWNERREZ_API_KEY")!;
    const ownerrezUsername = Deno.env.get("OWNERREZ_USERNAME")!;
    const ownerrezPassword = Deno.env.get("OWNERREZ_PASSWORD")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting OwnerRez reviews sync...");

    // Create auth header for OwnerRez
    const authHeader = `Basic ${btoa(`${ownerrezUsername}:${ownerrezPassword}`)}`;

    // Fetch reviews from OwnerRez
    const reviewsResponse = await fetch(
      "https://api.ownerrez.com/v2/reviews?limit=100",
      {
        headers: {
          Authorization: authHeader,
          "X-ApiKey": ownerrezApiKey,
          Accept: "application/json",
        },
      }
    );

    if (!reviewsResponse.ok) {
      console.error("OwnerRez API error:", reviewsResponse.status, reviewsResponse.statusText);
      throw new Error(`OwnerRez API error: ${reviewsResponse.status}`);
    }

    const reviewsData = await reviewsResponse.json();
    console.log(`Fetched ${reviewsData.items?.length || 0} reviews from OwnerRez`);

    // Filter for 5-star Airbnb/VRBO reviews
    const eligibleReviews = (reviewsData.items || []).filter((review: any) => {
      const source = review.source?.toLowerCase() || "";
      const isEligibleSource = source.includes("airbnb") || source.includes("vrbo") || source.includes("homeaway");
      const isFiveStar = review.stars >= 5 || review.rating >= 5;
      return isEligibleSource && isFiveStar;
    });

    console.log(`Found ${eligibleReviews.length} eligible 5-star reviews`);

    let reviewsAdded = 0;
    let reviewsSkipped = 0;

    for (const review of eligibleReviews) {
      const bookingId = review.booking_id || review.bookingId;

      // Check if already exists
      const { data: existing } = await supabase
        .from("ownerrez_reviews")
        .select("id")
        .eq("ownerrez_review_id", String(review.id))
        .single();

      if (existing) {
        reviewsSkipped++;
        continue;
      }

      // Fetch guest details from booking
      let guestName = review.guest_name || review.guestName || null;
      let guestPhone = null;
      let guestEmail = null;
      let propertyId = null;

      if (bookingId) {
        try {
          const bookingResponse = await fetch(
            `https://api.ownerrez.com/v2/bookings/${bookingId}`,
            {
              headers: {
                Authorization: authHeader,
                "X-ApiKey": ownerrezApiKey,
                Accept: "application/json",
              },
            }
          );

          if (bookingResponse.ok) {
            const bookingData = await bookingResponse.json();
            guestName = guestName || bookingData.guest?.name || bookingData.guest_name;
            guestPhone = bookingData.guest?.phone || bookingData.guest_phone;
            guestEmail = bookingData.guest?.email || bookingData.guest_email;

            // Try to map property
            const propertyListingId = bookingData.property_id || bookingData.propertyId;
            if (propertyListingId) {
              const { data: mappedProperty } = await supabase
                .from("properties")
                .select("id")
                .or(`id.eq.${propertyListingId},name.ilike.%${bookingData.property_name || ""}%`)
                .limit(1)
                .single();

              propertyId = mappedProperty?.id || null;
            }
          }
        } catch (e) {
          console.error(`Failed to fetch booking ${bookingId}:`, e);
        }
      }

      // Insert the review
      const { error: insertError } = await supabase.from("ownerrez_reviews").insert({
        booking_id: String(bookingId || review.id),
        ownerrez_review_id: String(review.id),
        guest_name: guestName,
        guest_phone: guestPhone,
        guest_email: guestEmail,
        property_id: propertyId,
        review_source: review.source || "Unknown",
        star_rating: review.stars || review.rating || 5,
        review_text: review.body || review.text || review.review_text || null,
        review_date: review.created_at || review.date || new Date().toISOString(),
      });

      if (insertError) {
        console.error("Insert error:", insertError);
      } else {
        reviewsAdded++;
        console.log(`Added review from ${guestName || "Unknown"}`);

        // Auto-create workflow request if guest has phone
        if (guestPhone) {
          const { data: newReview } = await supabase
            .from("ownerrez_reviews")
            .select("id")
            .eq("ownerrez_review_id", String(review.id))
            .single();

          if (newReview) {
            await supabase.from("google_review_requests").insert({
              review_id: newReview.id,
              guest_phone: guestPhone,
              workflow_status: "pending",
            });
            console.log(`Created workflow request for ${guestName}`);
          }
        }
      }
    }

    console.log(`Sync complete: ${reviewsAdded} added, ${reviewsSkipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        reviewsAdded,
        reviewsSkipped,
        totalEligible: eligibleReviews.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
