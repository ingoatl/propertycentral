import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Check if background music already exists
    const { data: existingFile } = await supabase.storage
      .from("message-attachments")
      .list("presentation-audio", { search: "background-music.mp3" });
    
    if (existingFile && existingFile.length > 0) {
      const { data: urlData } = supabase.storage
        .from("message-attachments")
        .getPublicUrl("presentation-audio/background-music.mp3");
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Background music already exists",
        url: urlData.publicUrl
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "ELEVENLABS_API_KEY not configured" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("Generating background music...");
    
    // Generate subtle ambient music using ElevenLabs Music API
    const response = await fetch(
      "https://api.elevenlabs.io/v1/music",
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: "Soft, minimal corporate ambient music. Gentle piano and subtle strings. Calm, professional, inspiring. Perfect for business presentations. Very quiet and unobtrusive background music.",
          duration_seconds: 120, // 2 minutes, will loop
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs Music API error: ${response.status}`, errorText);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Music generation failed: ${response.status}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await response.arrayBuffer();
    
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("message-attachments")
      .upload("presentation-audio/background-music.mp3", audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    
    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: uploadError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from("message-attachments")
      .getPublicUrl("presentation-audio/background-music.mp3");
    
    console.log("Successfully generated and uploaded background music");
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Background music generated and uploaded",
      url: urlData.publicUrl
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
