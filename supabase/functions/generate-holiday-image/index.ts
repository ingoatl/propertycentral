import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Enhance the prompt to transform the property photo
    const enhancedPrompt = `Transform this property photo into a beautiful festive holiday scene. ${textPrompt}. 
    Keep the property recognizable but add tasteful holiday decorations like:
    - Warm string lights around the roofline and windows
    - A light dusting of snow on the roof and landscape
    - A decorated wreath on the door
    - Warm golden light glowing from the windows
    - A cozy winter evening atmosphere
    Make it feel magical, warm, and inviting while keeping the property as the main focus.`;

    console.log('Enhanced prompt:', enhancedPrompt.substring(0, 200) + '...');

    let response;
    
    // If we have a property image URL, fetch it and pass as image input
    if (propertyImageUrl) {
      console.log('Fetching property image from:', propertyImageUrl);
      
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
        
        console.log('Property image fetched and converted to base64, size:', base64Image.length);

        // Call AI with the property image as input for transformation
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
                content: [
                  {
                    type: "text",
                    text: enhancedPrompt
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: imageDataUrl
                    }
                  }
                ]
              }
            ],
            modalities: ["image", "text"]
          }),
        });
      } catch (imageError) {
        console.error('Error fetching property image, falling back to text-only:', imageError);
        // Fall back to text-only generation
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
                content: `Generate a beautiful holiday greeting image for a property. ${textPrompt}`
              }
            ],
            modalities: ["image", "text"]
          }),
        });
      }
    } else {
      // No property image, generate from text prompt only
      console.log('No property image provided, generating from text prompt');
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
              content: `Generate a beautiful holiday greeting image for a property. ${textPrompt}`
            }
          ],
          modalities: ["image", "text"]
        }),
      });
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