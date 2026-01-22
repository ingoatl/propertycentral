import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OwnerRezListing {
  property_id: number;
  name?: string;
  bedroom_count?: number;
  bathroom_count?: number;
  occupancy_max?: number;
}

interface OwnerRezCharge {
  id: number;
  type: string;
  description?: string;
  amount: number;
  surcharge_id?: number;
}

interface OwnerRezBooking {
  id: number;
  property_id: number;
  property?: {
    id: number;
    name: string;
  };
  guest_id?: number;
  guest?: {
    first_name?: string;
    last_name?: string;
    name?: string;
    email?: string;
  };
  arrival: string;
  departure: string;
  total_amount: number;
  status: string;
  type?: string;
  charges?: OwnerRezCharge[];
  // Guest composition fields
  adults?: number;
  children?: number;
  pets?: number;
  num_adults?: number;
  num_children?: number;
  num_pets?: number;
}

interface OwnerRezGuest {
  id: number;
  first_name: string;
  last_name: string;
  name?: string;
}

/**
 * Parse booking charges to extract fee breakdown
 * According to agreement: Management fee is calculated on nightly accommodation revenue ONLY
 * Excludes: cleaning fees, pet fees, early check-in fees, late checkout fees, other ancillary charges
 */
function parseBookingCharges(charges: OwnerRezCharge[]): {
  accommodationRevenue: number;
  cleaningFee: number;
  petFee: number;
  otherFees: number;
  promotionsDiscount: number;
} {
  let accommodationRevenue = 0;
  let cleaningFee = 0;
  let petFee = 0;
  let otherFees = 0;
  let promotionsDiscount = 0;

  for (const charge of charges || []) {
    const description = (charge.description || '').toLowerCase();
    const amount = Number(charge.amount || 0);
    const chargeType = (charge.type || '').toLowerCase();

    // Handle negative amounts as discounts/promotions
    if (amount < 0) {
      promotionsDiscount += Math.abs(amount);
      console.log(`  Discount/Promotion: -$${Math.abs(amount).toFixed(2)} (${charge.description})`);
      continue;
    }

    // Rental/Accommodation charges - this is what management fee is based on
    if (chargeType === 'rental' || chargeType === 'rent' || 
        description.includes('nightly') || description.includes('accommodation') ||
        description.includes('room rate') || description.includes('rental')) {
      accommodationRevenue += amount;
      console.log(`  Accommodation: $${amount.toFixed(2)} (${charge.description})`);
    }
    // Cleaning fees - pass-through to owner
    else if (description.includes('clean') || description.includes('housekeeping')) {
      cleaningFee += amount;
      console.log(`  Cleaning Fee: $${amount.toFixed(2)} (${charge.description})`);
    }
    // Pet fees - pass-through to owner
    else if (description.includes('pet')) {
      petFee += amount;
      console.log(`  Pet Fee: $${amount.toFixed(2)} (${charge.description})`);
    }
    // Other fees (early check-in, late checkout, etc.) - these are NOT included in management fee base
    else if (description.includes('check-in') || description.includes('checkout') ||
             description.includes('early') || description.includes('late') ||
             chargeType === 'misc' || chargeType === 'surcharge' || chargeType === 'fee') {
      otherFees += amount;
      console.log(`  Other Fee: $${amount.toFixed(2)} (${charge.description})`);
    }
    // Default: treat as accommodation if no specific category matches
    else {
      // Only add to accommodation if it looks like a primary charge
      if (chargeType === '' || chargeType === 'charge') {
        accommodationRevenue += amount;
        console.log(`  Default → Accommodation: $${amount.toFixed(2)} (${charge.description})`);
      } else {
        otherFees += amount;
        console.log(`  Default → Other: $${amount.toFixed(2)} (${charge.description})`);
      }
    }
  }

  return {
    accommodationRevenue,
    cleaningFee,
    petFee,
    otherFees,
    promotionsDiscount
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ownerrezUsername = Deno.env.get('OWNERREZ_USERNAME');
    const ownerrezApiKey = Deno.env.get('OWNERREZ_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!ownerrezUsername || !ownerrezApiKey) {
      throw new Error('OWNERREZ_USERNAME and OWNERREZ_API_KEY must be configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching listings from OwnerRez...');
    console.log('Username present:', !!ownerrezUsername);
    console.log('API Key present:', !!ownerrezApiKey);

    // Fetch local properties to map OwnerRez listings
    const { data: localProperties, error: propertiesError } = await supabase
      .from('properties')
      .select('*');
    
    if (propertiesError) {
      console.error('Failed to fetch local properties:', propertiesError);
      throw propertiesError;
    }

    console.log('Local properties:', localProperties?.map(p => ({ id: p.id, name: p.name })));

    // Map OwnerRez property names to local property IDs based on addresses and names
    const propertyMapping: Record<string, string> = {};
    
    // Map by property name patterns and addresses
    for (const prop of localProperties || []) {
      const propNameLower = prop.name.toLowerCase();
      const addressLower = prop.address?.toLowerCase() || '';
      
      console.log(`Checking property: ${prop.name} at ${prop.address}`);
      
      // Boho Lux Theme (14 Villa Ct SE #14, Smyrna, GA 30080) - 20%
      if (addressLower.includes('14 villa') || (addressLower.includes('villa') && addressLower.includes('14'))) {
        propertyMapping['boho lux'] = prop.id;
        propertyMapping['boho lux theme'] = prop.id;
        console.log(`Mapped Boho Lux to ${prop.id}`);
      }
      
      // House of Blues Theme (15 Villa Ct SE #15, Smyrna, GA 30080) - 20%
      if (addressLower.includes('15 villa') || (addressLower.includes('villa') && addressLower.includes('15'))) {
        propertyMapping['house of blues'] = prop.id;
        propertyMapping['house of blues theme'] = prop.id;
        propertyMapping['blues & boho haven'] = prop.id;
        propertyMapping['the blues & boho haven'] = prop.id;
        console.log(`Mapped House of Blues/Blues & Boho Haven to ${prop.id}`);
      }
      
      // Mableton Meadows (184 Woodland Ln, Mableton, GA 30126) - 25%
      if (addressLower.includes('woodland') || addressLower.includes('184') || propNameLower.includes('woodland')) {
        propertyMapping['mableton meadows'] = prop.id;
        console.log(`Mapped Mableton Meadows to ${prop.id}`);
      }
      
      // Smoke Hollow Retreat (3419 Smoke Hollow Pl, Roswell, GA 30075) - 18%
      if (addressLower.includes('smoke hollow') || addressLower.includes('3419')) {
        propertyMapping['smoke hollow retreat'] = prop.id;
        propertyMapping['smoke hollow'] = prop.id;
        console.log(`Mapped Smoke Hollow Retreat to ${prop.id}`);
      }
      
      // Canadian Way Haven (3708 Canadian Way, Tucker, GA 30084) - 20%
      // OwnerRez listing name: "Peaceful 4BR Family Home w/ Fenced Yard/ NearEmory"
      if (addressLower.includes('canadian way') || addressLower.includes('3708') || addressLower.includes('tucker')) {
        propertyMapping['canadian way haven'] = prop.id;
        propertyMapping['canadian way'] = prop.id;
        propertyMapping['peaceful 4br family home'] = prop.id;
        propertyMapping['peaceful 4br'] = prop.id;
        propertyMapping['fenced yard'] = prop.id;
        propertyMapping['nearemory'] = prop.id;
        console.log(`Mapped Canadian Way Haven / Peaceful 4BR to ${prop.id}`);
      }
    }

    console.log('Property mapping:', propertyMapping);

    // Define management fee structure per property
    // These rates match the properties under PeachHaus management
    const managementFeeRates: Record<string, number> = {
      // Boho Lux Theme - 14 Villa Ct SE #14, Smyrna, GA 30080
      'boho lux': 0.20,
      'boho lux theme': 0.20,
      
      // House of Blues Theme - 15 Villa Ct SE #15, Smyrna, GA 30080
      'house of blues': 0.20,
      'house of blues theme': 0.20,
      
      // The Blues & Boho Haven - Combined 14 & 15 Villa Ct SE
      'blues & boho haven': 0.20,
      'the blues & boho haven': 0.20,
      
      // Mableton Meadows - 184 Woodland Ln, Mableton, GA 30126
      'mableton meadows': 0.25,
      
      // Smoke Hollow Retreat - 3419 Smoke Hollow Pl, Roswell, GA 30075
      'smoke hollow retreat': 0.18,
      'smoke hollow': 0.18,
      
      // Canadian Way Haven - 3708 Canadian Way, Tucker, GA 30084
      // OwnerRez listing: "Peaceful 4BR Family Home w/ Fenced Yard/ NearEmory"
      'canadian way haven': 0.20,
      'canadian way': 0.20,
      'peaceful 4br family home': 0.20,
      'peaceful 4br': 0.20,
      'fenced yard': 0.20,
      'nearemory': 0.20,
    };

    // Function to determine management fee rate based on property name
    const getManagementFeeRate = (propertyId: number, propertyName: string): number => {
      const lowerName = propertyName.toLowerCase();
      console.log(`Checking management fee for property: "${propertyName}" (ID: ${propertyId})`);
      
      for (const [key, rate] of Object.entries(managementFeeRates)) {
        if (lowerName.includes(key)) {
          console.log(`Matched "${key}" - using ${(rate * 100).toFixed(0)}% management fee`);
          return rate;
        }
      }
      console.log(`No match found - property not under management (0% fee)`);
      return 0.00; // Default 0% if not under management
    };

    // Function to get local property ID based on OwnerRez property name
    const getLocalPropertyId = (propertyName: string): string | null => {
      const lowerName = propertyName.toLowerCase();
      
      for (const [key, propertyId] of Object.entries(propertyMapping)) {
        if (lowerName.includes(key)) {
          console.log(`Mapped "${propertyName}" to local property ${propertyId}`);
          return propertyId;
        }
      }
      
      console.log(`No local property mapping found for "${propertyName}"`);
      return null;
    };

    // Fetch all listings from OwnerRez
    // Use HTTP Basic Authentication with username:token
    const credentials = btoa(`${ownerrezUsername}:${ownerrezApiKey}`);
    const authHeader = `Basic ${credentials}`;
    console.log('Using HTTP Basic Authentication');
    
    const listingsResponse = await fetch('https://api.ownerrez.com/v2/listings', {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    console.log('OwnerRez response status:', listingsResponse.status);
    console.log('OwnerRez response headers:', Object.fromEntries(listingsResponse.headers.entries()));
    
    if (!listingsResponse.ok) {
      const errorText = await listingsResponse.text();
      console.error('OwnerRez API error response:', errorText);
      throw new Error(`OwnerRez API error: ${listingsResponse.statusText}`);
    }

    const listingsData = await listingsResponse.json();
    const listings: OwnerRezListing[] = listingsData.items || [];

    console.log(`Found ${listings.length} listings in OwnerRez`);
    console.log('Property IDs:', listings.map(l => l.property_id).join(', '));
    
    // Log the full structure of the first listing to see what fields are available
    if (listings.length > 0) {
      console.log('First listing structure:', JSON.stringify(listings[0], null, 2));
    }

    // Fetch ALL bookings from OwnerRez WITH CHARGES for fee breakdown
    // Go back 36 months to capture all historical data
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 36);
    
    console.log('Fetching all bookings with guest and charges details from OwnerRez...');
    console.log(`Date range: ${startDate.toISOString()} to now`);
    
    // Paginate through ALL bookings
    let allBookings: OwnerRezBooking[] = [];
    let offset = 0;
    const limit = 100;
    
    while (true) {
      const bookingsResponse = await fetch(
        `https://api.ownerrez.com/v2/bookings?since_utc=${startDate.toISOString()}&expand=guest,charges&limit=${limit}&offset=${offset}`,
        {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!bookingsResponse.ok) {
        const errorText = await bookingsResponse.text();
        console.error('Failed to fetch bookings from OwnerRez');
        console.error(`Status: ${bookingsResponse.status}, Response:`, errorText);
        throw new Error(`Failed to fetch bookings: ${bookingsResponse.statusText}`);
      }

      const bookingsData = await bookingsResponse.json();
      const items: OwnerRezBooking[] = bookingsData.items || [];
      allBookings = allBookings.concat(items);
      
      console.log(`Fetched ${items.length} bookings (offset: ${offset}, total so far: ${allBookings.length})`);
      
      if (items.length < limit) {
        break; // No more pages
      }
      offset += limit;
    }

    console.log(`Found ${allBookings.length} total bookings`);
    
    // Log the first booking structure to see what fields are available
    if (allBookings.length > 0) {
      console.log('First booking structure:', JSON.stringify(allBookings[0], null, 2));
      if (allBookings[0].charges) {
        console.log('Charges data available:', allBookings[0].charges.length, 'charges');
      }
    }

    // Fetch all guests to map guest names with pagination
    console.log('Fetching all guests from OwnerRez with pagination...');
    const guestsMap = new Map<number, OwnerRezGuest>();
    
    // Use a very old date to ensure we get all guests
    const guestStartDate = new Date();
    guestStartDate.setFullYear(1970); // Use 1970 to get ALL guests ever
    
    let guestOffset = 0;
    const guestLimit = 100; // Fetch 100 guests per page
    let hasMoreGuests = true;
    
    while (hasMoreGuests) {
      const guestsResponse = await fetch(
        `https://api.ownerrez.com/v2/guests?created_since_utc=${guestStartDate.toISOString()}&limit=${guestLimit}&offset=${guestOffset}`,
        {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (guestsResponse.ok) {
        const guestsData = await guestsResponse.json();
        const guests: OwnerRezGuest[] = guestsData.items || [];
        
        console.log(`Fetched ${guests.length} guests at offset ${guestOffset}`);
        
        // Add guests to map
        for (const guest of guests) {
          guestsMap.set(guest.id, guest);
        }
        
        // Check if we got a full page - if not, we're done
        if (guests.length < guestLimit) {
          hasMoreGuests = false;
        } else {
          guestOffset += guestLimit;
        }
      } else {
        console.error('Failed to fetch guests:', guestsResponse.status, await guestsResponse.text());
        hasMoreGuests = false;
      }
    }
    
    console.log(`Total guests fetched: ${guestsMap.size}`);

    let totalSyncedBookings = 0;
    let totalRevenue = 0;
    let totalManagementFees = 0;
    let totalCleaningFees = 0;
    let totalPetFees = 0;

    // Group bookings by property_id
    const bookingsByProperty = new Map<number, OwnerRezBooking[]>();
    for (const booking of allBookings) {
      if (!bookingsByProperty.has(booking.property_id)) {
        bookingsByProperty.set(booking.property_id, []);
      }
      bookingsByProperty.get(booking.property_id)!.push(booking);
    }

    // Process each listing with its bookings
    for (const listing of listings) {
      try {
        const bookings = bookingsByProperty.get(listing.property_id) || [];
        
        if (bookings.length === 0) {
          console.log(`No bookings found for property ${listing.property_id}`);
          continue;
        }

        // Try to get property name from listing, bookings, or use property_id as fallback
        const propertyName = listing.name || 
                            bookings[0]?.property?.name || 
                            `Property ${listing.property_id}`;
        
        // Get management fee rate for this specific property
        const managementFeeRate = getManagementFeeRate(listing.property_id, propertyName);
        
        // Get local property ID mapping
        const localPropertyId = getLocalPropertyId(propertyName);

        console.log(`Processing ${bookings.length} bookings for ${propertyName} (${(managementFeeRate * 100).toFixed(0)}% management fee)`);

        let listingRevenue = 0;
        let listingManagementFees = 0;
        let listingCleaningFees = 0;
        let listingPetFees = 0;
        
        for (const booking of bookings) {
          console.log(`\nProcessing booking ${booking.id}:`);
          
          // Parse charges to get fee breakdown
          const feeBreakdown = parseBookingCharges(booking.charges || []);
          
          // WATCHDOG: Validate that breakdown sum matches total_amount (with some tolerance)
          const breakdownSum = feeBreakdown.accommodationRevenue + feeBreakdown.cleaningFee + 
                              feeBreakdown.petFee + feeBreakdown.otherFees - feeBreakdown.promotionsDiscount;
          const totalAmount = booking.total_amount || 0;
          
          if (Math.abs(breakdownSum - totalAmount) > 1) {
            console.warn(`⚠️ SYNC WATCHDOG: Fee breakdown mismatch for booking ${booking.id}`);
            console.warn(`  Breakdown sum: $${breakdownSum.toFixed(2)}, Total amount: $${totalAmount.toFixed(2)}`);
            console.warn(`  Difference: $${Math.abs(breakdownSum - totalAmount).toFixed(2)}`);
            
            // If no charges data available, use total_amount as accommodation revenue
            if (!booking.charges || booking.charges.length === 0) {
              console.log(`  No charges data - using total_amount as accommodation revenue`);
              feeBreakdown.accommodationRevenue = totalAmount;
            }
          }
          
          // Management fee is calculated ONLY on accommodation revenue (per agreement)
          const managementFee = feeBreakdown.accommodationRevenue * managementFeeRate;
          
          listingRevenue += totalAmount;
          listingManagementFees += managementFee;
          listingCleaningFees += feeBreakdown.cleaningFee;
          listingPetFees += feeBreakdown.petFee;

          console.log(`  Summary: Accommodation=$${feeBreakdown.accommodationRevenue.toFixed(2)}, ` +
                     `Cleaning=$${feeBreakdown.cleaningFee.toFixed(2)}, Pet=$${feeBreakdown.petFee.toFixed(2)}, ` +
                     `Other=$${feeBreakdown.otherFees.toFixed(2)}, Discount=$${feeBreakdown.promotionsDiscount.toFixed(2)}`);
          console.log(`  Management Fee (${(managementFeeRate * 100).toFixed(0)}% of $${feeBreakdown.accommodationRevenue.toFixed(2)}): $${managementFee.toFixed(2)}`);

          // Determine guest name - check embedded guest data first, then guest_id lookup
          let guestName: string | null = null;
          
          // Only look up guest name for actual bookings (not blocks)
          if (booking.type !== 'block') {
            // First check if guest data is embedded in the booking response
            if (booking.guest) {
              if (booking.guest.name) {
                guestName = booking.guest.name;
              } else if (booking.guest.first_name || booking.guest.last_name) {
                guestName = `${booking.guest.first_name || ''} ${booking.guest.last_name || ''}`.trim();
              }
            }
            
            // If not found in embedded data, look up from guests map
            if (!guestName && booking.guest_id) {
              const guest = guestsMap.get(booking.guest_id);
              if (guest) {
                if (guest.name) {
                  guestName = guest.name;
                } else if (guest.first_name || guest.last_name) {
                  guestName = `${guest.first_name || ''} ${guest.last_name || ''}`.trim();
                }
              }
            }
          }

          // Extract guest counts from booking data
          const adults = booking.adults ?? booking.num_adults ?? null;
          const children = booking.children ?? booking.num_children ?? null;
          const pets = booking.pets ?? booking.num_pets ?? null;
          
          // Get guest email if available
          const guestEmail = booking.guest?.email ?? null;

          // Upsert booking data with fee breakdown and guest composition
          const { error } = await supabase
            .from('ownerrez_bookings')
            .upsert({
              property_id: localPropertyId,
              ownerrez_listing_id: listing.property_id.toString(),
              ownerrez_listing_name: propertyName,
              booking_id: booking.id.toString(),
              guest_name: guestName,
              guest_email: guestEmail,
              check_in: booking.arrival,
              check_out: booking.departure,
              total_amount: totalAmount,
              accommodation_revenue: feeBreakdown.accommodationRevenue,
              cleaning_fee: feeBreakdown.cleaningFee,
              pet_fee: feeBreakdown.petFee,
              other_fees: feeBreakdown.otherFees,
              promotions_discount: feeBreakdown.promotionsDiscount,
              management_fee: managementFee,
              booking_status: booking.status,
              adults: adults,
              children: children,
              pets: pets,
              sync_date: new Date().toISOString(),
            }, {
              onConflict: 'booking_id',
            });
          
          if (error) {
            console.error(`Failed to upsert booking ${booking.id}:`, error);
            throw error;
          }
        }

        totalSyncedBookings += bookings.length;
        totalRevenue += listingRevenue;
        totalManagementFees += listingManagementFees;
        totalCleaningFees += listingCleaningFees;
        totalPetFees += listingPetFees;

        console.log(`\nSynced ${bookings.length} bookings for ${propertyName}:`);
        console.log(`  Total Revenue: $${listingRevenue.toFixed(2)}`);
        console.log(`  Management Fees: $${listingManagementFees.toFixed(2)}`);
        console.log(`  Cleaning Fees (pass-through): $${listingCleaningFees.toFixed(2)}`);
        console.log(`  Pet Fees (pass-through): $${listingPetFees.toFixed(2)}`);
      } catch (error) {
        console.error(`Error syncing property ${listing.property_id}:`, error);
        continue;
      }
    }

    // Sync reviews from OwnerRez bookings (reviews are linked to bookings)
    console.log('\n========== SYNCING REVIEWS ==========');
    let totalReviewsSynced = 0;
    
    for (const booking of allBookings) {
      try {
        // Fetch reviews for this booking
        const reviewsResponse = await fetch(
          `https://api.ownerrez.com/v2/bookings/${booking.id}/reviews`,
          {
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (reviewsResponse.ok) {
          const reviewsData = await reviewsResponse.json();
          const reviews = reviewsData.items || [];
          
          for (const review of reviews) {
            // Get guest name from the booking
            let guestName = 'Guest';
            if (booking.guest) {
              guestName = booking.guest.name || `${booking.guest.first_name || ''} ${booking.guest.last_name || ''}`.trim() || 'Guest';
            } else if (booking.guest_id && guestsMap.has(booking.guest_id)) {
              const guest = guestsMap.get(booking.guest_id)!;
              guestName = guest.name || `${guest.first_name || ''} ${guest.last_name || ''}`.trim() || 'Guest';
            }
            
            // Find local property ID for this booking
            const propertyName = listings.find(l => l.property_id === booking.property_id)?.name || '';
            const localPropertyId = getLocalPropertyId(propertyName);
            
            // Upsert review
            const { error } = await supabase
              .from('ownerrez_reviews')
              .upsert({
                booking_id: booking.id.toString(),
                ownerrez_review_id: review.id?.toString() || `review_${booking.id}`,
                guest_name: guestName,
                property_id: localPropertyId,
                star_rating: review.overall_rating || review.rating || 5,
                review_text: review.public_review || review.comment || review.text || '',
                review_date: review.created_utc || review.date || new Date().toISOString(),
                review_source: 'OwnerRez',
              }, {
                onConflict: 'booking_id',
              });
            
            if (error) {
              console.error(`Failed to upsert review for booking ${booking.id}:`, error);
            } else {
              totalReviewsSynced++;
              console.log(`Synced review for booking ${booking.id}: ${guestName}`);
            }
          }
        }
      } catch (reviewError) {
        // Reviews endpoint may not exist for all bookings, continue silently
        continue;
      }
    }
    
    console.log(`Total Reviews Synced: ${totalReviewsSynced}`);

    console.log('\n========== SYNC SUMMARY ==========');
    console.log(`Total Bookings Synced: ${totalSyncedBookings}`);
    console.log(`Total Reviews Synced: ${totalReviewsSynced}`);
    console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`Total Management Fees: $${totalManagementFees.toFixed(2)}`);
    console.log(`Total Cleaning Fees (pass-through): $${totalCleaningFees.toFixed(2)}`);
    console.log(`Total Pet Fees (pass-through): $${totalPetFees.toFixed(2)}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${listings.length} properties from OwnerRez`,
        properties: listings.length,
        summary: {
          totalBookings: totalSyncedBookings,
          totalReviews: totalReviewsSynced,
          totalRevenue: totalRevenue.toFixed(2),
          totalManagementFees: totalManagementFees.toFixed(2),
          totalCleaningFees: totalCleaningFees.toFixed(2),
          totalPetFees: totalPetFees.toFixed(2),
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error syncing OwnerRez data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
