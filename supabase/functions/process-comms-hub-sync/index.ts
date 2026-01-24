import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function processes the comms hub sync queue
// Can be called by a cron job or manually
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[process-comms-hub-sync] Processing pending syncs...");

    // Get pending items from queue
    const { data: pendingItems, error: queueError } = await supabase
      .from("comms_hub_sync_queue")
      .select("id, property_id, sync_type")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (queueError) {
      console.error("[process-comms-hub-sync] Error fetching queue:", queueError);
      throw queueError;
    }

    if (!pendingItems || pendingItems.length === 0) {
      console.log("[process-comms-hub-sync] No pending items to sync");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No pending items" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-comms-hub-sync] Found ${pendingItems.length} pending items`);

    // Extract property IDs
    const propertyIds = pendingItems.map(item => item.property_id);

    // Mark items as processing
    await supabase
      .from("comms_hub_sync_queue")
      .update({ status: "processing" })
      .in("property_id", propertyIds);

    // Call the main sync function
    const { data: syncResult, error: syncError } = await supabase.functions.invoke(
      "sync-properties-to-comms-hub",
      {
        body: { 
          property_ids: propertyIds,
          triggered_by: "queue_processor"
        }
      }
    );

    if (syncError) {
      console.error("[process-comms-hub-sync] Sync error:", syncError);
      
      // Mark items as failed
      await supabase
        .from("comms_hub_sync_queue")
        .update({ 
          status: "failed", 
          error_message: syncError.message,
          processed_at: new Date().toISOString()
        })
        .in("property_id", propertyIds);

      throw syncError;
    }

    console.log("[process-comms-hub-sync] Sync result:", syncResult);

    // Mark items as completed
    await supabase
      .from("comms_hub_sync_queue")
      .update({ 
        status: "completed",
        processed_at: new Date().toISOString(),
        error_message: null
      })
      .in("property_id", propertyIds);

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingItems.length,
        sync_result: syncResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[process-comms-hub-sync] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
