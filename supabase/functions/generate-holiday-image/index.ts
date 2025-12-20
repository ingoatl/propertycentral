import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to generate a generic festive image without property reference
async function generateGenericFestiveImage(
  apiKey: string, 
  ownerFirstName: string, 
  propertyName: string, 
  textPrompt: string
): Promise<Response> {
  const prompt = `Create a stunning, photorealistic holiday greeting image featuring a beautiful vacation rental property.

The image should show:
- A charming, cozy home decorated for the winter holidays
- Warm string lights adorning the roofline and windows  
- Light snow on the roof and ground creating a magical winter scene
- A festive wreath on the door
- Warm golden light glowing from inside the windows
- A magical evening atmosphere with soft snowfall
- The name "${ownerFirstName}" incorporated elegantly into the scene (perhaps on a welcome sign, mailbox, or holiday banner)

${textPrompt}

Make it feel warm, inviting, and magical - perfect for a holiday greeting card. The style should be photorealistic and high quality. Aspect ratio 16:9.`;

  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image-preview",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      modalities: ["image", "text"]
    }),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      propertyImageUrl, 
      ownerFirstName, 
      propertyName, 
      promptTemplate 
    } = await req.json();

    console.log('Generating holiday image for:', { ownerFirstName, propertyName, hasPropertyImage: !!propertyImageUrl });

    // Build the text prompt with personalization
    let textPrompt = promptTemplate
      .replace(/{owner_first_name}/g, ownerFirstName || 'Friend')
      .replace(/{property_name}/g, propertyName || 'your property');

    let response;
    
    // If we have a property image URL, analyze it first to understand the property style
    if (propertyImageUrl) {
      console.log('Analyzing property image to create inspired festive image:', propertyImageUrl);
      
      try {
        // Fetch the property image
        const imageResponse = await fetch(propertyImageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch property image: ${imageResponse.status}`);
        }
        
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
        
        // Determine content type from URL or response
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        const imageDataUrl = `data:${contentType};base64,${base64Image}`;
        
        console.log('Property image fetched, analyzing style...');

        // First, analyze the property image to understand its characteristics
        const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Analyze this property image and describe it in detail for creating a similar festive holiday version:
                    1. Architectural style (modern, traditional, farmhouse, craftsman, etc.)
                    2. Building colors and materials (brick, wood siding, stucco, etc.)
                    3. Roof style and color
                    4. Landscaping features (trees, bushes, lawn, etc.)
                    5. Notable features (porch, columns, windows style, etc.)
                    6. Setting (urban, suburban, rural, wooded, etc.)
                    
                    Provide a concise description that could be used to generate a similar-looking property decorated for the holidays.`
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: imageDataUrl
                    }
                  }
                ]
              }
            ]
          }),
        });

        let propertyDescription = "a beautiful vacation rental property";
        
        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          propertyDescription = analysisData.choices?.[0]?.message?.content || propertyDescription;
          console.log('Property analysis:', propertyDescription.substring(0, 200) + '...');
        }

        // Now generate a NEW festive image inspired by the property
        const festivePrompt = `Create a stunning, photorealistic holiday greeting image featuring a property similar to this description:

${propertyDescription}

The image should show:
- A beautifully decorated home in a winter holiday setting
- Warm string lights adorning the roofline and windows
- Light snow on the roof and ground creating a cozy winter scene
- A festive wreath on the door
- Warm golden light glowing from inside the windows
- A magical evening atmosphere with soft snowfall
- The name "${ownerFirstName}" incorporated elegantly into the scene (perhaps on a welcome sign, mailbox, or holiday banner)

${textPrompt}

Make it feel warm, inviting, and magical - perfect for a holiday greeting card. The style should be photorealistic and high quality. Aspect ratio 16:9.`;

        console.log('Generating festive image...');

        response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [
              {
                role: "user",
                content: festivePrompt
              }
            ],
            modalities: ["image", "text"]
          }),
        });
      } catch (imageError) {
        console.error('Error analyzing property image, falling back to generic festive image:', imageError);
        // Fall back to generic festive generation
        response = await generateGenericFestiveImage(LOVABLE_API_KEY, ownerFirstName, propertyName, textPrompt);
      }
    } else {
      // No property image, generate a generic festive image with owner's name
      console.log('No property image provided, generating generic festive image');
      response = await generateGenericFestiveImage(LOVABLE_API_KEY, ownerFirstName, propertyName, textPrompt);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please add funds to continue.');
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    // Extract the generated image
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData) {
      console.error('No image in response:', JSON.stringify(data).substring(0, 500));
      throw new Error('No image was generated by the AI');
    }

    // The image is base64 encoded, save it to storage
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}-${ownerFirstName?.replace(/\s+/g, '_') || 'owner'}.png`;
    const filePath = `generated/${fileName}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('holiday-images')
      .upload(filePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to save image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('holiday-images')
      .getPublicUrl(filePath);

    console.log('Image saved successfully:', publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: publicUrl,
        base64Image: imageData // Also return base64 for email embedding
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating holiday image:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});