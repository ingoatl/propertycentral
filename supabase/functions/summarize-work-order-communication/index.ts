import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { workOrderId } = await req.json();

    if (!workOrderId) {
      return new Response(
        JSON.stringify({ error: "workOrderId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch work order details - specify relationship for vendors
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .select(`
        id, title, description, status, urgency, estimated_cost, actual_cost,
        owner_approved_at, quoted_cost, vendor_notes, assigned_vendor_id,
        property:properties(id, name, address, owner_id)
      `)
      .eq("id", workOrderId)
      .single();

    if (woError || !workOrder) {
      console.error("Error fetching work order:", woError);
      return new Response(
        JSON.stringify({ error: "Work order not found", details: woError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch vendor separately if assigned
    let vendor = null;
    if (workOrder.assigned_vendor_id) {
      const { data: vendorData } = await supabase
        .from("vendors")
        .select("id, company_name, contact_name, phone")
        .eq("id", workOrder.assigned_vendor_id)
        .single();
      vendor = vendorData;
    }

    // Fetch vendor communications
    const vendorId = vendor?.id;
    let vendorMessages: any[] = [];
    
    if (vendorId) {
      const { data: messages } = await supabase
        .from("lead_communications")
        .select("body, direction, communication_type, created_at, metadata")
        .or(`metadata->>vendor_id.eq.${vendorId},metadata->>work_order_id.eq.${workOrderId}`)
        .order("created_at", { ascending: true })
        .limit(30);

      vendorMessages = messages || [];
    }

    // Fetch work order timeline
    const { data: timeline } = await supabase
      .from("work_order_timeline")
      .select("event_type, description, notes, created_at")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Build context for AI summarization
    const messageHistory = vendorMessages.map(m => {
      const dir = m.direction === "outbound" ? "Us" : "Vendor";
      const type = m.communication_type === "voice" ? " (voice)" : "";
      return `${dir}${type}: ${m.body || "[no text]"}`;
    }).join("\n");

    const timelineHistory = (timeline || []).map(t => 
      `- ${t.event_type}: ${t.description || t.notes || ""}`
    ).join("\n");

    const contextSummary = `
Work Order: ${workOrder.title}
Description: ${workOrder.description || "N/A"}
Status: ${workOrder.status}
Urgency: ${workOrder.urgency}
Vendor: ${vendor?.company_name || "Not assigned"}
Quote Amount: ${workOrder.quoted_cost ? `$${workOrder.quoted_cost}` : "No quote yet"}
Vendor Notes: ${workOrder.vendor_notes || "None"}
Owner Approved: ${workOrder.owner_approved_at ? "Yes" : "No"}
Property: ${workOrder.property?.name || "Unknown"} - ${workOrder.property?.address || ""}

Message History:
${messageHistory || "No messages exchanged yet"}

Timeline:
${timelineHistory || "No timeline entries"}
    `.trim();

    // Call Lovable AI for summarization
    const aiResponse = await fetch("https://ijsxcaaqphaciaenlegl.supabase.co/functions/v1/lovable-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a property management assistant. Summarize the vendor communication and work order status for a property manager who needs to update the property owner.

Your response MUST be valid JSON with this exact structure:
{
  "summary": "2-3 sentence summary of the current situation, focusing on what the owner needs to know",
  "keyFacts": {
    "vendorName": "string or null",
    "quotedAmount": number or null,
    "scope": "brief description of work",
    "status": "current status",
    "nextStep": "what needs to happen next"
  },
  "suggestedAction": "one of: approval_request, work_started, work_complete, additional_repairs, schedule_access, or null if no action needed"
}

Be concise and focus on actionable information. If there's a quote pending approval, highlight that.`
          },
          {
            role: "user",
            content: contextSummary
          }
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      
      // Return a basic summary if AI fails
      return new Response(
        JSON.stringify({
          summary: `Work order "${workOrder.title}" is ${workOrder.status}. ${workOrder.quoted_cost ? `Vendor quoted $${workOrder.quoted_cost}.` : ""} ${workOrder.owner_approved_at ? "Owner has approved." : "Awaiting owner approval."}`,
          keyFacts: {
            vendorName: vendor?.company_name || null,
            quotedAmount: workOrder.quoted_cost || null,
            scope: workOrder.description || workOrder.title,
            status: workOrder.status,
            nextStep: workOrder.owner_approved_at ? "Vendor can proceed" : "Need owner approval"
          },
          suggestedAction: workOrder.quoted_cost && !workOrder.owner_approved_at ? "approval_request" : null,
          messageCount: vendorMessages.length,
          raw: false
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    
    // Parse AI response
    let parsedResponse;
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError, aiContent);
      parsedResponse = {
        summary: aiContent || `Work order "${workOrder.title}" is ${workOrder.status}.`,
        keyFacts: {
          vendorName: vendor?.company_name || null,
          quotedAmount: workOrder.quoted_cost || null,
          scope: workOrder.description || workOrder.title,
          status: workOrder.status,
          nextStep: "Review and take action"
        },
        suggestedAction: null
      };
    }

    return new Response(
      JSON.stringify({
        ...parsedResponse,
        messageCount: vendorMessages.length,
        raw: false
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in summarize-work-order-communication:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
