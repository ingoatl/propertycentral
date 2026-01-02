import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      .replace(/[,#]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^\w-]/g, "");
    
    const zillowUrl = `https://www.zillow.com/homes/${formattedAddress}_rb/`;
    
    console.log("Fetching Zillow page:", zillowUrl);

    // Scrape Zillow using Firecrawl
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: zillowUrl,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 3000,
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

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    console.log("Scraped content length:", markdown.length);
    console.log("Content preview:", markdown.substring(0, 1000));

    // Extract Rent Zestimate from the markdown content
    // Zillow shows rent estimate in various formats
    const rentPatterns = [
      /Rent\s*Zestimate[®™]?\s*:?\s*\$?([\d,]+)/i,
      /rent\s*estimate[®™]?\s*:?\s*\$?([\d,]+)/i,
      /estimated\s*rent[®™]?\s*:?\s*\$?([\d,]+)/i,
      /\$?([\d,]+)\s*\/\s*mo(?:nth)?.*?(?:rent|zestimate)/i,
      /rent[^\n]*?\$?([\d,]+)\s*(?:\/\s*mo|per\s*month)/i,
      /zestimate[^\n]*?\$?([\d,]+)\s*(?:\/\s*mo|per\s*month)/i,
      /monthly\s*rent[^\n]*?\$?([\d,]+)/i,
    ];

    let rentZestimate: number | null = null;
    
    for (const pattern of rentPatterns) {
      const match = markdown.match(pattern);
      if (match) {
        const value = parseInt(match[1].replace(/,/g, ""), 10);
        if (value > 500 && value < 50000) { // Reasonable rent range
          rentZestimate = value;
          console.log(`Found Rent Zestimate: $${rentZestimate} using pattern: ${pattern}`);
          break;
        }
      }
    }

    // Calculate listing price (2.3x Rent Zestimate)
    const calculatedListingPrice = rentZestimate ? Math.round(rentZestimate * 2.3) : null;

    console.log("Rent Zestimate:", rentZestimate);
    console.log("Calculated Listing Price (2.3x):", calculatedListingPrice);

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
        multiplier: 2.3,
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
