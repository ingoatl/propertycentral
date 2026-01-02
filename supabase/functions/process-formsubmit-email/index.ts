import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshGoogleToken } from "../_shared/google-oauth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Task title mappings from form fields
const FIELD_TO_TASK_MAPPING: Record<string, string> = {
  // Owner Info
  'owner_full_name': 'Owner Name',
  'owner_name': 'Owner Name',
  'full_name': 'Owner Name',
  'name': 'Owner Name',
  'owner_email': 'Owner Email',
  'email': 'Owner Email',
  'owner_phone': 'Owner Phone',
  'phone': 'Owner Phone',
  'phone_number': 'Owner Phone',
  
  // Property Details
  'property_address': 'Property Address',
  'address': 'Property Address',
  'bedrooms': 'Bedrooms',
  'beds': 'Bedrooms',
  'bathrooms': 'Bathrooms',
  'baths': 'Bathrooms',
  'square_footage': 'Square Footage',
  'sqft': 'Square Footage',
  'property_type': 'Property Type',
  
  // Access & Codes
  'wifi_network': 'WiFi Network Name (SSID)',
  'wifi_ssid': 'WiFi Network Name (SSID)',
  'wifi_name': 'WiFi Network Name (SSID)',
  'wifi_password': 'WiFi Password',
  'smart_lock_brand': 'Smart Lock Brand',
  'lock_brand': 'Smart Lock Brand',
  'smart_lock_code': 'Smart Lock Code',
  'lock_code': 'Smart Lock Code',
  'lockbox_code': 'Lockbox Code for Emergencies',
  'gate_code': 'Gate code',
  'garage_code': 'Garage code',
  
  // Utilities
  'electric_provider': 'Electric Provider',
  'electricity': 'Electric Provider',
  'gas_provider': 'Gas Provider',
  'gas': 'Gas Provider',
  'water_provider': 'Water Provider',
  'water': 'Water Provider',
  'internet_provider': 'Internet Provider',
  'internet': 'Internet Provider',
  'trash_day': 'Trash Pickup Day',
  'trash_pickup_day': 'Trash Pickup Day',
  
  // Operations
  'cleaner_name': 'Primary Cleaner',
  'primary_cleaner': 'Primary Cleaner',
  'cleaner_payment': 'Cleaner Payment',
  'cleaning_rate': 'Cleaner Payment',
  'supply_closet': 'Supply Closet Location',
  'supply_closet_location': 'Supply Closet Location',
  'laundry_setup': 'Laundry Setup',
  
  // Listings
  'airbnb_link': 'Airbnb Link',
  'airbnb_url': 'Airbnb Link',
  'airbnb': 'Airbnb Link',
  'vrbo_link': 'VRBO Link',
  'vrbo_url': 'VRBO Link',
  'vrbo': 'VRBO Link',
  
  // Property Features
  'unique_selling_points': 'Unique Selling Points',
  'selling_points': 'Unique Selling Points',
  'house_quirks': 'House Quirks',
  'quirks': 'House Quirks',
  'guest_avatar': 'Guest Avatar',
  'target_guest': 'Guest Avatar',
  
  // Maintenance/Vendors
  'hvac_service': 'HVAC Service',
  'hvac': 'HVAC Service',
  'pest_control': 'Pest Control Provider',
  'pest_control_provider': 'Pest Control Provider',
  'lawncare': 'Lawncare Provider',
  'lawncare_provider': 'Lawncare Provider',
  'emergency_contact': 'Emergency Contact',
  
  // Insurance & Legal
  'insurance_provider': 'Insurance Provider',
  'insurance': 'Insurance Provider',
  'str_permit_status': 'STR Permit Status',
  'permit_status': 'STR Permit Status',
  
  // Pricing
  'nightly_rate': 'Target Nightly Rate',
  'target_nightly_rate': 'Target Nightly Rate',
  'minimum_stay': 'Minimum Stay',
  'min_stay': 'Minimum Stay',
  'pet_policy': 'Pet Policy',
  'pets_allowed': 'Pet Policy',
  'house_rules': 'House Rules',
  
  // Photography
  'photography_status': 'Photography Status',
  'photos': 'Photography Status',
  'existing_photos_link': 'Existing Photos Link',
  'photo_link': 'Existing Photos Link',
  
  // Linens/Furniture
  'linens_status': 'Linens Status',
  'linens': 'Linens Status',
  'furniture_status': 'Furniture Status',
  'furniture': 'Furniture Status',
  
  // Parking
  'parking_instructions': 'Parking Instructions',
  'parking': 'Parking Instructions',
};

