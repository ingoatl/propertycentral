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
      ownerFirstName, 
      propertyName, 
      promptTemplate,
      holidayName
    } = await req.json();

    console.log('=== HOLIDAY IMAGE GENERATION ===');
    console.log('Holiday:', holidayName);
    console.log('Owner:', ownerFirstName);
    console.log('Property:', propertyName);
    console.log('Template length:', promptTemplate?.length || 0);

    // Build the personalized prompt from the template
    let personalizedPrompt = (promptTemplate || '')
      .replace(/{owner_first_name}/g, ownerFirstName || 'Friend')
      .replace(/{owner_name}/g, ownerFirstName || 'Friend')
      .replace(/{property_name}/g, propertyName || 'your property');

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
        'independence day': 'Happy Independence Day',
        '4th of july': 'Happy 4th of July',
        'fourth of july': 'Happy 4th of July',
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

    const cleanHolidayName = holidayName || 'Holiday';
    const holidayGreeting = getHolidayGreeting(cleanHolidayName);
    
    console.log('Holiday greeting for image:', holidayGreeting);

    // If no prompt template, create a generic one based on holiday name
    if (!personalizedPrompt || personalizedPrompt.trim().length < 20) {
      console.log('WARN: No template provided, using generic prompt');
      personalizedPrompt = `Create a beautiful ${cleanHolidayName} greeting card image. 
      A warm, inviting scene with elegant text saying "${holidayGreeting}!" prominently displayed.
      Style: High quality, warm and inviting, perfect for a greeting card.`;
    }

    // Build a clean, simple prompt for image generation
    const imagePrompt = `Generate a beautiful ${cleanHolidayName} greeting card image.

REQUIREMENTS:
- Create a stunning, festive ${cleanHolidayName} themed image
- Include elegant decorative text saying "${holidayGreeting}!" prominently displayed in the image
- Make it warm, inviting, and visually appealing
- Style: High-quality greeting card suitable for email, luxurious and elegant
- Dimensions: Horizontal banner format (approximately 2:1 ratio)

THEME DETAILS FROM TEMPLATE:
${personalizedPrompt}

IMPORTANT: The text "${holidayGreeting}!" must be clearly visible and beautifully rendered in the image.`;

    console.log('Full prompt preview:', imagePrompt.substring(0, 300) + '...');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: imagePrompt
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
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received for', holidayName);

    // Extract the generated image
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData) {
      console.error('No image in response:', JSON.stringify(data).substring(0, 500));
      throw new Error('No image was generated by the AI');
    }

    // The image is base64 encoded, save it to storage
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Generate unique filename with holiday context
    const timestamp = Date.now();
    const holidaySlug = (holidayName || 'holiday').replace(/\s+/g, '-').toLowerCase();
    const ownerSlug = (ownerFirstName || 'owner').replace(/\s+/g, '_');
    const fileName = `${timestamp}-${holidaySlug}-${ownerSlug}.png`;
    const filePath = `generated/${fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
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

    console.log('SUCCESS: Image saved for', holidayName, '->', publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: publicUrl,
        holidayName
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
