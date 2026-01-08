import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map lead stages to GHL-friendly tags - matching your actual lead stages
function getStageTag(stage: string): string {
  const tagMap: Record<string, string> = {
    new_lead: "New Lead",
    unreached: "Unreached",
    call_scheduled: "Call Scheduled",
    call_attended: "Call Attended",
    send_contract: "Send Contract",
    contract_out: "Contract Out",
    contract_signed: "Contract Signed",
    ach_form_signed: "ACH Form Signed",
    onboarding_form_requested: "Onboarding Requested",
    insurance_requested: "Insurance Requested",
    inspection_scheduled: "Inspection Scheduled",
    ops_handoff: "Ops Handoff",
  };
  return tagMap[stage] || stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Cache for pipeline stages
let pipelineStagesCache: { pipelineId: string; stages: Record<string, string> } | null = null;

// Fetch pipelines and stages from GHL
async function fetchPipelineStages(ghlApiKey: string, locationId: string): Promise<{ pipelineId: string; stages: Record<string, string> }> {
  if (pipelineStagesCache) {
    return pipelineStagesCache;
  }

  console.log("Fetching GHL pipelines...");
  const response = await fetch(
    `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${locationId}`,
    {
      headers: {
        Authorization: `Bearer ${ghlApiKey}`,
        Version: "2021-07-28",
      },
    }
  );

  if (!response.ok) {
    console.error("Failed to fetch pipelines:", response.status);
    throw new Error("Failed to fetch GHL pipelines");
  }

  const data = await response.json();
  console.log("GHL pipelines response:", JSON.stringify(data));

  // Get the first pipeline (or the one named "Owner Acquisition" or similar)
  const pipelines = data.pipelines || [];
  let selectedPipeline = pipelines[0];

  // Try to find a more relevant pipeline
  for (const pipeline of pipelines) {
    const name = (pipeline.name || "").toLowerCase();
    if (name.includes("owner") || name.includes("lead") || name.includes("acquisition")) {
      selectedPipeline = pipeline;
      break;
    }
  }

  if (!selectedPipeline) {
    throw new Error("No pipelines found in GHL");
  }

  console.log("Using pipeline:", selectedPipeline.name, selectedPipeline.id);

  // Build stage name -> ID mapping
  const stages: Record<string, string> = {};
  for (const stage of selectedPipeline.stages || []) {
    // Normalize stage name for matching
    const normalizedName = (stage.name || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
    stages[normalizedName] = stage.id;
    stages[stage.name] = stage.id; // Also keep original name
    console.log(`Stage: "${stage.name}" -> ${stage.id}`);
  }

  pipelineStagesCache = { pipelineId: selectedPipeline.id, stages };
  return pipelineStagesCache;
}

// Map our lead stages to GHL pipeline stage names - matching your actual stages
function mapToGhlStageName(stage: string): string[] {
  // Return array of possible GHL stage name matches for each lead stage
  const stageMap: Record<string, string[]> = {
    new_lead: ["new lead", "new_lead", "new", "incoming", "lead"],
    unreached: ["unreached", "no contact", "no answer", "not reached"],
    call_scheduled: ["call scheduled", "call_scheduled", "scheduled", "discovery scheduled", "meeting scheduled"],
    call_attended: ["call attended", "call_attended", "call completed", "attended", "discovery completed"],
    send_contract: ["send contract", "send_contract", "ready for contract", "contract ready"],
    contract_out: ["contract out", "contract_out", "contract sent", "awaiting signature"],
    contract_signed: ["contract signed", "contract_signed", "signed", "won", "closed won"],
    ach_form_signed: ["ach form signed", "ach_form_signed", "ach signed", "payment setup", "payment form signed"],
    onboarding_form_requested: ["onboarding form requested", "onboarding_form_requested", "onboarding", "onboarding requested"],
    insurance_requested: ["insurance requested", "insurance_requested", "insurance", "awaiting insurance"],
    inspection_scheduled: ["inspection scheduled", "inspection_scheduled", "inspection", "move in inspection"],
    ops_handoff: ["ops handoff", "ops_handoff", "handoff", "completed", "active", "onboarded"],
  };

  return stageMap[stage] || [stage, stage.replace(/_/g, " ")];
}

// Find the best matching stage ID
function findStageId(stages: Record<string, string>, leadStage: string): string | null {
  const targetNames = mapToGhlStageName(leadStage);
  
  console.log(`Finding GHL stage for "${leadStage}", checking against:`, targetNames);

  // First try exact matches
  for (const name of targetNames) {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (stages[normalized]) {
      console.log(`Found exact match: ${normalized} -> ${stages[normalized]}`);
      return stages[normalized];
    }
    if (stages[name]) {
      console.log(`Found exact match: ${name} -> ${stages[name]}`);
      return stages[name];
    }
  }

  // Try partial matches against all GHL stage names
  for (const [stageName, stageId] of Object.entries(stages)) {
    const normalizedStageName = stageName.toLowerCase();
    for (const target of targetNames) {
      const normalizedTarget = target.toLowerCase();
      if (normalizedStageName.includes(normalizedTarget) || 
          normalizedTarget.includes(normalizedStageName)) {
        console.log(`Found partial match: "${stageName}" matches "${target}" -> ${stageId}`);
        return stageId;
      }
    }
  }

  console.log(`No matching GHL stage found for: ${leadStage}`);
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");

    if (!ghlApiKey || !ghlLocationId) {
      console.log("GHL credentials not configured, skipping sync");
      return new Response(
        JSON.stringify({ success: false, message: "GHL not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { leadId, syncReason, newStage } = await req.json();

    if (!leadId) {
      throw new Error("leadId is required");
    }

    console.log(`Syncing lead ${leadId} to GHL - Reason: ${syncReason || "manual"}`);

    // Fetch lead with related data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(`
        *,
        property_owners (id, name, email, phone),
        properties (id, name, address)
      `)
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error(`Lead not found: ${leadError?.message}`);
    }

    console.log("Lead data:", lead.name, lead.email, "Stage:", lead.stage);

    // Get pipeline stages
    let pipelineInfo: { pipelineId: string; stages: Record<string, string> } | null = null;
    try {
      pipelineInfo = await fetchPipelineStages(ghlApiKey, ghlLocationId);
    } catch (pipelineError) {
      console.error("Error fetching pipelines:", pipelineError);
    }

    // Build contact data for GHL
    const contactData: Record<string, any> = {
      locationId: ghlLocationId,
      email: lead.email,
      name: lead.name,
      firstName: lead.name?.split(" ")[0] || "",
      lastName: lead.name?.split(" ").slice(1).join(" ") || "",
      phone: lead.phone || "",
      address1: lead.property_address || lead.properties?.address || "",
      source: `Lovable - ${lead.opportunity_source || "Unknown"}`,
      tags: [getStageTag(lead.stage)],
      customFields: [
        { key: "lead_stage", value: lead.stage },
        { key: "property_address", value: lead.property_address || "" },
        { key: "supabase_lead_id", value: lead.id },
      ],
    };


    let ghlContactId = lead.ghl_contact_id;
    let response;

    if (ghlContactId) {
      // Update existing contact
      console.log("Updating existing GHL contact:", ghlContactId);
      response = await fetch(
        `https://services.leadconnectorhq.com/contacts/${ghlContactId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${ghlApiKey}`,
            "Content-Type": "application/json",
            Version: "2021-07-28",
          },
          body: JSON.stringify(contactData),
        }
      );
    } else {
      // Try to find existing contact by email first
      console.log("Looking for existing GHL contact by email:", lead.email);
      const searchResponse = await fetch(
        `https://services.leadconnectorhq.com/contacts/?locationId=${ghlLocationId}&email=${encodeURIComponent(lead.email)}`,
        {
          headers: {
            Authorization: `Bearer ${ghlApiKey}`,
            Version: "2021-07-28",
          },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.contacts && searchData.contacts.length > 0) {
          ghlContactId = searchData.contacts[0].id;
          console.log("Found existing GHL contact:", ghlContactId);

          // Update the found contact
          response = await fetch(
            `https://services.leadconnectorhq.com/contacts/${ghlContactId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${ghlApiKey}`,
                "Content-Type": "application/json",
                Version: "2021-07-28",
              },
              body: JSON.stringify(contactData),
            }
          );
        }
      }

      // Create new contact if not found
      if (!ghlContactId) {
        console.log("Creating new GHL contact");
        response = await fetch(
          "https://services.leadconnectorhq.com/contacts/",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ghlApiKey}`,
              "Content-Type": "application/json",
              Version: "2021-07-28",
            },
            body: JSON.stringify(contactData),
          }
        );
      }
    }

    if (!response) {
      throw new Error("No GHL API response");
    }

    const ghlResult = await response.json();
    console.log("GHL API response:", JSON.stringify(ghlResult));

    if (!response.ok) {
      console.error("GHL API error:", ghlResult);
      throw new Error(`GHL API error: ${ghlResult.message || response.statusText}`);
    }

    // Extract contact ID from response
    const newGhlContactId = ghlResult.contact?.id || ghlResult.id || ghlContactId;

    if (newGhlContactId && newGhlContactId !== lead.ghl_contact_id) {
      // Update lead with GHL contact ID
      await supabase
        .from("leads")
        .update({ ghl_contact_id: newGhlContactId })
        .eq("id", leadId);

      console.log("Updated lead with GHL contact ID:", newGhlContactId);
    }

    // Create or update opportunity in pipeline
    let opportunityResult = null;
    if (pipelineInfo && newGhlContactId) {
      const stageId = findStageId(pipelineInfo.stages, lead.stage);
      
      if (stageId) {
        console.log(`Syncing opportunity for stage "${lead.stage}" -> stageId: ${stageId}`);

        // First check if opportunity already exists for this contact
        const oppSearchResponse = await fetch(
          `https://services.leadconnectorhq.com/opportunities/search?locationId=${ghlLocationId}&contactId=${newGhlContactId}&pipelineId=${pipelineInfo.pipelineId}`,
          {
            headers: {
              Authorization: `Bearer ${ghlApiKey}`,
              Version: "2021-07-28",
            },
          }
        );

        let existingOpportunityId: string | null = null;
        if (oppSearchResponse.ok) {
          const oppSearchData = await oppSearchResponse.json();
          if (oppSearchData.opportunities && oppSearchData.opportunities.length > 0) {
            existingOpportunityId = oppSearchData.opportunities[0].id;
            console.log("Found existing opportunity:", existingOpportunityId);
          }
        }

        const opportunityData = {
          pipelineId: pipelineInfo.pipelineId,
          locationId: ghlLocationId,
          contactId: newGhlContactId,
          stageId: stageId,
          name: `${lead.name} - ${lead.property_address || "Property"}`,
          status: lead.stage === "lost" || lead.stage === "not_qualified" ? "lost" : "open",
        };

        if (existingOpportunityId) {
          // Update existing opportunity
          const updateOppResponse = await fetch(
            `https://services.leadconnectorhq.com/opportunities/${existingOpportunityId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${ghlApiKey}`,
                "Content-Type": "application/json",
                Version: "2021-07-28",
              },
              body: JSON.stringify({
                stageId: stageId,
                status: opportunityData.status,
              }),
            }
          );
          
          if (updateOppResponse.ok) {
            opportunityResult = await updateOppResponse.json();
            console.log("Updated opportunity to stage:", stageId);
          } else {
            console.error("Failed to update opportunity:", await updateOppResponse.text());
          }
        } else {
          // Create new opportunity
          const createOppResponse = await fetch(
            "https://services.leadconnectorhq.com/opportunities/",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${ghlApiKey}`,
                "Content-Type": "application/json",
                Version: "2021-07-28",
              },
              body: JSON.stringify(opportunityData),
            }
          );
          
          if (createOppResponse.ok) {
            opportunityResult = await createOppResponse.json();
            console.log("Created new opportunity:", opportunityResult.opportunity?.id);
          } else {
            console.error("Failed to create opportunity:", await createOppResponse.text());
          }
        }
      } else {
        console.log(`No matching GHL stage found for lead stage: ${lead.stage}`);
        console.log("Available stages:", Object.keys(pipelineInfo.stages));
      }
    }

    // Add a note if stage changed
    if (syncReason === "stage_change" && newStage && newGhlContactId) {
      const noteBody = `Stage changed to: ${getStageTag(newStage)}\n\nSynced from PeachHaus CRM at ${new Date().toLocaleString()}`;

      await fetch(
        `https://services.leadconnectorhq.com/contacts/${newGhlContactId}/notes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ghlApiKey}`,
            "Content-Type": "application/json",
            Version: "2021-07-28",
          },
          body: JSON.stringify({
            body: noteBody,
          }),
        }
      );

      console.log("Added stage change note to GHL contact");
    }

    return new Response(
      JSON.stringify({
        success: true,
        ghlContactId: newGhlContactId,
        action: ghlContactId ? "updated" : "created",
        opportunityUpdated: !!opportunityResult,
        pipelineId: pipelineInfo?.pipelineId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing lead to GHL:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
