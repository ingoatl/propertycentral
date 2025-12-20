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

    // Personalized prompt with owner's name
    const ownerName = ownerFirstName || 'Friend';
    const imagePrompt = `Create a festive ${cleanHolidayName} greeting card image. The image MUST prominently display the text "${holidayGreeting}, ${ownerName}!" in an elegant, readable font. Use warm, inviting colors appropriate for ${cleanHolidayName}. Horizontal banner format, high quality.`;

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

    // Process and upload image
    const cleanBase64 = imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
    console.log('Image size:', Math.round(imageBuffer.length / 1024), 'KB');

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
