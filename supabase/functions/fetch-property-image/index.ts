import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("[fetch-property-image] Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, propertyId } = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ error: "Address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      console.error("[fetch-property-image] GOOGLE_PLACES_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Google Places API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Find place from address
    const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(address)}&inputtype=textquery&fields=place_id,photos,name&key=${apiKey}`;
    
    console.log("[fetch-property-image] Finding place for address:", address);
    const findPlaceRes = await fetch(findPlaceUrl);
    const findPlaceData = await findPlaceRes.json();

    if (findPlaceData.status !== "OK" || !findPlaceData.candidates?.length) {
      console.log("[fetch-property-image] No place found for address");
      return new Response(
        JSON.stringify({ error: "No place found for this address", imageUrl: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const place = findPlaceData.candidates[0];
    console.log("[fetch-property-image] Found place:", place.name);

    // Check if place has photos
    if (!place.photos || place.photos.length === 0) {
      console.log("[fetch-property-image] No photos available for this place");
      return new Response(
        JSON.stringify({ error: "No photos available", imageUrl: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Get the first photo reference
    const photoReference = place.photos[0].photo_reference;
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoReference}&key=${apiKey}`;

    console.log("[fetch-property-image] Fetching photo...");
    
    // Step 3: Fetch the actual image
    const photoRes = await fetch(photoUrl);
    if (!photoRes.ok) {
      console.error("[fetch-property-image] Failed to fetch photo");
      return new Response(
        JSON.stringify({ error: "Failed to fetch photo", imageUrl: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageBlob = await photoRes.blob();
    const imageBuffer = await imageBlob.arrayBuffer();

    // Step 4: Upload to Supabase Storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const fileName = `${propertyId || Date.now()}-google-places.jpg`;
    
    const { error: uploadError } = await supabase.storage
      .from("property-images")
      .upload(fileName, imageBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("[fetch-property-image] Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload image", imageUrl: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from("property-images")
      .getPublicUrl(fileName);

    console.log("[fetch-property-image] Image uploaded successfully:", publicUrl);

    // Step 5: Update property if propertyId provided
    if (propertyId) {
      const { error: updateError } = await supabase
        .from("properties")
        .update({ image_path: publicUrl })
        .eq("id", propertyId);

      if (updateError) {
        console.error("[fetch-property-image] Failed to update property:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ imageUrl: publicUrl, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fetch-property-image] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message, imageUrl: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
