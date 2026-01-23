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
    // Use dedicated GuestConnect key, fallback to general partner key for backwards compatibility
    const expectedApiKey = Deno.env.get("GUESTCONNECT_SYNC_API_KEY") || Deno.env.get("PARTNER_SYNC_API_KEY");

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
        // Verify property exists and get owner_id directly from properties table
        const { data: property } = await supabase
          .from("properties")
          .select("id, owner_id")
          .eq("id", activity.property_id)
          .single();

        if (!property) {
          console.warn(`[receive-marketing-sync] Property not found: ${activity.property_id}`);
          results.skipped++;
          continue;
        }

        console.log(`[receive-marketing-sync] Found property ${property.id} with owner_id: ${property.owner_id}`);

        // Upsert the activity - use owner_id directly from property
        const { error: upsertError } = await supabase
          .from("owner_marketing_activities")
          .upsert(
            {
              property_id: activity.property_id,
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
