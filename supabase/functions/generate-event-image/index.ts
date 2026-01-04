import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventImageRequest {
  eventName: string;
  eventDate?: string;
  propertyCity?: string;
  aiPrompt?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventName, eventDate, propertyCity, aiPrompt }: EventImageRequest = await req.json();
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!eventName) {
      throw new Error("eventName is required");
    }

    console.log(`Generating image for event: ${eventName} in ${propertyCity || 'Atlanta'}`);

    // Build a descriptive prompt for the event
    const basePrompt = aiPrompt || `${eventName} event in ${propertyCity || 'Atlanta'}, vibrant atmosphere`;
    const fullPrompt = `Professional photograph of ${basePrompt}. High quality, vibrant colors, realistic, editorial style photography. 16:9 aspect ratio.`;

    // Use Lovable AI image generation
    if (lovableApiKey) {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [
              {
                role: "user",
                content: fullPrompt,
              },
            ],
            modalities: ["image", "text"],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

          if (imageUrl) {
            console.log(`Successfully generated image for: ${eventName}`);
            return new Response(
              JSON.stringify({ imageUrl, eventName }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (err) {
        console.error("Lovable AI error:", err);
      }
    }

    // Fallback to stock images based on event type
    const stockImages: Record<string, string> = {
      football: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=600&h=400&fit=crop",
      soccer: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&h=400&fit=crop",
      basketball: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&h=400&fit=crop",
      baseball: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=600&h=400&fit=crop",
      concert: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=400&fit=crop",
      festival: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&h=400&fit=crop",
      convention: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop",
      marathon: "https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=600&h=400&fit=crop",
      default: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=400&fit=crop",
    };

    // Match event to stock image
    const lowerEvent = eventName.toLowerCase();
    let fallbackImage = stockImages.default;
    for (const [keyword, url] of Object.entries(stockImages)) {
      if (lowerEvent.includes(keyword)) {
        fallbackImage = url;
        break;
      }
    }

    return new Response(
      JSON.stringify({ imageUrl: fallbackImage, eventName, fallback: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error generating event image:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
