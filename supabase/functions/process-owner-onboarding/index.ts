import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Complete task mapping from form fields to onboarding tasks
const TASK_MAPPINGS: Record<string, { phase: number; title: string; phaseTitle?: string }> = {
  // Phase 1 - Owner/Legal Information
  owner_name: { phase: 1, title: 'Owner Name', phaseTitle: 'Owner Information' },
  owner_email: { phase: 1, title: 'Owner Email', phaseTitle: 'Owner Information' },
  owner_phone: { phase: 1, title: 'Owner Phone', phaseTitle: 'Owner Information' },
  insurance_provider: { phase: 1, title: 'Insurance Provider', phaseTitle: 'Owner Information' },
  insurance_policy_number: { phase: 1, title: 'Insurance Policy Number', phaseTitle: 'Owner Information' },
  insurance_corporate_contacts: { phase: 1, title: 'Insurance Corporate Contacts', phaseTitle: 'Owner Information' },
  str_permit_status: { phase: 1, title: 'STR Permit Status', phaseTitle: 'Owner Information' },
  permit_number: { phase: 1, title: 'STR Permit Number', phaseTitle: 'Owner Information' },
  entity_ownership: { phase: 1, title: 'Entity Ownership', phaseTitle: 'Owner Information' },
  
  // Phase 1 - Document URLs
  government_id_url: { phase: 1, title: 'Government ID', phaseTitle: 'Owner Information' },
  property_deed_url: { phase: 1, title: 'Property Deed', phaseTitle: 'Owner Information' },
  property_tax_statement_url: { phase: 1, title: 'Property Tax Statement', phaseTitle: 'Owner Information' },
  mortgage_statement_url: { phase: 1, title: 'Mortgage Statement', phaseTitle: 'Owner Information' },
  entity_documents_url: { phase: 1, title: 'Entity Documents', phaseTitle: 'Owner Information' },
  hoa_rules_url: { phase: 1, title: 'HOA Rules Document', phaseTitle: 'Owner Information' },
  
  // Phase 2 - Access Details
  wifi_ssid: { phase: 2, title: 'WiFi SSID', phaseTitle: 'Access Details' },
  wifi_password: { phase: 2, title: 'WiFi password', phaseTitle: 'Access Details' },
  smart_lock_brand: { phase: 2, title: 'Smart lock brand', phaseTitle: 'Access Details' },
  smart_lock_code: { phase: 2, title: 'Smart lock master PIN code', phaseTitle: 'Access Details' },
  lockbox_code: { phase: 2, title: 'Lockbox code', phaseTitle: 'Access Details' },
  backup_key_location: { phase: 2, title: 'Backup Key Location', phaseTitle: 'Access Details' },
  garage_code: { phase: 2, title: 'Garage code', phaseTitle: 'Access Details' },
  gate_code: { phase: 2, title: 'Gate code', phaseTitle: 'Access Details' },
  trash_pickup_day: { phase: 2, title: 'Trash day', phaseTitle: 'Access Details' },
  trash_bin_location: { phase: 2, title: 'Trash Bin Location', phaseTitle: 'Access Details' },
  maids_closet_code: { phase: 2, title: 'Maids closet code', phaseTitle: 'Access Details' },
  thermostat_login: { phase: 2, title: 'Thermostat Login', phaseTitle: 'Access Details' },
  parking_instructions: { phase: 2, title: 'Parking Instructions', phaseTitle: 'Access Details' },
  parking_map_url: { phase: 2, title: 'Parking Map', phaseTitle: 'Access Details' },
  
  // Phase 3 - Utilities
  wastewater_system: { phase: 3, title: 'Wastewater System', phaseTitle: 'Utilities' },
  septic_company: { phase: 3, title: 'Septic Company', phaseTitle: 'Utilities' },
  septic_last_pumped: { phase: 3, title: 'Septic Last Pumped', phaseTitle: 'Utilities' },
  
  // Phase 4 - Operations/Cleaning
  primary_cleaner: { phase: 4, title: 'Primary cleaner name', phaseTitle: 'Cleaning Operations' },
  backup_cleaner: { phase: 4, title: 'Backup Cleaner', phaseTitle: 'Cleaning Operations' },
  cleaner_payment: { phase: 4, title: 'Cleaner Payment Rate', phaseTitle: 'Cleaning Operations' },
  cleaner_satisfaction: { phase: 4, title: 'Owner Satisfaction with Cleaner', phaseTitle: 'Cleaning Operations' },
  cleaner_quality: { phase: 4, title: 'Cleaner Quality Notes', phaseTitle: 'Cleaning Operations' },
  supply_closet_location: { phase: 4, title: 'Supply Closet Location', phaseTitle: 'Cleaning Operations' },
  laundry_notes: { phase: 4, title: 'Laundry Notes', phaseTitle: 'Cleaning Operations' },
  
  // Phase 7 - Listings
  airbnb_link: { phase: 7, title: 'Airbnb', phaseTitle: 'Listings & Booking Platforms' },
  vrbo_link: { phase: 7, title: 'VRBO', phaseTitle: 'Listings & Booking Platforms' },
  furnished_finder_link: { phase: 7, title: 'Furnished Finder', phaseTitle: 'Listings & Booking Platforms' },
  booking_com_link: { phase: 7, title: 'Booking.com', phaseTitle: 'Listings & Booking Platforms' },
  other_listing_links: { phase: 7, title: 'Other Listing Links', phaseTitle: 'Listings & Booking Platforms' },
  
  // Phase 8 - Guest Materials
  guide_book_url: { phase: 8, title: 'Guest Guide Book', phaseTitle: 'Guest Experience' },
  house_manual_url: { phase: 8, title: 'House Manual', phaseTitle: 'Guest Experience' },
  
  // Phase 9 - Vendors/Maintenance
  lawncare_provider: { phase: 9, title: 'Lawn care provider', phaseTitle: 'Vendors & Maintenance' },
  pest_control_provider: { phase: 9, title: 'Pest control provider', phaseTitle: 'Vendors & Maintenance' },
  hvac_service: { phase: 9, title: 'HVAC provider', phaseTitle: 'Vendors & Maintenance' },
  maintenance_contact: { phase: 9, title: 'Maintenance handyman', phaseTitle: 'Vendors & Maintenance' },
  emergency_contact_24_7: { phase: 9, title: 'Emergency Contact Name', phaseTitle: 'Vendors & Maintenance' },
  water_shutoff_location: { phase: 9, title: 'Water shut-off location', phaseTitle: 'Vendors & Maintenance' },
  breaker_panel_location: { phase: 9, title: 'Breaker panel location', phaseTitle: 'Vendors & Maintenance' },
  gas_shutoff_location: { phase: 9, title: 'Gas shut-off location', phaseTitle: 'Vendors & Maintenance' },
  fire_extinguisher_locations: { phase: 9, title: 'Fire extinguisher locations', phaseTitle: 'Vendors & Maintenance' },
  security_brand: { phase: 9, title: 'Security system brand', phaseTitle: 'Vendors & Maintenance' },
  alarm_code: { phase: 9, title: 'Alarm code', phaseTitle: 'Vendors & Maintenance' },
  camera_locations: { phase: 9, title: 'Camera locations', phaseTitle: 'Vendors & Maintenance' },
  camera_login_website: { phase: 9, title: 'Camera login website', phaseTitle: 'Vendors & Maintenance' },
  camera_login_credentials: { phase: 9, title: 'Camera login credentials', phaseTitle: 'Vendors & Maintenance' },
  known_maintenance_issues: { phase: 9, title: 'Known Maintenance Issues', phaseTitle: 'Vendors & Maintenance' },
  smoke_co_detector_status: { phase: 9, title: 'Smoke/CO Detector Status', phaseTitle: 'Vendors & Maintenance' },
  
  // Phase 10 - Property Details/Specifications
  property_type: { phase: 10, title: 'Property Type', phaseTitle: 'Property Details' },
  bedrooms: { phase: 10, title: 'Bedrooms', phaseTitle: 'Property Details' },
  bathrooms: { phase: 10, title: 'Bathrooms', phaseTitle: 'Property Details' },
  square_footage: { phase: 10, title: 'Square Footage', phaseTitle: 'Property Details' },
  year_built: { phase: 10, title: 'Year Built', phaseTitle: 'Property Details' },
  num_stories: { phase: 10, title: 'Number of Stories', phaseTitle: 'Property Details' },
  max_occupancy: { phase: 10, title: 'Max Occupancy', phaseTitle: 'Property Details' },
  has_basement: { phase: 10, title: 'Basement', phaseTitle: 'Property Details' },
  fenced_yard: { phase: 10, title: 'Fenced Yard', phaseTitle: 'Property Details' },
  ada_compliant: { phase: 10, title: 'ADA Compliant', phaseTitle: 'Property Details' },
  pool_type: { phase: 10, title: 'Pool', phaseTitle: 'Property Details' },
  unique_selling_points: { phase: 10, title: 'Unique Selling Points', phaseTitle: 'Property Details' },
  guest_avatar: { phase: 10, title: 'Primary Guest Avatar', phaseTitle: 'Property Details' },
  house_quirks: { phase: 10, title: 'House Quirks', phaseTitle: 'Property Details' },
  pool_hot_tub_info: { phase: 10, title: 'Pool/Hot Tub Information', phaseTitle: 'Property Details' },
  max_vehicles: { phase: 10, title: 'Parking Capacity', phaseTitle: 'Property Details' },
  sensitive_neighbor_notes: { phase: 10, title: 'Neighbor Notes', phaseTitle: 'Property Details' },
  recent_renovations: { phase: 10, title: 'Recent Renovations', phaseTitle: 'Property Details' },
  existing_photos_link: { phase: 5, title: 'Existing Photos Link', phaseTitle: 'Photos & Media' },
  
  // Schools
  elementary_school: { phase: 10, title: 'Elementary School', phaseTitle: 'Property Details' },
  middle_school: { phase: 10, title: 'Middle School', phaseTitle: 'Property Details' },
  high_school: { phase: 10, title: 'High School', phaseTitle: 'Property Details' },
  
  // Phase 11 - Pricing
  average_daily_rate: { phase: 11, title: 'Nightly Rate', phaseTitle: 'Pricing & Revenue' },
  current_nightly_rate: { phase: 11, title: 'Current Nightly Rate', phaseTitle: 'Pricing & Revenue' },
  current_cleaning_fee: { phase: 11, title: 'Cleaning Fee', phaseTitle: 'Pricing & Revenue' },
  average_monthly_revenue: { phase: 11, title: 'Monthly Rent', phaseTitle: 'Pricing & Revenue' },
  
  // Phase 12 - Pets
  pet_size_restrictions: { phase: 12, title: 'Pet Rules', phaseTitle: 'Pet Policy' },
  pet_deposit: { phase: 11, title: 'Pet Fee', phaseTitle: 'Pricing & Revenue' },
};

