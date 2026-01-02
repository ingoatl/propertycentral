import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Fetching public properties...");

    // Fetch managed properties with details and pricing
    const { data: managedProperties, error: managedError } = await supabase
      .from("properties")
      .select(`
        id,
        name,
        address,
        property_type,
        rental_type,
        image_path,
        property_details (
          brand_name,
          bedrooms,
          bathrooms,
          sqft,
          parking_type,
          parking_spaces
        ),
        property_pricing_history (
          monthly_rent,
          nightly_rate,
          is_current
        )
      `);

    if (managedError) {
      console.error("Error fetching managed properties:", managedError);
      throw managedError;
    }

    // Fetch partner properties with Zillow pricing
    const { data: partnerProperties, error: partnerError } = await supabase
      .from("partner_properties")
      .select("*, zillow_rent_zestimate, calculated_listing_price, zillow_last_fetched")
      .eq("status", "active");

    if (partnerError) {
      console.error("Error fetching partner properties:", partnerError);
      throw partnerError;
    }

    // Parse city and state from address
    const parseLocation = (address: string) => {
      const parts = address.split(",").map(p => p.trim());
      if (parts.length >= 2) {
        const stateZip = parts[parts.length - 1];
        const city = parts[parts.length - 2];
        const stateMatch = stateZip.match(/([A-Z]{2})/);
        return {
          city,
          state: stateMatch ? stateMatch[1] : "",
        };
      }
      return { city: "", state: "" };
    };

    // Transform managed properties
    const transformedManaged = (managedProperties || []).map((p: any) => {
      const details = p.property_details;
      const currentPricing = p.property_pricing_history?.find((ph: any) => ph.is_current);
      const location = parseLocation(p.address);

      return {
        id: p.id,
        name: p.name,
        brand_name: details?.brand_name || null,
        address: p.address,
        city: location.city,
        state: location.state,
        bedrooms: details?.bedrooms || null,
        bathrooms: details?.bathrooms || null,
        sqft: details?.sqft || null,
        monthly_rent: currentPricing?.monthly_rent || null,
        nightly_rate: currentPricing?.nightly_rate || null,
        image_url: p.image_path || null,
        property_type: p.property_type || "managed",
        rental_type: p.rental_type || "short-term",
        parking_type: details?.parking_type || null,
        parking_spaces: details?.parking_spaces || null,
        source: "property_central",
      };
    });

    // Transform partner properties - use calculated_listing_price (2.3x Zillow) if available
    const transformedPartner = (partnerProperties || []).map((p: any) => ({
      id: p.id,
      name: p.property_title || p.address,
      brand_name: null,
      address: p.address,
      city: p.city,
      state: p.state,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      sqft: p.square_footage,
      monthly_rent: p.calculated_listing_price || p.monthly_price,
      zillow_rent_zestimate: p.zillow_rent_zestimate || null,
      midtermnation_price: p.monthly_price,
      price_source: p.calculated_listing_price ? "zillow_calculated" : "midtermnation",
      nightly_rate: null,
      image_url: p.featured_image_url,
      property_type: "partner",
      rental_type: "mid-term",
      parking_type: p.parking_type,
      parking_spaces: p.parking_spaces,
      source: "midtermnation",
    }));

    const allProperties = [...transformedManaged, ...transformedPartner];

    console.log(`Returning ${allProperties.length} properties (${transformedManaged.length} managed, ${transformedPartner.length} partner)`);

    return new Response(
      JSON.stringify({
        properties: allProperties,
        last_updated: new Date().toISOString(),
        count: allProperties.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in get-public-properties:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
