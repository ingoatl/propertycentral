import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface ListingHealth {
  score: number;
  status: "healthy" | "warning" | "critical";
  summary: string;
}

interface PricingIntelligence {
  current_base_rate: number;
  recommended_rate: number;
  rate_change_percent: number;
  market_adr: number;
  mpi_7_day: number;
  mpi_30_day: number;
  occupancy_rate: number;
  competitiveness_score: number;
}

interface Optimization {
  type: string;
  date: string;
  status: string;
  description: string;
  expected_impact: string;
}

interface RevenueAlert {
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  action_taken: string;
}

interface PerformanceTrends {
  booking_velocity_trend: "up" | "down" | "stable";
  ctr_trend: "up" | "down" | "stable";
  conversion_trend: "up" | "down" | "stable";
}

interface PropertyPayload {
  ownerrez_id?: string;
  property_name?: string;
  listing_health?: ListingHealth;
  pricing_intelligence?: PricingIntelligence;
  recent_optimizations?: Optimization[];
  revenue_alerts?: RevenueAlert[];
  performance_trends?: PerformanceTrends;
}

interface SyncPayload {
  sync_timestamp: string;
  properties: PropertyPayload[];
}

// Property name mappings for fuzzy matching (Listing Boost name -> Property Central name)
const PROPERTY_NAME_MAPPINGS: Record<string, string> = {
  "The Berkley at Chimney Lakes": "The Berkley",
  "The Scandinavian Retreat": "Scandinavian Retreat",
  "The Alpine": "Alpine",
  "Lavish Living Atlanta": "Lavish Living",
  "The Scandi Chic": "Scandi Chic",
  "Old Roswell Retreat": "Modern + Cozy Townhome",
  "The Old Roswell Retreat": "Modern + Cozy Townhome",
  "Mableton Meadows": "Woodland Lane",
  "The Boho Lux": "House of Blues", // Closest match if no exact property
  "Homerun Hideaway": "Family Retreat",
  "The Bloom": "Whispering Oaks",
  "The Maple Leaf": "Canadian Way",
  "Shift Sanctuary": "Midtown Lighthouse",
  "Alpharetta Basecamp": "Smoke Hollow",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const partnerApiKey = Deno.env.get("PARTNER_SYNC_API_KEY");

  // Validate API key
  const providedKey = req.headers.get("x-api-key");
  if (!providedKey || providedKey !== partnerApiKey) {
    console.error("Invalid or missing API key");
    return new Response(
      JSON.stringify({ error: "Unauthorized - invalid API key" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const payload: SyncPayload = await req.json();
    console.log("Received PeachHaus sync:", {
      timestamp: payload.sync_timestamp,
      propertyCount: payload.properties?.length || 0,
    });

    if (!payload.properties || !Array.isArray(payload.properties)) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: properties array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all active properties for matching
    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("id, name, rental_type, owner_id")
      .is("offboarded_at", null);

    if (propError) {
      console.error("Failed to fetch properties:", propError);
      throw new Error("Failed to fetch properties");
    }

    // Fetch OwnerRez mappings for ownerrez_id matching
    const { data: ownerrezMappings } = await supabase
      .from("ownerrez_bookings")
      .select("property_id, ownerrez_listing_id")
      .not("property_id", "is", null);

    // Build ownerrez_id to property_id map (deduplicated)
    const ownerrezIdMap: Record<string, string> = {};
    for (const mapping of ownerrezMappings || []) {
      if (mapping.ownerrez_listing_id && mapping.property_id) {
        ownerrezIdMap[mapping.ownerrez_listing_id] = mapping.property_id;
      }
    }

    const results: {
      ownerrez_id?: string;
      property_name?: string;
      status: "processed" | "skipped";
      reason?: string;
      property_id?: string;
    }[] = [];

    const today = new Date().toISOString().split("T")[0];

    for (const prop of payload.properties) {
      let matchedPropertyId: string | null = null;
      let matchedProperty: any = null;

      // Strategy 1: Match by ownerrez_id
      if (prop.ownerrez_id && ownerrezIdMap[prop.ownerrez_id]) {
        matchedPropertyId = ownerrezIdMap[prop.ownerrez_id];
        matchedProperty = properties?.find(p => p.id === matchedPropertyId);
        console.log(`Matched by ownerrez_id ${prop.ownerrez_id} -> ${matchedPropertyId}`);
      }

      // Strategy 2: Match by property name
      if (!matchedPropertyId && prop.property_name) {
        const searchName = prop.property_name.toLowerCase().trim();
        
        // 2a: Check name mappings first
        const mappedName = PROPERTY_NAME_MAPPINGS[prop.property_name];
        if (mappedName) {
          matchedProperty = properties?.find(p => 
            p.name.toLowerCase().trim() === mappedName.toLowerCase()
          );
          if (matchedProperty) {
            matchedPropertyId = matchedProperty.id;
            console.log(`Matched by mapping ${prop.property_name} -> ${mappedName}`);
          }
        }

        // 2b: Exact match
        if (!matchedPropertyId) {
          matchedProperty = properties?.find(p => 
            p.name.toLowerCase().trim() === searchName
          );
          if (matchedProperty) {
            matchedPropertyId = matchedProperty.id;
            console.log(`Matched by exact name: ${prop.property_name}`);
          }
        }

        // 2c: Substring match (either direction)
        if (!matchedPropertyId) {
          matchedProperty = properties?.find(p => {
            const propName = p.name.toLowerCase().trim();
            return propName.includes(searchName) || searchName.includes(propName);
          });
          if (matchedProperty) {
            matchedPropertyId = matchedProperty.id;
            console.log(`Matched by substring: ${prop.property_name} -> ${matchedProperty.name}`);
          }
        }

        // 2d: Clean "The" prefix match
        if (!matchedPropertyId) {
          const cleanedSearch = searchName.replace(/^the\s+/i, "");
          matchedProperty = properties?.find(p => {
            const cleanedProp = p.name.toLowerCase().trim().replace(/^the\s+/i, "");
            return cleanedProp === cleanedSearch || 
                   cleanedProp.includes(cleanedSearch) || 
                   cleanedSearch.includes(cleanedProp);
          });
          if (matchedProperty) {
            matchedPropertyId = matchedProperty.id;
            console.log(`Matched by cleaned name: ${prop.property_name} -> ${matchedProperty.name}`);
          }
        }
      }

      // Check if property was found
      if (!matchedPropertyId || !matchedProperty) {
        console.log(`No match found for: ownerrez_id=${prop.ownerrez_id}, name=${prop.property_name}`);
        results.push({
          ownerrez_id: prop.ownerrez_id,
          property_name: prop.property_name,
          status: "skipped",
          reason: "not_found",
        });
        continue;
      }

      // FILTER: Only process hybrid or STR properties (skip mid_term and long_term)
      const rentalType = matchedProperty.rental_type?.toLowerCase();
      if (rentalType === "mid_term" || rentalType === "long_term") {
        console.log(`Skipping ${matchedProperty.name} - rental_type is ${rentalType}`);
        results.push({
          ownerrez_id: prop.ownerrez_id,
          property_name: prop.property_name,
          status: "skipped",
          reason: "mid_term_rental",
          property_id: matchedPropertyId,
        });
        continue;
      }

      // Upsert PeachHaus stats
      const { error: upsertError } = await supabase
        .from("property_peachhaus_stats")
        .upsert({
          property_id: matchedPropertyId,
          ownerrez_id: prop.ownerrez_id || null,
          sync_date: today,
          listing_health: prop.listing_health || {},
          pricing_intelligence: prop.pricing_intelligence || {},
          recent_optimizations: prop.recent_optimizations || [],
          revenue_alerts: prop.revenue_alerts || [],
          performance_trends: prop.performance_trends || {},
          synced_at: new Date().toISOString(),
        }, {
          onConflict: "property_id,sync_date",
        });

      if (upsertError) {
        console.error(`Failed to upsert stats for ${matchedProperty.name}:`, upsertError);
        results.push({
          ownerrez_id: prop.ownerrez_id,
          property_name: prop.property_name,
          status: "skipped",
          reason: `db_error: ${upsertError.message}`,
          property_id: matchedPropertyId,
        });
        continue;
      }

      console.log(`Successfully synced PeachHaus data for ${matchedProperty.name}`);
      results.push({
        ownerrez_id: prop.ownerrez_id,
        property_name: prop.property_name,
        status: "processed",
        property_id: matchedPropertyId,
      });
    }

    // Log to partner_sync_log
    const processed = results.filter(r => r.status === "processed").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    const skippedDetails = results
      .filter(r => r.status === "skipped")
      .map(r => ({ 
        ownerrez_id: r.ownerrez_id, 
        property_name: r.property_name, 
        reason: r.reason 
      }));

    await supabase.from("partner_sync_log").insert({
      source_system: "peachhaus",
      sync_type: "listing_boost",
      sync_status: processed > 0 ? "completed" : (skipped > 0 ? "partial" : "failed"),
      properties_synced: processed,
      properties_failed: skipped,
      error_details: skipped > 0 ? {
        message: `${skipped} properties skipped`,
        skipped_details: skippedDetails,
      } : { message: "Sync completed successfully" },
    });

    console.log(`[receive-peachhaus-sync] Logged to partner_sync_log: ${processed} processed, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        properties_processed: processed,
        properties_skipped: skipped,
        skipped_details: skippedDetails,
        message: "Sync received successfully",
        received_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("PeachHaus sync error:", errorMessage);
    
    // Log failure
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await supabase.from("partner_sync_log").insert({
      source_system: "peachhaus",
      sync_type: "property_performance",
      sync_status: "failed",
      properties_synced: 0,
      error_details: { message: errorMessage },
    });

    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