// Utility type to task title mapping for Phase 3
const UTILITY_TASK_MAPPINGS: Record<string, string> = {
  'Electric': 'Electric Provider',
  'Gas': 'Gas Provider',
  'Water': 'Water Provider',
  'Sewer': 'Sewer Provider',
  'Trash': 'Trash Provider',
  'Internet': 'Internet Provider',
  'Cable/TV': 'Cable/TV Provider',
};

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendAdminEmail(formData: any) {
  if (!RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set, skipping admin email");
    return;
  }

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #f97316;">🍑 New Property Onboarding Submission</h1>
        <p style="font-size: 18px; color: #666;">${formData.property_address}</p>
      </div>

      <div style="background: #fff7ed; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
        <h2 style="color: #ea580c; margin-top: 0;">Owner Information</h2>
        <p><strong>Name:</strong> ${formData.owner_name}</p>
        <p><strong>Email:</strong> ${formData.owner_email}</p>
        <p><strong>Phone:</strong> ${formData.owner_phone || 'Not provided'}</p>
      </div>

      <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
        <h2 style="color: #16a34a; margin-top: 0;">Access Details</h2>
        <p><strong>WiFi:</strong> ${formData.wifi_ssid} / ${formData.wifi_password}</p>
        <p><strong>Smart Lock:</strong> ${formData.smart_lock_brand} - Code: ${formData.smart_lock_code}</p>
        <p><strong>Lockbox:</strong> ${formData.lockbox_code || 'Not provided'}</p>
        <p><strong>Gate Code:</strong> ${formData.gate_code || 'Not provided'}</p>
        <p><strong>Garage Code:</strong> ${formData.garage_code || 'Not provided'}</p>
      </div>

      <div style="background: #eff6ff; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
        <h2 style="color: #2563eb; margin-top: 0;">Utilities</h2>
        <p><strong>Wastewater:</strong> ${formData.wastewater_system}</p>
        ${formData.utilities?.map((u: any) => `<p><strong>${u.type}:</strong> ${u.provider} - Account: ${u.account_number}</p>`).join('') || ''}
      </div>

      <div style="background: #fefce8; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
        <h2 style="color: #ca8a04; margin-top: 0;">Operations</h2>
        <p><strong>Primary Cleaner:</strong> ${formData.primary_cleaner}</p>
        <p><strong>Backup Cleaner:</strong> ${formData.backup_cleaner || 'Not provided'}</p>
        <p><strong>Pets Allowed:</strong> ${formData.pets_allowed ? 'Yes' : 'No'}</p>
        <p><strong>House Quirks:</strong> ${formData.house_quirks || 'Not provided'}</p>
      </div>

      <div style="background: #fdf4ff; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
        <h2 style="color: #a855f7; margin-top: 0;">Vendors</h2>
        <p><strong>Lawncare:</strong> ${formData.lawncare_provider}</p>
        <p><strong>Pest Control:</strong> ${formData.pest_control_provider}</p>
        <p><strong>HVAC:</strong> ${formData.hvac_service}</p>
        <p><strong>Maintenance:</strong> ${formData.maintenance_contact}</p>
        <p><strong>Emergency (24/7):</strong> ${formData.emergency_contact_24_7}</p>
      </div>

      <div style="background: #fef2f2; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
        <h2 style="color: #dc2626; margin-top: 0;">Safety & Security</h2>
        <p><strong>Security System:</strong> ${formData.has_security_system ? `Yes - ${formData.security_brand}` : 'No'}</p>
        <p><strong>Cameras:</strong> ${formData.has_cameras ? `Yes - ${formData.camera_locations}` : 'No'}</p>
        <p><strong>Fire Extinguishers:</strong> ${formData.fire_extinguisher_locations}</p>
        <p><strong>Water Shut-off:</strong> ${formData.water_shutoff_location}</p>
        <p><strong>Breaker Panel:</strong> ${formData.breaker_panel_location}</p>
      </div>

      <div style="background: #f5f5f4; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
        <h2 style="color: #57534e; margin-top: 0;">Documents & Compliance</h2>
        <p><strong>Government ID:</strong> ${formData.government_id_url ? '✅ Uploaded' : '❌ Missing'}</p>
        <p><strong>Property Deed:</strong> ${formData.property_deed_url ? '✅ Uploaded' : '❌ Missing'}</p>
        <p><strong>Tax Statement:</strong> ${formData.property_tax_statement_url ? '✅ Uploaded' : '❌ Missing'}</p>
        <p><strong>Insurance:</strong> ${formData.insurance_provider} - Policy: ${formData.insurance_policy_number}</p>
        <p><strong>HOA:</strong> ${formData.has_hoa ? `Yes - ${formData.hoa_contact_name}` : 'No'}</p>
        <p><strong>STR Permit:</strong> ${formData.str_permit_status}</p>
      </div>

      <div style="background: #ecfdf5; padding: 20px; border-radius: 12px;">
        <h2 style="color: #059669; margin-top: 0;">Financial Performance</h2>
        <p><strong>ADR:</strong> $${formData.average_daily_rate || 'Not provided'}</p>
        <p><strong>Occupancy:</strong> ${formData.occupancy_rate || 'Not provided'}%</p>
        <p><strong>Monthly Revenue:</strong> $${formData.average_monthly_revenue || 'Not provided'}</p>
        <p><strong>Pricing Goals:</strong> ${formData.pricing_revenue_goals || 'Not provided'}</p>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 14px;">
          This submission was received via the PeachHaus Owner Onboarding Form
        </p>
      </div>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "PeachHaus <onboarding@peachhausgroup.com>",
      to: ["info@peachhausgroup.com"],
      subject: `New Property Onboarding: ${formData.property_address}`,
      html: emailHtml,
    }),
  });

  if (!response.ok) {
    console.error("Failed to send admin email:", await response.text());
  }
}

