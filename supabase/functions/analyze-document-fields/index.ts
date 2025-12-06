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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { templateId } = await req.json();

    console.log("Analyzing document fields for template:", templateId);

    // Get template details
    const { data: template, error: templateError } = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      throw new Error("Template not found");
    }

    // Check if we already have cached field mappings
    if (template.field_mappings && Array.isArray(template.field_mappings) && template.field_mappings.length > 0) {
      console.log("Using cached field mappings");
      return new Response(
        JSON.stringify({
          success: true,
          fields: template.field_mappings,
          cached: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the document file
    const fileUrl = template.file_path.startsWith("http")
      ? template.file_path
      : `${SUPABASE_URL}/storage/v1/object/public/onboarding-documents/${template.file_path}`;

    console.log("Fetching document from:", fileUrl);

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch document: ${fileResponse.status}`);
    }

    // Get file content - for DOCX we'll extract text
    const fileBuffer = await fileResponse.arrayBuffer();
    let documentText = "";

    // Check if it's a DOCX file
    if (template.file_path.toLowerCase().endsWith(".docx")) {
      // DOCX files are ZIP archives - extract document.xml content
      try {
        const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
        const zip = await JSZip.loadAsync(fileBuffer);
        const documentXml = await zip.file("word/document.xml")?.async("string");
        
        if (documentXml) {
          // Extract text from XML, removing tags
          documentText = documentXml
            .replace(/<w:t[^>]*>/g, "")
            .replace(/<\/w:t>/g, " ")
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();
        }
      } catch (zipError) {
        console.error("Error parsing DOCX:", zipError);
        // Try treating as plain text
        documentText = new TextDecoder().decode(fileBuffer);
      }
    } else {
      // For other files, try to extract as text
      documentText = new TextDecoder().decode(fileBuffer);
    }

    console.log("Extracted document text length:", documentText.length);
    console.log("Document preview:", documentText.substring(0, 500));

    // Use AI to analyze the document and identify fields
    const aiPrompt = `Analyze this rental/lease agreement document and identify ALL fields that need to be filled in. 

Document content:
${documentText.substring(0, 15000)}

For each field found, determine:
1. The field name/label (use snake_case for api_id)
2. The field type: "text", "number", "date", "email", "phone", "textarea", "checkbox"
3. Who should fill it: "admin" (property manager fills before sending) or "guest" (tenant fills when signing)
4. A user-friendly label
5. The category: "property", "financial", "dates", "occupancy", "contact", "identification", "vehicle", "emergency", "acknowledgment", "other"

Rules for determining admin vs guest:
- Admin fills: property address, rent amounts, deposit, lease dates, property rules, policies, landlord info
- Guest fills: guest personal info (address, phone, ID), emergency contacts, vehicle info, acknowledgments, initials, signatures

Return a JSON array of field objects. Example format:
[
  {"api_id": "property_address", "label": "Property Address", "type": "text", "filled_by": "admin", "category": "property"},
  {"api_id": "monthly_rent", "label": "Monthly Rent", "type": "number", "filled_by": "admin", "category": "financial"},
  {"api_id": "guest_phone", "label": "Guest Phone Number", "type": "phone", "filled_by": "guest", "category": "contact"},
  {"api_id": "emergency_contact_name", "label": "Emergency Contact Name", "type": "text", "filled_by": "guest", "category": "emergency"},
  {"api_id": "vehicle_make", "label": "Vehicle Make", "type": "text", "filled_by": "guest", "category": "vehicle"},
  {"api_id": "rules_acknowledgment", "label": "I acknowledge the house rules", "type": "checkbox", "filled_by": "guest", "category": "acknowledgment"}
]

Return ONLY the JSON array, no other text.`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert at analyzing legal documents and identifying form fields. Return only valid JSON arrays.",
          },
          { role: "user", content: aiPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "[]";
    
    console.log("AI response:", aiContent);

    // Parse the AI response
    let fields: Array<{
      api_id: string;
      label: string;
      type: string;
      filled_by: string;
      category: string;
    }> = [];

    try {
      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = aiContent;
      if (jsonStr.includes("```json")) {
        jsonStr = jsonStr.split("```json")[1].split("```")[0];
      } else if (jsonStr.includes("```")) {
        jsonStr = jsonStr.split("```")[1].split("```")[0];
      }
      fields = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      // Return default fields if parsing fails
      fields = [
        { api_id: "property_address", label: "Property Address", type: "text", filled_by: "admin", category: "property" },
        { api_id: "monthly_rent", label: "Monthly Rent", type: "number", filled_by: "admin", category: "financial" },
        { api_id: "security_deposit", label: "Security Deposit", type: "number", filled_by: "admin", category: "financial" },
        { api_id: "lease_start_date", label: "Lease Start Date", type: "date", filled_by: "admin", category: "dates" },
        { api_id: "lease_end_date", label: "Lease End Date", type: "date", filled_by: "admin", category: "dates" },
        { api_id: "guest_name", label: "Guest Name", type: "text", filled_by: "admin", category: "contact" },
        { api_id: "guest_email", label: "Guest Email", type: "email", filled_by: "admin", category: "contact" },
      ];
    }

    // Ensure we always have essential guest info fields
    const hasGuestName = fields.some(f => f.api_id === "guest_name" || f.api_id === "tenant_name");
    const hasGuestEmail = fields.some(f => f.api_id === "guest_email" || f.api_id === "tenant_email");
    
    if (!hasGuestName) {
      fields.unshift({ api_id: "guest_name", label: "Guest Name", type: "text", filled_by: "admin", category: "contact" });
    }
    if (!hasGuestEmail) {
      fields.splice(1, 0, { api_id: "guest_email", label: "Guest Email", type: "email", filled_by: "admin", category: "contact" });
    }

    console.log("Detected fields:", fields.length);

    // Cache the field mappings in the database
    const { error: updateError } = await supabase
      .from("document_templates")
      .update({ field_mappings: fields })
      .eq("id", templateId);

    if (updateError) {
      console.error("Error caching field mappings:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        fields,
        cached: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
