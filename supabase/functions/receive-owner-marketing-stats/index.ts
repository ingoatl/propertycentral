import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface MarketingStatsPayload {
  property_source_id?: string;
  property_name?: string;
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
    
    // Method 2: Name matching fallback
    if (!property && payload.property_name) {
      const searchName = payload.property_name.toLowerCase().trim();
      const { data: allProperties } = await supabase
        .from("properties")
        .select("id, name, owner_id")
        .is("offboarded_at", null);
      
      property = allProperties?.find(p => {
        const propName = p.name?.toLowerCase() || "";
        return propName === searchName || 
               propName.includes(searchName) || 
               searchName.includes(propName);
      });
      
      if (property) {
        console.log(`[receive-owner-marketing-stats] Matched by property_name "${payload.property_name}" -> ${property.name}`);
      }
    }

    if (!property) {
      console.error(`[receive-owner-marketing-stats] Property not found: source_id=${payload.property_source_id}, name=${payload.property_name}`);
      return new Response(
        JSON.stringify({ 
          error: "Property not found", 
          source_id: payload.property_source_id,
          property_name: payload.property_name 
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
      error_details: { property_name: property.name, report_month: payload.report_period }
    });

    console.log(`[receive-owner-marketing-stats] Successfully stored marketing stats for ${property.name} (${payload.report_period})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        property_name: property.name,
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
