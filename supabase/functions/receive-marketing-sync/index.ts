import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface MarketingActivity {
  property_id?: string;
  property_name?: string;
  property_address?: string;
  property_city?: string;
  activity_type: string;
  platform?: string;
  title: string;
  description?: string;
  metrics?: Record<string, number>;
  url?: string;
  created_at: string;
  external_id: string;
}

interface SyncPayload {
  sync_type: string;
  source_project: string;
  timestamp: string;
  activities: MarketingActivity[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Use dedicated GuestConnect key, fallback to general partner key for backwards compatibility
    const expectedApiKey = Deno.env.get("GUESTCONNECT_SYNC_API_KEY") || Deno.env.get("PARTNER_SYNC_API_KEY");
    
    console.log("[receive-marketing-sync] Expected API key configured:", !!expectedApiKey);

    // Validate API key
    const providedApiKey = req.headers.get("x-api-key");
    console.log("[receive-marketing-sync] API key provided:", !!providedApiKey);
    
    if (!providedApiKey || providedApiKey !== expectedApiKey) {
      console.error("[receive-marketing-sync] Invalid or missing API key");
      console.error("[receive-marketing-sync] Key match:", providedApiKey === expectedApiKey);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }
    
    console.log("[receive-marketing-sync] API key validated successfully");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload: SyncPayload = await req.json();

    console.log("[receive-marketing-sync] Received sync from:", payload.source_project);
    console.log("[receive-marketing-sync] Activities count:", payload.activities?.length || 0);

    if (payload.sync_type !== "marketing_activities") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid sync type" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Fetch all properties once for matching
    const { data: allProperties } = await supabase
      .from("properties")
      .select("id, name, address, owner_id")
      .is("offboarded_at", null);

    console.log("[receive-marketing-sync] Loaded", allProperties?.length || 0, "properties for matching");

    const results = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      matched: [] as string[],
      errors: [] as string[],
    };