// Parse formsubmit email body to extract field-value pairs
function parseFormSubmitEmail(body: string, rawHtml: string | null): Record<string, string> {
  const content = body || rawHtml || '';
  const fields: Record<string, string> = {};
  
  console.log("Parsing formsubmit email content...");
  console.log("Content length:", content.length);
  
  // Pattern 1: Field Name: Value format
  const colonPattern = /([A-Za-z][A-Za-z0-9_\s]{2,40}):\s*([^\n]+)/g;
  let match;
  while ((match = colonPattern.exec(content)) !== null) {
    const fieldName = match[1].trim().toLowerCase().replace(/\s+/g, '_');
    const value = match[2].trim();
    if (value && value.length > 0 && value !== 'N/A' && value !== 'n/a') {
      fields[fieldName] = value;
    }
  }
  
  // Pattern 2: HTML table rows (common in formsubmit)
  const tableRowPattern = /<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<\/tr>/gi;
  while ((match = tableRowPattern.exec(content)) !== null) {
    const fieldName = match[1].trim().toLowerCase().replace(/\s+/g, '_');
    const value = match[2].trim();
    if (value && value.length > 0 && value !== 'N/A' && value !== 'n/a') {
      fields[fieldName] = value;
    }
  }
  
  // Pattern 3: Key = Value format
  const equalPattern = /([A-Za-z][A-Za-z0-9_\s]{2,40})\s*=\s*([^\n]+)/g;
  while ((match = equalPattern.exec(content)) !== null) {
    const fieldName = match[1].trim().toLowerCase().replace(/\s+/g, '_');
    const value = match[2].trim();
    if (value && value.length > 0 && value !== 'N/A') {
      fields[fieldName] = value;
    }
  }
  
  console.log("Extracted fields:", JSON.stringify(fields, null, 2));
  return fields;
}

