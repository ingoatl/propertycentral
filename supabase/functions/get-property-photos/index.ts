import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("[get-property-photos] Request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();
    
    if (!address) {
      return new Response(
        JSON.stringify({ error: "Address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("RAPIDAPI_KEY");
    
    if (!apiKey) {
      console.error("[get-property-photos] RAPIDAPI_KEY not configured");
      return new Response(
        JSON.stringify({ error: "RapidAPI key not configured", photos: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[get-property-photos] Fetching photos for:", address);

    const response = await fetch(
      `https://realtor-data3.p.rapidapi.com/detail/photos?query=${encodeURIComponent(address)}`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-host": "realtor-data3.p.rapidapi.com",
          "x-rapidapi-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error("[get-property-photos] API error:", response.status);
      return new Response(
        JSON.stringify({ error: "Failed to fetch photos", photos: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("[get-property-photos] Response:", JSON.stringify(data).slice(0, 200));

    // Extract photos from the response - handle various response formats
    let photos: string[] = [];
    
    if (Array.isArray(data)) {
      // If response is an array of photo URLs
      photos = data.slice(0, 10);
    } else if (data.photos && Array.isArray(data.photos)) {
      // If response has a photos property
      photos = data.photos.slice(0, 10).map((p: any) => 
        typeof p === 'string' ? p : (p.url || p.href || p.photo_url || '')
      ).filter(Boolean);
    } else if (data.data && Array.isArray(data.data)) {
      // If response has a data property with photos
      photos = data.data.slice(0, 10).map((p: any) => 
        typeof p === 'string' ? p : (p.url || p.href || p.photo_url || '')
      ).filter(Boolean);
    } else if (data.result && data.result.photos) {
      // If response has result.photos
      photos = data.result.photos.slice(0, 10).map((p: any) => 
        typeof p === 'string' ? p : (p.url || p.href || '')
      ).filter(Boolean);
    }

    console.log("[get-property-photos] Found", photos.length, "photos");

    return new Response(
      JSON.stringify({ photos }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[get-property-photos] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message, photos: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
