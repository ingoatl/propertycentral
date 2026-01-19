import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, photoData, photoType, vendorName } = await req.json();

    if (!token || !photoData || !photoType) {
      return new Response(
        JSON.stringify({ success: false, error: "Token, photo data, and photo type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate token and get work order
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .select("id, assigned_vendor:vendors(name)")
      .eq("vendor_access_token", token)
      .single();

    if (woError || !workOrder) {
      console.error("Invalid or expired token:", woError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired job link" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode base64 photo data
    const base64Data = photoData.split(",")[1] || photoData;
    const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    // Generate unique filename
    const fileName = `${workOrder.id}/${photoType}/${Date.now()}.jpg`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("work-order-photos")
      .upload(fileName, binaryData, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to upload photo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("work-order-photos")
      .getPublicUrl(fileName);

    // Insert photo record
    const uploaderName = vendorName || workOrder.assigned_vendor?.name || "Vendor";
    
    const { error: insertError } = await supabase
      .from("work_order_photos")
      .insert({
        work_order_id: workOrder.id,
        photo_url: publicUrl,
        photo_type: photoType,
        uploaded_by: uploaderName,
        uploaded_by_type: "vendor",
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save photo record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add timeline entry
    await supabase.from("work_order_timeline").insert({
      work_order_id: workOrder.id,
      action: `${photoType.charAt(0).toUpperCase() + photoType.slice(1)} photo uploaded`,
      performed_by_type: "vendor",
      performed_by_name: uploaderName,
    });

    console.log(`Photo uploaded successfully for work order ${workOrder.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        photoUrl: publicUrl,
        message: "Photo uploaded successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error uploading photo:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
