import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Full interface with all possible fields - only populated fields will be sent
interface CommsHubProperty {
  source_id: string;
  property_title?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  distance_from_corporate_hq?: string;
  bedrooms?: number;
  bathrooms?: number;
  square_footage?: number;
  max_guests?: number;
  monthly_price?: number;
  security_deposit?: number;
  cleaning_fee?: number;
  status?: string;
  property_website?: string;
  ical_url?: string;
  amenities?: Record<string, boolean>;
  // Marketing images (5 required types)
  featured_image_url?: string;
  exterior_image_url?: string;
  hero_interior_image_url?: string;
  signature_feature_image_url?: string;
  primary_bedroom_image_url?: string;
  kitchen_image_url?: string;
  gallery_images?: string[];
  virtual_tour_url?: string;
  walkthrough_video_url?: string;
  existing_listing_url?: string;
  // Contact info
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  // Additional property details
  property_type_detail?: string;
  stories?: string;
  parking_type?: string;
  parking_spaces?: string;
  basement?: boolean;
  fenced_yard?: string;
  ada_compliant?: boolean;
  brand_name?: string;
  // Additional pricing
  utility_cap?: number;
  admin_fee?: number;
  pet_fee?: number;
  monthly_pet_rent?: number;
  monthly_cleaning_fee?: number;
  nightly_rate?: number;
  // Rental type
  rental_type?: string;
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

// Build amenities from property data - only include truthy values
function buildAmenities(details: any, policies: any): Record<string, boolean> | undefined {
  const amenities: Record<string, boolean> = {};
  
  // From property_details
  if (details?.ada_compliant) amenities.adaAccessible = true;
  if (details?.fenced_yard === "YES" || details?.fenced_yard === true) amenities.fencedYard = true;
  if (details?.parking_type && details?.parking_type !== "None") amenities.parking = true;
  if (details?.basement) amenities.basement = true;
  
  // From property_policies
  if (policies?.pets_allowed) amenities.petFriendly = true;
  
  // Defaults for furnished MTR properties (these are typically true for managed rentals)
  amenities.fullyFurnished = true;
  amenities.wifi = true;
  amenities.washerDryer = true;
  amenities.centralAC = true;
  amenities.highSpeedInternet = true;

  return Object.keys(amenities).length > 0 ? amenities : undefined;
}

// Remove undefined/null values from object
function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};
  for (const key in obj) {
    const value = obj[key];
    // Keep the value if it's not null, not undefined, and not an empty string
    if (value !== null && value !== undefined && value !== '') {
      // For arrays, only include if not empty
      if (Array.isArray(value) && value.length === 0) continue;
      // For objects, only include if not empty
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
      cleaned[key] = value;
    }
  }
  return cleaned;
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
        owner_id,
        nightly_rate
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

    const commsHubProperties: Partial<CommsHubProperty>[] = [];
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

        // Fetch contact info
        const { data: contactInfo } = await supabase
          .from("property_contact_info")
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

        // Fetch platform listings for URLs
        const { data: platforms } = await supabase
          .from("platform_listings")
          .select("platform_name, listing_url, is_active")
          .eq("property_id", property.id)
          .eq("is_active", true);

        // Find various URLs from platform listings
        const airbnbListing = platforms?.find(
          p => p.platform_name?.toLowerCase().includes("airbnb")
        );
        const vrboListing = platforms?.find(
          p => p.platform_name?.toLowerCase().includes("vrbo")
        );
        const virtualTourListing = platforms?.find(
          p => p.platform_name?.toLowerCase().includes("matterport") ||
               p.listing_url?.includes("matterport") ||
               p.listing_url?.includes("my.matterport")
        );
        const websiteListing = platforms?.find(
          p => p.platform_name?.toLowerCase().includes("website") ||
               p.platform_name?.toLowerCase().includes("direct")
        );
        const walkthroughVideo = platforms?.find(
          p => p.platform_name?.toLowerCase().includes("video") ||
               p.platform_name?.toLowerCase().includes("walkthrough") ||
               p.listing_url?.includes("youtube") ||
               p.listing_url?.includes("vimeo")
        );

        // Parse address
        const parsedAddress = parseAddress(property.address || "");

        // Build description
        const brandName = details?.brand_name || property.name;
        let description = "";
        if (brandName && details?.bedrooms && details?.bathrooms && parsedAddress.city) {
          description = `${brandName} - Beautiful ${details.bedrooms} bedroom, ${details.bathrooms} bath furnished rental in ${parsedAddress.city}. ${property.rental_type === "mid_term" ? "Available for mid-term stays." : "Available for short-term and extended stays."}`;
        }

        // Calculate max guests (2 per bedroom + 2)
        const maxGuests = details?.bedrooms ? (details.bedrooms * 2 + 2) : undefined;

        // Determine status
        const status = "available"; // Could be enhanced with booking data

        // Build the Comms Hub property object with all available data
        const fullPropertyData: CommsHubProperty = {
          // Required identifier
          source_id: property.id,
          
          // Basic info
          property_title: brandName || property.name,
          description: description || undefined,
          
          // Address fields
          address: parsedAddress.street || property.address,
          city: parsedAddress.city || undefined,
          state: parsedAddress.state || undefined,
          zip_code: parsedAddress.zip || undefined,
          
          // Property specs
          bedrooms: details?.bedrooms || undefined,
          bathrooms: details?.bathrooms || undefined,
          square_footage: details?.sqft || undefined,
          max_guests: maxGuests,
          
          // Pricing
          monthly_price: pricing?.monthly_rent || undefined,
          security_deposit: pricing?.security_deposit || undefined,
          cleaning_fee: pricing?.cleaning_fee || undefined,
          utility_cap: pricing?.utility_cap || undefined,
          admin_fee: pricing?.admin_fee || undefined,
          pet_fee: pricing?.pet_fee || undefined,
          monthly_pet_rent: pricing?.monthly_pet_rent || undefined,
          monthly_cleaning_fee: pricing?.monthly_cleaning_fee || undefined,
          nightly_rate: pricing?.nightly_rate || property.nightly_rate || undefined,
          
          // Status
          status: status,
          rental_type: property.rental_type || undefined,
          
          // URLs
          property_website: contactInfo?.website_url || websiteListing?.listing_url || undefined,
          ical_url: property.ical_url || undefined,
          existing_listing_url: airbnbListing?.listing_url || vrboListing?.listing_url || undefined,
          virtual_tour_url: virtualTourListing?.listing_url || undefined,
          walkthrough_video_url: walkthroughVideo?.listing_url || undefined,
          
          // Images - Featured image from property
          featured_image_url: property.image_path || undefined,
          // Note: Specific marketing images would need to be stored and fetched
          // exterior_image_url, hero_interior_image_url, etc. - add when data available
          
          // Amenities
          amenities: buildAmenities(details, policies),
          
          // Contact info (prefer property-specific, fallback to owner)
          contact_name: owner?.name || undefined,
          contact_email: contactInfo?.contact_email || owner?.email || undefined,
          contact_phone: contactInfo?.contact_phone || owner?.phone || undefined,
          
          // Additional property details
          property_type_detail: details?.property_type_detail || undefined,
          stories: details?.stories || undefined,
          parking_type: details?.parking_type || undefined,
          parking_spaces: details?.parking_spaces || undefined,
          basement: details?.basement || undefined,
          fenced_yard: details?.fenced_yard || undefined,
          ada_compliant: details?.ada_compliant || undefined,
          brand_name: details?.brand_name || undefined,
        };

        // Clean the object to remove null/undefined/empty values
        const cleanedProperty = cleanObject(fullPropertyData);
        
        commsHubProperties.push(cleanedProperty);
        
        console.log(`[sync-properties-to-comms-hub] Prepared property ${property.id} with ${Object.keys(cleanedProperty).length} fields`);
        
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
