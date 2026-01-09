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

    // Call the existing ghl-fetch-call-transcripts function
    const response = await fetch(`${supabaseUrl}/functions/v1/ghl-fetch-call-transcripts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        syncAll: true,
        limit: 50,
        userId: userId, // Pass user ID for attribution
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GHL sync error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to sync calls", details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log("GHL sync complete:", result);

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount: result.syncedCount || 0,
        analyzedCount: result.analyzedCount || 0,
        message: `Synced ${result.syncedCount || 0} calls, analyzed ${result.analyzedCount || 0}`,
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
