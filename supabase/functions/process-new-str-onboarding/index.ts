import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Task mappings for new STR properties
const TASK_MAPPINGS: Record<string, { phase: number; title: string }> = {
  // Phase 1: Owner Info & Legal
  owner_name: { phase: 1, title: 'Owner Name' },
  owner_email: { phase: 1, title: 'Owner Email' },
  owner_phone: { phase: 1, title: 'Owner Phone' },
  entity_ownership: { phase: 1, title: 'Entity Ownership' },
  entity_name: { phase: 1, title: 'Entity Name' },
  tax_id: { phase: 1, title: 'Tax ID / EIN' },
  str_permit_status: { phase: 1, title: 'STR Permit Status' },
  permit_number: { phase: 1, title: 'STR Permit Number' },
  government_id_url: { phase: 1, title: 'Government ID' },
  property_deed_url: { phase: 1, title: 'Property Deed' },
  mortgage_statement_url: { phase: 1, title: 'Mortgage Statement' },
  entity_documents_url: { phase: 1, title: 'Entity Documents' },
  insurance_provider: { phase: 1, title: 'Insurance Provider' },
  insurance_policy_number: { phase: 1, title: 'Insurance Policy Number' },
  has_str_insurance: { phase: 1, title: 'Has STR-Specific Insurance' },
  insurance_certificate_url: { phase: 1, title: 'Insurance Certificate' },
  hoa_restrictions: { phase: 1, title: 'HOA Restrictions' },
  hoa_notes: { phase: 1, title: 'HOA Restriction Details' },
  hoa_contact_info: { phase: 1, title: 'HOA Contact Information' },
  hoa_rules_url: { phase: 1, title: 'HOA Rules Document' },

  // Phase 2: Property Access & Infrastructure
  wifi_ready: { phase: 2, title: 'WiFi Ready' },
  wifi_ssid: { phase: 2, title: 'WiFi Network Name' },
  wifi_password: { phase: 2, title: 'WiFi Password' },
  smart_lock_installed: { phase: 2, title: 'Smart Lock Installed' },
  smart_lock_brand: { phase: 2, title: 'Smart Lock Brand' },
  parking_instructions: { phase: 2, title: 'Parking Instructions' },
  max_vehicles: { phase: 2, title: 'Maximum Vehicles' },

  // Phase 3: Utilities
  utilities_setup: { phase: 3, title: 'Utilities Setup Status' },

  electric_provider: { phase: 3, title: 'Electric Provider' },
  gas_provider: { phase: 3, title: 'Gas Provider' },
  water_provider: { phase: 3, title: 'Water Provider' },
  trash_provider: { phase: 3, title: 'Trash Provider' },
  internet_provider: { phase: 3, title: 'Internet Provider' },

  // Phase 4: Cleaning & Operations
  has_existing_cleaner: { phase: 4, title: 'Has Existing Cleaner' },
  cleaner_name: { phase: 4, title: 'Primary Cleaner Name' },
  cleaner_phone: { phase: 4, title: 'Primary Cleaner Phone' },
  cleaner_rate: { phase: 4, title: 'Cleaner Rate' },
  needs_cleaner_referral: { phase: 4, title: 'Needs Cleaner Referral' },
  laundry_setup: { phase: 4, title: 'Laundry Setup' },
  laundry_notes: { phase: 4, title: 'Laundry Notes' },
  supply_storage_location: { phase: 4, title: 'Supply Closet Location' },
  preferred_turnover_time: { phase: 4, title: 'Preferred Turnover Time' },
  turnover_notes: { phase: 4, title: 'Turnover Notes' },

  // Phase 5: Photography
  photography_needs: { phase: 5, title: 'Photography Status' },
  photography_notes: { phase: 5, title: 'Photography Notes' },

  // Phase 6: Setup & Furnishing
  furniture_status: { phase: 6, title: 'Furniture Setup Status' },
  furniture_notes: { phase: 6, title: 'Furniture Notes' },
  kitchen_status: { phase: 6, title: 'Kitchen Setup Status' },
  kitchen_notes: { phase: 6, title: 'Kitchen Notes' },
  linens_status: { phase: 6, title: 'Linens Setup Status' },
  linens_notes: { phase: 6, title: 'Linens Notes' },
  decor_status: { phase: 6, title: 'Decor Setup Status' },
  decor_notes: { phase: 6, title: 'Decor Notes' },
  outdoor_status: { phase: 6, title: 'Outdoor Setup Status' },
  outdoor_notes: { phase: 6, title: 'Outdoor Notes' },
  cleaning_supplies_status: { phase: 6, title: 'Cleaning Supplies Status' },
  cleaning_supplies_notes: { phase: 6, title: 'Cleaning Supplies Notes' },

  // Phase 7: Listings & Platforms
  listing_platforms: { phase: 7, title: 'Selected Listing Platforms' },
  listing_title_ideas: { phase: 7, title: 'Listing Title Ideas' },
  unique_selling_points: { phase: 7, title: 'Unique Selling Points' },
  competitor_links: { phase: 7, title: 'Competitor Listings' },

  // Phase 8: Guest Materials
  checkout_procedures: { phase: 8, title: 'Checkout Instructions' },
  special_instructions: { phase: 8, title: 'House Quirks & Special Instructions' },

  // Phase 9: Vendors & Maintenance
  maintenance_contact: { phase: 9, title: 'Maintenance Contact' },
  emergency_contact: { phase: 9, title: 'Emergency Contact (24/7)' },
  known_issues: { phase: 9, title: 'Known Maintenance Issues' },
  pool_hot_tub_info: { phase: 9, title: 'Pool/Hot Tub Information' },

  // Phase 10: Property Specs
  property_type: { phase: 10, title: 'Property Type' },
  bedrooms: { phase: 10, title: 'Number of Bedrooms' },
  bathrooms: { phase: 10, title: 'Number of Bathrooms' },
  square_footage: { phase: 10, title: 'Square Footage' },
  property_features: { phase: 10, title: 'Property Features & Amenities' },
  neighbor_notes: { phase: 10, title: 'Neighbor Notes' },

  // Phase 11: Pricing & Financial
  rental_strategy: { phase: 11, title: 'Rental Strategy' },
  target_guest_avatar: { phase: 11, title: 'Target Guest Avatar' },
  pricing_goal: { phase: 11, title: 'Pricing Goal' },
  expected_adr: { phase: 11, title: 'Expected Nightly Rate' },
  minimum_stay: { phase: 11, title: 'Minimum Stay' },
  max_guests: { phase: 11, title: 'Maximum Guests' },
  peak_season_months: { phase: 11, title: 'Peak Season Months' },

  // Phase 12: House Rules & Policies
  house_rules: { phase: 12, title: 'House Rules' },
  pet_policy: { phase: 12, title: 'Pet Policy' },
  pet_deposit: { phase: 12, title: 'Pet Fee' },
  pet_size_restrictions: { phase: 12, title: 'Pet Size Restrictions' },
  noise_policy: { phase: 12, title: 'Noise Policy' },
  smoking_policy: { phase: 12, title: 'Smoking Policy' },
  party_policy: { phase: 12, title: 'Party/Events Policy' },
};

