import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

async function sendNewPropertyAlert(property: any) {
  try {
    const fullAddress = [property.address, property.city, property.state, property.zip_code]
      .filter(Boolean)
      .join(', ');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2D5A27 0%, #4A7C43 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; }
          .property-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .property-title { font-size: 20px; font-weight: bold; color: #2D5A27; margin-bottom: 10px; }
          .property-detail { margin: 8px 0; }
          .property-detail strong { color: #555; }
          .cta-button { display: inline-block; background: #2D5A27; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .badge { display: inline-block; background: #FFA500; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏠 New Partner Property Alert</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">A new property has been synced to Property Central</p>
          </div>
          <div class="content">
            <p>Hi Chris,</p>
            <p>A new partner property from MidTermNation has been added to Property Central and needs to be listed on all platforms.</p>
            
            <div class="property-card">
              <span class="badge">NEW PROPERTY</span>
              <div class="property-title">${property.property_title || 'Untitled Property'}</div>
              <div class="property-detail"><strong>📍 Address:</strong> ${fullAddress || 'Not provided'}</div>
              <div class="property-detail"><strong>🏠 Type:</strong> ${property.property_type || 'Not specified'}</div>
              <div class="property-detail"><strong>🛏️ Bedrooms:</strong> ${property.bedrooms || 'N/A'}</div>
              <div class="property-detail"><strong>🚿 Bathrooms:</strong> ${property.bathrooms || 'N/A'}</div>
              <div class="property-detail"><strong>📐 Sq Ft:</strong> ${property.square_footage ? property.square_footage.toLocaleString() : 'N/A'}</div>
              <div class="property-detail"><strong>💰 Monthly Price:</strong> ${property.monthly_price ? '$' + property.monthly_price.toLocaleString() : 'Not set'}</div>
              <div class="property-detail"><strong>👤 Owner Contact:</strong> ${property.contact_name || 'Not provided'}</div>
              ${property.existing_listing_url ? `<div class="property-detail"><strong>🔗 Existing Listing:</strong> <a href="${property.existing_listing_url}">${property.existing_listing_url}</a></div>` : ''}
            </div>

            <p><strong>Action Required:</strong></p>
            <ul>
              <li>Add this property to all listing platforms (Airbnb, VRBO, Furnished Finder, etc.)</li>
              <li>Complete the onboarding tasks in Property Central</li>
              <li>Update listing URLs once created</li>
            </ul>

            <a href="https://preview--peachhaus-property-central.lovable.app/properties" class="cta-button">View in Property Central →</a>
          </div>
          <div class="footer">
            <p>This is an automated notification from PeachHaus Property Central</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await resend.emails.send({
      from: "PeachHaus Property Central <onboarding@resend.dev>",
      to: ["chris@peachhausgroup.com"],
      cc: ["info@peachhausgroup.com"],
      subject: `🏠 New Property Alert: ${property.property_title || 'New Partner Property'} - Action Required`,
      html: emailHtml,
    });

    console.log(`New property alert email sent to Chris:`, result);
    return true;
  } catch (error) {
    console.error('Failed to send new property alert email:', error);
    return false;
  }
}

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
    let newPropertyCount = 0;
    const errors: { source_id: string; error: string }[] = [];

    for (const property of properties) {
      console.log(`Processing property: ${property.property_title} (source_id: ${property.source_id})`);
      
      // Check if this is a NEW property (doesn't exist yet)
      const { data: existingProperty } = await supabase
        .from('partner_properties')
        .select('id')
        .eq('source_id', property.source_id)
        .eq('source_system', property.source_system || 'midtermnation')
        .single();

      const isNewProperty = !existingProperty;
      
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
        
        // Send email alert for NEW properties only
        if (isNewProperty) {
          newPropertyCount++;
          console.log(`NEW PROPERTY DETECTED: ${property.property_title} - Sending alert to Chris`);
          await sendNewPropertyAlert(property);
        }
        
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
        console.log(`Updated sync log: ${successCount} synced, ${errorCount} failed, ${newPropertyCount} new`);
      }
    }

    console.log(`=== Sync Complete: ${successCount} succeeded, ${errorCount} failed, ${newPropertyCount} new properties ===`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: successCount,
        failed: errorCount,
        newProperties: newPropertyCount,
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