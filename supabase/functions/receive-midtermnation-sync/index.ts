import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Name mappings for property matching
const PROPERTY_NAME_MAPPINGS: Record<string, string[]> = {
  "canadian way": ["canadian", "tucker"],
  "the berkley": ["berkley"],
  "modern + cozy townhome": ["modern", "cozy", "willow stream"],
  "lavish living": ["lavish", "rita way"],
  "scandinavian retreat": ["scandinavian", "laurel bridge"],
  "smoke hollow": ["smoke", "roswell"],
  "midtown lighthouse": ["midtown", "lighthouse", "piedmont"],
  "whispering oaks": ["whispering", "oaks", "grady smith"],
  "mableton meadows": ["mableton", "woodland"],
  "the bloom": ["bloom"],
};

interface MidTermProperty {
  source_id: string;
  property_title: string;
  address?: string;
  city?: string;
  state?: string;
  bedrooms?: number;
  bathrooms?: number;
  monthly_price?: number;
  status?: string;
  listing_url?: string;
  ical_url?: string;
  featured_image_url?: string;
}

interface SyncPayload {
  sync_type: string;
  source_project: string;
  timestamp: string;
  properties: MidTermProperty[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const expectedApiKey = Deno.env.get("PARTNER_SYNC_API_KEY");

    console.log("[receive-midtermnation-sync] Expected API key configured:", !!expectedApiKey);

    // Validate API key
    const providedApiKey = req.headers.get("x-api-key");
    console.log("[receive-midtermnation-sync] API key provided:", !!providedApiKey);

    if (!providedApiKey || providedApiKey !== expectedApiKey) {
      console.error("[receive-midtermnation-sync] Invalid or missing API key");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    console.log("[receive-midtermnation-sync] API key validated successfully");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload: SyncPayload = await req.json();

    console.log("[receive-midtermnation-sync] Received sync from:", payload.source_project);
    console.log("[receive-midtermnation-sync] Properties count:", payload.properties?.length || 0);

    if (payload.sync_type !== "midterm_properties" && payload.sync_type !== "partner_properties") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid sync type" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Fetch all properties for matching
    const { data: allProperties } = await supabase
      .from("properties")
      .select("id, name, address, owner_id, rental_type")
      .is("offboarded_at", null);

    console.log("[receive-midtermnation-sync] Loaded", allProperties?.length || 0, "properties for matching");

    const results = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      matched: [] as string[],
      errors: [] as string[],
    };

    for (const property of payload.properties || []) {
      try {
        let matchedProperty = null;

        // Method 1: Direct source_id match (if we store it)
        if (property.source_id && !matchedProperty) {
          matchedProperty = allProperties?.find(p => p.id === property.source_id);
          if (matchedProperty) {
            console.log(`[receive-midtermnation-sync] Matched by source_id: ${matchedProperty.name}`);
          }
        }

        // Method 2: Match by property_title
        if (property.property_title && !matchedProperty) {
          const searchName = property.property_title.toLowerCase().trim();
          
          // Try mapped names first
          for (const [pattern, keywords] of Object.entries(PROPERTY_NAME_MAPPINGS)) {
            if (searchName.includes(pattern) || keywords.some(kw => searchName.includes(kw))) {
              matchedProperty = allProperties?.find(p => {
                const propName = p.name?.toLowerCase() || "";
                const propAddr = p.address?.toLowerCase() || "";
                return keywords.some(kw => propName.includes(kw) || propAddr.includes(kw));
              });
              if (matchedProperty) {
                console.log(`[receive-midtermnation-sync] Matched by pattern "${pattern}": ${matchedProperty.name}`);
                break;
              }
            }
          }
          
          // Fallback to direct name match
          if (!matchedProperty) {
            matchedProperty = allProperties?.find(p => {
              const propName = p.name?.toLowerCase() || "";
              return propName === searchName || 
                     propName.includes(searchName) || 
                     searchName.includes(propName);
            });
            if (matchedProperty) {
              console.log(`[receive-midtermnation-sync] Matched by name "${property.property_title}": ${matchedProperty.name}`);
            }
          }
        }

        // Method 3: Match by address
        if (property.address && !matchedProperty) {
          const searchAddr = property.address.toLowerCase().trim();
          matchedProperty = allProperties?.find(p => {
            const propAddr = p.address?.toLowerCase() || "";
            const searchParts = searchAddr.split(/[\s,]+/).filter(s => s.length > 3);
            const matchCount = searchParts.filter(part => propAddr.includes(part)).length;
            return matchCount >= 2 || propAddr.includes(searchAddr);
          });
          if (matchedProperty) {
            console.log(`[receive-midtermnation-sync] Matched by address "${property.address}": ${matchedProperty.name}`);
          }
        }

        if (!matchedProperty) {
          console.warn(`[receive-midtermnation-sync] Property not found: title="${property.property_title}", address="${property.address}"`);
          results.skipped++;
          continue;
        }

        results.matched.push(`${property.property_title || property.source_id} -> ${matchedProperty.name}`);

        // Upsert into partner_properties table
        const partnerRecord = {
          source_id: property.source_id,
          source_system: "midtermnation",
          category: "mid_term",
          property_title: property.property_title,
          address: property.address || null,
          city: property.city || null,
          state: property.state || null,
          bedrooms: property.bedrooms || null,
          bathrooms: property.bathrooms || null,
          monthly_price: property.monthly_price || null,
          status: property.status || "active",
          existing_listing_url: property.listing_url || null,
          ical_url: property.ical_url || null,
          featured_image_url: property.featured_image_url || null,
          synced_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase
          .from("partner_properties")
          .upsert(partnerRecord, {
            onConflict: "source_id,source_system",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error("[receive-midtermnation-sync] Upsert error:", upsertError);
          results.errors.push(`${property.source_id}: ${upsertError.message}`);
        } else {
          results.inserted++;
        }
      } catch (err) {
        console.error("[receive-midtermnation-sync] Property error:", err);
        const errMessage = err instanceof Error ? err.message : "Unknown error";
        results.errors.push(`${property.source_id}: ${errMessage}`);
      }
    }

    // Log the sync
    await supabase.from("partner_sync_log").insert({
      sync_type: "incoming",
      source_system: "midtermnation",
      properties_synced: results.inserted + results.updated,
      properties_failed: results.errors.length,
      sync_status: results.errors.length === 0 ? "completed" : (results.inserted > 0 ? "partial" : "failed"),
      error_details: { errors: results.errors, matched: results.matched, skipped: results.skipped },
    });

    console.log("[receive-midtermnation-sync] Sync complete:", results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        received_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[receive-midtermnation-sync] Error:", error);
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