const PHASE_TITLES: Record<number, string> = {
  1: 'Owner Information & Legal',
  2: 'Property Access & Infrastructure',
  3: 'Utilities Setup',
  4: 'Cleaning & Operations',
  5: 'Professional Photography',
  6: 'Setup & Furnishing',
  7: 'Listings & Booking Platforms',
  8: 'Guest Materials',
  9: 'Vendors & Maintenance',
  10: 'Property Specifications',
  11: 'Pricing & Financial Goals',
  12: 'House Rules & Policies',
  13: 'Launch & Go-Live',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.json();
    console.log("Processing new STR onboarding submission for:", formData.owner_name);

    // 1. Create or find property owner
    let ownerId: string;
    const { data: existingOwner } = await supabase
      .from("property_owners")
      .select("id")
      .eq("email", formData.owner_email)
      .maybeSingle();

    if (existingOwner) {
      ownerId = existingOwner.id;
      console.log("Found existing owner:", ownerId);
    } else {
      const { data: newOwner, error: ownerError } = await supabase
        .from("property_owners")
        .insert({
          name: formData.owner_name,
          email: formData.owner_email,
          phone: formData.owner_phone,
        })
        .select("id")
        .single();

      if (ownerError) throw new Error(`Failed to create owner: ${ownerError.message}`);
      ownerId = newOwner.id;
      console.log("Created new owner:", ownerId);
    }

    // 2. Create property
    const propertyName = formData.property_address.split(',')[0].trim();
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .insert({
        name: propertyName,
        address: formData.property_address,
        owner_id: ownerId,
        property_type: 'Client-Managed',
        status: 'Onboarding',
        bedrooms: formData.bedrooms,
        bathrooms: formData.bathrooms,
      })
      .select("id")
      .single();

    if (propertyError) throw new Error(`Failed to create property: ${propertyError.message}`);
    console.log("Created property:", property.id);

    // 3. Create property details
    await supabase.from("property_details").insert({
      property_id: property.id,
      property_type: formData.property_type,
      square_footage: formData.square_footage,
      parking_spaces: formData.max_vehicles,
    });

    // 4. Create property policies
    await supabase.from("property_policies").insert({
      property_id: property.id,
      pets_allowed: formData.pet_policy !== 'No Pets Allowed',
      pet_rules: formData.pet_size_restrictions,
      max_pet_weight: null,
    });

    // 5. Create onboarding project with all 13 phases
    const { data: project, error: projectError } = await supabase
      .from("onboarding_projects")
      .insert({
        property_id: property.id,
        owner_name: formData.owner_name,
        property_address: formData.property_address,
        status: 'in-progress',
        progress: 0,
      })
      .select("id")
      .single();

    if (projectError) throw new Error(`Failed to create project: ${projectError.message}`);
    console.log("Created onboarding project:", project.id);

    // 6. Create tasks from form data
    const tasksToCreate: any[] = [];

    // Process all field mappings
    for (const [fieldKey, mapping] of Object.entries(TASK_MAPPINGS)) {
      let value = formData[fieldKey];
      
      // Handle special cases
      if (fieldKey === 'hoa_contact_info' && (formData.hoa_contact_name || formData.hoa_contact_phone)) {
        value = `Contact: ${formData.hoa_contact_name || 'N/A'} | Phone: ${formData.hoa_contact_phone || 'N/A'}`;
      }
      
      // Handle utility providers
      if (fieldKey === 'electric_provider' && formData.utilities?.electric) {
        value = `Provider: ${formData.utilities.electric.provider || 'N/A'} | Account: ${formData.utilities.electric.accountNumber || 'N/A'}`;
      }
      if (fieldKey === 'gas_provider' && formData.utilities?.gas) {
        value = `Provider: ${formData.utilities.gas.provider || 'N/A'} | Account: ${formData.utilities.gas.accountNumber || 'N/A'}`;
      }
      if (fieldKey === 'water_provider' && formData.utilities?.water) {
        value = `Provider: ${formData.utilities.water.provider || 'N/A'} | Account: ${formData.utilities.water.accountNumber || 'N/A'}`;
      }
      if (fieldKey === 'trash_provider' && formData.utilities?.trash) {
        value = `Provider: ${formData.utilities.trash.provider || 'N/A'} | Account: ${formData.utilities.trash.accountNumber || 'N/A'}`;
      }
      if (fieldKey === 'internet_provider' && formData.utilities?.internet) {
        value = `Provider: ${formData.utilities.internet.provider || 'N/A'} | Account: ${formData.utilities.internet.accountNumber || 'N/A'}`;
      }

      // Handle setup status fields
      if (fieldKey.endsWith('_status') && formData.setup_status) {
        const setupKey = fieldKey.replace('_status', '');
        if (formData.setup_status[setupKey]) {
          value = formData.setup_status[setupKey].status;
        }
      }
      if (fieldKey.endsWith('_notes') && formData.setup_status) {
        const setupKey = fieldKey.replace('_notes', '');
        if (formData.setup_status[setupKey]) {
          value = formData.setup_status[setupKey].notes;
        }
      }

      // Handle arrays
      if (Array.isArray(value)) {
        value = value.join(', ');
      }
      
      // Handle booleans
      if (typeof value === 'boolean') {
        value = value ? 'Yes' : 'No';
      }

      if (value && value !== '' && value !== 'N/A') {
        tasksToCreate.push({
          project_id: project.id,
          phase_number: mapping.phase,
          phase_title: PHASE_TITLES[mapping.phase],
          title: mapping.title,
          field_type: 'text',
          field_value: String(value),
          status: 'completed',
        });
      }
    }

    // Add placeholder tasks for phases that need manual attention
    const phasesWithTasks = new Set(tasksToCreate.map(t => t.phase_number));
    for (let phase = 1; phase <= 13; phase++) {
      if (!phasesWithTasks.has(phase)) {
        tasksToCreate.push({
          project_id: project.id,
          phase_number: phase,
          phase_title: PHASE_TITLES[phase],
          title: `Phase ${phase} Setup`,
          field_type: 'text',
          field_value: '',
          status: 'pending',
        });
      }
    }

    // Insert all tasks
    if (tasksToCreate.length > 0) {
      const { error: tasksError } = await supabase
        .from("onboarding_tasks")
        .insert(tasksToCreate);

      if (tasksError) {
        console.error("Error creating tasks:", tasksError);
      } else {
        console.log(`Created ${tasksToCreate.length} onboarding tasks`);
      }
    }

    // 7. Calculate and update progress
    const completedTasks = tasksToCreate.filter(t => t.field_value && t.field_value !== '').length;
    const totalTasks = tasksToCreate.length;
    const progress = Math.min(Math.round((completedTasks / totalTasks) * 100), 95);

    await supabase
      .from("onboarding_projects")
      .update({ progress })
      .eq("id", project.id);

    // 8. Send notification emails
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      // Admin notification
      await resend.emails.send({
        from: "PeachHaus <notifications@peachhausgroup.com>",
        to: ["info@peachhausgroup.com"],
        subject: `New Property Onboarding: ${formData.property_address}`,
        html: `
          <h2>New Property Onboarding Submission</h2>
          <p><strong>Owner:</strong> ${formData.owner_name}</p>
          <p><strong>Email:</strong> ${formData.owner_email}</p>
          <p><strong>Phone:</strong> ${formData.owner_phone}</p>
          <p><strong>Property:</strong> ${formData.property_address}</p>
          <p><strong>Property Type:</strong> ${formData.property_type}</p>
          <p><strong>Rental Strategy:</strong> ${formData.rental_strategy}</p>
          <p><strong>Photography Needs:</strong> ${formData.photography_needs || 'Not specified'}</p>
          <p><strong>Needs Cleaner Referral:</strong> ${formData.needs_cleaner_referral ? 'Yes' : 'No'}</p>
          <hr>
          <p>View the full onboarding project in Property Central.</p>
        `,
      });

      // Owner confirmation
      await resend.emails.send({
        from: "PeachHaus <info@peachhausgroup.com>",
        to: [formData.owner_email],
        subject: "Welcome to PeachHaus - We've Received Your Information!",
        html: `
          <h2>Thank You for Choosing PeachHaus!</h2>
          <p>Hi ${formData.owner_name.split(' ')[0]},</p>
          <p>We've received your property onboarding information for <strong>${formData.property_address}</strong>.</p>
          <h3>What's Next?</h3>
          <ul>
            <li>Our team will review your submission within 24-48 hours</li>
            <li>We'll schedule an onboarding call to discuss your property and answer any questions</li>
            <li>Based on your setup status, we'll create a customized launch timeline</li>
          </ul>
          <p>If you have any questions in the meantime, feel free to reach out to us at info@peachhausgroup.com or call (770) 906-5022.</p>
          <p>We're excited to help you launch your rental property!</p>
          <p>Best regards,<br>The PeachHaus Team</p>
        `,
      });

      console.log("Notification emails sent");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "New STR onboarding processed successfully",
        property_id: property.id,
        project_id: project.id,
        owner_id: ownerId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error processing new STR onboarding:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