async function sendOwnerEmail(formData: any) {
  if (!RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set, skipping owner email");
    return;
  }

  // Validate email format before sending
  if (!EMAIL_REGEX.test(formData.owner_email)) {
    console.error("Invalid owner email format, skipping owner email:", formData.owner_email);
    return;
  }

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(to bottom, #fff7ed, #ffffff);">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #f97316; font-size: 28px;">🍑 Thank You for Choosing PeachHaus!</h1>
      </div>

      <div style="background: white; padding: 30px; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Dear ${formData.owner_name},
        </p>
        
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          We're excited to welcome you to the PeachHaus family! Your onboarding form for 
          <strong>${formData.property_address}</strong> has been received.
        </p>

        <div style="background: #fff7ed; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <h3 style="color: #ea580c; margin-top: 0;">What Happens Next?</h3>
          <ol style="color: #374151; line-height: 1.8;">
            <li>Our team will review your submission within one business day</li>
            <li>We'll reach out if any information is needed</li>
            <li>Your dedicated property manager will contact you for an intro call</li>
            <li>We'll create your listing optimization plan</li>
          </ol>
        </div>

        <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <h3 style="color: #16a34a; margin-top: 0;">Our Management Approach</h3>
          <p style="color: #374151; line-height: 1.6;">
            <strong>Hybrid STR + MTR Strategy:</strong> We optimize your property for both 
            short-term vacation rentals and mid-term corporate housing, maximizing your 
            revenue potential year-round.
          </p>
        </div>

        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          If you have any questions in the meantime, feel free to reach out to us at 
          <a href="mailto:info@peachhausgroup.com" style="color: #f97316;">info@peachhausgroup.com</a>.
        </p>

        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Best regards,<br/>
          <strong>The PeachHaus Team</strong>
        </p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <p style="color: #9ca3af; font-size: 14px;">
          PeachHaus Group LLC | Atlanta, GA<br/>
          <a href="https://peachhausgroup.com" style="color: #f97316;">peachhausgroup.com</a>
        </p>
      </div>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "PeachHaus <onboarding@peachhausgroup.com>",
        to: [formData.owner_email],
        subject: "Thank You for Choosing PeachHaus! 🍑",
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      console.error("Failed to send owner email:", await response.text());
    }
  } catch (error) {
    console.error("Failed to send owner email:", error);
  }
}

