import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map lead stages to GHL-friendly tags
function getStageTag(stage: string): string {
  const tagMap: Record<string, string> = {
    new_lead: "New Lead",
    contacted: "Contacted",
    discovery_scheduled: "Discovery Scheduled",
    qualified: "Qualified",
    proposal_sent: "Proposal Sent",
    contract_sent: "Contract Sent",
    contract_signed: "Contract Signed",
    ach_form_signed: "ACH Form Signed",
    onboarding_form_requested: "Onboarding In Progress",
    insurance_requested: "Insurance Requested",
    inspection_scheduled: "Inspection Scheduled",
    ops_handoff: "Ops Handoff",
    lost: "Lost",
    not_qualified: "Not Qualified",
  };
  return tagMap[stage] || stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
        property_owners (id, name, email, phone, address),
        properties (id, name, address, city, state, zip_code)
      `)
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error(`Lead not found: ${leadError?.message}`);
    }

    console.log("Lead data:", lead.name, lead.email, "Stage:", lead.stage);

    // Build contact data for GHL
    const contactData: Record<string, any> = {
      locationId: ghlLocationId,
      email: lead.email,
      name: lead.name,
      firstName: lead.name?.split(" ")[0] || "",
      lastName: lead.name?.split(" ").slice(1).join(" ") || "",
      phone: lead.phone || "",
      address1: lead.property_address || lead.properties?.address || "",
      city: lead.properties?.city || "",
      state: lead.properties?.state || "",
      postalCode: lead.properties?.zip_code || "",
      source: `Lovable - ${lead.source || "Unknown"}`,
      tags: [getStageTag(lead.stage)],
      customFields: [
        { key: "lead_stage", value: lead.stage },
        { key: "service_type", value: lead.service_type || "" },
        { key: "property_address", value: lead.property_address || "" },
        { key: "supabase_lead_id", value: lead.id },
      ],
    };

    // Add additional tags based on lead data
    if (lead.service_type) {
      contactData.tags.push(
        lead.service_type === "full_service" ? "Full Service" : "Co-Hosting"
      );
    }

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
