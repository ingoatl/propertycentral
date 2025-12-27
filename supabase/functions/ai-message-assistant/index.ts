import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, currentMessage, contactName, conversationContext, messageType } = await req.json();

    console.log("AI Message Assistant request:", { action, contactName, messageType });

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    let systemPrompt = `You are a professional property management assistant helping compose ${messageType === "sms" ? "SMS messages" : "emails"}. 
Keep messages professional, friendly, and concise.
${messageType === "sms" ? "Keep SMS messages under 160 characters when possible." : ""}
Contact name: ${contactName || "Unknown"}
${conversationContext ? `Previous context: ${conversationContext}` : ""}`;

    let userPrompt = "";

    switch (action) {
      case "generate":
        userPrompt = `Generate a professional reply ${messageType === "sms" ? "SMS" : "email"} for a property management company. 
${currentMessage ? `The current draft is: "${currentMessage}". Improve upon it or use it as context.` : "Create an appropriate response."}
Be helpful and professional.`;
        break;

      case "improve":
        userPrompt = `Improve this message while keeping the same meaning. Make it clearer and more professional:
"${currentMessage}"`;
        break;

      case "shorter":
        userPrompt = `Make this message shorter and more concise while keeping the key information:
"${currentMessage}"`;
        break;

      case "professional":
        userPrompt = `Rewrite this message in a more formal, professional tone:
"${currentMessage}"`;
        break;

      case "friendly":
        userPrompt = `Rewrite this message in a warmer, friendlier tone while keeping it professional:
"${currentMessage}"`;
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Use Lovable AI (OpenRouter)
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lovable.dev",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedMessage = data.choices?.[0]?.message?.content?.trim();

    if (!generatedMessage) {
      throw new Error("No message generated");
    }

    console.log("Generated message:", generatedMessage.substring(0, 100) + "...");

    return new Response(
      JSON.stringify({ message: generatedMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("AI Message Assistant error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