    for (const activity of payload.activities || []) {
      try {
        let property = null;

        // Try to find property by multiple methods
        // Method 1: Direct property_id match (if GuestConnect provides it)
        if (activity.property_id && !property) {
          property = allProperties?.find(p => p.id === activity.property_id);
          if (property) {
            console.log(`[receive-marketing-sync] Matched by property_id: ${property.name}`);
          }
        }

        // Method 2: Match by property_name
        if (activity.property_name && !property) {
          const searchName = activity.property_name.toLowerCase().trim();
          property = allProperties?.find(p => {
            const propName = p.name?.toLowerCase() || "";
            // Exact match or contains
            return propName === searchName || 
                   propName.includes(searchName) || 
                   searchName.includes(propName);
          });
          if (property) {
            console.log(`[receive-marketing-sync] Matched by property_name "${activity.property_name}" -> ${property.name}`);
          }
        }

        // Method 3: Match by property_address
        if (activity.property_address && !property) {
          const searchAddr = activity.property_address.toLowerCase().trim();
          property = allProperties?.find(p => {
            const propAddr = p.address?.toLowerCase() || "";
            // Check if the address contains key parts
            const searchParts = searchAddr.split(/[\s,]+/).filter(s => s.length > 2);
            const matchCount = searchParts.filter(part => propAddr.includes(part)).length;
            return matchCount >= 2 || propAddr.includes(searchAddr) || searchAddr.includes(propAddr);
          });
          if (property) {
            console.log(`[receive-marketing-sync] Matched by property_address "${activity.property_address}" -> ${property.name}`);
          }
        }

        // Method 4: Match by property_city (less precise, use with name keywords)
        if (activity.property_city && activity.property_name && !property) {
          const searchCity = activity.property_city.toLowerCase().trim();
          const searchName = activity.property_name.toLowerCase().trim();
          property = allProperties?.find(p => {
            const propAddr = p.address?.toLowerCase() || "";
            const propName = p.name?.toLowerCase() || "";
            // City must be in address AND name must partially match
            const cityMatch = propAddr.includes(searchCity);
            const namePartMatch = searchName.split(/\s+/).some(word => 
              word.length > 3 && (propName.includes(word) || propAddr.includes(word))
            );
            return cityMatch && namePartMatch;
          });
          if (property) {
            console.log(`[receive-marketing-sync] Matched by city+name "${activity.property_city}" + "${activity.property_name}" -> ${property.name}`);
          }
        }

        // Method 5: Fuzzy match on known property name patterns
        if (activity.property_name && !property) {
          const searchName = activity.property_name.toLowerCase();
          
          // Known property name mappings (expanded for all projects)
          const namePatterns: Record<string, string[]> = {
            "whispering oaks": ["whispering", "oaks", "grady smith", "farmhouse", "bloom"],
            "the alpine": ["alpine", "cabin"],
            "scandinavian retreat": ["scandinavian", "retreat", "laurel bridge"],
            "lavish living": ["lavish", "living", "rita way", "lavish living atlanta"],
            "modern + cozy townhome": ["modern", "cozy", "townhome", "willow stream", "old roswell", "roswell retreat"],
            "scandi chic": ["scandi", "chic", "duvall"],
            "midtown lighthouse": ["midtown", "lighthouse", "piedmont", "shift sanctuary"],
            "house of blues": ["house of blues", "blues", "15 villa", "boho lux", "boho"],
            "smoke hollow": ["smoke hollow", "smoke", "roswell", "alpharetta basecamp", "basecamp"],
            "canadian way": ["canadian", "tucker", "peaceful", "maple leaf"],
            "woodland lane": ["woodland", "mableton", "mableton meadows"],
            "family retreat": ["family retreat", "durham", "homerun hideaway", "homerun"],
            "the berkley": ["berkley", "chimney lakes"],
          };

          for (const [patternName, keywords] of Object.entries(namePatterns)) {
            const matchScore = keywords.filter(kw => searchName.includes(kw)).length;
            if (matchScore >= 1) {
              property = allProperties?.find(p => {
                const propName = p.name?.toLowerCase() || "";
                const propAddr = p.address?.toLowerCase() || "";
                return keywords.some(kw => propName.includes(kw) || propAddr.includes(kw));
              });
              if (property) {
                console.log(`[receive-marketing-sync] Fuzzy matched "${activity.property_name}" via pattern "${patternName}" -> ${property.name}`);
                break;
              }
            }
          }
        }

        if (!property) {
          console.warn(`[receive-marketing-sync] Property not found for activity: name="${activity.property_name}", address="${activity.property_address}", city="${activity.property_city}"`);
          results.skipped++;
          continue;
        }

        results.matched.push(`${activity.property_name || activity.external_id} -> ${property.name}`);

        const activityRecord = {
          property_id: property.id,
          owner_id: property.owner_id || null,
          activity_type: activity.activity_type,
          platform: activity.platform || null,
          title: activity.title,
          description: activity.description || null,
          metrics: activity.metrics || {},
          activity_url: activity.url || null,
          external_id: activity.external_id,
          source_project: payload.source_project,
          activity_date: activity.created_at,
          synced_at: new Date().toISOString(),
        };

        // Upsert using the new unique constraint on (external_id, source_project)
        const { error: upsertError } = await supabase
          .from("owner_marketing_activities")
          .upsert(activityRecord, {
            onConflict: "external_id,source_project",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error("[receive-marketing-sync] Upsert error:", upsertError);
          results.errors.push(`${activity.external_id}: ${upsertError.message}`);
        } else {
          results.inserted++;
        }
      } catch (err) {
        console.error("[receive-marketing-sync] Activity error:", err);
        const errMessage = err instanceof Error ? err.message : "Unknown error";
        results.errors.push(`${activity.external_id}: ${errMessage}`);
      }
    }

    // Log the sync
    await supabase.from("partner_sync_log").insert({
      sync_type: "incoming",
      source_system: payload.source_project,
      properties_synced: results.inserted + results.updated,
      properties_failed: results.errors.length,
      sync_status: results.errors.length === 0 ? "completed" : "partial",
      error_details: results.errors.length > 0 ? { errors: results.errors, matched: results.matched } : { matched: results.matched },
    });

    console.log("[receive-marketing-sync] Sync complete:", results);

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
    console.error("[receive-marketing-sync] Error:", error);
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
