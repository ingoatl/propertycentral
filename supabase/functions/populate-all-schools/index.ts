import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Fetching all properties with projects...");

    // Get all properties with their onboarding projects
    const { data: properties, error: propertiesError } = await supabaseClient
      .from("properties")
      .select(`
        id,
        name,
        address,
        onboarding_projects!inner (
          id
        )
      `);

    if (propertiesError) {
      console.error("Error fetching properties:", propertiesError);
      throw propertiesError;
    }

    console.log(`Found ${properties?.length || 0} properties with projects`);

    const results = [];
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    for (const property of properties || []) {
      const projectId = property.onboarding_projects[0]?.id;
      if (!projectId) continue;

      console.log(`Processing ${property.name} - ${property.address}`);

      try {
        // Check if school data already exists
        const { data: existingSchools } = await supabaseClient
          .from("onboarding_tasks")
          .select("title, field_value")
          .eq("project_id", projectId)
          .in("title", ["School District", "Elementary School", "Middle School", "High School"]);

        const hasCompleteSchools = existingSchools?.length === 4 && 
          existingSchools.every(s => s.field_value && s.field_value.trim() !== "");

        if (hasCompleteSchools) {
          console.log(`  ✓ Already has complete school data`);
          results.push({ property: property.name, status: "skipped", reason: "already_complete" });
          continue;
        }

        // Call AI to get school info
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are a school district lookup assistant. Given a property address in Georgia, USA, determine the school district and schools.`
              },
              {
                role: "user",
                content: `What are the school district, elementary school, middle school, and high school for: ${property.address}`
              }
            ],
            tools: [{
              type: "function",
              function: {
                name: "return_school_info",
                description: "Return school information",
                parameters: {
                  type: "object",
                  properties: {
                    school_district: { type: "string" },
                    elementary_school: { type: "string" },
                    middle_school: { type: "string" },
                    high_school: { type: "string" }
                  },
                  required: ["school_district", "elementary_school", "middle_school", "high_school"],
                  additionalProperties: false
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "return_school_info" } }
          }),
        });

        if (!aiResponse.ok) {
          throw new Error(`AI error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) throw new Error("No tool call");

        const schoolInfo = JSON.parse(toolCall.function.arguments);
        console.log(`  AI returned:`, schoolInfo);

        // Delete existing school tasks
        await supabaseClient
          .from("onboarding_tasks")
          .delete()
          .eq("project_id", projectId)
          .in("title", ["School District", "Elementary School", "Middle School", "High School"]);

        // Insert new school tasks
        const tasksToInsert = [
          { title: "School District", value: schoolInfo.school_district },
          { title: "Elementary School", value: schoolInfo.elementary_school },
          { title: "Middle School", value: schoolInfo.middle_school },
          { title: "High School", value: schoolInfo.high_school }
        ].map(t => ({
          project_id: projectId,
          phase_number: 10,
          phase_title: "Property Specifications",
          title: t.title,
          field_type: "text",
          field_value: t.value,
          status: "completed"
        }));

        const { error: insertError } = await supabaseClient
          .from("onboarding_tasks")
          .insert(tasksToInsert);

        if (insertError) throw insertError;

        console.log(`  ✓ Updated school data`);
        results.push({ 
          property: property.name, 
          status: "success",
          schools: schoolInfo
        });

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`  ✗ Error for ${property.name}:`, error);
        results.push({ 
          property: property.name, 
          status: "error", 
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: results.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in populate-all-schools:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
