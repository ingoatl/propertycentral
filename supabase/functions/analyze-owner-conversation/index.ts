import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalysisRequest {
  conversationId: string;
  transcript?: string;
  documentContents?: Array<{
    fileName: string;
    content: string;
    isStructured?: boolean;
    structuredData?: any;
  }>;
  propertyContext?: {
    id: string;
    name: string;
    address: string;
  };
}

// Direct mapping from utility/data types to exact task titles
const directTaskMappings: Record<string, string[]> = {
  // Utilities
  'electric': ['Electric Details'],
  'electricity': ['Electric Details'],
  'power': ['Electric Details'],
  'gas': ['Gas Details'],
  'water': ['Water Details'],
  'internet': ['Internet Details'],
  'wifi': ['WiFi Details'],
  'trash': ['Trash Service Provider'],
  'garbage': ['Trash Service Provider'],
  'hoa': ['HOA Contact Information', 'HOA Information'],
  
  // Security
  'security': ['Security System Brand', 'Security System Present'],
  'alarm': ['Security Alarm Code', 'Security System Brand'],
  'camera': ['Camera Locations', 'Cameras Present'],
  
  // Contacts
  'cleaner': ['Primary cleaner name', 'Primary cleaner phone number'],
  'cleaning': ['Primary cleaner name', 'Negotiated price per cleaning'],
  
  // Owner info
  'owner': ['Owner Name', 'Owner Email', 'Owner Phone'],
  
  // Insurance
  'insurance': ['Insurance Provider & Policy Number', 'Upload Insurance Policy'],
  
  // Property
  'parking': ['Parking Type', 'Parking Capacity'],
  'pet': ['Pet policy', 'Pets Allowed', 'Pet Rules'],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { conversationId, transcript, documentContents, propertyContext }: AnalysisRequest = await req.json();

    console.log("Analyzing conversation:", conversationId);
    console.log("Has transcript:", !!transcript);
    console.log("Document count:", documentContents?.length || 0);
    console.log("Property context:", propertyContext);

    // Update status to analyzing
    await supabase
      .from("owner_conversations")
      .update({ status: "analyzing" })
      .eq("id", conversationId);

    // Check for existing actions to prevent duplicates
    const { data: existingActions } = await supabase
      .from("owner_conversation_actions")
      .select("title, action_type")
      .eq("conversation_id", conversationId);
    
    const existingTitles = new Set((existingActions || []).map(a => `${a.action_type}:${a.title.toLowerCase()}`));
    console.log("Existing actions count:", existingTitles.size);

    // Get existing onboarding project and tasks for this property
    let existingProject: any = null;
    let existingTasks: any[] = [];
    const tasksByTitle: Map<string, any> = new Map();
    
    if (propertyContext?.id) {
      const { data: projectData } = await supabase
        .from("onboarding_projects")
        .select("*")
        .eq("property_id", propertyContext.id)
        .maybeSingle();
      
      existingProject = projectData;
      
      if (existingProject) {
        const { data: tasksData } = await supabase
          .from("onboarding_tasks")
          .select("*")
          .eq("project_id", existingProject.id)
          .order("phase_number", { ascending: true });
        
        existingTasks = tasksData || [];
        
        // Build a map of task titles for fast lookup
        for (const task of existingTasks) {
          tasksByTitle.set(task.title.toLowerCase(), task);
        }
        
        console.log(`Found ${existingTasks.length} existing tasks for property`);
      }
    }

    // Helper to find task by exact or partial title match
    const findTaskByTitle = (searchTerms: string[]): any | null => {
      for (const term of searchTerms) {
        const termLower = term.toLowerCase();
        // Exact match first
        if (tasksByTitle.has(termLower)) {
          return tasksByTitle.get(termLower);
        }
        // Partial match
        for (const [title, task] of tasksByTitle) {
          if (title.includes(termLower) || termLower.includes(title)) {
            return task;
          }
        }
      }
      return null;
    };

    // Helper to update a task
    const updateTask = async (task: any, fieldValue: string, notes: string) => {
      if (!task) return false;
      
      const { error } = await supabase
        .from("onboarding_tasks")
        .update({
          field_value: fieldValue,
          notes: task.notes ? `${task.notes}\n${notes}` : notes,
          status: 'completed',
          completed_date: new Date().toISOString()
        })
        .eq("id", task.id);
      
      if (!error) {
        console.log(`✓ Updated task "${task.title}" with value: ${fieldValue.substring(0, 50)}...`);
        return true;
      }
      console.error(`✗ Failed to update task "${task.title}":`, error);
      return false;
    };

    // Build the content for analysis
    let contentToAnalyze = "";
    
    if (transcript) {
      contentToAnalyze += `## OWNER CONVERSATION TRANSCRIPT\n\n${transcript}\n\n`;
    }
    
    if (documentContents && documentContents.length > 0) {
      for (const doc of documentContents) {
        if (doc.isStructured && doc.structuredData) {
          contentToAnalyze += `## STRUCTURED DATA FROM: ${doc.fileName}\n\n`;
          contentToAnalyze += `This is parsed Excel/CSV data. Extract all relevant property information:\n\n`;
          contentToAnalyze += doc.content;
          contentToAnalyze += `\n\n`;
        } else {
          contentToAnalyze += `## DOCUMENT: ${doc.fileName}\n\n${doc.content}\n\n`;
        }
      }
    }

    // Enhanced system prompt with explicit field extraction
    const systemPrompt = `You are an expert property management assistant. Your job is to analyze owner conversations, property documents, and structured data to extract property information.

CRITICAL: Extract specific field values that map to these EXACT onboarding task fields:

OWNER INFORMATION:
- owner_name: Full name of the property owner
- owner_email: Owner's email address
- owner_phone: Owner's phone number

UTILITIES (extract provider AND account number):
- water_provider: Water utility provider name
- water_account: Water account number
- electric_provider: Electric utility provider name  
- electric_account: Electric account number
- gas_provider: Gas utility provider name
- gas_account: Gas account number
- internet_provider: Internet/WiFi provider name
- internet_account: Internet account number
- trash_provider: Trash service provider

ACCESS & WIFI:
- wifi_network: WiFi network name (SSID)
- wifi_password: WiFi password
- smart_lock_code: Smart lock PIN code
- gate_code: Gate access code
- garage_code: Garage door code
- lockbox_code: Lockbox code

SECURITY:
- security_system_brand: Security system brand/company
- security_alarm_code: Alarm code
- camera_locations: Where cameras are located
- has_cameras: true/false
- has_security_system: true/false

INSURANCE:
- insurance_provider: Insurance company name
- insurance_policy_number: Policy number

CONTACTS (extract name, phone, company):
- primary_cleaner_name: Cleaner's name
- primary_cleaner_phone: Cleaner's phone
- cleaning_price: Negotiated cleaning price

HOA:
- hoa_contact_info: HOA contact details
- hoa_portal_url: HOA portal login URL
- hoa_portal_username: Portal username

PROPERTY SPECS:
- parking_type: Type of parking
- parking_capacity: Number of vehicles
- water_shutoff_location: Where main water shutoff is
- gas_shutoff_location: Where gas shutoff is

Property Context: ${propertyContext ? `${propertyContext.name} at ${propertyContext.address}` : 'Unknown property'}

Return a JSON object with this structure:
{
  "summary": "Brief summary of extracted information",
  "fieldValues": {
    "owner_name": "value or null",
    "owner_email": "value or null",
    "owner_phone": "value or null",
    "water_provider": "value or null",
    "water_account": "value or null",
    "electric_provider": "value or null",
    "electric_account": "value or null",
    "gas_provider": "value or null",
    "gas_account": "value or null",
    "internet_provider": "value or null",
    "internet_account": "value or null",
    "trash_provider": "value or null",
    "wifi_network": "value or null",
    "wifi_password": "value or null",
    "smart_lock_code": "value or null",
    "gate_code": "value or null",
    "garage_code": "value or null",
    "lockbox_code": "value or null",
    "security_system_brand": "value or null",
    "security_alarm_code": "value or null",
    "camera_locations": "value or null",
    "has_cameras": true/false/null,
    "has_security_system": true/false/null,
    "insurance_provider": "value or null",
    "insurance_policy_number": "value or null",
    "primary_cleaner_name": "value or null",
    "primary_cleaner_phone": "value or null",
    "cleaning_price": "value or null",
    "hoa_contact_info": "value or null",
    "hoa_portal_url": "value or null",
    "hoa_portal_username": "value or null",
    "parking_type": "value or null",
    "parking_capacity": "value or null",
    "water_shutoff_location": "value or null",
    "gas_shutoff_location": "value or null"
  },
  "credentials": [
    {
      "serviceName": "Service name",
      "username": "Username",
      "password": "Password",
      "url": "Login URL",
      "notes": "Additional notes"
    }
  ],
  "appliances": [
    {
      "type": "Appliance type",
      "brand": "Brand",
      "model": "Model",
      "serialNumber": "Serial",
      "location": "Location"
    }
  ],
  "additionalInfo": [
    {
      "category": "Category name",
      "title": "Info title",
      "details": "Detailed information"
    }
  ]
}

Extract ALL available information. Use null only if truly not found.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contentToAnalyze }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI response received, parsing...");

    // Parse the JSON from the response
    let analysisResult;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1].trim();
      analysisResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw content:", content);
      throw new Error("Failed to parse AI analysis response");
    }

    // Update the conversation with the analysis
    const { error: updateError } = await supabase
      .from("owner_conversations")
      .update({
        status: "analyzed",
        ai_summary: analysisResult.summary,
        extracted_items: analysisResult,
      })
      .eq("id", conversationId);

    if (updateError) {
      console.error("Failed to update conversation:", updateError);
      throw updateError;
    }

    // Track updates
    const tasksUpdated: string[] = [];
    const propertyInfoToStore: any[] = [];
    const fieldValues = analysisResult.fieldValues || {};

    // Define exact mappings from extracted fields to task titles
    // Multiple possible task titles to handle variations
    const fieldToTaskMapping: Record<string, { titles: string[]; format?: (v: any) => string }> = {
      owner_name: { titles: ['Owner Name'] },
      owner_email: { titles: ['Owner Email'] },
      owner_phone: { titles: ['Owner Phone'] },
      water_provider: { 
        titles: ['Water Details', 'Water Utility', 'Water Provider'],
        format: (v) => {
          const account = fieldValues.water_account;
          return account ? `${v} - Account: ${account}` : v;
        }
      },
      electric_provider: {
        titles: ['Electric Details', 'Electric Utility', 'Electricity Details', 'Power Provider'],
        format: (v) => {
          const account = fieldValues.electric_account;
          return account ? `${v} - Account: ${account}` : v;
        }
      },
      gas_provider: {
        titles: ['Gas Details', 'Gas Utility', 'Natural Gas Provider'],
        format: (v) => {
          const account = fieldValues.gas_account;
          return account ? `${v} - Account: ${account}` : v;
        }
      },
      internet_provider: {
        titles: ['Internet Details', 'Internet Utility', 'Internet Provider', 'Internet/Cable'],
        format: (v) => {
          const account = fieldValues.internet_account;
          return account ? `${v} - Account: ${account}` : v;
        }
      },
      trash_provider: { titles: ['Trash Service Provider', 'Trash Utility', 'Garbage Service'] },
      wifi_network: {
        titles: ['WiFi Details', 'WiFi SSID', 'WiFi Network Name'],
        format: (v) => {
          const password = fieldValues.wifi_password;
          return password ? `Network: ${v} | Password: ${password}` : `Network: ${v}`;
        }
      },
      smart_lock_code: { titles: ['Smart lock master PIN code', 'Smart Lock Code', 'Lock Code', 'Door Code'] },
      gate_code: { titles: ['Gate code', 'Gate Code', 'Gate Access Code'] },
      garage_code: { titles: ['Garage code', 'Garage Code', 'Garage Door Code'] },
      lockbox_code: { titles: ['Lockbox Code for Emergencies', 'Lockbox Code', 'Backup Key Location'] },
      security_system_brand: { titles: ['Security System Brand', 'Security Provider', 'Alarm System Brand'] },
      security_alarm_code: { titles: ['Security Alarm Code', 'Alarm Code'] },
      camera_locations: { titles: ['Camera Locations', 'Camera Location'] },
      has_cameras: { 
        titles: ['Cameras Present', 'Has Cameras', 'Security Cameras'],
        format: (v) => v === true ? 'Yes' : v === false ? 'No' : String(v)
      },
      has_security_system: {
        titles: ['Security System Present', 'Has Security System'],
        format: (v) => v === true ? 'Yes' : v === false ? 'No' : String(v)
      },
      insurance_provider: {
        titles: ['Insurance Provider & Policy Number', 'Insurance Provider', 'Insurance Details'],
        format: (v) => {
          const policy = fieldValues.insurance_policy_number;
          return policy ? `${v} - Policy #${policy}` : v;
        }
      },
      primary_cleaner_name: { titles: ['Primary cleaner name', 'Primary Cleaner Name', 'Cleaner Name'] },
      primary_cleaner_phone: { titles: ['Primary cleaner phone number', 'Primary Cleaner Phone', 'Cleaner Phone'] },
      cleaning_price: { titles: ['Negotiated price per cleaning', 'Cleaning Price', 'Cleaning Fee'] },
      hoa_contact_info: { 
        titles: ['HOA Contact Information', 'HOA Information', 'HOA Details'],
        format: (v) => {
          const url = fieldValues.hoa_portal_url;
          const username = fieldValues.hoa_portal_username;
          let result = v;
          if (url) result += `\nPortal: ${url}`;
          if (username) result += `\nUsername: ${username}`;
          return result;
        }
      },
      parking_type: { titles: ['Parking Type', 'Parking Details'] },
      parking_capacity: { titles: ['Parking Capacity', 'Parking Spaces', 'Number of Parking Spaces'] },
      water_shutoff_location: { titles: ['Water Main Shutoff Location', 'Water Shutoff Location', 'Main Water Valve'] },
      gas_shutoff_location: { titles: ['Gas Shutoff Location', 'Gas Main Location', 'Gas Valve Location'] },
      hvac_provider: { titles: ['HVAC Service Provider', 'HVAC Contact', 'HVAC Provider'] },
      plumber_contact: { titles: ['Plumber Contact', 'Plumber', 'Plumber Information'] },
      electrician_contact: { titles: ['Electrician Contact', 'Electrician', 'Electrician Information'] },
      handyman_contact: { titles: ['Handyman Contact', 'Handyman', 'Handyman Information'] },
      thermostat_brand: { titles: ['Thermostat Brand', 'Thermostat Login', 'Smart Thermostat'] },
      school_district: { titles: ['School District'] },
      property_type: { titles: ['Property Type Detail', 'Property Type'] },
    };
    
    // Helper to find task by checking multiple possible titles
    const findMatchingTask = (titles: string[]): any | null => {
      for (const title of titles) {
        const task = tasksByTitle.get(title.toLowerCase());
        if (task) return task;
        // Also try partial match
        for (const [taskTitle, taskObj] of tasksByTitle) {
          if (taskTitle.includes(title.toLowerCase()) || title.toLowerCase().includes(taskTitle)) {
            return taskObj;
          }
        }
      }
      return null;
    };

    // Process each extracted field and update the corresponding task
    if (existingProject) {
      for (const [fieldKey, mapping] of Object.entries(fieldToTaskMapping)) {
        const value = fieldValues[fieldKey];
        if (value !== null && value !== undefined && value !== '') {
          const task = findMatchingTask(mapping.titles);
          if (task) {
            const formattedValue = mapping.format ? mapping.format(value) : String(value);
            const updated = await updateTask(task, formattedValue, `Extracted from owner documents`);
            if (updated) {
              tasksUpdated.push(task.title);
            }
          } else {
            console.log(`No task found for field "${fieldKey}" (looking for: ${mapping.titles.join(', ')})`);
          }
        }
      }
    }

    // Store credentials as property info
    for (const cred of analysisResult.credentials || []) {
      propertyInfoToStore.push({
        type: 'credential',
        title: `Credential: ${cred.serviceName}`,
        description: `Username: ${cred.username || 'N/A'}\nPassword: ${cred.password ? '****' : 'N/A'}\nURL: ${cred.url || 'N/A'}`,
        category: 'Access',
        content: cred
      });
    }

    // Store appliances as property info
    for (const appliance of analysisResult.appliances || []) {
      propertyInfoToStore.push({
        type: 'appliance',
        title: `Appliance: ${appliance.type}${appliance.brand ? ` - ${appliance.brand}` : ''}`,
        description: `Model: ${appliance.model || 'N/A'}\nSerial: ${appliance.serialNumber || 'N/A'}\nLocation: ${appliance.location || 'N/A'}`,
        category: 'Equipment',
        content: appliance
      });
    }

    // Store additional info
    for (const info of analysisResult.additionalInfo || []) {
      propertyInfoToStore.push({
        type: 'property_info',
        title: info.title,
        description: info.details,
        category: info.category,
        content: info
      });
    }

    // Insert property info as actions
    const actionsToInsert = [];
    const isDuplicate = (type: string, title: string) => {
      const key = `${type}:${title.toLowerCase()}`;
      if (existingTitles.has(key)) {
        return true;
      }
      existingTitles.add(key);
      return false;
    };

    for (const info of propertyInfoToStore) {
      if (isDuplicate("property_info", info.title)) continue;
      actionsToInsert.push({
        conversation_id: conversationId,
        action_type: "property_info",
        title: info.title,
        description: info.description,
        category: info.category,
        priority: "medium",
        content: info.content,
        status: "suggested",
      });
    }

    if (actionsToInsert.length > 0) {
      const { error: actionsError } = await supabase
        .from("owner_conversation_actions")
        .insert(actionsToInsert);

      if (actionsError) {
        console.error("Failed to insert actions:", actionsError);
      }
    }

    // === DATA VALIDATION WATCHDOG ===
    // Verify that data was properly extracted and mapped
    const validationIssues: string[] = [];
    const expectedFields = [
      'owner_name', 'owner_email', 'owner_phone',
      'water_provider', 'electric_provider', 'gas_provider', 'internet_provider',
      'wifi_network', 'security_system_brand'
    ];
    
    // Check for empty or null critical fields
    for (const field of expectedFields) {
      const value = fieldValues[field];
      if (value === null || value === undefined || value === '') {
        validationIssues.push(`Missing or empty: ${field}`);
      }
    }
    
    // Validate data formats
    if (fieldValues.owner_email && !fieldValues.owner_email.includes('@')) {
      validationIssues.push(`Invalid email format: ${fieldValues.owner_email}`);
    }
    if (fieldValues.owner_phone && fieldValues.owner_phone.replace(/\D/g, '').length < 10) {
      validationIssues.push(`Invalid phone format: ${fieldValues.owner_phone}`);
    }
    
    // Log validation results
    if (validationIssues.length > 0) {
      console.warn('=== DATA VALIDATION WATCHDOG WARNINGS ===');
      validationIssues.forEach(issue => console.warn(`  ⚠️ ${issue}`));
      console.warn('=========================================');
    } else {
      console.log('✅ Data validation passed - all critical fields extracted');
    }
    
    // Verify tasks were actually updated in the database
    if (tasksUpdated.length > 0 && existingProject) {
      const { data: verifyTasks, error: verifyError } = await supabase
        .from("onboarding_tasks")
        .select("id, title, field_value, status")
        .eq("project_id", existingProject.id)
        .not("field_value", "is", null);
      
      if (verifyError) {
        console.error("Failed to verify task updates:", verifyError);
      } else {
        console.log(`✅ Verified ${verifyTasks?.length || 0} tasks have field_value set`);
        
        // Double-check the tasks we claimed to update
        const actuallyUpdated = verifyTasks?.filter(t => 
          tasksUpdated.some(title => t.title.toLowerCase() === title.toLowerCase())
        ) || [];
        
        if (actuallyUpdated.length !== tasksUpdated.length) {
          console.warn(`⚠️ Mismatch: Claimed ${tasksUpdated.length} updates but verified ${actuallyUpdated.length}`);
        }
      }
    }

    console.log(`Analysis complete. Updated ${tasksUpdated.length} tasks: ${tasksUpdated.join(', ')}`);
    console.log(`Stored ${actionsToInsert.length} property info items`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: analysisResult.summary,
        tasksUpdated: tasksUpdated.length,
        tasksUpdatedList: tasksUpdated,
        propertyInfoCount: actionsToInsert.length,
        validationIssues: validationIssues.length > 0 ? validationIssues : null,
        extractedFields: Object.keys(fieldValues).filter(k => fieldValues[k] !== null && fieldValues[k] !== undefined && fieldValues[k] !== ''),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in analyze-owner-conversation:", error);

    // Update conversation status to error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const body = await new Response(req.clone().body).json().catch(() => ({}));
      if (body.conversationId) {
        await supabase
          .from("owner_conversations")
          .update({ status: "error" })
          .eq("id", body.conversationId);
      }
    } catch (e) {
      console.error("Failed to update conversation status:", e);
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
