import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OwnerRezListing {
  property_id: number;
  name?: string;  // Property name if available
  bedroom_count?: number;
  bathroom_count?: number;
  occupancy_max?: number;
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
  };
  arrival: string;
  departure: string;
  total_amount: number;
  status: string;
  type?: string;
}

interface OwnerRezGuest {
  id: number;
  first_name: string;
  last_name: string;
  name?: string;
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
      if (addressLower.includes('canadian way') || addressLower.includes('3708')) {
        propertyMapping['canadian way haven'] = prop.id;
        propertyMapping['canadian way'] = prop.id;
        console.log(`Mapped Canadian Way Haven to ${prop.id}`);
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
      'canadian way haven': 0.20,
      'canadian way': 0.20,
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

    // Fetch ALL bookings from OwnerRez (without filtering by property)
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);
    
    console.log('Fetching all bookings with guest details from OwnerRez...');
    const allBookingsResponse = await fetch(
      `https://api.ownerrez.com/v2/bookings?since_utc=${startDate.toISOString()}&expand=guest`,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!allBookingsResponse.ok) {
      const errorText = await allBookingsResponse.text();
      console.error('Failed to fetch bookings from OwnerRez');
      console.error(`Status: ${allBookingsResponse.status}, Response:`, errorText);
      throw new Error(`Failed to fetch bookings: ${allBookingsResponse.statusText}`);
    }

    const allBookingsData = await allBookingsResponse.json();
    const allBookings: OwnerRezBooking[] = allBookingsData.items || [];
    
    console.log(`Found ${allBookings.length} total bookings`);
    
    // Log the first booking structure to see what fields are available
    if (allBookings.length > 0) {
      console.log('First booking structure:', JSON.stringify(allBookings[0], null, 2));
      if (allBookings[0].guest) {
        console.log('Guest data embedded in booking:', JSON.stringify(allBookings[0].guest, null, 2));
      }
    }

    // Fetch all guests to map guest names (need to provide a date filter)
    console.log('Fetching all guests from OwnerRez...');
    const guestStartDate = new Date();
    guestStartDate.setFullYear(guestStartDate.getFullYear() - 5); // Get guests from last 5 years to ensure we get all
    
    const guestsResponse = await fetch(
      `https://api.ownerrez.com/v2/guests?created_since_utc=${guestStartDate.toISOString()}`,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      }
    );

    const guestsMap = new Map<number, OwnerRezGuest>();
    if (guestsResponse.ok) {
      const guestsData = await guestsResponse.json();
      const guests: OwnerRezGuest[] = guestsData.items || [];
      console.log(`Fetched ${guests.length} guests from OwnerRez`);
      
      // Build guest map
      for (const guest of guests) {
        guestsMap.set(guest.id, guest);
      }
      console.log(`Built guest map with ${guestsMap.size} entries`);
    } else {
      console.error('Failed to fetch guests:', guestsResponse.status, await guestsResponse.text());
    }

    let totalSyncedBookings = 0;
    let totalRevenue = 0;
    let totalManagementFees = 0;

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
        console.log(`Sample booking - ID: ${bookings[0]?.id}, Total: $${bookings[0]?.total_amount || 0}`);

        let listingRevenue = 0;
        let listingManagementFees = 0;
        
        for (const booking of bookings) {
          const bookingTotal = booking.total_amount || 0;
          listingRevenue += bookingTotal;
          
          const managementFee = bookingTotal * managementFeeRate;
          listingManagementFees += managementFee;

          // Determine guest name from guest_id lookup
          let guestName: string | null = null;
          
          // Only look up guest name for actual bookings (not blocks)
          if (booking.type !== 'block' && booking.guest_id) {
            const guest = guestsMap.get(booking.guest_id);
            if (guest) {
              if (guest.name) {
                guestName = guest.name;
              } else if (guest.first_name || guest.last_name) {
                guestName = `${guest.first_name || ''} ${guest.last_name || ''}`.trim();
              }
              console.log(`Booking ${booking.id}: Found guest "${guestName}" for guest_id ${booking.guest_id}`);
            } else {
              console.log(`Booking ${booking.id}: No guest found in map for guest_id ${booking.guest_id}`);
            }
          }
          
          console.log(`Booking ${booking.id}: guest_id=${booking.guest_id}, guest_name="${guestName}", type="${booking.type}", status="${booking.status}", has_guest_data=${!!booking.guest}`);

          // Upsert booking data with local property ID if available
          const { data, error } = await supabase
            .from('ownerrez_bookings')
            .upsert({
              property_id: localPropertyId,
              ownerrez_listing_id: listing.property_id.toString(),
              ownerrez_listing_name: propertyName,
              booking_id: booking.id.toString(),
              guest_name: guestName,
              check_in: booking.arrival,
              check_out: booking.departure,
              total_amount: bookingTotal,
              management_fee: managementFee,
              booking_status: booking.status,
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

        console.log(`Synced ${bookings.length} bookings - Revenue: $${listingRevenue.toFixed(2)}, Mgmt Fees: $${listingManagementFees.toFixed(2)}`);
      } catch (error) {
        console.error(`Error syncing property ${listing.property_id}:`, error);
        continue;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${listings.length} properties from OwnerRez`,
        properties: listings.length,
        summary: {
          totalBookings: totalSyncedBookings,
          totalRevenue: totalRevenue.toFixed(2),
          totalManagementFees: totalManagementFees.toFixed(2),
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
