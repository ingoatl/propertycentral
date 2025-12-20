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

    const cleanHolidayName = holidayName || 'Holiday';
    const holidayGreeting = getHolidayGreeting(cleanHolidayName);
    
    console.log('Holiday greeting:', holidayGreeting);

    // Simple, effective prompt for OpenAI image generation
    const imagePrompt = `A beautiful ${cleanHolidayName} greeting card with the text "${holidayGreeting}!" prominently displayed. Festive, warm, elegant design. Horizontal banner format.`;

    console.log('Generating image with OpenAI...');

    // Use OpenAI's gpt-image-1 for fast, reliable image generation
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: imagePrompt,
        n: 1,
        size: '1536x1024', // Horizontal format
        quality: 'low', // Faster generation, smaller file
        output_format: 'png',
        output_compression: 50, // Reduce file size
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', response.status, errorText);
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Image generated successfully');

    // gpt-image-1 returns base64 data directly
    const base64Data = data.data?.[0]?.b64_json;
    if (!base64Data) {
      throw new Error('No image data in response');
    }

    // Convert base64 to buffer
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    console.log('Image size:', Math.round(imageBuffer.length / 1024), 'KB');

    // Generate filename
    const timestamp = Date.now();
    const holidaySlug = cleanHolidayName.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const ownerSlug = (ownerFirstName || 'owner').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const fileName = `${timestamp}-${holidaySlug}-${ownerSlug}.png`;
    const filePath = `generated/${fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('holiday-images')
      .upload(filePath, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to save image: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('holiday-images')
      .getPublicUrl(filePath);

    console.log('SUCCESS:', publicUrl);

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
    console.error('ERROR:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