// Find property by address in the email
async function findPropertyByAddress(supabase: any, content: string): Promise<{ id: string; name: string } | null> {
  // Extract address from email subject or body
  const addressPatterns = [
    /(\d+[^,\n]+(?:,\s*[A-Za-z\s]+)?(?:,\s*[A-Z]{2}\s*\d{5})?)/g,
    /property.*?(?:at|address)[:\s]*([^\n]+)/gi,
  ];
  
  const addresses: string[] = [];
  for (const pattern of addressPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      addresses.push(match[1].trim());
    }
  }
  
  console.log("Found potential addresses:", addresses);
  
  // Try to match with existing properties
  for (const addr of addresses) {
    const searchTerm = addr.replace(/[^\w\s]/g, ' ').trim();
    const words = searchTerm.split(/\s+/).filter(w => w.length > 2).slice(0, 3);
    
    for (const word of words) {
      const { data: properties } = await supabase
        .from('properties')
        .select('id, name, address')
        .or(`name.ilike.%${word}%,address.ilike.%${word}%`)
        .limit(5);
      
      if (properties && properties.length > 0) {
        console.log(`Found property match: ${properties[0].name}`);
        return { id: properties[0].id, name: properties[0].name };
      }
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { emailInsightId, propertyId, gmailMessageId, forceReprocess } = await req.json();
    
    console.log("Processing formsubmit email:", { emailInsightId, propertyId, gmailMessageId });
    
    // Get Gmail access token
    const accessToken = await refreshGoogleToken(supabase as any);
    if (!accessToken) {
      throw new Error("Failed to get Gmail access token");
    }
    
    // Determine the gmail message ID
    let messageId = gmailMessageId;
    if (!messageId && emailInsightId) {
      const { data: insight } = await supabase
        .from('email_insights')
        .select('gmail_message_id, subject')
        .eq('id', emailInsightId)
        .single();
      
      if (insight) {
        messageId = insight.gmail_message_id;
        console.log("Got message ID from insight:", messageId);
      }
    }
    
    if (!messageId) {
      throw new Error("No Gmail message ID provided or found");
    }
    
    // Fetch the email content from Gmail
    console.log("Fetching email from Gmail:", messageId);
    const messageResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      throw new Error(`Gmail API error: ${messageResponse.status} - ${errorText}`);
    }
    
    const emailData = await messageResponse.json();
    
    const headers = emailData.payload.headers;
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    
    console.log("Email subject:", subject);
    
    // Extract body content
    let body = '';
    let rawHtml = '';
    
    if (emailData.payload.body?.data) {
      body = atob(emailData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    } else if (emailData.payload.parts) {
      const textPart = emailData.payload.parts.find((p: any) => p.mimeType === 'text/plain');
      const htmlPart = emailData.payload.parts.find((p: any) => p.mimeType === 'text/html');
      
      // For nested multipart
      const findParts = (parts: any[]): void => {
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
          if (part.mimeType === 'text/html' && part.body?.data) {
            rawHtml = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
          if (part.parts) {
            findParts(part.parts);
          }
        }
      };
      
      if (textPart?.body?.data) {
        body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
      if (htmlPart?.body?.data) {
        rawHtml = atob(htmlPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
      
      // Try nested parts if not found
      if (!body && !rawHtml && emailData.payload.parts) {
        findParts(emailData.payload.parts);
      }
    }
    
    console.log("Email body length:", body.length);
    console.log("Email HTML length:", rawHtml.length);
    console.log("Body preview:", body.substring(0, 500));
    
    // Parse the formsubmit email
    const extractedFields = parseFormSubmitEmail(body, rawHtml);
    
    // Find or use provided property
    let targetPropertyId = propertyId;
    if (!targetPropertyId) {
      const property = await findPropertyByAddress(supabase, subject + ' ' + body);
      if (property) {
        targetPropertyId = property.id;
      }
    }
    
    if (!targetPropertyId) {
      throw new Error("Could not determine target property");
    }
    
    console.log("Target property ID:", targetPropertyId);
    
    // Get the onboarding project for this property
    const { data: projects } = await supabase
      .from('onboarding_projects')
      .select('id')
      .eq('property_id', targetPropertyId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!projects || projects.length === 0) {
      throw new Error("No onboarding project found for this property");
    }
    
    const projectId = projects[0].id;
    console.log("Target project ID:", projectId);
    
    // Get all onboarding tasks for this project
    const { data: tasks } = await supabase
      .from('onboarding_tasks')
      .select('id, title, field_value, status')
      .eq('project_id', projectId);
    
    if (!tasks) {
      throw new Error("Failed to fetch onboarding tasks");
    }
    
    console.log(`Found ${tasks.length} onboarding tasks`);
    
    // Match and update tasks
    let updatedCount = 0;
    const updates: Array<{ task: string; value: string }> = [];
    
    for (const [fieldKey, fieldValue] of Object.entries(extractedFields)) {
      // Find matching task title
      const taskTitle = FIELD_TO_TASK_MAPPING[fieldKey];
      
      if (taskTitle) {
        // Find task with this title (case-insensitive)
        const matchingTask = tasks.find(t => 
          t.title.toLowerCase() === taskTitle.toLowerCase() ||
          t.title.toLowerCase().includes(taskTitle.toLowerCase()) ||
          taskTitle.toLowerCase().includes(t.title.toLowerCase())
        );
        
        if (matchingTask) {
          // Only update if task doesn't already have a value or forceReprocess is true
          if (!matchingTask.field_value || forceReprocess) {
            const { error } = await supabase
              .from('onboarding_tasks')
              .update({
                field_value: fieldValue,
                status: 'completed',
                completed_date: new Date().toISOString(),
              })
              .eq('id', matchingTask.id);
            
            if (!error) {
              updatedCount++;
              updates.push({ task: taskTitle, value: fieldValue });
              console.log(`Updated task "${taskTitle}" with value: ${fieldValue}`);
            }
          }
        } else {
          // Try fuzzy matching
          const fuzzyMatch = tasks.find((t: any) => {
            const titleWords = t.title.toLowerCase().split(/[\s_]+/);
            const keyWords = fieldKey.toLowerCase().split(/[\s_]+/);
            return keyWords.some((kw: string) => titleWords.some((tw: string) => tw.includes(kw) || kw.includes(tw)));
          });
          
          if (fuzzyMatch && (!fuzzyMatch.field_value || forceReprocess)) {
            const { error } = await supabase
              .from('onboarding_tasks')
              .update({
                field_value: fieldValue,
                status: 'completed',
                completed_date: new Date().toISOString(),
              })
              .eq('id', fuzzyMatch.id);
            
            if (!error) {
              updatedCount++;
              updates.push({ task: fuzzyMatch.title, value: fieldValue });
              console.log(`Updated task "${fuzzyMatch.title}" (fuzzy match) with value: ${fieldValue}`);
            }
          }
        }
      }
    }
    
    // Update project progress
    const { data: allTasks } = await supabase
      .from('onboarding_tasks')
      .select('status')
      .eq('project_id', projectId);
    
    if (allTasks) {
      const completedCount = allTasks.filter(t => t.status === 'completed').length;
      const progress = Math.round((completedCount / allTasks.length) * 100);
      
      await supabase
        .from('onboarding_projects')
        .update({ progress })
        .eq('id', projectId);
      
      console.log(`Updated project progress to ${progress}%`);
    }
    
    console.log(`Processed formsubmit email. Updated ${updatedCount} tasks.`);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed formsubmit email, updated ${updatedCount} tasks`,
        extractedFields: Object.keys(extractedFields).length,
        updates,
        propertyId: targetPropertyId,
        projectId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error processing formsubmit email:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
