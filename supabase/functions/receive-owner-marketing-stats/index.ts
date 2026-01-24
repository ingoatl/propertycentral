import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface MarketingStatsPayload {
  property_source_id?: string;
  property_name?: string;
  marketing_hub_property_id?: string;
  report_period: string;
  social_media?: {
    instagram_posts?: number;
    instagram_stories?: number;
    facebook_posts?: number;
    gmb_posts?: number;
    total_reach?: number;
    total_engagement?: number;
    engagement_rate?: number;
  };
  outreach?: {
    total_companies_contacted?: number;
    industries_targeted?: string[];
    emails_sent?: number;
    calls_made?: number;
    hotsheets_distributed?: number;
    decision_makers_identified?: number;
  };
  visibility?: {
    marketing_active?: boolean;
    included_in_hotsheets?: boolean;
  };
  executive_summary?: string;
  synced_at?: string;
}

// Known property name mappings (Marketing Hub name -> Property Central name)
const PROPERTY_NAME_MAPPINGS: Record<string, string> = {
  // Family Retreat mappings
  "the durham family retreat": "family retreat",
  "durham family retreat": "family retreat",
  "homerun hideaway": "family retreat",
  "the homerun hideaway": "family retreat",
  
  // The Berkley mappings
  "the berkley at chimney lakes": "the berkley",
  "berkley at chimney lakes": "the berkley",
  
  // Alpine mappings
  "the alpine": "alpine",
  
  // Scandinavian Retreat mappings
  "the scandinavian retreat": "scandinavian retreat",
  
  // Modern + Cozy Townhome mappings
  "old roswell retreat": "modern + cozy townhome",
  "the old roswell retreat": "modern + cozy townhome",
  "old roswell": "modern + cozy townhome",
  
  // Woodland Lane mappings
  "mableton meadows": "woodland lane",
  
  // House of Blues / Boho Lux - Note: may need to verify actual property
  "the boho lux": "scandi chic",
  "boho lux": "scandi chic",
  
  // Whispering Oaks mappings
  "the bloom": "whispering oaks farmhouse",
  "bloom": "whispering oaks farmhouse",
  
  // Canadian Way mappings
  "the maple leaf": "canadian way",
  "maple leaf": "canadian way",
  
  // MidTown Lighthouse mappings
  "shift sanctuary": "midtown lighthouse",
  "the shift sanctuary": "midtown lighthouse",
  
  // Smoke Hollow mappings (if exists)
  "alpharetta basecamp": "smoke hollow",
  
  // Lavish Living mappings
  "lavish living atlanta": "lavish living",
  "lavish living - 8 mins from braves stadium w/king": "lavish living",
  
  // Scandi Chic mappings
  "the scandi chic": "scandi chic",
  "scandi chic-mins to ksu/dt, sleeps 5, w/king, pet frndly": "scandi chic",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify API key from Marketing Hub
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("MARKETING_HUB_API_KEY") || 
                        Deno.env.get("PARTNER_SYNC_API_KEY");
    
    console.log("[receive-owner-marketing-stats] API key configured:", !!expectedKey);
    console.log("[receive-owner-marketing-stats] API key provided:", !!apiKey);
    
    if (!apiKey || apiKey !== expectedKey) {
      console.error("[receive-owner-marketing-stats] Unauthorized - invalid API key");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: MarketingStatsPayload = await req.json();
    console.log("[receive-owner-marketing-stats] Received payload:", JSON.stringify(payload, null, 2));

    // Find property by source_id or name matching
    let property = null;
    
    // Method 1: Direct ID match
    if (payload.property_source_id) {
      const { data: directMatch } = await supabase
        .from("properties")
        .select("id, name, owner_id")
        .eq("id", payload.property_source_id)
        .maybeSingle();
      property = directMatch;
      if (property) {
        console.log(`[receive-owner-marketing-stats] Matched by property_id: ${property.name}`);
      }
    }
    
    // Method 2: Name matching fallback with multiple strategies
    if (!property && payload.property_name) {
      const searchName = payload.property_name.toLowerCase().trim();
      
      // Check for known mappings first
      const mappedName = PROPERTY_NAME_MAPPINGS[searchName];
      
      const { data: allProperties } = await supabase
        .from("properties")
        .select("id, name, owner_id")
        .is("offboarded_at", null);
      
      if (allProperties) {
        // Strategy 1: Check known mapping
        if (mappedName) {
          property = allProperties.find(p => 
            p.name?.toLowerCase() === mappedName
          );
          if (property) {
            console.log(`[receive-owner-marketing-stats] Matched via known mapping: "${payload.property_name}" -> ${property.name}`);
          }
        }
        
        // Strategy 2: Exact match
        if (!property) {
          property = allProperties.find(p => 
            p.name?.toLowerCase() === searchName
          );
          if (property) {
            console.log(`[receive-owner-marketing-stats] Matched by exact name: ${property.name}`);
          }
        }
        
        // Strategy 3: Property Central name is contained in Marketing Hub name
        if (!property) {
          property = allProperties.find(p => {
            const propName = p.name?.toLowerCase() || "";
            return searchName.includes(propName) && propName.length > 3;
          });
          if (property) {
            console.log(`[receive-owner-marketing-stats] Matched by property name contained in: "${payload.property_name}" -> ${property.name}`);
          }
        }
        
        // Strategy 4: Marketing Hub name is contained in Property Central name
        if (!property) {
          property = allProperties.find(p => {
            const propName = p.name?.toLowerCase() || "";
            return propName.includes(searchName) && searchName.length > 3;
          });
          if (property) {
            console.log(`[receive-owner-marketing-stats] Matched by name containing: "${payload.property_name}" -> ${property.name}`);
          }
        }
        
        // Strategy 5: Keyword extraction (remove common prefixes like "The")
        if (!property) {
          const cleanedSearch = searchName.replace(/^the\s+/i, "").trim();
          property = allProperties.find(p => {
            const propName = p.name?.toLowerCase().replace(/^the\s+/i, "").trim() || "";
            return propName === cleanedSearch || 
                   propName.includes(cleanedSearch) || 
                   cleanedSearch.includes(propName);
          });
          if (property) {
            console.log(`[receive-owner-marketing-stats] Matched by cleaned keyword: "${payload.property_name}" -> ${property.name}`);
          }
        }
      }
    }

    if (!property) {
      console.error(`[receive-owner-marketing-stats] Property not found: source_id=${payload.property_source_id}, name=${payload.property_name}`);
      console.log(`[receive-owner-marketing-stats] Marketing Hub ID for reference: ${payload.marketing_hub_property_id}`);
      
      // Log the unmatched property for admin review
      await supabase.from("partner_sync_log").insert({
        source_system: "marketing_hub",
        sync_type: "marketing_stats_unmatched",
        properties_synced: 0,
        sync_status: "failed",
        error_details: { 
          property_name: payload.property_name,
          marketing_hub_property_id: payload.marketing_hub_property_id,
          report_month: payload.report_period,
          reason: "Property not found in Property Central"
        }
      });
      
      return new Response(
        JSON.stringify({ 
          error: "Property not found", 
          source_id: payload.property_source_id,
          property_name: payload.property_name,
          marketing_hub_property_id: payload.marketing_hub_property_id,
          suggestion: "Add property name mapping or create property in Property Central"
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert marketing stats
    const { error: upsertError } = await supabase
      .from("property_marketing_stats")
      .upsert({
        property_id: property.id,
        report_month: payload.report_period,
        social_media: payload.social_media || {},
        outreach: payload.outreach || {},
        visibility: payload.visibility || {},
        executive_summary: payload.executive_summary,
        synced_at: new Date().toISOString()
      }, {
        onConflict: "property_id,report_month"
      });

    if (upsertError) {
      console.error("[receive-owner-marketing-stats] Upsert error:", upsertError);
      throw upsertError;
    }

    // Log sync
    await supabase.from("partner_sync_log").insert({
      source_system: "marketing_hub",
      sync_type: "marketing_stats",
      properties_synced: 1,
      sync_status: "completed",
      error_details: { 
        property_name: property.name, 
        report_month: payload.report_period,
        marketing_hub_property_id: payload.marketing_hub_property_id 
      }
    });

    console.log(`[receive-owner-marketing-stats] Successfully stored marketing stats for ${property.name} (${payload.report_period})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        property_name: property.name,
        property_id: property.id,
        report_month: payload.report_period,
        received_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[receive-owner-marketing-stats] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
