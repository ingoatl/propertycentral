import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Comprehensive field mappings from MidTermNation to onboarding phases
const FIELD_MAPPINGS = [
  // Phase 1 - Owner Intake & Legal
  { phase: 1, titlePattern: '%Owner Name%', field: 'contact_name' },
  { phase: 1, titlePattern: '%Owner Email%', field: 'contact_email' },
  { phase: 1, titlePattern: '%Owner Phone%', field: 'contact_phone' },
  
  // Phase 7 - Listings & Booking Platforms
  { phase: 7, titlePattern: '%Airbnb%', field: 'existing_listing_url' },
  { phase: 7, titlePattern: '%Direct Booking%', field: 'virtual_tour_url' },
  { phase: 7, titlePattern: '%Virtual Tour%', field: 'virtual_tour_url' },
  { phase: 7, titlePattern: '%PeachHaus Website%', field: 'virtual_tour_url' },
  
  // Phase 8 - Marketing and Guest Experience
  { phase: 8, titlePattern: '%Pet policy%', field: 'pet_policy', transform: (v: string) => v?.toLowerCase() === 'allowed' ? 'Yes' : 'No' },
  { phase: 8, titlePattern: '%Unique selling%', field: 'property_description' },
  { phase: 8, titlePattern: '%Property Description%', field: 'property_description' },
  
  // Phase 10 - Property Specifications
  { phase: 10, titlePattern: '%Year Built%', field: 'year_built', transform: (v: any) => v?.toString() },
  { phase: 10, titlePattern: '%Max Occupancy%', field: 'max_guests', transform: (v: any) => v?.toString() },
  { phase: 10, titlePattern: '%Square Footage%', field: 'square_footage', transform: (v: any) => v?.toString() },
  { phase: 10, titlePattern: '%Bedrooms%', field: 'bedrooms', transform: (v: any) => v?.toString() },
  { phase: 10, titlePattern: '%Bathrooms%', field: 'bathrooms', transform: (v: any) => v?.toString() },
  { phase: 10, titlePattern: '%Parking Capacity%', field: 'parking_spaces', transform: (v: any) => v?.toString() },
  { phase: 10, titlePattern: '%Parking Type%', field: 'parking_type' },
  { phase: 10, titlePattern: '%Stories%', field: 'stories', transform: (v: any) => v?.toString() },
  { phase: 10, titlePattern: '%Property Type%', field: 'property_type' },
  
  // Phase 11 - Financial Terms & Pricing
  { phase: 11, titlePattern: '%Monthly Rent%', field: 'monthly_price', transform: (v: any) => 
    v ? `⚠️ MidTermNation price: $${Number(v).toLocaleString()}/mo. For listing sites, calculate long-term rent: Zillow Rent Zestimate × 2.3` : null 
  },
  { phase: 11, titlePattern: '%Security Deposit%', field: 'security_deposit', transform: (v: any) => v ? `$${Number(v).toLocaleString()}` : null },
  { phase: 11, titlePattern: '%Cleaning Fee%', field: 'cleaning_fee', transform: (v: any) => v ? `$${Number(v).toLocaleString()}` : null },
  
  // Phase 12 - Pet & Lease Policies
  { phase: 12, titlePattern: '%Pets Allowed%', field: 'pet_policy', transform: (v: string) => v?.toLowerCase() === 'allowed' ? 'Yes' : 'No' },
  { phase: 12, titlePattern: '%Pet Policy Details%', field: 'pet_policy_details' },
];

