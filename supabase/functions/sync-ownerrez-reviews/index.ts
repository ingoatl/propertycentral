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

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Create auth header for OwnerRez
    const credentials = btoa(`${ownerrezUsername}:${ownerrezApiKey}`);
    const authHeader = `Basic ${credentials}`;

    // Check for action parameter
    const body = await req.json().catch(() => ({}));
    const action = body.action || "sync";

    if (action === "backfill_phones") {
      // Backfill phone numbers for existing reviews
      console.log("Starting phone number backfill...");
      
      const { data: reviewsNeedingPhone } = await supabase
        .from("ownerrez_reviews")
        .select("*")
        .is("guest_phone", null);
      
      console.log(`Found ${reviewsNeedingPhone?.length || 0} reviews without phone numbers`);
      
      let updated = 0;
      for (const review of reviewsNeedingPhone || []) {
        const bookingId = review.booking_id;
        if (!bookingId) continue;
        
        try {
          // Fetch booking to get guest_id
          const bookingResponse = await fetch(
            `https://api.ownerrez.com/v2/bookings/${bookingId}`,
            { headers: { Authorization: authHeader, "Content-Type": "application/json" } }
          );
          
          if (!bookingResponse.ok) {
            console.log(`Booking ${bookingId} not found`);
            continue;
          }
          
          const bookingData = await bookingResponse.json();
          const guestId = bookingData.guest?.id || bookingData.guest_id;
          
          let guestPhone = bookingData.guest?.phone;
          let guestEmail = bookingData.guest?.email;
          let guestName = bookingData.guest?.name || bookingData.guest?.first_name;
          
          // Fetch from guest endpoint if needed
          if (guestId && !guestPhone) {
            const guestResponse = await fetch(
              `https://api.ownerrez.com/v2/guests/${guestId}`,
              { headers: { Authorization: authHeader, "Content-Type": "application/json" } }
            );
            
            if (guestResponse.ok) {
              const guestData = await guestResponse.json();
              console.log(`Guest ${guestId} data:`, JSON.stringify(guestData, null, 2));
              guestPhone = guestData.phone || guestData.phones?.[0]?.number || guestData.primary_phone;
              guestEmail = guestEmail || guestData.email || guestData.emails?.[0]?.address;
              guestName = guestName || guestData.name || guestData.first_name;
            }
          }
          
          if (guestPhone || guestEmail || guestName) {
            const updates: any = {};
            if (guestPhone) updates.guest_phone = guestPhone;
            if (guestEmail && !review.guest_email) updates.guest_email = guestEmail;
            if (guestName && !review.guest_name) updates.guest_name = guestName;
            
            if (Object.keys(updates).length > 0) {
              await supabase
                .from("ownerrez_reviews")
                .update(updates)
                .eq("id", review.id);
              
              console.log(`Updated review ${review.id} with:`, updates);
              updated++;
              
              // Create workflow request if phone found and none exists
              if (guestPhone) {
                const { data: existingRequest } = await supabase
                  .from("google_review_requests")
                  .select("id")
                  .eq("review_id", review.id)
                  .maybeSingle();
                
                if (!existingRequest) {
                  await supabase.from("google_review_requests").insert({
                    review_id: review.id,
                    guest_phone: guestPhone,
                    workflow_status: "pending",
                  });
                  console.log(`Created workflow request for review ${review.id}`);
                }
              }
            }
          }
        } catch (e) {
          console.error(`Error processing review ${review.id}:`, e);
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, action: "backfill_phones", updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Standard sync action
    console.log("Starting OwnerRez reviews sync...");

    // Fetch reviews from OwnerRez
    const reviewsResponse = await fetch(
      "https://api.ownerrez.com/v2/reviews?limit=100",
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      }
    );

    if (!reviewsResponse.ok) {
      console.error("OwnerRez API error:", reviewsResponse.status, reviewsResponse.statusText);
      throw new Error(`OwnerRez API error: ${reviewsResponse.status}`);
    }

    const reviewsData = await reviewsResponse.json();
    console.log(`Fetched ${reviewsData.items?.length || 0} reviews from OwnerRez`);
    
    // Log first review structure to understand the data
    if (reviewsData.items?.[0]) {
      console.log("Sample review structure:", JSON.stringify(reviewsData.items[0], null, 2));
    }
    
    // Filter for 5-star Airbnb/VRBO reviews
    // OwnerRez uses "listing_site" field (e.g., "Vrbo", "Airbnb")
    const eligibleReviews = (reviewsData.items || []).filter((review: any) => {
      const listingSite = (review.listing_site || "").toLowerCase();
      const isEligibleSource = listingSite.includes("airbnb") || listingSite.includes("vrbo") || listingSite.includes("homeaway");
      const isFiveStar = review.stars >= 5;
      
      // Try multiple fields for guest name
      const guestName = review.display_name || review.guest_name || review.reviewer_name || review.name;
      
      if (isFiveStar) {
        console.log(`5-star review from ${review.listing_site}, guest: ${guestName}, booking_id: ${review.booking_id}, eligible: ${isEligibleSource}`);
      }
      
      return isEligibleSource && isFiveStar;
    });

    console.log(`Found ${eligibleReviews.length} eligible 5-star reviews`);

    let reviewsAdded = 0;
    let reviewsSkipped = 0;

    for (const review of eligibleReviews) {
      const bookingId = review.booking_id;

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

      // Try multiple fields for guest name from review
      let guestName = review.display_name || review.guest_name || review.reviewer_name || review.name || null;
      let guestPhone = null;
      let guestEmail = null;
      let propertyId = null;

      if (bookingId) {
        try {
          // Fetch booking with guest expansion
          const bookingResponse = await fetch(
            `https://api.ownerrez.com/v2/bookings/${bookingId}?expand=guest`,
            {
              headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
              },
            }
          );

          if (bookingResponse.ok) {
            const bookingData = await bookingResponse.json();
            console.log(`Booking ${bookingId} response:`, JSON.stringify(bookingData, null, 2));
            
            // Extract guest info - try various paths
            const guest = bookingData.guest || {};
            guestName = guestName || guest.name || guest.first_name || bookingData.guest_name;
            guestPhone = guest.phone || guest.primary_phone || guest.cell_phone || guest.phones?.[0]?.number || bookingData.guest_phone;
            guestEmail = guest.email || guest.primary_email || guest.emails?.[0]?.address || bookingData.guest_email;

            // If guest phone not in booking, try fetching from guest endpoint
            const guestId = bookingData.guest?.id || bookingData.guest_id || review.guest_id;
            if (!guestPhone && guestId) {
              try {
                const guestResponse = await fetch(
                  `https://api.ownerrez.com/v2/guests/${guestId}`,
                  {
                    headers: {
                      Authorization: authHeader,
                      "Content-Type": "application/json",
                    },
                  }
                );
                if (guestResponse.ok) {
                  const guestData = await guestResponse.json();
                  console.log(`Guest ${guestId} data:`, JSON.stringify(guestData, null, 2));
                  guestPhone = guestData.phone || guestData.phones?.[0]?.number;
                  guestEmail = guestEmail || guestData.email || guestData.emails?.[0]?.address;
                  guestName = guestName || guestData.name || guestData.first_name;
                }
              } catch (guestErr) {
                console.error(`Failed to fetch guest ${guestId}:`, guestErr);
              }
            }

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
        review_source: review.listing_site || "Unknown",
        star_rating: review.stars || 5,
        review_text: review.body || null,
        review_date: review.date || review.created_utc || new Date().toISOString(),
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
