import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("[google-places-autocomplete] Request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, country = "us" } = await req.json();
    
    if (!query || query.length < 3) {
      return new Response(
        JSON.stringify({ predictions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    
    if (!apiKey) {
      console.error("[google-places-autocomplete] GOOGLE_PLACES_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Google Places API key not configured", predictions: [] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[google-places-autocomplete] Fetching predictions for:", query);

    // Use the Places API Autocomplete endpoint
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", query);
    url.searchParams.set("types", "address");
    url.searchParams.set("components", `country:${country}`);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "OK" || data.status === "ZERO_RESULTS") {
      const predictions = (data.predictions || []).map((p: any) => ({
        place_id: p.place_id,
        description: p.description,
      }));

      console.log("[google-places-autocomplete] Found", predictions.length, "predictions");

      return new Response(
        JSON.stringify({ predictions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error("[google-places-autocomplete] API error:", data.status, data.error_message);
    return new Response(
      JSON.stringify({ predictions: [], error: data.error_message || data.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[google-places-autocomplete] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message, predictions: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});