// Helper to convert empty strings to null for numeric fields
const toNumber = (value: any): number | null => {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
};

// Helper to convert empty strings to null for text fields
const toText = (value: any): string | null => {
  if (value === '' || value === null || value === undefined) return null;
  return String(value);
};

// Helper function to create or update a task
async function createOrUpdateTask(
  projectId: string, 
  phase: number, 
  title: string, 
  value: string,
  phaseTitle?: string
): Promise<boolean> {
  try {
    // Skip if value is empty or just whitespace
    if (!value || value.trim() === '') {
      return false;
    }
    
    // Check if task exists
    const { data: existingTask } = await supabase
      .from('onboarding_tasks')
      .select('id')
      .eq('project_id', projectId)
      .eq('title', title)
      .single();

    if (existingTask) {
      // Update existing task
      await supabase
        .from('onboarding_tasks')
        .update({
          field_value: value,
          status: 'completed',
          completed_date: new Date().toISOString(),
        })
        .eq('id', existingTask.id);
    } else {
      // Create new task with value
      await supabase
        .from('onboarding_tasks')
        .insert({
          project_id: projectId,
          phase_number: phase,
          phase_title: phaseTitle || `Phase ${phase}`,
          title: title,
          field_type: 'text',
          field_value: value,
          status: 'completed',
          completed_date: new Date().toISOString(),
        });
    }
    return true;
  } catch (error) {
    console.error(`Failed to create/update task ${title}:`, error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.json();
    console.log("Processing owner onboarding submission for:", formData.property_address, formData.owner_name);

    // Validate required fields
    if (!formData.owner_email || !EMAIL_REGEX.test(formData.owner_email)) {
      console.error("Invalid or missing owner email:", formData.owner_email);
    }

    // 1. Save raw submission - only include valid database columns with proper type handling
    const submissionData = {
      owner_name: formData.owner_name,
      owner_email: formData.owner_email,
      owner_phone: toText(formData.owner_phone),
      property_address: formData.property_address,
      wifi_ssid: toText(formData.wifi_ssid),
      wifi_password: toText(formData.wifi_password),
      smart_lock_brand: toText(formData.smart_lock_brand),
      smart_lock_code: toText(formData.smart_lock_code),
      lockbox_code: toText(formData.lockbox_code),
      backup_key_location: toText(formData.backup_key_location),
      maids_closet_code: toText(formData.maids_closet_code),
      trash_pickup_day: toText(formData.trash_pickup_day),
      trash_bin_location: toText(formData.trash_bin_location),
      gate_code: toText(formData.gate_code),
      garage_code: toText(formData.garage_code),
      wastewater_system: toText(formData.wastewater_system),
      septic_last_pumped: toText(formData.septic_last_pumped),
      septic_company: toText(formData.septic_company),
      utilities: formData.utilities,
      primary_cleaner: toText(formData.primary_cleaner),
      backup_cleaner: toText(formData.backup_cleaner),
      cleaner_satisfaction: toText(formData.cleaner_satisfaction),
      cleaner_payment: toText(formData.cleaner_payment),
      cleaner_quality: toText(formData.cleaner_quality),
      supply_closet_location: toText(formData.supply_closet_location),
      laundry_notes: toText(formData.laundry_notes),
      guest_avatar: toText(formData.guest_avatar),
      unique_selling_points: toText(formData.unique_selling_points),
      existing_photos_link: toText(formData.existing_photos_link),
      airbnb_link: toText(formData.airbnb_link),
      vrbo_link: toText(formData.vrbo_link),
      other_listing_links: toText(formData.other_listing_links),
      pets_allowed: formData.pets_allowed ?? false,
      pet_deposit: toNumber(formData.pet_deposit),
      pet_size_restrictions: toText(formData.pet_size_restrictions),
      pool_hot_tub_info: toText(formData.pool_hot_tub_info),
      has_thermostat: formData.has_thermostat ?? false,
      thermostat_login: toText(formData.thermostat_login),
      house_quirks: toText(formData.house_quirks),
      sensitive_neighbor_notes: toText(formData.sensitive_neighbor_notes),
      max_vehicles: toNumber(formData.max_vehicles),
      parking_instructions: toText(formData.parking_instructions),
      recent_renovations: toText(formData.recent_renovations),
      known_maintenance_issues: toText(formData.known_maintenance_issues),
      lawncare_provider: toText(formData.lawncare_provider),
      pest_control_provider: toText(formData.pest_control_provider),
      hvac_service: toText(formData.hvac_service),
      maintenance_contact: toText(formData.maintenance_contact),
      emergency_contact_24_7: toText(formData.emergency_contact_24_7),
      insurance_corporate_contacts: toText(formData.insurance_corporate_contacts),
      has_security_system: formData.has_security_system ?? false,
      security_brand: toText(formData.security_brand),
      alarm_code: toText(formData.alarm_code),
      has_cameras: formData.has_cameras ?? false,
      camera_locations: toText(formData.camera_locations),
      camera_login_website: toText(formData.camera_login_website),
      camera_login_credentials: toText(formData.camera_login_credentials),
      fire_extinguisher_locations: toText(formData.fire_extinguisher_locations),
      smoke_co_detector_status: toText(formData.smoke_co_detector_status),
      water_shutoff_location: toText(formData.water_shutoff_location),
      breaker_panel_location: toText(formData.breaker_panel_location),
      gas_shutoff_location: toText(formData.gas_shutoff_location),
      government_id_url: toText(formData.government_id_url),
      property_deed_url: toText(formData.property_deed_url),
      property_tax_statement_url: toText(formData.property_tax_statement_url),
      mortgage_statement_url: toText(formData.mortgage_statement_url),
      entity_ownership: toText(formData.entity_ownership),
      entity_documents_url: toText(formData.entity_documents_url),
      has_hoa: formData.has_hoa ?? false,
      hoa_contact_name: toText(formData.hoa_contact_name),
      hoa_contact_phone: toText(formData.hoa_contact_phone),
      hoa_rules_url: toText(formData.hoa_rules_url),
      str_permit_status: toText(formData.str_permit_status),
      permit_number: toText(formData.permit_number),
      insurance_provider: toText(formData.insurance_provider),
      insurance_policy_number: toText(formData.insurance_policy_number),
      guide_book_url: toText(formData.guide_book_url),
      house_manual_url: toText(formData.house_manual_url),
      parking_map_url: toText(formData.parking_map_url),
      last_year_revenue: toNumber(formData.last_year_revenue),
      airbnb_revenue_export_url: toText(formData.airbnb_revenue_export_url),
      vrbo_revenue_export_url: toText(formData.vrbo_revenue_export_url),
      ownerrez_revenue_export_url: toText(formData.ownerrez_revenue_export_url),
      average_daily_rate: toNumber(formData.average_daily_rate),
      occupancy_rate: toNumber(formData.occupancy_rate),
      average_booking_window: toNumber(formData.average_booking_window),
      average_monthly_revenue: toNumber(formData.average_monthly_revenue),
      peak_season: toText(formData.peak_season),
      peak_season_adr: toNumber(formData.peak_season_adr),
      revenue_statement_url: toText(formData.revenue_statement_url),
      expense_report_url: toText(formData.expense_report_url),
      competitor_insights: toText(formData.competitor_insights),
      pricing_revenue_goals: formData.pricing_revenue_goals,
      status: 'processing',
    };

    const { data: submission, error: submissionError } = await supabase
      .from('owner_onboarding_submissions')
      .insert(submissionData)
      .select()
      .single();

    if (submissionError) {
      console.error("Failed to save submission:", submissionError);
      throw new Error("Failed to save submission");
    }

    console.log("Submission saved:", submission.id);

    // 2. Create or find property owner
    let ownerId: string;
    const { data: existingOwner } = await supabase
      .from('property_owners')
      .select('id')
      .eq('email', formData.owner_email)
      .single();

    if (existingOwner) {
      ownerId = existingOwner.id;
    } else {
      const { data: newOwner, error: ownerError } = await supabase
        .from('property_owners')
        .insert({
          name: formData.owner_name,
          email: formData.owner_email,
          phone: toText(formData.owner_phone),
          payment_method: 'ach',
        })
        .select()
        .single();

      if (ownerError) {
        console.error("Failed to create owner:", ownerError);
        throw new Error("Failed to create property owner");
      }
      ownerId = newOwner.id;
    }

    console.log("Owner ID:", ownerId);

    // 3. Create property
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .insert({
        name: formData.property_address.split(',')[0],
        address: formData.property_address,
        property_type: 'Client-Managed',
        owner_id: ownerId,
      })
      .select()
      .single();

    if (propertyError) {
      console.error("Failed to create property:", propertyError);
      throw new Error("Failed to create property");
    }

    console.log("Property created:", property.id);

    // 4. Create property details with all available data
    const propertyDetailsData: any = {
      property_id: property.id,
      pets_allowed: formData.pets_allowed ?? false,
    };
    
    // Add parking spaces if provided
    if (formData.max_vehicles) {
      propertyDetailsData.parking_spaces = String(formData.max_vehicles);
    }

    await supabase
      .from('property_details')
      .insert(propertyDetailsData);

    // 5. Create property policies with pet data
    const propertyPoliciesData: any = {
      property_id: property.id,
      pets_allowed: formData.pets_allowed ?? false,
    };
    
    // Add pet rules if provided
    if (formData.pet_size_restrictions) {
      propertyPoliciesData.pet_rules = formData.pet_size_restrictions;
    }

    await supabase
      .from('property_policies')
      .insert(propertyPoliciesData);

    // 5b. Create property financial data
    const financialData = {
      property_id: property.id,
      submission_id: submission.id,
      last_year_revenue: toNumber(formData.last_year_revenue),
      average_daily_rate: toNumber(formData.average_daily_rate),
      occupancy_rate: toNumber(formData.occupancy_rate),
      average_booking_window: toNumber(formData.average_booking_window),
      average_monthly_revenue: toNumber(formData.average_monthly_revenue),
      peak_season: toText(formData.peak_season),
      peak_season_adr: toNumber(formData.peak_season_adr),
      revenue_statement_url: toText(formData.revenue_statement_url),
      expense_report_url: toText(formData.expense_report_url),
      airbnb_revenue_export_url: toText(formData.airbnb_revenue_export_url),
      vrbo_revenue_export_url: toText(formData.vrbo_revenue_export_url),
      ownerrez_revenue_export_url: toText(formData.ownerrez_revenue_export_url),
      pricing_revenue_goals: toText(formData.pricing_revenue_goals),
      competitor_insights: toText(formData.competitor_insights),
    };

    const { error: financialError } = await supabase
      .from('property_financial_data')
      .insert(financialData);

    if (financialError) {
      console.error("Failed to create financial data:", financialError);
      // Don't throw - this is not critical
    } else {
      console.log("Financial data saved for property:", property.id);
    }

    // 6. Create onboarding project - status is 'in-progress', progress starts at 0
    const { data: project, error: projectError } = await supabase
      .from('onboarding_projects')
      .insert({
        property_id: property.id,
        owner_name: formData.owner_name,
        property_address: formData.property_address,
        status: 'in-progress',
        progress: 0,
      })
      .select()
      .single();

    if (projectError) {
      console.error("Failed to create project:", projectError);
      throw new Error("Failed to create onboarding project");
    }

    console.log("Project created:", project.id);

    // 7. Pre-populate onboarding tasks from field mappings
    let tasksPopulated = 0;
    for (const [field, taskInfo] of Object.entries(TASK_MAPPINGS)) {
      const value = formData[field];
      if (value && value !== '' && String(value).trim() !== '') {
        const success = await createOrUpdateTask(
          project.id,
          taskInfo.phase,
          taskInfo.title,
          String(value),
          taskInfo.phaseTitle
        );
        if (success) tasksPopulated++;
      }
    }

    // 7b. Process utilities array into individual tasks
    if (formData.utilities && Array.isArray(formData.utilities)) {
      for (const utility of formData.utilities) {
        if (utility.type && (utility.provider || utility.account_number)) {
          const taskTitle = UTILITY_TASK_MAPPINGS[utility.type] || `${utility.type} Provider`;
          const value = utility.provider 
            ? `Provider: ${utility.provider}${utility.account_number ? ` | Account: ${utility.account_number}` : ''}`
            : `Account: ${utility.account_number}`;
          
          const success = await createOrUpdateTask(
            project.id,
            3, // Phase 3 for utilities
            taskTitle,
            value,
            'Utilities'
          );
          if (success) tasksPopulated++;
        }
      }
    }

    // 7c. Handle HOA info as combined field
    if (formData.has_hoa && (formData.hoa_contact_name || formData.hoa_contact_phone)) {
      const hoaInfo = `Contact: ${formData.hoa_contact_name || 'N/A'} | Phone: ${formData.hoa_contact_phone || 'N/A'}`;
      const success = await createOrUpdateTask(
        project.id,
        1, // Phase 1 for owner info
        'HOA Contact Information',
        hoaInfo,
        'Owner Information'
      );
      if (success) tasksPopulated++;
    }

    // 7d. Handle pets_allowed as a task
    if (formData.pets_allowed !== undefined) {
      const success = await createOrUpdateTask(
        project.id,
        12,
        'Pets Allowed',
        formData.pets_allowed ? 'Yes' : 'No',
        'Pet Policy'
      );
      if (success) tasksPopulated++;
    }

    console.log("Tasks populated:", tasksPopulated);

    // 8. Calculate actual progress based on tasks
    // Only count tasks with actual values as completed
    const { data: allTasks } = await supabase
      .from('onboarding_tasks')
      .select('id, status, field_value')
      .eq('project_id', project.id);

    const totalTasks = allTasks?.length || 0;
    // Only count tasks as completed if they have a real value
    const completedTasks = allTasks?.filter(t => 
      t.status === 'completed' && 
      t.field_value && 
      t.field_value.trim() !== ''
    ).length || 0;
    
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    console.log(`Progress: ${completedTasks}/${totalTasks} = ${progress}%`);

    // 9. Update submission with created IDs - keep status as 'processing' until manually verified
    await supabase
      .from('owner_onboarding_submissions')
      .update({
        property_id: property.id,
        owner_id: ownerId,
        project_id: project.id,
        status: 'processed', // Not 'completed' - just processed
        processed_at: new Date().toISOString(),
      })
      .eq('id', submission.id);

    // 10. Update project progress - NEVER set to 100% automatically
    // Always cap at 95% max to indicate human review needed
    const cappedProgress = Math.min(progress, 95);
    await supabase
      .from('onboarding_projects')
      .update({
        progress: cappedProgress,
        status: 'in-progress', // Always in-progress after form submission
      })
      .eq('id', project.id);

    // 11. Send emails
    await Promise.all([
      sendAdminEmail(formData),
      sendOwnerEmail(formData),
    ]);

    // 12. Fetch property image from RapidAPI
    if (property.id && formData.property_address) {
      try {
        console.log("Fetching property image from RapidAPI for:", formData.property_address);
        
        const imageResponse = await fetch(`${SUPABASE_URL}/functions/v1/fetch-property-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ 
            address: formData.property_address, 
            propertyId: property.id 
          }),
        });
        
        if (imageResponse.ok) {
          const imageResult = await imageResponse.json();
          console.log("Property image fetch result:", imageResult.success ? "success" : "failed");
        }
      } catch (imgError) {
        console.error("Failed to fetch property image (non-blocking):", imgError);
      }
    }

    console.log("Onboarding processing complete");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Onboarding submitted successfully",
        propertyId: property.id,
        projectId: project.id,
        progress: cappedProgress,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error processing onboarding:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
