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
  if (greetings[lowerName]) return greetings[lowerName];
  
  for (const [key, greeting] of Object.entries(greetings)) {
    if (lowerName.includes(key)) return greeting;
  }
  
  return `Happy ${name}`;
};

// Convert PNG to optimized JPEG using canvas
async function optimizeImage(base64Data: string): Promise<{ buffer: Uint8Array; mimeType: string }> {
  // Remove data URL prefix if present
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
  
  // For now, return as-is but with proper JPEG content type hint
  // The AI already generates reasonably sized images
  // In production, you'd use a proper image processing library
  
  // Check if it's already small enough (under 200KB is good for email)
  const sizeKB = imageBuffer.length / 1024;
  console.log(`Original image size: ${Math.round(sizeKB)}KB`);
  
  if (sizeKB < 200) {
    // Already optimized enough
    return { buffer: imageBuffer, mimeType: 'image/png' };
  }
  
  // For larger images, we'll still use PNG but log a warning
  console.log('Image is larger than ideal for email, but proceeding with PNG');
  return { buffer: imageBuffer, mimeType: 'image/png' };
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

    const { ownerFirstName, propertyName, promptTemplate, holidayName } = await req.json();

    console.log('=== HOLIDAY IMAGE GENERATION ===');
    console.log('Holiday:', holidayName);
    console.log('Owner:', ownerFirstName);

    const cleanHolidayName = holidayName || 'Holiday';
    const holidayGreeting = getHolidayGreeting(cleanHolidayName);
    console.log('Greeting:', holidayGreeting);

    // Build prompt using the holiday-specific template if provided, otherwise use default
    const ownerName = ownerFirstName || 'Friend';
    
    // Use the custom prompt template if provided, otherwise build a default one
    // Request smaller dimensions for faster loading in email clients
    let imagePrompt: string;
    if (promptTemplate && promptTemplate.trim()) {
      // Replace placeholders in the custom template
      imagePrompt = promptTemplate
        .replace(/{owner_first_name}/g, ownerName)
        .replace(/{owner_name}/g, ownerName)
        .replace(/{holiday_name}/g, cleanHolidayName)
        .replace(/{holiday_greeting}/g, holidayGreeting);
      
      // Ensure the greeting text is included
      if (!imagePrompt.toLowerCase().includes(ownerName.toLowerCase())) {
        imagePrompt += ` The image MUST prominently display "${holidayGreeting}, ${ownerName}!" in elegant text.`;
      }
    } else {
      // Default prompt with cozy house theme - optimized for email (600px wide)
      imagePrompt = `Create a beautiful ${cleanHolidayName} greeting card featuring a cozy, elegant house decorated for ${cleanHolidayName}. The house should have warm lighting from windows, festive ${cleanHolidayName} decorations appropriate to the holiday, and a welcoming atmosphere. The image MUST prominently display the text "${holidayGreeting}, ${ownerName}!" in an elegant, easy-to-read script font overlaid on the scene. Use warm, inviting colors and imagery specifically appropriate for ${cleanHolidayName}. Professional property management holiday card style. Horizontal banner format 600x400 pixels, optimized for email viewing.`;
    }
    
    // Add optimization hints to prompt
    imagePrompt += " Create a compact, email-optimized image around 600 pixels wide.";
    
    console.log('Image prompt:', imagePrompt.substring(0, 200) + '...');

    console.log('Calling Gemini image API...');

    // Try up to 3 times with the Gemini model
    let imageData: string | null = null;
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`Attempt ${attempt}/3`);
      
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [{ role: "user", content: imagePrompt }],
            modalities: ["image", "text"]
          }),
        });

        if (!response.ok) {
          lastError = `API error: ${response.status}`;
          console.error(lastError);
          if (response.status === 429 || response.status === 402) {
            throw new Error(response.status === 429 ? 'Rate limit exceeded' : 'Credits exhausted');
          }
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }

        const data = await response.json();
        imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        
        if (imageData) {
          console.log('Image generated successfully');
          break;
        }
        
        lastError = 'No image in response';
        console.log(lastError, '- retrying...');
        await new Promise(r => setTimeout(r, 500));
        
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Unknown error';
        console.error('Attempt failed:', lastError);
        if (lastError.includes('Rate limit') || lastError.includes('Credits')) {
          throw e;
        }
      }
    }

    if (!imageData) {
      throw new Error(`Image generation failed after 3 attempts: ${lastError}`);
    }

    // Optimize and process image
    const { buffer: imageBuffer, mimeType } = await optimizeImage(imageData);
    const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    console.log('Final image size:', Math.round(imageBuffer.length / 1024), 'KB');

    const timestamp = Date.now();
    const holidaySlug = cleanHolidayName.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const ownerSlug = (ownerFirstName || 'owner').replace(/[^a-zA-Z0-9]/g, '');
    const filePath = `generated/${timestamp}-${holidaySlug}-${ownerSlug}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('holiday-images')
      .upload(filePath, imageBuffer, {
        contentType: mimeType,
        cacheControl: '31536000', // 1 year cache for CDN
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('holiday-images')
      .getPublicUrl(filePath);

    console.log('SUCCESS:', publicUrl);

    return new Response(
      JSON.stringify({ success: true, imageUrl: publicUrl, holidayName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('ERROR:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
