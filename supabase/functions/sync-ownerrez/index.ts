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
    const ownerrezApiKey = Deno.env.get('OWNERREZ_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!ownerrezApiKey) {
      throw new Error('OWNERREZ_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching listings from OwnerRez...');

    // Fetch all listings from OwnerRez
    const listingsResponse = await fetch('https://api.ownerrez.com/v2/listings', {
      headers: {
        'Authorization': `Bearer ${ownerrezApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!listingsResponse.ok) {
      throw new Error(`OwnerRez API error: ${listingsResponse.statusText}`);
    }

    const listingsData = await listingsResponse.json();
    const listings: OwnerRezListing[] = listingsData.items || [];

    console.log(`Found ${listings.length} listings in OwnerRez`);

    // Filter for specific properties
    const targetProperties = [
      '184 Woodland Ln, Mableton, GA 30126',
      'Villa 14',
      'Villa 15',
    ];

    const filteredListings = listings.filter(listing => 
      targetProperties.some(target => 
        listing.name.toLowerCase().includes(target.toLowerCase()) ||
        listing.address.toLowerCase().includes(target.toLowerCase())
      )
    );

    console.log(`Filtered to ${filteredListings.length} target properties`);

    // Sync each listing
    for (const listing of filteredListings) {
      console.log(`Syncing listing: ${listing.name}`);

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
            'Authorization': `Bearer ${ownerrezApiKey}`,
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

      console.log(`Found ${bookings.length} bookings for ${listing.name}`);

      // Calculate total revenue and management fee (assuming 10% fee)
      let totalRevenue = 0;
      
      for (const booking of bookings) {
        totalRevenue += booking.total || 0;
        
        const managementFee = (booking.total || 0) * 0.10;

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
            total_amount: booking.total || 0,
            management_fee: managementFee,
            booking_status: booking.status,
            sync_date: new Date().toISOString(),
          }, {
            onConflict: 'booking_id',
          });
      }

      console.log(`Synced ${bookings.length} bookings with total revenue: $${totalRevenue}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${filteredListings.length} properties from OwnerRez`,
        listings: filteredListings.map(l => l.name),
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
