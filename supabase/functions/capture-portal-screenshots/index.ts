import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");

// Owner portal feature tabs and their URLs
const PORTAL_FEATURES = [
  { name: "messages", tab: "messages", label: "Messages & Communications" },
  { name: "maintenance", tab: "maintenance", label: "Maintenance Requests" },
  { name: "screenings", tab: "screenings", label: "Guest Screenings" },
  { name: "marketing", tab: "marketing", label: "Marketing Activity" },
  { name: "voice-recap", tab: "recaps", label: "Voice Recaps" },
  { name: "onboarding", tab: "onboarding", label: "Onboarding Timeline" },
  { name: "schedule-calls", tab: "schedule", label: "Schedule Calls" },
  { name: "reports", tab: "reports", label: "PDF Reports" },
];

async function captureScreenshot(url: string): Promise<{ screenshot?: string; error?: string }> {
  if (!firecrawlApiKey) {
    return { error: "FIRECRAWL_API_KEY not configured" };
  }

  try {
    console.log(`Capturing screenshot of: ${url}`);
    
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["screenshot"],
        waitFor: 3000, // Wait for page to fully load
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl error: ${errorText}`);
      return { error: `Firecrawl API error: ${response.status}` };
    }

    const data = await response.json();
    
    // Firecrawl returns screenshot as base64 or URL
    const screenshot = data.data?.screenshot || data.screenshot;
    
    if (!screenshot) {
      return { error: "No screenshot returned" };
    }

    return { screenshot };
  } catch (error) {
    console.error(`Screenshot capture error: ${error}`);
    return { error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { features, base_url, force } = await req.json();

    // Default to all features if none specified
    const featuresToCapture = features && features.length > 0 
      ? PORTAL_FEATURES.filter(f => features.includes(f.name))
      : PORTAL_FEATURES;

    // Use provided base_url or default demo URL
    const baseUrl = base_url || "https://propertycentral.lovable.app/owner";

    console.log(`Capturing ${featuresToCapture.length} feature screenshots`);

    const results: any[] = [];

    for (const feature of featuresToCapture) {
      try {
        // Check if screenshot already exists (unless force=true)
        const existingPath = `feature-screenshots/${feature.name}.png`;
        
        if (!force) {
          const { data: existingFile } = await supabase.storage
            .from("property-images")
            .list("feature-screenshots", { search: `${feature.name}.png` });
          
          if (existingFile && existingFile.length > 0) {
            console.log(`Screenshot for ${feature.name} already exists, skipping`);
            
            const { data: urlData } = supabase.storage
              .from("property-images")
              .getPublicUrl(existingPath);
            
            results.push({
              feature: feature.name,
              label: feature.label,
              status: "exists",
              url: urlData.publicUrl,
            });
            continue;
          }
        }

        // Construct URL with tab parameter
        const featureUrl = `${baseUrl}#${feature.tab}`;
        
        // Capture screenshot
        const { screenshot, error } = await captureScreenshot(featureUrl);

        if (error || !screenshot) {
          console.error(`Failed to capture ${feature.name}: ${error}`);
          results.push({
            feature: feature.name,
            label: feature.label,
            status: "error",
            error,
          });
          continue;
        }

        // Handle both base64 and URL responses
        let imageBuffer: Uint8Array;
        
        if (screenshot.startsWith("data:image")) {
          // Base64 data URL
          const base64Data = screenshot.split(",")[1];
          imageBuffer = base64Decode(base64Data);
        } else if (screenshot.startsWith("http")) {
          // URL - download the image
          const imageResponse = await fetch(screenshot);
          const arrayBuffer = await imageResponse.arrayBuffer();
          imageBuffer = new Uint8Array(arrayBuffer);
        } else {
          // Raw base64
          imageBuffer = base64Decode(screenshot);
        }

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("property-images")
          .upload(existingPath, imageBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload failed for ${feature.name}: ${uploadError.message}`);
          results.push({
            feature: feature.name,
            label: feature.label,
            status: "error",
            error: uploadError.message,
          });
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("property-images")
          .getPublicUrl(existingPath);

        console.log(`Successfully captured ${feature.name}`);
        
        results.push({
          feature: feature.name,
          label: feature.label,
          status: "success",
          url: urlData.publicUrl,
        });

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (featureError) {
        console.error(`Error processing ${feature.name}: ${featureError}`);
        results.push({
          feature: feature.name,
          label: feature.label,
          status: "error",
          error: String(featureError),
        });
      }
    }

    const successCount = results.filter(r => r.status === "success" || r.status === "exists").length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Captured ${successCount}/${featuresToCapture.length} feature screenshots`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in capture-portal-screenshots:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
