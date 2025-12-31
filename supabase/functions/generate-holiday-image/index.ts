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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { ownerFirstName, propertyName, promptTemplate, holidayName } = await req.json();

    console.log('=== HOLIDAY IMAGE GENERATION (OpenAI) ===');
    console.log('Holiday:', holidayName);
    console.log('Owner:', ownerFirstName);

    const cleanHolidayName = holidayName || 'Holiday';
    const holidayGreeting = getHolidayGreeting(cleanHolidayName);
    console.log('Greeting:', holidayGreeting);

    const ownerName = ownerFirstName || 'Friend';
    
    // Build prompt for OpenAI gpt-image-1
    let imagePrompt: string;
    if (promptTemplate && promptTemplate.trim()) {
      imagePrompt = promptTemplate
        .replace(/{owner_first_name}/g, ownerName)
        .replace(/{owner_name}/g, ownerName)
        .replace(/{holiday_name}/g, cleanHolidayName)
        .replace(/{holiday_greeting}/g, holidayGreeting);
      
      if (!imagePrompt.toLowerCase().includes(ownerName.toLowerCase())) {
        imagePrompt += ` The image MUST prominently display "${holidayGreeting}, ${ownerName}!" in elegant text.`;
      }
    } else {
      imagePrompt = `Create a beautiful ${cleanHolidayName} greeting card featuring a cozy, elegant house decorated for ${cleanHolidayName}. The house should have warm lighting from windows, festive ${cleanHolidayName} decorations appropriate to the holiday, and a welcoming atmosphere. The image MUST prominently display the text "${holidayGreeting}, ${ownerName}!" in an elegant, easy-to-read script font overlaid on the scene. Use warm, inviting colors and imagery specifically appropriate for ${cleanHolidayName}. Professional property management holiday card style.`;
    }
    
    console.log('Image prompt:', imagePrompt.substring(0, 200) + '...');
    console.log('Calling OpenAI gpt-image-1 API...');

    // Call OpenAI image generation API (DALL-E 3)
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) {
      console.error('No image URL in response:', JSON.stringify(data).substring(0, 500));
      throw new Error('No image URL returned from OpenAI');
    }

    console.log('Image generated successfully, downloading...');

    // Download the image from OpenAI URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    const imageBuffer = new Uint8Array(await imageResponse.arrayBuffer());
    console.log('Image size:', Math.round(imageBuffer.length / 1024), 'KB');

    // Upload to storage
    const timestamp = Date.now();
    const holidaySlug = cleanHolidayName.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const ownerSlug = (ownerFirstName || 'owner').replace(/[^a-zA-Z0-9]/g, '');
    const filePath = `generated/${timestamp}-${holidaySlug}-${ownerSlug}.png`;

    const { error: uploadError } = await supabase.storage
      .from('holiday-images')
      .upload(filePath, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('holiday-images')
      .getPublicUrl(filePath);

    console.log('SUCCESS - Image URL:', publicUrl);

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
