import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CommsHubProperty {
  source_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  square_footage: number | null;
  max_guests: number;
  monthly_price: number | null;
  security_deposit: number | null;
  cleaning_fee: number | null;
  description: string;
  featured_image_url: string | null;
  gallery_images: string[];
  amenities: Record<string, boolean>;
  virtual_tour_url: string | null;
  ical_url: string | null;
  existing_listing_url: string | null;
  status: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

// Parse address into components
function parseAddress(fullAddress: string): { street: string; city: string; state: string; zip: string } {
  // Pattern: "Street, City, State ZIP" or "Street, City State ZIP"
  const match = fullAddress.match(/^(.+?),\s*([^,]+?),?\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/);
  if (match) {
    return {
      street: match[1].trim(),
      city: match[2].trim(),
      state: match[3].trim(),
      zip: match[4].trim(),
    };
  }
  
  // Alternative pattern: "Street, City, State" (no zip)
  const altMatch = fullAddress.match(/^(.+?),\s*([^,]+?),\s*([A-Z]{2})$/);
  if (altMatch) {
    return {
      street: altMatch[1].trim(),
      city: altMatch[2].trim(),
      state: altMatch[3].trim(),
      zip: "",
    };
  }
  
  return { street: fullAddress, city: "", state: "", zip: "" };
}

// Build amenities from property data
function buildAmenities(details: any, policies: any): Record<string, boolean> {
  return {
    // From property_details
    adaAccessible: details?.ada_compliant || false,
    fencedYard: details?.fenced_yard === "YES" || details?.fenced_yard === true,
    parking: !!details?.parking_type && details?.parking_type !== "None",
    
    // From property_policies
    petFriendly: policies?.pets_allowed || false,
    
    // Defaults for furnished MTR properties
    fullyFurnished: true,
    wifi: true,
    washerDryer: true,
    centralAC: true,
    highSpeedInternet: true,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const commsHubUrl = Deno.env.get("COMMS_HUB_SYNC_URL");
    const partnerApiKey = Deno.env.get("PARTNER_SYNC_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine for sync_all
    }
    
    const { property_ids, sync_all, triggered_by } = body as {
      property_ids?: string[];
      sync_all?: boolean;
      triggered_by?: string;
    };

    console.log("[sync-properties-to-comms-hub] Starting sync", { 
      property_ids, 
      sync_all,
      triggered_by,
      hasCommsHubUrl: !!commsHubUrl 
    });

    if (!commsHubUrl) {
      console.error("[sync-properties-to-comms-hub] COMMS_HUB_SYNC_URL not configured");
      return new Response(
        JSON.stringify({ success: false, error: "COMMS_HUB_SYNC_URL not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Build query for properties
    let propertiesQuery = supabase
      .from("properties")
      .select(`
        id,
        name,
        address,
        rental_type,
        property_type,
        image_path,
        ical_url,
        owner_id
      `)
      .in("property_type", ["Client-Managed", "Company-Owned"])
      .is("offboarded_at", null);

    if (property_ids && property_ids.length > 0) {
      propertiesQuery = propertiesQuery.in("id", property_ids);
    }

    const { data: properties, error: propError } = await propertiesQuery;

    if (propError) {
      console.error("[sync-properties-to-comms-hub] Error fetching properties:", propError);
      throw propError;
    }

    console.log(`[sync-properties-to-comms-hub] Found ${properties?.length || 0} properties to sync`);

    const commsHubProperties: CommsHubProperty[] = [];
    const errors: Array<{ property_id: string; error: string }> = [];

    for (const property of properties || []) {
      try {
        // Fetch property details
        const { data: details } = await supabase
          .from("property_details")
          .select("*")
          .eq("property_id", property.id)
          .single();

        // Fetch current pricing
        const { data: pricing } = await supabase
          .from("property_pricing_history")
          .select("*")
          .eq("property_id", property.id)
          .eq("is_current", true)
          .single();

        // Fetch policies
        const { data: policies } = await supabase
          .from("property_policies")
          .select("*")
          .eq("property_id", property.id)
          .single();

        // Fetch owner info
        let owner = null;
        if (property.owner_id) {
          const { data: ownerData } = await supabase
            .from("property_owners")
            .select("name, email, phone")
            .eq("id", property.owner_id)
            .single();
          owner = ownerData;
        }

        // Fetch platform listings for existing URLs
        const { data: platforms } = await supabase
          .from("platform_listings")
          .select("platform_name, listing_url, is_active")
          .eq("property_id", property.id)
          .eq("is_active", true);

        // Find Airbnb or VRBO listing URL
        const existingListingUrl = platforms?.find(
          p => p.platform_name?.toLowerCase().includes("airbnb") || 
               p.platform_name?.toLowerCase().includes("vrbo")
        )?.listing_url || null;

        // Find virtual tour URL
        const virtualTourUrl = platforms?.find(
          p => p.platform_name?.toLowerCase().includes("matterport") ||
               p.listing_url?.includes("matterport") ||
               p.listing_url?.includes("my.matterport")
        )?.listing_url || null;

        // Parse address
        const parsedAddress = parseAddress(property.address || "");

        // Build description
        const brandName = details?.brand_name || property.name;
        const description = `${brandName} - Beautiful ${details?.bedrooms || 0} bedroom, ${details?.bathrooms || 0} bath furnished rental in ${parsedAddress.city || "the area"}. ${property.rental_type === "mid_term" ? "Available for mid-term stays." : "Available for short-term and extended stays."}`;

        // Calculate max guests (2 per bedroom + 2)
        const maxGuests = (details?.bedrooms || 1) * 2 + 2;

        // Build the Comms Hub property object
        const commsHubProperty: CommsHubProperty = {
          source_id: property.id,
          name: brandName || property.name,
          address: parsedAddress.street || property.address,
          city: parsedAddress.city,
          state: parsedAddress.state,
          zip_code: parsedAddress.zip,
          bedrooms: details?.bedrooms || 0,
          bathrooms: details?.bathrooms || 0,
          square_footage: details?.sqft || null,
          max_guests: maxGuests,
          monthly_price: pricing?.monthly_rent || null,
          security_deposit: pricing?.security_deposit || null,
          cleaning_fee: pricing?.cleaning_fee || null,
          description: description,
          featured_image_url: property.image_path || null,
          gallery_images: [], // Could fetch from storage if needed
          amenities: buildAmenities(details, policies),
          virtual_tour_url: virtualTourUrl,
          ical_url: property.ical_url || null,
          existing_listing_url: existingListingUrl,
          status: "available",
          contact_name: owner?.name || null,
          contact_email: owner?.email || null,
          contact_phone: owner?.phone || null,
        };

        commsHubProperties.push(commsHubProperty);
      } catch (err: any) {
        console.error(`[sync-properties-to-comms-hub] Error processing property ${property.id}:`, err);
        errors.push({ property_id: property.id, error: err.message || "Unknown error" });
      }
    }

    console.log(`[sync-properties-to-comms-hub] Prepared ${commsHubProperties.length} properties for sync`);

    // Send to Communications Hub
    let syncResult: any = null;
    try {
      console.log("[sync-properties-to-comms-hub] Sending to Comms Hub:", commsHubUrl);
      
      const syncResponse = await fetch(commsHubUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": partnerApiKey || "",
        },
        body: JSON.stringify({ properties: commsHubProperties }),
      });

      if (!syncResponse.ok) {
        const errorText = await syncResponse.text();
        console.error("[sync-properties-to-comms-hub] Comms Hub sync failed:", errorText);
        syncResult = { success: false, error: errorText };
      } else {
        syncResult = await syncResponse.json();
        console.log("[sync-properties-to-comms-hub] Comms Hub sync successful:", syncResult);
      }
    } catch (fetchErr: any) {
      console.error("[sync-properties-to-comms-hub] Fetch error:", fetchErr);
      syncResult = { success: false, error: fetchErr.message || "Network error" };
    }

    // Log the sync
    await supabase.from("partner_sync_log").insert({
      sync_type: "outgoing",
      source_system: "comms_hub",
      properties_synced: commsHubProperties.length,
      properties_failed: errors.length,
      sync_status: syncResult?.success === false ? "failed" : "completed",
      error_details: syncResult?.error || (errors.length > 0 ? errors : null),
    });

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: commsHubProperties.length,
        failed_count: errors.length,
        errors: errors.length > 0 ? errors : undefined,
        sync_result: syncResult,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[sync-properties-to-comms-hub] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
