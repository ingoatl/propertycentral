import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface MarketingActivity {
  property_id: string;
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
    const expectedApiKey = Deno.env.get("PARTNER_SYNC_API_KEY");

    // Validate API key
    const providedApiKey = req.headers.get("x-api-key");
    if (!providedApiKey || providedApiKey !== expectedApiKey) {
      console.error("[receive-marketing-sync] Invalid or missing API key");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

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

    const results = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const activity of payload.activities || []) {
      try {
        // Verify property exists
        const { data: property } = await supabase
          .from("properties")
          .select("id")
          .eq("id", activity.property_id)
          .single();

        if (!property) {
          console.warn(`[receive-marketing-sync] Property not found: ${activity.property_id}`);
          results.skipped++;
          continue;
        }

        // Get owner_id for this property
        const { data: ownerLink } = await supabase
          .from("property_owner_links")
          .select("owner_id")
          .eq("property_id", activity.property_id)
          .single();

        // Upsert the activity
        const { error: upsertError } = await supabase
          .from("owner_marketing_activities")
          .upsert(
            {
              property_id: activity.property_id,
              owner_id: ownerLink?.owner_id || null,
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
            },
            {
              onConflict: "external_id,source_project",
              ignoreDuplicates: false,
            }
          );

        if (upsertError) {
          console.error("[receive-marketing-sync] Upsert error:", upsertError);
          results.errors.push(`${activity.external_id}: ${upsertError.message}`);
        } else {
          results.inserted++;
        }
      } catch (err) {
        console.error("[receive-marketing-sync] Activity error:", err);
        results.errors.push(`${activity.external_id}: ${err.message}`);
      }
    }

    // Log the sync
    await supabase.from("partner_sync_log").insert({
      sync_type: "incoming",
      source_system: payload.source_project,
      properties_synced: results.inserted + results.updated,
      properties_failed: results.errors.length,
      sync_status: results.errors.length === 0 ? "completed" : "partial",
      error_details: results.errors.length > 0 ? { errors: results.errors } : null,
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
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
