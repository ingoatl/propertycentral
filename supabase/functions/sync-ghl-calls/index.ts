import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      userId = user?.id || null;
    }

    console.log("Starting GHL call sync for user:", userId);

    // 1. Sync Voice AI bot calls
    console.log("Syncing Voice AI bot calls...");
    const voiceAiResponse = await fetch(`${supabaseUrl}/functions/v1/ghl-fetch-call-transcripts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        syncAll: true,
        limit: 50,
        userId: userId,
      }),
    });

    let voiceAiResult = { syncedCount: 0, analyzedCount: 0 };
    if (voiceAiResponse.ok) {
      voiceAiResult = await voiceAiResponse.json();
      console.log("Voice AI sync complete:", voiceAiResult);
    } else {
      const errorText = await voiceAiResponse.text();
      console.error("Voice AI sync error:", errorText);
    }

    // 2. Sync human phone calls and other conversations (SMS, Email)
    console.log("Syncing human conversations...");
    const conversationsResponse = await fetch(`${supabaseUrl}/functions/v1/ghl-sync-conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        limit: 200, // Increased limit to capture more calls including older ones
      }),
    });

    let conversationsResult = { syncedCount: 0, conversationsProcessed: 0 };
    if (conversationsResponse.ok) {
      conversationsResult = await conversationsResponse.json();
      console.log("Conversations sync complete:", conversationsResult);
    } else {
      const errorText = await conversationsResponse.text();
      console.error("Conversations sync error:", errorText);
    }

    const totalSynced = (voiceAiResult.syncedCount || 0) + (conversationsResult.syncedCount || 0);

    return new Response(
      JSON.stringify({
        success: true,
        voiceAiSynced: voiceAiResult.syncedCount || 0,
        voiceAiAnalyzed: voiceAiResult.analyzedCount || 0,
        conversationsSynced: conversationsResult.syncedCount || 0,
        conversationsProcessed: conversationsResult.conversationsProcessed || 0,
        totalSynced,
        message: `Synced ${totalSynced} total (${voiceAiResult.syncedCount || 0} AI calls, ${conversationsResult.syncedCount || 0} conversations)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
