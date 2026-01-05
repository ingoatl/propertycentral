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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { templateId, forceReanalyze, fileUrl, detectTypeOnly } = await req.json();

    console.log("Analyzing document - templateId:", templateId, "fileUrl:", fileUrl, "detectTypeOnly:", detectTypeOnly);

    let documentUrl = fileUrl;
    let template = null;

    // If templateId provided, fetch from database
    if (templateId) {
      const { data: templateData, error: templateError } = await supabase
        .from("document_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (templateError || !templateData) {
        throw new Error("Template not found");
      }

      template = templateData;
      documentUrl = template.file_path;

      // Check if we already have cached field mappings (unless force re-analyze)
      if (!forceReanalyze && !detectTypeOnly && template.field_mappings && Array.isArray(template.field_mappings) && template.field_mappings.length > 0) {
        console.log("Using cached field mappings");
        return new Response(
          JSON.stringify({
            success: true,
            fields: template.field_mappings,
            detected_contract_type: template.contract_type,
            cached: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!documentUrl) {
      throw new Error("No document URL provided");
    }

    // Download the document file
    const fileUrlFull = documentUrl.startsWith("http")
      ? documentUrl
      : `${SUPABASE_URL}/storage/v1/object/public/onboarding-documents/${documentUrl}`;

    console.log("Fetching document from:", fileUrlFull);

    const fileResponse = await fetch(fileUrlFull);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch document: ${fileResponse.status}`);
    }

    // Get file content - for DOCX we'll extract text
    const fileBuffer = await fileResponse.arrayBuffer();
    let documentText = "";

    // Check if it's a DOCX file
    if (documentUrl.toLowerCase().endsWith(".docx")) {
      try {
        const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
        const zip = await JSZip.loadAsync(fileBuffer);
        const documentXml = await zip.file("word/document.xml")?.async("string");
        
        if (documentXml) {
          documentText = documentXml
            .replace(/<w:t[^>]*>/g, "")
            .replace(/<\/w:t>/g, " ")
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();
        }
      } catch (zipError) {
        console.error("Error parsing DOCX:", zipError);
        documentText = new TextDecoder().decode(fileBuffer);
      }
    } else {
      documentText = new TextDecoder().decode(fileBuffer);
    }

    console.log("Extracted document text length:", documentText.length);
    console.log("Document preview:", documentText.substring(0, 500));

    // Use AI to analyze the document
    const aiPrompt = detectTypeOnly 
      ? `Analyze this document and determine its type and suggest a name.

Document content:
${documentText.substring(0, 10000)}

Determine the document type from these options:
- "co_hosting" - Co-hosting agreement where owner stays involved in management
- "full_service" - Full-service property management agreement where owner hands off completely
- "rental_agreement" - Guest/tenant rental or lease agreement
- "addendum" - Supplement or addendum to another document
- "pet_policy" - Pet policy agreement
- "early_termination" - Early termination agreement
- "other" - Any other type of document

Also suggest a concise name for this template.

Return ONLY a JSON object like:
{
  "detected_contract_type": "co_hosting",
  "suggested_name": "Co-Hosting Management Agreement"
}

Return ONLY the JSON, no other text.`
      : `Analyze this property management/rental agreement document and identify ALL fields that need to be filled in, INCLUDING signature blocks.

Document content:
${documentText.substring(0, 15000)}

FIRST, determine the document type from these options:
- "co_hosting" - Co-hosting agreement
- "full_service" - Full-service property management agreement  
- "rental_agreement" - Guest/tenant rental or lease agreement
- "addendum" - Supplement or addendum
- "pet_policy" - Pet policy agreement
- "early_termination" - Early termination agreement
- "other" - Any other type

THEN, identify ALL fillable fields including:
1. Regular form fields (name blanks, date blanks, amounts, addresses)
2. SIGNATURE BLOCKS - Look for:
   - "Guest Signature" or "Tenant Signature" lines
   - "Owner Signature" or "Host Signature" lines
   - Date lines near signatures

For each field found, determine:
1. The field name/label (use snake_case for api_id)
2. The field type: "text", "number", "date", "email", "phone", "textarea", "checkbox", "signature"
3. Who should fill it: "admin" (filled before sending) or "guest" (owner fills during signing)
4. A user-friendly label
5. The category: "property", "financial", "dates", "occupancy", "contact", "identification", "signature", "other"

Rules for admin vs guest:
- Admin fills: effective_date, host info
- Guest/Owner fills: their personal info (name, address, phone, email), property address, package selection, signatures

Return a JSON object with this structure:
{
  "detected_contract_type": "co_hosting",
  "suggested_name": "Co-Hosting Agreement",
  "fields": [
    {"api_id": "effective_date", "label": "Effective Date", "type": "date", "filled_by": "admin", "category": "dates"},
    {"api_id": "owner_name", "label": "Owner Name", "type": "text", "filled_by": "guest", "category": "contact"},
    {"api_id": "owner_signature", "label": "Owner Signature", "type": "signature", "filled_by": "guest", "category": "signature"}
  ]
}

Return ONLY the JSON, no other text.`;

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
            content: "You are an expert at analyzing legal documents and identifying form fields AND signature blocks. Return only valid JSON. Pay special attention to document type detection and signature lines.",
          },
          { role: "user", content: aiPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "{}";
    
    console.log("AI response:", aiContent);

    // Parse the AI response
    let parsedResult: {
      detected_contract_type?: string;
      suggested_name?: string;
      fields?: Array<{
        api_id: string;
        label: string;
        type: string;
        filled_by: string;
        category: string;
      }>;
    } = {};

    try {
      let jsonStr = aiContent;
      if (jsonStr.includes("```json")) {
        jsonStr = jsonStr.split("```json")[1].split("```")[0];
      } else if (jsonStr.includes("```")) {
        jsonStr = jsonStr.split("```")[1].split("```")[0];
      }
      parsedResult = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      parsedResult = {
        detected_contract_type: "other",
        suggested_name: "Document Template",
        fields: [],
      };
    }

    const detectedType = parsedResult.detected_contract_type || "other";
    const suggestedName = parsedResult.suggested_name || "Document Template";
    let fields = parsedResult.fields || [];

    // If not detectTypeOnly, ensure we have essential fields
    if (!detectTypeOnly && fields.length > 0) {
      const hasOwnerSignature = fields.some(f => 
        f.api_id.includes("owner_signature") || f.api_id.includes("guest_signature")
      );
      const hasHostSignature = fields.some(f => 
        f.api_id.includes("host_signature") || f.api_id.includes("agent_signature")
      );
      
      if (!hasOwnerSignature) {
        fields.push({ api_id: "owner_signature", label: "Owner Signature", type: "signature", filled_by: "guest", category: "signature" });
        fields.push({ api_id: "owner_date_signed", label: "Owner Date Signed", type: "date", filled_by: "guest", category: "signature" });
      }
      if (!hasHostSignature) {
        fields.push({ api_id: "host_signature", label: "Host/Agent Signature", type: "signature", filled_by: "admin", category: "signature" });
        fields.push({ api_id: "host_date_signed", label: "Host Date Signed", type: "date", filled_by: "admin", category: "signature" });
      }
    }

    // Update template if we have one
    if (template && !detectTypeOnly) {
      const { error: updateError } = await supabase
        .from("document_templates")
        .update({ 
          field_mappings: fields,
          contract_type: detectedType,
        })
        .eq("id", templateId);

      if (updateError) {
        console.error("Error updating template:", updateError);
      }
    }

    console.log("Detected type:", detectedType, "Fields:", fields.length);

    return new Response(
      JSON.stringify({
        success: true,
        detected_contract_type: detectedType,
        suggested_name: suggestedName,
        fields: detectTypeOnly ? undefined : fields,
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
