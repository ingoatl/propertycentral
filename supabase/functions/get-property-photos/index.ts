import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to fetch photos from Google Places API as fallback
async function fetchFromGooglePlaces(address: string, googleApiKey: string): Promise<string[]> {
  console.log("[get-property-photos] Trying Google Places fallback for:", address);
  
  try {
    // First, search for the place - request more fields
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(address)}&inputtype=textquery&fields=place_id,name,photos,formatted_address&key=${googleApiKey}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    console.log("[get-property-photos] Google Places search result:", searchData.status);
    console.log("[get-property-photos] Candidates found:", searchData.candidates?.length || 0);
    
    if (searchData.candidates && searchData.candidates.length > 0) {
      const candidate = searchData.candidates[0];
      console.log("[get-property-photos] Candidate:", candidate.name || 'unnamed', "place_id:", candidate.place_id);
      console.log("[get-property-photos] Direct photos count:", candidate.photos?.length || 0);
      
      if (candidate.photos && candidate.photos.length > 0) {
        // Get photo URLs using photo_reference
        const photos = candidate.photos.slice(0, 5).map((photo: any) => 
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${googleApiKey}`
        );
        console.log("[get-property-photos] Found", photos.length, "Google Places photos");
        return photos;
      }
      
      // If we have a place_id but no photos from search, try place details
      if (candidate.place_id) {
        console.log("[get-property-photos] Fetching place details for:", candidate.place_id);
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${candidate.place_id}&fields=photos,name,formatted_address&key=${googleApiKey}`;
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();
        
        console.log("[get-property-photos] Place details status:", detailsData.status);
        console.log("[get-property-photos] Detail photos count:", detailsData.result?.photos?.length || 0);
        
        if (detailsData.result?.photos && detailsData.result.photos.length > 0) {
          const photos = detailsData.result.photos.slice(0, 5).map((photo: any) => 
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${googleApiKey}`
          );
          console.log("[get-property-photos] Found", photos.length, "Google Places detail photos");
          return photos;
        }
      }
    }
    
    // If no photos from exact address, try a broader Street View approach
    console.log("[get-property-photos] No photos from Places API, trying Street View fallback");
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodeURIComponent(address)}&key=${googleApiKey}`;
    // We can't verify if Street View exists without fetching, so just return it as a possibility
    // The frontend will handle if the image fails to load
    return [streetViewUrl];
    
  } catch (error) {
    console.error("[get-property-photos] Google Places error:", error);
    return [];
  }
}

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
    const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    
    console.log("[get-property-photos] Fetching photos for:", address);
    console.log("[get-property-photos] RapidAPI configured:", !!apiKey);
    console.log("[get-property-photos] Google Places configured:", !!googleApiKey);

    let photos: string[] = [];

    // Try RapidAPI first if configured
    if (apiKey) {
      try {
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

        if (response.ok) {
          const data = await response.json();
          console.log("[get-property-photos] RapidAPI Response:", JSON.stringify(data).slice(0, 200));

          // Extract photos from the response - handle various response formats
          if (Array.isArray(data)) {
            photos = data.slice(0, 10);
          } else if (data.photos && Array.isArray(data.photos)) {
            photos = data.photos.slice(0, 10).map((p: any) => 
              typeof p === 'string' ? p : (p.url || p.href || p.photo_url || '')
            ).filter(Boolean);
          } else if (data.data && Array.isArray(data.data)) {
            photos = data.data.slice(0, 10).map((p: any) => 
              typeof p === 'string' ? p : (p.url || p.href || p.photo_url || '')
            ).filter(Boolean);
          } else if (data.result && data.result.photos) {
            photos = data.result.photos.slice(0, 10).map((p: any) => 
              typeof p === 'string' ? p : (p.url || p.href || '')
            ).filter(Boolean);
          }
        } else {
          console.error("[get-property-photos] RapidAPI error:", response.status);
        }
      } catch (rapidApiError) {
        console.error("[get-property-photos] RapidAPI fetch error:", rapidApiError);
      }
    }

    // If no photos from RapidAPI, try Google Places as fallback
    if (photos.length === 0 && googleApiKey) {
      photos = await fetchFromGooglePlaces(address, googleApiKey);
    }

    console.log("[get-property-photos] Total photos found:", photos.length);

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
