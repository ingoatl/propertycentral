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

    // Use Lovable AI Gateway with vision capabilities
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Lovable AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limited, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "AI vision extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    console.log("AI Response:", content);

    // Parse the JSON response
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();
      
      const parsed = JSON.parse(cleanContent);
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
      console.error("JSON parse error:", parseError);
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
