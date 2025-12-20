import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map holiday names to their proper greetings
const getHolidayGreeting = (name: string): string => {
  const greetings: Record<string, string> = {
    'christmas': 'Merry Christmas',
    'new year': 'Happy New Year',
    "new year's": 'Happy New Year',
    "new year's day": 'Happy New Year',
    'thanksgiving': 'Happy Thanksgiving',
    'easter': 'Happy Easter',
    'hanukkah': 'Happy Hanukkah',
    'chanukah': 'Happy Hanukkah',
    'diwali': 'Happy Diwali',
    'kwanzaa': 'Happy Kwanzaa',
    'valentine': "Happy Valentine's Day",
    "valentine's day": "Happy Valentine's Day",
    'mother': "Happy Mother's Day",
    "mother's day": "Happy Mother's Day",
    'father': "Happy Father's Day",
    "father's day": "Happy Father's Day",
    'independence day': 'Happy Fourth of July',
    '4th of july': 'Happy Fourth of July',
    'fourth of july': 'Happy Fourth of July',
    'labor day': 'Happy Labor Day',
    'memorial day': 'Happy Memorial Day',
    'halloween': 'Happy Halloween',
    'st. patrick': "Happy St. Patrick's Day",
    "st. patrick's day": "Happy St. Patrick's Day",
  };
  
  const lowerName = name.toLowerCase();
  
  // Check for exact match first
  if (greetings[lowerName]) return greetings[lowerName];
  
  // Check for partial matches
  for (const [key, greeting] of Object.entries(greetings)) {
    if (lowerName.includes(key)) return greeting;
  }
  
  // Default: capitalize and add "Happy"
  return `Happy ${name}`;
};

// Generate image with retry logic
async function generateImageWithRetry(
  apiKey: string,
  prompt: string,
  maxRetries: number = 2
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Image generation attempt ${attempt}/${maxRetries}`);
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please add funds to continue.');
      }
      
      if (attempt < maxRetries) {
        console.log('Retrying after API error...');
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    // Extract the generated image
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageData) {
      return imageData;
    }
    
    console.error('No image in response, attempt', attempt);
    if (attempt < maxRetries) {
      console.log('Retrying image generation...');
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  throw new Error('Failed to generate image after multiple attempts');
}

// Compress and optimize base64 image using canvas-like approach
function optimizeImageBuffer(base64Data: string): Uint8Array {
  // Remove data URL prefix if present
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
  
  // The AI generates reasonably sized images, but we can't resize in Deno easily
  // Just return the buffer - the AI model already generates optimized sizes
  return imageBuffer;
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
      ownerFirstName, 
      propertyName, 
      promptTemplate,
      holidayName
    } = await req.json();

    console.log('=== HOLIDAY IMAGE GENERATION ===');
    console.log('Holiday:', holidayName);
    console.log('Owner:', ownerFirstName);
    console.log('Property:', propertyName);

    // Build the personalized prompt from the template
    let personalizedPrompt = (promptTemplate || '')
      .replace(/{owner_first_name}/g, ownerFirstName || 'Friend')
      .replace(/{owner_name}/g, ownerFirstName || 'Friend')
      .replace(/{property_name}/g, propertyName || 'your property');

    const cleanHolidayName = holidayName || 'Holiday';
    const holidayGreeting = getHolidayGreeting(cleanHolidayName);
    
    console.log('Holiday greeting for image:', holidayGreeting);

    // If no prompt template, create a generic one based on holiday name
    if (!personalizedPrompt || personalizedPrompt.trim().length < 20) {
      personalizedPrompt = `A warm, inviting ${cleanHolidayName} scene.`;
    }

    // Build optimized prompt - request smaller image dimensions
    const imagePrompt = `Generate a ${cleanHolidayName} greeting card image.

CRITICAL REQUIREMENTS:
1. Generate a SMALL, optimized image (600x300 pixels maximum)
2. Include elegant text "${holidayGreeting}!" prominently displayed
3. Festive ${cleanHolidayName} theme
4. Warm, inviting, high-quality greeting card style
5. Horizontal banner format (2:1 ratio)

Theme: ${personalizedPrompt.substring(0, 200)}

Generate the image now with "${holidayGreeting}!" text visible.`;

    console.log('Prompt length:', imagePrompt.length);

    // Generate image with retry logic
    const imageData = await generateImageWithRetry(LOVABLE_API_KEY, imagePrompt, 2);

    // Optimize and save
    const imageBuffer = optimizeImageBuffer(imageData);
    
    console.log('Image size:', Math.round(imageBuffer.length / 1024), 'KB');

    // Generate unique filename with holiday context
    const timestamp = Date.now();
    const holidaySlug = (holidayName || 'holiday').replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const ownerSlug = (ownerFirstName || 'owner').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const fileName = `${timestamp}-${holidaySlug}-${ownerSlug}.png`;
    const filePath = `generated/${fileName}`;

    // Upload to storage with cache control for faster loading
    const { error: uploadError } = await supabase.storage
      .from('holiday-images')
      .upload(filePath, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '31536000', // 1 year cache
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

    console.log('SUCCESS: Image saved ->', publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: publicUrl,
        holidayName,
        sizeKB: Math.round(imageBuffer.length / 1024)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('ERROR generating holiday image:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
