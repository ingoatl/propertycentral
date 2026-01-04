import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Property mapping: OwnerRez listing name patterns to local property IDs
// This must be kept in sync with the main sync-ownerrez function
function buildPropertyMapping(localProperties: any[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  for (const prop of localProperties || []) {
    const addressLower = prop.address?.toLowerCase() || '';
    
    // Mableton Meadows -> Woodland Lane (184 Woodland Ln)
    if (addressLower.includes('woodland') || addressLower.includes('mableton')) {
      mapping['mableton meadows'] = prop.id;
      mapping['woodland lane'] = prop.id;
      console.log(`Mapped Mableton Meadows/Woodland to ${prop.id} (${prop.name})`);
    }
    
    // Canadian Way / Peaceful 4BR
    if (addressLower.includes('canadian') || addressLower.includes('tucker')) {
      mapping['peaceful 4br family home'] = prop.id;
      mapping['peaceful 4br'] = prop.id;
      mapping['canadian way'] = prop.id;
      mapping['nearemory'] = prop.id;
      console.log(`Mapped Canadian Way to ${prop.id} (${prop.name})`);
    }
    
    // Smoke Hollow
    if (addressLower.includes('smoke hollow')) {
      mapping['smoke hollow'] = prop.id;
      mapping['smoke hollow retreat'] = prop.id;
      console.log(`Mapped Smoke Hollow to ${prop.id} (${prop.name})`);
    }
    
    // Boho Lux Theme
    if (addressLower.includes('14 villa') || (addressLower.includes('villa') && addressLower.includes('14'))) {
      mapping['boho lux'] = prop.id;
      mapping['boho lux theme'] = prop.id;
      console.log(`Mapped Boho Lux to ${prop.id} (${prop.name})`);
    }
    
    // House of Blues Theme / Blues & Boho Haven
    if (addressLower.includes('15 villa') || (addressLower.includes('villa') && addressLower.includes('15'))) {
      mapping['house of blues'] = prop.id;
      mapping['house of blues theme'] = prop.id;
      mapping['blues & boho haven'] = prop.id;
      mapping['the blues & boho haven'] = prop.id;
      console.log(`Mapped House of Blues to ${prop.id} (${prop.name})`);
    }
    
    // Berkeley / Scandi Chic
    if (addressLower.includes('berkeley')) {
      mapping['scandi chic'] = prop.id;
      mapping['scandinavian retreat'] = prop.id;
      console.log(`Mapped Berkeley/Scandi to ${prop.id} (${prop.name})`);
    }
    
    // Lavish Living
    if (addressLower.includes('lavish')) {
      mapping['lavish living'] = prop.id;
      console.log(`Mapped Lavish Living to ${prop.id} (${prop.name})`);
    }
    
    // Midtown Lighthouse
    if (addressLower.includes('midtown') || addressLower.includes('lighthouse')) {
      mapping['midtown lighthouse'] = prop.id;
      console.log(`Mapped Midtown Lighthouse to ${prop.id} (${prop.name})`);
    }
    
    // Alpine
    if (addressLower.includes('alpine')) {
      mapping['the alpine'] = prop.id;
      mapping['alpine'] = prop.id;
      console.log(`Mapped Alpine to ${prop.id} (${prop.name})`);
    }
    
    // Family Retreat
    if (addressLower.includes('family retreat')) {
      mapping['family retreat'] = prop.id;
      console.log(`Mapped Family Retreat to ${prop.id} (${prop.name})`);
    }
  }
  
  return mapping;
}

// Find local property ID from OwnerRez listing/property name
function findPropertyId(propertyName: string, mapping: Record<string, string>): string | null {
  if (!propertyName) return null;
  
  const lowerName = propertyName.toLowerCase();
  
  // Direct match
  for (const [key, id] of Object.entries(mapping)) {
    if (lowerName.includes(key)) {
      return id;
    }
  }
  
  return null;
}

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

    // Fetch local properties to build mapping
    const { data: localProperties } = await supabase
      .from("properties")
      .select("id, name, address");
    
    const propertyMapping = buildPropertyMapping(localProperties || []);
    console.log("Property mapping built:", Object.keys(propertyMapping).length, "entries");

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
      let deleted = 0;
      
      for (const review of reviewsNeedingPhone || []) {
        const bookingId = review.booking_id;
        const ownerrezReviewId = review.ownerrez_review_id;
        if (!bookingId) continue;
        
        try {
          let guestPhone = null;
          let guestEmail = null;
          let guestName = null;
          
          if (ownerrezReviewId) {
            try {
              const reviewResponse = await fetch(
                `https://api.ownerrez.com/v2/reviews/${ownerrezReviewId}`,
                { headers: { Authorization: authHeader, "Content-Type": "application/json" } }
              );
              if (reviewResponse.ok) {
                const reviewData = await reviewResponse.json();
                guestName = reviewData.display_name || reviewData.guest_name || reviewData.reviewer_name;
                console.log(`Review ${ownerrezReviewId}: guest name = ${guestName}`);
              }
            } catch (e) {
              console.log(`Review endpoint failed for ${ownerrezReviewId}`);
            }
          }
          
          // Then try booking endpoint
          const bookingResponse = await fetch(
            `https://api.ownerrez.com/v2/bookings/${bookingId}`,
            { headers: { Authorization: authHeader, "Content-Type": "application/json" } }
          );
          
          if (!bookingResponse.ok) {
            console.log(`Booking ${bookingId} not found - removing orphaned review`);
            await supabase.from("ownerrez_reviews").delete().eq("id", review.id);
            deleted++;
            continue;
          }
          
          const bookingData = await bookingResponse.json();
          const guestId = bookingData.guest?.id || bookingData.guest_id;
          
          guestPhone = bookingData.guest?.phone;
          guestEmail = bookingData.guest?.email;
          guestName = guestName || bookingData.guest?.name || bookingData.guest?.first_name;
          
          // Fetch from guest endpoint if needed
          if (guestId && !guestPhone) {
            const guestResponse = await fetch(
              `https://api.ownerrez.com/v2/guests/${guestId}`,
              { headers: { Authorization: authHeader, "Content-Type": "application/json" } }
            );
            
            if (guestResponse.ok) {
              const guestData = await guestResponse.json();
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
        JSON.stringify({ success: true, action: "backfill_phones", updated, deleted }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Standard sync action - fetch ALL reviews from OwnerRez
    console.log("Starting OwnerRez reviews sync...");

    // Fetch ALL reviews from OwnerRez (not just 100)
    let allReviews: any[] = [];
    let offset = 0;
    const limit = 100;
    
    while (true) {
      const reviewsResponse = await fetch(
        `https://api.ownerrez.com/v2/reviews?limit=${limit}&offset=${offset}`,
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
      const items = reviewsData.items || [];
      allReviews = allReviews.concat(items);
      
      console.log(`Fetched ${items.length} reviews (offset: ${offset}, total so far: ${allReviews.length})`);
      
      if (items.length < limit) {
        break; // No more pages
      }
      offset += limit;
    }
    
    console.log(`Total reviews fetched from OwnerRez: ${allReviews.length}`);
    
    // Log first review structure
    if (allReviews[0]) {
      console.log("Sample review structure:", JSON.stringify(allReviews[0], null, 2));
    }
    
    // Filter for 4+ star Airbnb/VRBO reviews (expanded criteria)
    const eligibleReviews = allReviews.filter((review: any) => {
      const listingSite = (review.listing_site || review.source || "").toLowerCase();
      const isEligibleSource = listingSite.includes("airbnb") || listingSite.includes("vrbo") || 
                               listingSite.includes("homeaway") || listingSite.includes("booking");
      const stars = review.stars || review.overall_rating || review.rating || 0;
      const isGoodRating = stars >= 4;
      
      if (isGoodRating) {
        console.log(`Good review (${stars} stars) from ${review.listing_site}, booking: ${review.booking_id}`);
      }
      
      return isEligibleSource && isGoodRating;
    });

    console.log(`Found ${eligibleReviews.length} eligible reviews (4+ stars)`);

    let reviewsAdded = 0;
    let reviewsUpdated = 0;
    let reviewsSkipped = 0;
    let propertyMappingsMissing: string[] = [];

    for (const review of eligibleReviews) {
      const bookingId = review.booking_id;

      // Check if already exists
      const { data: existing } = await supabase
        .from("ownerrez_reviews")
        .select("id, property_id")
        .eq("ownerrez_review_id", String(review.id))
        .maybeSingle();

      let guestName = review.display_name || review.guest_name || review.reviewer_name || review.name || null;
      let guestPhone = null;
      let guestEmail = null;
      let propertyId = null;
      let propertyName = review.property_name || "";

      // Fetch booking details to get property info and guest details
      if (bookingId) {
        try {
          const bookingResponse = await fetch(
            `https://api.ownerrez.com/v2/bookings/${bookingId}?expand=guest,property`,
            {
              headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
              },
            }
          );

          if (bookingResponse.ok) {
            const bookingData = await bookingResponse.json();
            
            // Get property name from booking
            propertyName = bookingData.property?.name || bookingData.property_name || propertyName;
            
            // Map to local property
            propertyId = findPropertyId(propertyName, propertyMapping);
            
            if (!propertyId && propertyName) {
              // Try looking up from ownerrez_bookings table as backup
              const { data: booking } = await supabase
                .from("ownerrez_bookings")
                .select("property_id")
                .eq("booking_id", String(bookingId))
                .maybeSingle();
              
              if (booking?.property_id) {
                propertyId = booking.property_id;
                console.log(`Found property_id from bookings table for ${propertyName}: ${propertyId}`);
              } else {
                if (!propertyMappingsMissing.includes(propertyName)) {
                  propertyMappingsMissing.push(propertyName);
                  console.log(`No property mapping for: "${propertyName}"`);
                }
              }
            }
            
            // Extract guest info
            const guest = bookingData.guest || {};
            guestName = guestName || guest.name || guest.first_name || bookingData.guest_name;
            guestPhone = guest.phone || guest.primary_phone || guest.cell_phone || guest.phones?.[0]?.number;
            guestEmail = guest.email || guest.primary_email || guest.emails?.[0]?.address;

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
                  guestPhone = guestData.phone || guestData.phones?.[0]?.number;
                  guestEmail = guestEmail || guestData.email || guestData.emails?.[0]?.address;
                  guestName = guestName || guestData.name || guestData.first_name;
                }
              } catch (guestErr) {
                console.error(`Failed to fetch guest ${guestId}:`, guestErr);
              }
            }
          }
        } catch (e) {
          console.error(`Failed to fetch booking ${bookingId}:`, e);
        }
      }

      // If existing, check if we need to update property_id
      if (existing) {
        if (propertyId && !existing.property_id) {
          // Update with property_id
          await supabase
            .from("ownerrez_reviews")
            .update({ property_id: propertyId })
            .eq("id", existing.id);
          reviewsUpdated++;
          console.log(`Updated property_id for review ${existing.id}: ${propertyId}`);
        } else {
          reviewsSkipped++;
        }
        continue;
      }

      // Insert the review
      const { error: insertError, data: insertedReview } = await supabase
        .from("ownerrez_reviews")
        .insert({
          booking_id: String(bookingId || review.id),
          ownerrez_review_id: String(review.id),
          guest_name: guestName,
          guest_phone: guestPhone,
          guest_email: guestEmail,
          property_id: propertyId,
          review_source: review.listing_site || "Unknown",
          star_rating: review.stars || review.overall_rating || 5,
          review_text: review.body || review.public_review || review.comment || null,
          review_date: review.date || review.created_utc || new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
      } else {
        reviewsAdded++;
        console.log(`Added review from ${guestName || "Unknown"} for ${propertyName || "unknown property"}`);

        // Auto-create workflow request if guest has phone
        if (guestPhone && insertedReview) {
          await supabase.from("google_review_requests").insert({
            review_id: insertedReview.id,
            guest_phone: guestPhone,
            workflow_status: "pending",
          });
          console.log(`Created workflow request for ${guestName}`);
        }
      }
    }

    // Now update any reviews that are missing property_id by looking up from bookings table
    console.log("\n=== Fixing reviews with missing property_id ===");
    const { data: reviewsMissingProperty } = await supabase
      .from("ownerrez_reviews")
      .select("id, booking_id")
      .is("property_id", null);
    
    let fixedPropertyIds = 0;
    for (const review of reviewsMissingProperty || []) {
      if (!review.booking_id) continue;
      
      const { data: booking } = await supabase
        .from("ownerrez_bookings")
        .select("property_id")
        .eq("booking_id", review.booking_id)
        .maybeSingle();
      
      if (booking?.property_id) {
        await supabase
          .from("ownerrez_reviews")
          .update({ property_id: booking.property_id })
          .eq("id", review.id);
        fixedPropertyIds++;
        console.log(`Fixed property_id for review ${review.id}`);
      }
    }

    console.log(`\nSync complete: ${reviewsAdded} added, ${reviewsUpdated} updated, ${reviewsSkipped} skipped, ${fixedPropertyIds} property_ids fixed`);
    if (propertyMappingsMissing.length > 0) {
      console.log("Missing property mappings:", propertyMappingsMissing);
    }

    return new Response(
      JSON.stringify({
        success: true,
        reviewsAdded,
        reviewsUpdated,
        reviewsSkipped,
        fixedPropertyIds,
        totalEligible: eligibleReviews.length,
        missingMappings: propertyMappingsMissing,
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
