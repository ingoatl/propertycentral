const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { screenshotUrl, address } = await req.json();

    if (!screenshotUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Screenshot URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extracting Rent Zestimate from screenshot for:", address);
    console.log("Screenshot URL:", screenshotUrl.substring(0, 100) + "...");

    // Use OpenAI GPT-4o with vision to extract the Rent Zestimate
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!openAIApiKey) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting property rental pricing data from Zillow screenshots. 
Your task is to find the "Rent Zestimate" value on the page.
The Rent Zestimate is Zillow's estimated monthly rent for a property.
It usually appears as "Rent Zestimate: $X,XXX/mo" or similar format.

IMPORTANT: 
- Only return the Rent Zestimate value, NOT the sale price or Zestimate for purchase.
- The Rent Zestimate is typically in the range of $1,000 to $20,000 per month.
- If you cannot find a clear Rent Zestimate, return null.

Respond ONLY with a JSON object in this exact format:
{"rentZestimate": 3500, "confidence": "high"}
or
{"rentZestimate": null, "confidence": "not_found", "reason": "explanation"}`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract the Rent Zestimate from this Zillow screenshot for the property at: ${address}`,
              },
              {
                type: "image_url",
                image_url: {
                  url: screenshotUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      return new Response(
        JSON.stringify({ success: false, error: "AI vision extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";
    
    console.log("AI Response:", content);

    // Parse the JSON response
    try {
      const parsed = JSON.parse(content);
      return new Response(
        JSON.stringify({
          success: true,
          rentZestimate: parsed.rentZestimate,
          confidence: parsed.confidence,
          reason: parsed.reason,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (parseError) {
      // Try to extract number from response if JSON parsing fails
      const numberMatch = content.match(/(\d{1,2},?\d{3})/);
      if (numberMatch) {
        const value = parseInt(numberMatch[1].replace(/,/g, ""), 10);
        if (value >= 500 && value <= 50000) {
          return new Response(
            JSON.stringify({
              success: true,
              rentZestimate: value,
              confidence: "medium",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      return new Response(
        JSON.stringify({ success: false, rentZestimate: null, error: "Could not parse AI response" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error in AI extraction:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
