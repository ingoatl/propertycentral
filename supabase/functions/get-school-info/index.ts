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
    const { propertyAddress } = await req.json();
    
    if (!propertyAddress) {
      return new Response(
        JSON.stringify({ error: "Property address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Getting school info for address:", propertyAddress);

    // Call Lovable AI to extract school information
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a school district lookup assistant. Given a property address in Georgia, USA, you must determine the school district and the elementary, middle, and high schools that serve that address. 

IMPORTANT: You must use your knowledge of Georgia school districts to provide accurate information. For addresses in metro Atlanta (Smyrna, Roswell, Kennesaw, Duluth, Lilburn, Tucker, Mableton, College Park), you should know the school districts and schools.

If you're uncertain about any school, return "Unknown" for that field rather than guessing.`
          },
          {
            role: "user",
            content: `What are the school district, elementary school, middle school, and high school for this address: ${propertyAddress}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_school_info",
              description: "Return the school district and schools for the given address",
              parameters: {
                type: "object",
                properties: {
                  school_district: {
                    type: "string",
                    description: "The school district name (e.g., 'Cobb County School District')"
                  },
                  elementary_school: {
                    type: "string",
                    description: "The elementary school name"
                  },
                  middle_school: {
                    type: "string",
                    description: "The middle school name"
                  },
                  high_school: {
                    type: "string",
                    description: "The high school name"
                  }
                },
                required: ["school_district", "elementary_school", "middle_school", "high_school"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_school_info" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI Response:", JSON.stringify(aiResponse, null, 2));

    // Extract school info from tool call
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const schoolInfo = JSON.parse(toolCall.function.arguments);
    console.log("Extracted school info:", schoolInfo);

    return new Response(
      JSON.stringify({
        school_district: schoolInfo.school_district,
        elementary_school: schoolInfo.elementary_school,
        middle_school: schoolInfo.middle_school,
        high_school: schoolInfo.high_school
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in get-school-info:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
