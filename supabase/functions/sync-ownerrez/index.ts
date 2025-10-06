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
  guest_name: string;
  arrival: string;
  departure: string;
  total_amount: number;
  status: string;
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

    // Define management fee structure per property
    const managementFeeRates: Record<string, number> = {
      'mableton meadows': 0.25,  // 25% for Mableton Meadows
      'boho lux': 0.20,  // 20% for Boho Lux Theme (Villa 14)
      'house of blues': 0.20,  // 20% for House of Blues Theme (Villa 15)
      'blues & boho haven': 0.20,  // 20% for The Blues & Boho Haven (Villa 15)
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
    
    console.log('Fetching all bookings from OwnerRez...');
    const allBookingsResponse = await fetch(
      `https://api.ownerrez.com/v2/bookings?since_utc=${startDate.toISOString()}`,
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

        console.log(`Processing ${bookings.length} bookings for ${propertyName} (${(managementFeeRate * 100).toFixed(0)}% management fee)`);
        console.log(`Sample booking - ID: ${bookings[0]?.id}, Total: $${bookings[0]?.total_amount || 0}`);

        let listingRevenue = 0;
        let listingManagementFees = 0;
        
        for (const booking of bookings) {
          const bookingTotal = booking.total_amount || 0;
          listingRevenue += bookingTotal;
          
          const managementFee = bookingTotal * managementFeeRate;
          listingManagementFees += managementFee;

          // Upsert booking data
          await supabase
            .from('ownerrez_bookings')
            .upsert({
              property_id: null,
              ownerrez_listing_id: listing.property_id.toString(),
              ownerrez_listing_name: propertyName,
              booking_id: booking.id.toString(),
              guest_name: booking.guest_name,
              check_in: booking.arrival,
              check_out: booking.departure,
              total_amount: bookingTotal,
              management_fee: managementFee,
              booking_status: booking.status,
              sync_date: new Date().toISOString(),
            }, {
              onConflict: 'booking_id',
            });
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
