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

    const apiKey = Deno.env.get("RAPIDAPI_KEY");
    if (!apiKey) {
      console.error("[fetch-property-image] RAPIDAPI_KEY not configured");
      return new Response(
        JSON.stringify({ error: "RapidAPI key not configured", imageUrl: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fetch-property-image] Fetching image for:", address);

    // Step 1: Get photos from RapidAPI (Realtor API)
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
      console.error("[fetch-property-image] API error:", response.status);
      return new Response(
        JSON.stringify({ error: "Failed to fetch photos", imageUrl: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("[fetch-property-image] Response:", JSON.stringify(data).slice(0, 300));

    // Extract first photo URL
    let firstPhotoUrl: string | null = null;

    if (Array.isArray(data) && data.length > 0) {
      firstPhotoUrl = typeof data[0] === 'string' ? data[0] : (data[0].url || data[0].href || data[0].photo_url);
    } else if (data.photos && Array.isArray(data.photos) && data.photos.length > 0) {
      const p = data.photos[0];
      firstPhotoUrl = typeof p === 'string' ? p : (p.url || p.href || p.photo_url);
    } else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const p = data.data[0];
      firstPhotoUrl = typeof p === 'string' ? p : (p.url || p.href || p.photo_url);
    } else if (data.result?.photos && data.result.photos.length > 0) {
      const p = data.result.photos[0];
      firstPhotoUrl = typeof p === 'string' ? p : (p.url || p.href);
    }

    if (!firstPhotoUrl) {
      console.log("[fetch-property-image] No photos found for this address");
      return new Response(
        JSON.stringify({ error: "No photos found", imageUrl: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fetch-property-image] Found photo:", firstPhotoUrl);

    // Step 2: Download the image
    const photoRes = await fetch(firstPhotoUrl);
    if (!photoRes.ok) {
      console.error("[fetch-property-image] Failed to download photo");
      return new Response(
        JSON.stringify({ error: "Failed to download photo", imageUrl: firstPhotoUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageBlob = await photoRes.blob();
    const imageBuffer = await imageBlob.arrayBuffer();

    // Step 3: Upload to Supabase Storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const fileName = `${propertyId || Date.now()}-realtor.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("property-images")
      .upload(fileName, imageBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("[fetch-property-image] Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload image", imageUrl: firstPhotoUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from("property-images")
      .getPublicUrl(fileName);

    console.log("[fetch-property-image] Image uploaded successfully:", publicUrl);

    // Step 4: Update property if propertyId provided
    if (propertyId) {
      const { error: updateError } = await supabase
        .from("properties")
        .update({ image_path: publicUrl })
        .eq("id", propertyId);

      if (updateError) {
        console.error("[fetch-property-image] Failed to update property:", updateError);
      } else {
        console.log("[fetch-property-image] Property image_path updated");
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
