import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MULTIPLIER = 2.2;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, partnerPropertyId } = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ success: false, error: "Address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlApiKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format address for Zillow URL
    const formattedAddress = address
      .trim()
      .toLowerCase()
      .replace(/,/g, "")
      .replace(/\./g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    
    const zillowUrl = `https://www.zillow.com/homes/${formattedAddress}_rb/`;
    
    console.log("Fetching Zillow page screenshot:", zillowUrl);

    // Use Firecrawl to get a screenshot of the Zillow page
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: zillowUrl,
        formats: ["screenshot", "markdown"],
        onlyMainContent: false,
        waitFor: 5000,
        screenshot: true,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error("Firecrawl API error:", scrapeData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: scrapeData.error || `Firecrawl request failed with status ${scrapeResponse.status}`,
          zillowUrl 
        }),
        { status: scrapeResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const screenshot = scrapeData.data?.screenshot || scrapeData.screenshot;
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    
    console.log("Got screenshot:", !!screenshot);
    console.log("Screenshot URL length:", screenshot?.length || 0);

    let rentZestimate: number | null = null;

    // Method 1: Use AI Vision to extract Rent Zestimate from screenshot
    if (screenshot) {
      try {
        console.log("Using AI Vision to extract Rent Zestimate from screenshot...");
        
        // Call Gemini Vision API via Lovable AI proxy
        const aiResponse = await fetch("https://ijsxcaaqphaciaenlegl.supabase.co/functions/v1/ai-extract-rent-zestimate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            screenshotUrl: screenshot,
            address: address,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          if (aiData.rentZestimate && aiData.rentZestimate > 500 && aiData.rentZestimate < 50000) {
            rentZestimate = aiData.rentZestimate;
            console.log(`AI Vision extracted Rent Zestimate: $${rentZestimate}`);
          }
        }
      } catch (aiError) {
        console.error("AI Vision extraction failed:", aiError);
      }
    }

    // Method 2: Fallback to regex parsing of markdown
    if (!rentZestimate && markdown) {
      console.log("Falling back to regex extraction from markdown...");
      const patterns = [
        /Rent\s*Zestimate[®™]?\s*[:\s]*\$?([\d,]+)/i,
        /Zestimate.*?rent[:\s]*\$?([\d,]+)/i,
        /rent[:\s]*\$?([\d,]+)\s*\/\s*mo/i,
        /\$?([\d,]+)\s*\/mo.*?(?:rent|estimated)/i,
        /Estimated\s*monthly\s*rent[:\s]*\$?([\d,]+)/i,
      ];

      for (const pattern of patterns) {
        const match = markdown.match(pattern);
        if (match) {
          const value = parseInt(match[1].replace(/,/g, ""), 10);
          if (value > 500 && value < 50000) {
            rentZestimate = value;
            console.log(`Regex extracted Rent Zestimate: $${rentZestimate}`);
            break;
          }
        }
      }
    }

    // Calculate listing price (2.2x Rent Zestimate)
    const calculatedListingPrice = rentZestimate ? Math.round(rentZestimate * MULTIPLIER) : null;

    console.log("Final Rent Zestimate:", rentZestimate);
    console.log(`Calculated Listing Price (${MULTIPLIER}x):`, calculatedListingPrice);

    // Update partner property if ID provided
    if (partnerPropertyId && (rentZestimate || calculatedListingPrice)) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { error: updateError } = await supabase
        .from("partner_properties")
        .update({
          zillow_rent_zestimate: rentZestimate,
          calculated_listing_price: calculatedListingPrice,
          zillow_last_fetched: new Date().toISOString(),
        })
        .eq("id", partnerPropertyId);

      if (updateError) {
        console.error("Failed to update partner property:", updateError);
      } else {
        console.log(`Updated partner property ${partnerPropertyId} with Zillow pricing`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        zillowUrl,
        rentZestimate,
        calculatedListingPrice,
        multiplier: MULTIPLIER,
        screenshotAvailable: !!screenshot,
        fetchedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching Zillow Zestimate:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch Zillow data";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
