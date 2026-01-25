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
        console.log("Using Lovable AI Vision to extract Rent Zestimate from screenshot...");
        
        // Use Lovable AI Gateway directly (no need for separate function)
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        
        if (LOVABLE_API_KEY) {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content: `Extract the Rent Zestimate from this Zillow page screenshot. 
The Rent Zestimate is Zillow's estimated monthly rent (NOT the sale price).
It's typically shown as "Rent Zestimate: $X,XXX/mo" or similar.
Only return a JSON object: {"rentZestimate": 3500} or {"rentZestimate": null, "reason": "not found"}`
                },
                {
                  role: "user",
                  content: [
                    { type: "text", text: `Find the Rent Zestimate for: ${address}` },
                    { type: "image_url", image_url: { url: screenshot } }
                  ]
                }
              ]
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            console.log("AI Vision response:", content);
            
            // Parse response
            try {
              let cleanContent = content.trim();
              if (cleanContent.includes("```")) {
                cleanContent = cleanContent.replace(/```json\n?/g, "").replace(/```\n?/g, "");
              }
              const parsed = JSON.parse(cleanContent.trim());
              if (parsed.rentZestimate && parsed.rentZestimate > 500 && parsed.rentZestimate < 50000) {
                rentZestimate = parsed.rentZestimate;
                console.log(`AI Vision extracted Rent Zestimate: $${rentZestimate}`);
              }
            } catch (parseErr) {
              // Try regex fallback
              const match = content.match(/(\d{1,2},?\d{3})/);
              if (match) {
                const value = parseInt(match[1].replace(/,/g, ""), 10);
                if (value >= 1000 && value <= 20000) {
                  rentZestimate = value;
                  console.log(`Regex extracted Rent Zestimate: $${rentZestimate}`);
                }
              }
            }
          } else {
            console.error("AI Vision request failed:", aiResponse.status);
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