async function createOnboardingProjectIfNeeded(supabase: any, partnerPropertyId: string, property: any): Promise<string | null> {
  // Check if project already exists
  const { data: existingProject } = await supabase
    .from('onboarding_projects')
    .select('id')
    .eq('partner_property_id', partnerPropertyId)
    .single();

  if (existingProject) {
    console.log(`Onboarding project already exists: ${existingProject.id}`);
    return existingProject.id;
  }

  // Create new onboarding project
  const fullAddress = [property.address, property.city, property.state, property.zip_code]
    .filter(Boolean)
    .join(', ');

  const { data: newProject, error } = await supabase
    .from('onboarding_projects')
    .insert({
      owner_name: property.contact_name || 'Partner Owner',
      property_address: fullAddress || property.property_title || 'Partner Property',
      partner_property_id: partnerPropertyId,
      status: 'in_progress',
      progress: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create onboarding project:', error);
    return null;
  }

  console.log(`Created new onboarding project: ${newProject.id}`);

  // Create Phase 7 tasks for partner properties (per memory: partner properties only show Phase 7)
  const phase7Tasks = [
    { title: 'Airbnb', field_type: 'url' },
    { title: 'VRBO', field_type: 'url' },
    { title: 'Booking.com', field_type: 'url' },
    { title: 'Furnished Finder', field_type: 'url' },
    { title: 'Direct Booking Page', field_type: 'url' },
    { title: 'PeachHaus Website', field_type: 'url' },
  ];

  // Also create tasks for other phases to store synced data
  const otherPhaseTasks = [
    // Phase 1
    { phase: 1, title: 'Owner Name', field_type: 'text' },
    { phase: 1, title: 'Owner Email', field_type: 'email' },
    { phase: 1, title: 'Owner Phone', field_type: 'phone' },
    // Phase 10
    { phase: 10, title: 'Year Built', field_type: 'text' },
    { phase: 10, title: 'Max Occupancy', field_type: 'number' },
    { phase: 10, title: 'Square Footage', field_type: 'number' },
    { phase: 10, title: 'Bedrooms', field_type: 'number' },
    { phase: 10, title: 'Bathrooms', field_type: 'number' },
    { phase: 10, title: 'Parking Capacity', field_type: 'number' },
    { phase: 10, title: 'Parking Type', field_type: 'text' },
    { phase: 10, title: 'Stories', field_type: 'number' },
    { phase: 10, title: 'Property Type Detail', field_type: 'text' },
    // Phase 11
    { phase: 11, title: 'Monthly Rent', field_type: 'text' },
    { phase: 11, title: 'Security Deposit', field_type: 'text' },
    { phase: 11, title: 'Cleaning Fee', field_type: 'text' },
    // Phase 12
    { phase: 12, title: 'Pets Allowed', field_type: 'checkbox' },
    { phase: 12, title: 'Pet Policy Details', field_type: 'textarea' },
    // Phase 8
    { phase: 8, title: 'Unique selling points of property', field_type: 'textarea' },
    { phase: 8, title: 'Pet policy (Allowed/Not Allowed)', field_type: 'text' },
  ];

  // Insert Phase 7 tasks
  for (const task of phase7Tasks) {
    await supabase.from('onboarding_tasks').insert({
      project_id: newProject.id,
      phase_number: 7,
      phase_title: 'Listings & Booking Platforms',
      title: task.title,
      field_type: task.field_type,
      status: 'pending',
    });
  }

  // Insert other phase tasks (hidden in UI but store synced data)
  for (const task of otherPhaseTasks) {
    await supabase.from('onboarding_tasks').insert({
      project_id: newProject.id,
      phase_number: task.phase,
      phase_title: getPhaseTitle(task.phase),
      title: task.title,
      field_type: task.field_type,
      status: 'pending',
    });
  }

  console.log(`Created ${phase7Tasks.length + otherPhaseTasks.length} tasks for project ${newProject.id}`);
  return newProject.id;
}

function getPhaseTitle(phaseNumber: number): string {
  const titles: Record<number, string> = {
    1: 'Owner Intake & Legal',
    7: 'Listings & Booking Platforms',
    8: 'Marketing and Guest Experience',
    10: 'Property Specifications',
    11: 'Financial Terms & Pricing',
    12: 'Pet & Lease Policies',
  };
  return titles[phaseNumber] || `Phase ${phaseNumber}`;
}

async function populateOnboardingFields(supabase: any, projectId: string, property: any): Promise<number> {
  let updatedCount = 0;

  for (const mapping of FIELD_MAPPINGS) {
    let value = property[mapping.field];
    
    // Apply transformation if defined
    if (value !== null && value !== undefined && mapping.transform) {
      value = mapping.transform(value);
    }
    
    if (value) {
      const { data, error } = await supabase
        .from('onboarding_tasks')
        .update({ 
          field_value: value,
          status: 'completed'
        })
        .eq('project_id', projectId)
        .ilike('title', mapping.titlePattern)
        .or('field_value.is.null,field_value.eq.""')
        .select('id');
      
      if (error) {
        console.error(`Failed to update ${mapping.titlePattern}:`, error);
      } else if (data && data.length > 0) {
        updatedCount++;
        console.log(`✓ Populated "${mapping.titlePattern}" with: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
      }
    }
  }

  return updatedCount;
}

async function sendNewPropertyAlert(property: any, projectId: string, fieldsPopulated: number) {
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
          .success-badge { background: #22c55e; }
          .alert-box { background: #FFF3CD; border: 1px solid #FFECB5; border-radius: 8px; padding: 15px; margin: 15px 0; }
          .alert-box strong { color: #856404; }
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
            <p>A new partner property from MidTermNation has been added to Property Central.</p>
            
            <div class="property-card">
              <span class="badge">NEW PROPERTY</span>
              <span class="badge success-badge" style="margin-left: 8px;">${fieldsPopulated} FIELDS PRE-POPULATED</span>
              <div class="property-title">${property.property_title || 'Untitled Property'}</div>
              <div class="property-detail"><strong>📍 Address:</strong> ${fullAddress || 'Not provided'}</div>
              <div class="property-detail"><strong>🏠 Type:</strong> ${property.property_type || 'Not specified'}</div>
              <div class="property-detail"><strong>🛏️ Bedrooms:</strong> ${property.bedrooms || 'N/A'}</div>
              <div class="property-detail"><strong>🚿 Bathrooms:</strong> ${property.bathrooms || 'N/A'}</div>
              <div class="property-detail"><strong>📐 Sq Ft:</strong> ${property.square_footage ? property.square_footage.toLocaleString() : 'N/A'}</div>
              <div class="property-detail"><strong>👤 Owner:</strong> ${property.contact_name || 'Not provided'} ${property.contact_email ? `(${property.contact_email})` : ''}</div>
              <div class="property-detail"><strong>📞 Phone:</strong> ${property.contact_phone || 'Not provided'}</div>
              ${property.existing_listing_url ? `<div class="property-detail"><strong>🔗 Existing Listing:</strong> <a href="${property.existing_listing_url}">${property.existing_listing_url}</a></div>` : ''}
            </div>

            <div class="alert-box">
              <strong>⚠️ Monthly Rent Calculation Required:</strong><br>
              MidTermNation sent: <strong>$${property.monthly_price ? property.monthly_price.toLocaleString() : 'N/A'}/mo</strong><br>
              For listing sites, calculate: <strong>Zillow Rent Zestimate × 2.3</strong>
            </div>

            <p><strong>✅ Property Details Pre-Populated:</strong></p>
            <ul>
              <li>Owner contact information (Name, Email, Phone)</li>
              <li>Property specifications (Beds, Baths, Sq Ft, etc.)</li>
              <li>Financial terms (Security Deposit, Cleaning Fee)</li>
              <li>Pet policy details</li>
              ${property.existing_listing_url ? '<li>Existing Airbnb listing URL</li>' : ''}
            </ul>

            <p><strong>🎯 Action Required:</strong></p>
            <ul>
              <li><strong>Complete Phase 7 (Listings & Booking Platforms)</strong> - Add this property to all listing platforms</li>
              <li>Calculate listing rent using Zillow Zestimate × 2.3</li>
              <li>Update listing URLs once created</li>
            </ul>

            <a href="https://preview--peachhaus-property-central.lovable.app/properties" class="cta-button">Complete Phase 7 in Property Central →</a>
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
      subject: `🏠 New Property: ${property.property_title || 'Partner Property'} - Complete Phase 7`,
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
    let totalFieldsPopulated = 0;
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
        
        if (upsertedProperty?.id) {
          // Step 1: Create or find onboarding project
          const projectId = await createOnboardingProjectIfNeeded(supabase, upsertedProperty.id, property);
          
          if (projectId) {
            // Step 2: Populate ALL onboarding fields from synced data
            const fieldsPopulated = await populateOnboardingFields(supabase, projectId, property);
            totalFieldsPopulated += fieldsPopulated;
            console.log(`Populated ${fieldsPopulated} fields for project ${projectId}`);
            
            // Step 3: ONLY THEN send email alert for NEW properties
            if (isNewProperty) {
              newPropertyCount++;
              console.log(`NEW PROPERTY DETECTED: ${property.property_title} - Sending alert to Chris (after populating ${fieldsPopulated} fields)`);
              await sendNewPropertyAlert(property, projectId, fieldsPopulated);
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
          error_details: errors.length > 0 ? errors : null,
          sync_status: errorCount > 0 && successCount === 0 ? 'failed' : 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLogId);

      if (updateError) {
        console.error('Failed to update sync log:', updateError);
      } else {
        console.log(`Updated sync log: ${successCount} synced, ${errorCount} failed, ${newPropertyCount} new, ${totalFieldsPopulated} fields populated`);
      }
    }

    console.log(`=== Sync Complete: ${successCount} succeeded, ${errorCount} failed, ${newPropertyCount} new properties, ${totalFieldsPopulated} fields populated ===`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: successCount,
        failed: errorCount,
        newProperties: newPropertyCount,
        fieldsPopulated: totalFieldsPopulated,
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
