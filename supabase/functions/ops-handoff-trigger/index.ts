import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Team member Slack channel mappings
const TEAM_SLACK_CHANNELS = {
  alex: "#ops-onboarding",      // Alex - Ops Manager / Listing Specialist
  anja: "#finance-onboarding",  // Anja - Bookkeeper
  ingo: "#ops-onboarding",      // Ingo - Owner/Coordinator
  catherine: "#marketing-va",    // Catherine - Marketing VA
  chris: "#marketing-va",        // Chris - Marketing VA
};

// Phase to team member mapping
const PHASE_ASSIGNMENTS: Record<number, { role: string; member: string }> = {
  1: { role: "Bookkeeper", member: "anja" },
  2: { role: "Property Setup Specialist", member: "ingo" },
  3: { role: "Ops Manager", member: "alex" },
  4: { role: "Cleaner Coordinator", member: "alex" },
  5: { role: "Ops Manager", member: "alex" },
  6: { role: "Marketing VA", member: "catherine" },
  7: { role: "Listing Specialist", member: "alex" },
  8: { role: "Marketing VA", member: "catherine" },
  9: { role: "Property Setup Specialist", member: "ingo" },
  10: { role: "Bookkeeper", member: "anja" },
  11: { role: "Bookkeeper", member: "anja" },
  12: { role: "Marketing VA", member: "chris" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId } = await req.json();
    
    if (!leadId) {
      throw new Error("leadId is required");
    }

    console.log(`Processing ops handoff for lead: ${leadId}`);
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get lead with owner and property data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(`
        *,
        property_owners (
          id, name, email, phone, service_type
        )
      `)
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error(`Lead not found: ${leadError?.message}`);
    }

    console.log(`Lead found: ${lead.name}, Owner: ${lead.property_owners?.name}, Service: ${lead.property_owners?.service_type}`);

    const contractType = lead.property_owners?.service_type || "full_service";
    const isCohosting = contractType === "cohosting";
    const propertyAddress = lead.property_address || "Unknown Address";
    const ownerName = lead.property_owners?.name || lead.name || "Unknown Owner";

    // Check if onboarding project already exists
    const { data: existingProject } = await supabase
      .from("onboarding_projects")
      .select("id")
      .eq("property_id", lead.property_id)
      .maybeSingle();

    let projectId = existingProject?.id;

    // Create onboarding project if it doesn't exist
    if (!projectId && lead.property_id) {
      const { data: newProject, error: projectError } = await supabase
        .from("onboarding_projects")
        .insert({
          property_id: lead.property_id,
          owner_id: lead.owner_id,
          status: "in_progress",
          progress: 0,
        })
        .select("id")
        .single();

      if (projectError) {
        console.error("Error creating project:", projectError);
      } else {
        projectId = newProject.id;
        console.log(`Created onboarding project: ${projectId}`);
      }
    }

    // Build Slack messages for each team member
    const slackMessages: Record<string, string[]> = {
      alex: [],
      anja: [],
      ingo: [],
      catherine: [],
      chris: [],
    };

    // Determine blocking info based on contract type
    const blockingInfo: string[] = [];
    if (isCohosting) {
      blockingInfo.push("• Owner is CO-HOSTING - verify their Airbnb/VRBO account access");
    } else {
      blockingInfo.push("• FULL SERVICE - We set up all listings for this owner");
    }

    // Build task assignments
    const alexTasks = [
      "Phase 3: Utilities & Services setup (Due: 7 days)",
      "Phase 4: Cleaner assignment & rate negotiation (Due: 7 days)",
      "Phase 5: PMS & OwnerRez setup (Due: 7 days)",
      "Phase 7: Create Airbnb/VRBO listings (Due: 14 days)",
    ];

    const anjaTasks = [
      "Phase 1: Verify contract & legal documents (Due: 3 days)",
      "Phase 10: Financial terms & pricing setup (Due: 7 days)",
      "Phase 11: Pet & lease policies (Due: 7 days)",
    ];

    const marketingTasks = [
      "Phase 6: Schedule professional photography (Due: 10 days)",
      "Phase 8: Create digital guidebook (Due: 14 days)",
      "Phase 12: Neighborhood info & local tips (Due: 14 days)",
    ];

    const ingoTasks = [
      "Phase 2: Property access & smart lock setup (Due: 5 days)",
      "Phase 9: Emergency contacts & safety verification (Due: 7 days)",
    ];

    // Build the main notification message
    const mainMessage = `🏠 *NEW PROPERTY HANDOFF*

*Property:* ${propertyAddress}
*Owner:* ${ownerName}
*Contract:* ${isCohosting ? "Co-hosting (owner has listings)" : "Full Service (we create listings)"}
*Email:* ${lead.email || "N/A"}
*Phone:* ${lead.phone || "N/A"}

${blockingInfo.join("\n")}

🔗 <https://propertycentral.lovable.app/admin/leads/${leadId}|View Lead> ${projectId ? `| <https://propertycentral.lovable.app/onboarding/projects/${projectId}|View Project>` : ""}`;

    // Alex's message
    slackMessages.alex.push(`${mainMessage}

📋 *Your Tasks (Phases 3, 4, 5, 7):*
${alexTasks.map(t => `• ${t}`).join("\n")}

${isCohosting ? "⚠️ *Co-host Note:* Sync with owner's existing listings instead of creating new ones" : "✅ Create new Airbnb & VRBO listings from scratch"}`);

    // Anja's message
    slackMessages.anja.push(`${mainMessage}

📋 *Your Tasks (Phases 1, 10, 11):*
${anjaTasks.map(t => `• ${t}`).join("\n")}

📎 *Check for Owner Documents:*
• Insurance certificate
• W9/Tax documents
• STR permit status`);

    // Catherine/Chris's message
    slackMessages.catherine.push(`${mainMessage}

📋 *Your Tasks (Phases 6, 8, 12):*
${marketingTasks.map(t => `• ${t}`).join("\n")}`);

    // Ingo's message
    slackMessages.ingo.push(`${mainMessage}

📋 *Your Tasks (Phases 2, 9):*
${ingoTasks.map(t => `• ${t}`).join("\n")}

🔐 *Access Priority:* Smart lock installation & code setup`);

    // Send Slack notifications via google-calendar-sync function
    const slackResults: Record<string, boolean> = {};
    
    for (const [member, messages] of Object.entries(slackMessages)) {
      if (messages.length === 0) continue;
      
      const channel = TEAM_SLACK_CHANNELS[member as keyof typeof TEAM_SLACK_CHANNELS];
      if (!channel) continue;

      try {
        console.log(`Sending Slack message to ${member} in ${channel}`);
        
        const slackResponse = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-sync`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "send-slack-message",
            channel: channel,
            message: messages[0],
          }),
        });

        const slackResult = await slackResponse.json();
        slackResults[member] = slackResponse.ok;
        console.log(`Slack to ${member}: ${slackResponse.ok ? "sent" : "failed"}`, slackResult);
      } catch (slackError) {
        console.error(`Slack error for ${member}:`, slackError);
        slackResults[member] = false;
      }
    }

    // Add timeline entry
    await supabase.from("lead_timeline").insert({
      lead_id: leadId,
      action: `Ops handoff completed - Team notified via Slack`,
      metadata: {
        contract_type: contractType,
        project_id: projectId,
        slack_notifications: slackResults,
      },
    });

    console.log(`Ops handoff complete for lead ${leadId}`);

    return new Response(
      JSON.stringify({
        success: true,
        projectId,
        contractType,
        slackNotifications: slackResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ops-handoff-trigger:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
