import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OwnerRezListing {
  id: number;
  name: string;
  address: string;
}

interface OwnerRezBooking {
  id: number;
  listing_id: number;
  guest_name: string;
  arrival: string;
  departure: string;
  total: number;
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
      'woodland': 0.25,  // 25% for Woodland
      'villa 14': 0.20,  // 20% for Villa 14
      'villa 15': 0.20,  // 20% for Villa 15
      'smoke hollow': 0.18,  // 18% for Smoke Hollow
      'canadian way': 0.20,  // 20% for Canadian Way
    };

    // Function to determine management fee rate
    const getManagementFeeRate = (propertyName: string): number => {
      const lowerName = propertyName.toLowerCase();
      for (const [key, rate] of Object.entries(managementFeeRates)) {
        if (lowerName.includes(key)) {
          return rate;
        }
      }
      return 0.20; // Default 20% if not found
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

    // Filter for specific properties
    const targetProperties = [
      '184 Woodland Ln, Mableton, GA 30126',
      'Woodland',
      'Villa 14',
      'Villa 15',
      'Smoke Hollow',
      'Canadian Way',
    ];

    const filteredListings = listings.filter(listing => 
      targetProperties.some(target => 
        listing.name.toLowerCase().includes(target.toLowerCase()) ||
        (listing.address && listing.address.toLowerCase().includes(target.toLowerCase()))
      )
    );

    console.log(`Filtered to ${filteredListings.length} target properties`);

    let totalSyncedBookings = 0;
    let totalRevenue = 0;
    let totalManagementFees = 0;

    // Sync each listing
    for (const listing of filteredListings) {
      console.log(`Syncing listing: ${listing.name}`);

      // Determine management fee rate for this property
      const managementFeeRate = getManagementFeeRate(listing.name);

      // Try to find matching property in our database
      const { data: properties } = await supabase
        .from('properties')
        .select('id, name, address')
        .or(`name.ilike.%${listing.name}%,address.ilike.%${listing.address}%`)
        .limit(1);

      let propertyId = properties?.[0]?.id || null;

      // Fetch bookings for this listing (last 12 months)
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);
      
      const bookingsResponse = await fetch(
        `https://api.ownerrez.com/v2/bookings?listing_id=${listing.id}&arrival_from=${startDate.toISOString().split('T')[0]}`,
        {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!bookingsResponse.ok) {
        console.error(`Failed to fetch bookings for listing ${listing.id}`);
        continue;
      }

      const bookingsData = await bookingsResponse.json();
      const bookings: OwnerRezBooking[] = bookingsData.items || [];

      console.log(`Found ${bookings.length} bookings for ${listing.name} (${(managementFeeRate * 100).toFixed(0)}% management fee)`);

      // Calculate total revenue and management fee
      let listingRevenue = 0;
      let listingManagementFees = 0;
      
      for (const booking of bookings) {
        const bookingTotal = booking.total || 0;
        listingRevenue += bookingTotal;
        
        const managementFee = bookingTotal * managementFeeRate;
        listingManagementFees += managementFee;

        // Upsert booking data
        await supabase
          .from('ownerrez_bookings')
          .upsert({
            property_id: propertyId,
            ownerrez_listing_id: listing.id.toString(),
            ownerrez_listing_name: listing.name,
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

      console.log(`Synced ${bookings.length} bookings - Revenue: $${listingRevenue.toFixed(2)}, Mgmt Fees (${(managementFeeRate * 100).toFixed(0)}%): $${listingManagementFees.toFixed(2)}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${filteredListings.length} properties from OwnerRez`,
        listings: filteredListings.map(l => l.name),
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
