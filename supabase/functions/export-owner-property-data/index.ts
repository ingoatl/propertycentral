import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface PropertyExport {
  property_id: string;
  name: string;
  address: string;
  rental_type: string | null;
  property_type: string | null;
  image_url: string | null;
  owner: {
    owner_id: string;
    name: string;
    email: string;
    phone: string | null;
    second_owner_name: string | null;
    second_owner_email: string | null;
  } | null;
  details: {
    brand_name: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sqft: number | null;
    stories: string | null;
    parking_type: string | null;
    parking_spaces: string | null;
    basement: boolean | null;
    fenced_yard: string | null;
    ada_compliant: boolean | null;
  } | null;
  pricing: {
    monthly_rent: number | null;
    nightly_rate: number | null;
    security_deposit: number | null;
    cleaning_fee: number | null;
    pet_fee: number | null;
    admin_fee: number | null;
    utility_cap: number | null;
  } | null;
  platforms: Array<{
    platform_name: string;
    is_active: boolean;
    listing_url: string | null;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const guestConnectUrl = Deno.env.get("GUESTCONNECT_SYNC_URL");
    const partnerApiKey = Deno.env.get("PARTNER_SYNC_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { property_ids, sync_all } = await req.json();

    console.log("[export-owner-property-data] Starting export", { 
      property_ids, 
      sync_all,
      hasGuestConnectUrl: !!guestConnectUrl 
    });

    // Build query for properties
    let propertiesQuery = supabase
      .from("properties")
      .select(`
        id,
        name,
        address,
        rental_type,
        property_type,
        image_path
      `)
      .in("property_type", ["Client-Managed", "Company-Owned"])
      .is("offboarded_at", null);

    if (property_ids && property_ids.length > 0) {
      propertiesQuery = propertiesQuery.in("id", property_ids);
    }

    const { data: properties, error: propError } = await propertiesQuery;

    if (propError) {
      console.error("[export-owner-property-data] Error fetching properties:", propError);
      throw propError;
    }

    console.log(`[export-owner-property-data] Found ${properties?.length || 0} properties to export`);

    const exports: PropertyExport[] = [];

    for (const property of properties || []) {
      // Fetch owner
      const { data: ownerLink } = await supabase
        .from("property_owner_links")
        .select(`
          property_owners (
            id,
            name,
            email,
            phone,
            second_owner_name,
            second_owner_email
          )
        `)
        .eq("property_id", property.id)
        .single();

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

      // Fetch platform listings
      const { data: platforms } = await supabase
        .from("platform_listings")
        .select("platform_name, is_active, listing_url")
        .eq("property_id", property.id);

      const owner = ownerLink?.property_owners as any;

      const exportData: PropertyExport = {
        property_id: property.id,
        name: property.name,
        address: property.address,
        rental_type: property.rental_type,
        property_type: property.property_type,
        image_url: property.image_path,
        owner: owner ? {
          owner_id: owner.id,
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
          second_owner_name: owner.second_owner_name,
          second_owner_email: owner.second_owner_email,
        } : null,
        details: details ? {
          brand_name: details.brand_name,
          bedrooms: details.bedrooms,
          bathrooms: details.bathrooms,
          sqft: details.sqft,
          stories: details.stories,
          parking_type: details.parking_type,
          parking_spaces: details.parking_spaces,
          basement: details.basement,
          fenced_yard: details.fenced_yard,
          ada_compliant: details.ada_compliant,
        } : null,
        pricing: pricing ? {
          monthly_rent: pricing.monthly_rent,
          nightly_rate: pricing.nightly_rate,
          security_deposit: pricing.security_deposit,
          cleaning_fee: pricing.cleaning_fee,
          pet_fee: pricing.pet_fee,
          admin_fee: pricing.admin_fee,
          utility_cap: pricing.utility_cap,
        } : null,
        platforms: platforms || [],
      };

      exports.push(exportData);
    }

    const payload = {
      sync_type: "property_full",
      source_project: "property_central",
      source_project_id: "ijsxcaaqphaciaenlegl",
      timestamp: new Date().toISOString(),
      properties: exports,
    };

    console.log(`[export-owner-property-data] Prepared ${exports.length} properties for export`);

    // If GuestConnect URL is configured, send the data
    let syncResult = null;
    if (guestConnectUrl && partnerApiKey) {
      console.log("[export-owner-property-data] Sending to GuestConnect:", guestConnectUrl);
      
      const syncResponse = await fetch(guestConnectUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": partnerApiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!syncResponse.ok) {
        const errorText = await syncResponse.text();
        console.error("[export-owner-property-data] GuestConnect sync failed:", errorText);
        syncResult = { success: false, error: errorText };
      } else {
        syncResult = await syncResponse.json();
        console.log("[export-owner-property-data] GuestConnect sync successful:", syncResult);
      }

      // Log the sync
      await supabase.from("partner_sync_log").insert({
        sync_type: "outgoing",
        source_system: "guestconnect",
        properties_synced: exports.length,
        properties_failed: syncResult?.success === false ? exports.length : 0,
        sync_status: syncResult?.success === false ? "failed" : "completed",
        error_details: syncResult?.error || null,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        exported_count: exports.length,
        payload,
        sync_result: syncResult,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[export-owner-property-data] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
