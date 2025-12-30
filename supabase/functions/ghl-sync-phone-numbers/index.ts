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
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");
    
    if (!ghlApiKey || !ghlLocationId) {
      throw new Error("GHL_API_KEY and GHL_LOCATION_ID are required");
    }

    console.log(`Fetching phone numbers from HighLevel for location: ${ghlLocationId}`);

    // Fetch phone numbers from HighLevel
    const response = await fetch(
      `https://services.leadconnectorhq.com/phone-system/numbers/location/${ghlLocationId}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-07-28",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HighLevel API error:", errorText);
      throw new Error(`HighLevel API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`Fetched ${data.numbers?.length || 0} phone numbers from HighLevel`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store phone numbers in database
    const phoneNumbers = data.numbers || [];
    const syncedNumbers = [];

    for (const num of phoneNumbers) {
      const phoneData = {
        ghl_phone_id: num.id,
        phone_number: num.number,
        friendly_name: num.friendlyName || num.number,
        type: num.type || "local",
        capabilities: num.capabilities || {},
        location_id: ghlLocationId,
        is_active: true,
        synced_at: new Date().toISOString(),
      };

      // Upsert to avoid duplicates
      const { error: upsertError } = await supabase
        .from("ghl_phone_numbers")
        .upsert(phoneData, { onConflict: "ghl_phone_id" });

      if (upsertError) {
        console.error(`Error upserting phone number ${num.number}:`, upsertError);
      } else {
        syncedNumbers.push(phoneData);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount: syncedNumbers.length,
        phoneNumbers: syncedNumbers,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error syncing GHL phone numbers:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
