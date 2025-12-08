import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== Receive Partner Sync Started ===");

  const startedAt = new Date().toISOString();
  let syncLogId: string | null = null;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Validate API key
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('PARTNER_SYNC_API_KEY');
    
    if (!apiKey || apiKey !== expectedKey) {
      console.error("Unauthorized: Invalid or missing API key");
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { properties } = await req.json();
    
    if (!properties || !Array.isArray(properties)) {
      console.error("Invalid payload: properties array required");
      return new Response(
        JSON.stringify({ error: 'Invalid payload: properties array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Received ${properties.length} properties to sync`);

    // Create sync log entry for watchdog monitoring
    const { data: logData, error: logError } = await supabase
      .from('partner_sync_log')
      .insert({
        sync_type: 'incoming',
        source_system: 'midtermnation',
        properties_synced: 0,
        properties_failed: 0,
        sync_status: 'in_progress',
        started_at: startedAt,
      })
      .select('id')
      .single();

    if (logError) {
      console.error('Failed to create sync log:', logError);
    } else {
      syncLogId = logData.id;
      console.log(`Created sync log: ${syncLogId}`);
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: { source_id: string; error: string }[] = [];

    for (const property of properties) {
      console.log(`Processing property: ${property.property_title} (source_id: ${property.source_id})`);
      
      const { data: upsertedProperty, error } = await supabase
        .from('partner_properties')
        .upsert({
          source_id: property.source_id,
          source_system: property.source_system || 'midtermnation',
          category: property.category || 'Partner Inventory',
          property_title: property.property_title,
          address: property.address,
          city: property.city,
          state: property.state,
          zip_code: property.zip_code,
          property_type: property.property_type,
          property_description: property.property_description,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          square_footage: property.square_footage,
          max_guests: property.max_guests,
          stories: property.stories,
          parking_spaces: property.parking_spaces,
          parking_type: property.parking_type,
          year_built: property.year_built,
          featured_image_url: property.featured_image_url,
          gallery_images: property.gallery_images,
          amenities: property.amenities,
          appliances_included: property.appliances_included,
          services_included: property.services_included,
          utilities_included: property.utilities_included,
          monthly_price: property.monthly_price,
          security_deposit: property.security_deposit,
          cleaning_fee: property.cleaning_fee,
          contact_name: property.contact_name,
          contact_email: property.contact_email,
          contact_phone: property.contact_phone,
          pet_policy: property.pet_policy,
          pet_policy_details: property.pet_policy_details,
          ical_url: property.ical_url,
          existing_listing_url: property.existing_listing_url,
          virtual_tour_url: property.virtual_tour_url,
          slug: property.slug,
          status: property.status || 'active',
          is_public: property.is_public !== false,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'source_id,source_system'
        })
        .select('id')
        .single();

      if (error) {
        errorCount++;
        errors.push({ source_id: property.source_id, error: error.message });
        console.error(`Failed to sync property ${property.source_id}:`, error);
      } else {
        successCount++;
        console.log(`Successfully synced property: ${property.property_title}`);
        
        // Auto-fill existing onboarding tasks with synced data
        if (upsertedProperty?.id) {
          // Find onboarding project linked to this partner property
          const { data: linkedProject } = await supabase
            .from('onboarding_projects')
            .select('id')
            .eq('partner_property_id', upsertedProperty.id)
            .single();
          
          if (linkedProject) {
            // Define field mappings: task title pattern -> property value
            const fieldMappings = [
              { titlePattern: '%Airbnb%', value: property.existing_listing_url },
              { titlePattern: '%Year Built%', value: property.year_built?.toString() },
              { titlePattern: '%Max Occupancy%', value: property.max_guests?.toString() },
              { titlePattern: '%Square Footage%', value: property.square_footage?.toString() },
              { titlePattern: '%Bedrooms%', value: property.bedrooms?.toString() },
              { titlePattern: '%Bathrooms%', value: property.bathrooms?.toString() },
              { titlePattern: '%Parking Capacity%', value: property.parking_spaces?.toString() },
              { titlePattern: '%Parking Type%', value: property.parking_type },
              { titlePattern: '%Stories%', value: property.stories?.toString() },
            ];

            for (const mapping of fieldMappings) {
              if (mapping.value) {
                const { error: updateError } = await supabase
                  .from('onboarding_tasks')
                  .update({ 
                    field_value: mapping.value,
                    status: 'completed'
                  })
                  .eq('project_id', linkedProject.id)
                  .ilike('title', mapping.titlePattern)
                  .or('field_value.is.null,field_value.eq.""');
                
                if (updateError) {
                  console.error(`Failed to update ${mapping.titlePattern} task:`, updateError);
                } else {
                  console.log(`Auto-filled ${mapping.titlePattern} with: ${mapping.value}`);
                }
              }
            }
          }
        }
      }
    }

    // Update sync log with final results
    if (syncLogId) {
      const { error: updateError } = await supabase
        .from('partner_sync_log')
        .update({
          properties_synced: successCount,
          properties_failed: errorCount,
          error_details: errors,
          sync_status: errorCount > 0 && successCount === 0 ? 'failed' : 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLogId);

      if (updateError) {
        console.error('Failed to update sync log:', updateError);
      } else {
        console.log(`Updated sync log: ${successCount} synced, ${errorCount} failed`);
      }
    }

    console.log(`=== Sync Complete: ${successCount} succeeded, ${errorCount} failed ===`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: successCount,
        failed: errorCount,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Update sync log on failure
    if (syncLogId) {
      await supabase
        .from('partner_sync_log')
        .update({
          sync_status: 'failed',
          error_details: [{ error: errorMessage }],
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLogId);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
