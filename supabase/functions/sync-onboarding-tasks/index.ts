import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapping from task titles to owner_onboarding_submissions fields
const TASK_FIELD_MAPPING: Record<string, string[]> = {
  "Owner Name": ["owner_name", "name"],
  "Owner Email": ["owner_email", "email"],
  "Owner Phone": ["owner_phone", "phone"],
  "WiFi Details": ["wifi_ssid", "wifi_password"],
  "Smart lock master PIN code": ["smart_lock_code"],
  "Lockbox Code for Emergencies": ["lockbox_code"],
  "Gate code": ["gate_code"],
  "Backup key location": ["backup_key_location"],
  "Garage Code": ["garage_code"],
  "Alarm Code": ["alarm_code"],
  "Trash Service Provider": ["trash_provider"],
  "Trash Pickup Day": ["trash_pickup_day"],
  "Water Provider": ["water_provider"],
  "Electric Provider": ["electric_provider"],
  "Gas Provider": ["gas_provider"],
  "Internet Provider": ["internet_provider"],
  "HOA Information": ["hoa_name", "hoa_contact"],
  "Primary Cleaner": ["primary_cleaner"],
  "Backup Cleaner": ["backup_cleaner"],
  "Insurance Provider": ["insurance_provider"],
  "STR Permit Number": ["str_permit_number"],
};

// Direct mappings for owner fields (highest priority)
const OWNER_DIRECT_FIELDS: Record<string, string> = {
  "Owner Name": "name",
  "Owner Email": "email", 
  "Owner Phone": "phone",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, propertyId: passedPropertyId } = await req.json();
    
    if (!projectId) {
      throw new Error("projectId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Syncing onboarding tasks for project: ${projectId}`);

    // Get the project and property info
    const { data: project, error: projectError } = await supabase
      .from("onboarding_projects")
      .select("id, property_id, owner_name")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message}`);
    }

    // Use passed propertyId or fall back to project's property_id
    const propertyId = passedPropertyId || project.property_id;

    // Get ALL tasks for this project (not just pending ones with empty values)
    // We want to sync any task that doesn't have data yet
    const { data: allTasks, error: tasksError } = await supabase
      .from("onboarding_tasks")
      .select("id, title, field_value, status")
      .eq("project_id", projectId);

    if (tasksError) {
      throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
    }

    // Filter to tasks that need syncing (empty field_value or null)
    const pendingTasks = (allTasks || []).filter(task => 
      !task.field_value || task.field_value.trim() === ""
    );

    console.log(`Found ${pendingTasks.length} tasks without values out of ${allTasks?.length || 0} total`);

    // Source 1: Get data from owner_onboarding_submissions for this property
    let submissionData: Record<string, unknown> = {};
    if (propertyId) {
      const { data: submission } = await supabase
        .from("owner_onboarding_submissions")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (submission) {
        submissionData = submission;
        console.log("Found owner_onboarding_submission data for property");
      }
    }

    // Source 2: Get completed tasks from OTHER projects for the same property
    let completedTasksData: Record<string, string> = {};
    if (propertyId) {
      // Get tasks from other projects with same property_id
      const { data: otherProjects } = await supabase
        .from("onboarding_projects")
        .select("id")
        .eq("property_id", propertyId)
        .neq("id", projectId);

      if (otherProjects && otherProjects.length > 0) {
        const otherProjectIds = otherProjects.map(p => p.id);
        const { data: completedTasks } = await supabase
          .from("onboarding_tasks")
          .select("title, field_value")
          .in("project_id", otherProjectIds)
          .eq("status", "completed")
          .not("field_value", "is", null);

        if (completedTasks) {
          for (const task of completedTasks) {
            if (task.field_value && task.field_value.trim() !== "") {
              completedTasksData[task.title] = task.field_value;
            }
          }
          console.log(`Found ${Object.keys(completedTasksData).length} completed tasks from other projects`);
        }
      }
    }

    // Source 3: Get property owner data
    let ownerData: Record<string, unknown> = {};
    if (propertyId) {
      const { data: property } = await supabase
        .from("properties")
        .select("owner_id, name")
        .eq("id", propertyId)
        .single();

      if (property?.owner_id) {
        const { data: owner } = await supabase
          .from("property_owners")
          .select("name, email, phone")
          .eq("id", property.owner_id)
          .single();

        if (owner) {
          ownerData = {
            owner_name: owner.name,
            owner_email: owner.email,
            owner_phone: owner.phone,
          };
          console.log("Found property owner data:", JSON.stringify(ownerData));
        }
      }
    }

    // Now sync the tasks
    const syncedTasks: string[] = [];
    
    for (const task of pendingTasks || []) {
      let newValue: string | null = null;

      // Priority 1: Check completed tasks from other projects (same property)
      if (completedTasksData[task.title]) {
        newValue = completedTasksData[task.title];
        console.log(`Task "${task.title}" found in completed tasks from other projects: ${newValue}`);
      }

      // Priority 2: Check property_owners table directly for owner-related fields
      if (!newValue && OWNER_DIRECT_FIELDS[task.title]) {
        const ownerField = OWNER_DIRECT_FIELDS[task.title];
        const ownerValue = ownerData[`owner_${ownerField}`] || ownerData[ownerField];
        if (ownerValue && typeof ownerValue === "string" && ownerValue.trim() !== "") {
          newValue = ownerValue;
          console.log(`Task "${task.title}" found in property_owners: ${newValue}`);
        }
      }

      // Priority 3: Check owner_onboarding_submissions using field mappings
      if (!newValue) {
        const mappedFields = TASK_FIELD_MAPPING[task.title];
        if (mappedFields) {
          const values: string[] = [];
          for (const field of mappedFields) {
            // Check submission data first, then owner data
            const val = submissionData[field] || ownerData[field] || ownerData[`owner_${field}`];
            if (val && typeof val === "string" && val.trim() !== "") {
              values.push(val);
            }
          }
          if (values.length > 0) {
            newValue = values.join(" / ");
            console.log(`Task "${task.title}" found via field mapping: ${newValue}`);
          }
        }
      }

      // Update the task if we found a value
      if (newValue && newValue.trim() !== "") {
        const { error: updateError } = await supabase
          .from("onboarding_tasks")
          .update({
            field_value: newValue,
            status: "completed",
            completed_date: new Date().toISOString(),
            notes: "Auto-synced from existing property data",
          })
          .eq("id", task.id);

        if (!updateError) {
          syncedTasks.push(task.title);
          console.log(`Synced task: ${task.title} = ${newValue}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount: syncedTasks.length,
        syncedTasks,
        message: syncedTasks.length > 0 
          ? `Synced ${syncedTasks.length} tasks with existing data`
          : "No tasks needed syncing - all data already populated or no matching data found",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
