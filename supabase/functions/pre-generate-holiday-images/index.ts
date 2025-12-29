import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PreGenerateRequest {
  templateId: string;
  limit?: number; // Max images to generate in this batch
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { templateId, limit = 50 } = await req.json() as PreGenerateRequest;

    console.log('=== PRE-GENERATE HOLIDAY IMAGES ===');
    console.log('Template ID:', templateId);
    console.log('Limit:', limit);

    // Fetch the template
    const { data: template, error: templateError } = await supabase
      .from('holiday_email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      throw new Error(`Template not found: ${templateError?.message}`);
    }

    console.log('Template:', template.holiday_name);

    // Fetch queue items that need images
    const { data: queueItems, error: queueError } = await supabase
      .from('holiday_email_queue')
      .select(`
        id,
        recipient_name,
        recipient_email,
        owner_id,
        property_id
      `)
      .eq('template_id', templateId)
      .eq('status', 'pending')
      .is('pre_generated_image_url', null)
      .limit(limit);

    if (queueError) {
      throw new Error(`Failed to fetch queue: ${queueError.message}`);
    }

    console.log(`Found ${queueItems?.length || 0} items needing images`);

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No items need images',
          generated: 0,
          total: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get property names for personalization
    const propertyIds = [...new Set(queueItems.map(q => q.property_id).filter(Boolean))];
    const { data: properties } = await supabase
      .from('properties')
      .select('id, name, address')
      .in('id', propertyIds);

    const propertyMap = new Map(properties?.map(p => [p.id, p.name || p.address]) || []);

    const results: { id: string; success: boolean; imageUrl?: string; error?: string }[] = [];
    let successCount = 0;
    let failCount = 0;

    // Process each queue item
    for (const item of queueItems) {
      const ownerFirstName = item.recipient_name?.split(' ')[0] || 'Friend';
      const propertyName = propertyMap.get(item.property_id) || 'Your Property';

      console.log(`Generating image for ${ownerFirstName} (${item.recipient_email})`);

      try {
        // Call the generate-holiday-image function
        const imageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-holiday-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            ownerFirstName,
            propertyName,
            promptTemplate: template.image_prompt_template,
            holidayName: template.holiday_name,
          }),
        });

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          throw new Error(`Image generation failed: ${errorText}`);
        }

        const imageData = await imageResponse.json();
        
        if (!imageData.imageUrl) {
          throw new Error('No image URL in response');
        }

        // Update the queue item with the pre-generated image URL
        const { error: updateError } = await supabase
          .from('holiday_email_queue')
          .update({ 
            pre_generated_image_url: imageData.imageUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        if (updateError) {
          throw new Error(`Failed to update queue: ${updateError.message}`);
        }

        results.push({ id: item.id, success: true, imageUrl: imageData.imageUrl });
        successCount++;
        console.log(`✓ Image generated for ${ownerFirstName}`);

        // Rate limiting: wait 500ms between generations to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`✗ Failed for ${ownerFirstName}:`, errorMsg);
        
        results.push({ id: item.id, success: false, error: errorMsg });
        failCount++;

        // If it's a rate limit error, stop processing
        if (errorMsg.includes('Rate limit') || errorMsg.includes('429')) {
          console.log('Rate limit hit, stopping batch');
          break;
        }

        // Still wait a bit before next attempt
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`=== COMPLETE: ${successCount} success, ${failCount} failed ===`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${successCount} images, ${failCount} failed`,
        generated: successCount,
        failed: failCount,
        total: queueItems.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in pre-generate-holiday-images:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
