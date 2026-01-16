import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Field category definitions with user-friendly labels
const CATEGORY_LABELS: Record<string, string> = {
  property: "Property Details",
  financial: "Financial Terms",
  dates: "Lease Dates",
  occupancy: "Occupancy & Policies",
  contact: "Contact Information",
  identification: "Identification",
  vehicle: "Vehicle Information",
  emergency: "Emergency Contact",
  acknowledgment: "Acknowledgments",
  signature: "Signatures",
  other: "Other Fields",
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

    // Use AI to analyze the document with IMPROVED prompts
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
  "detected_contract_type": "rental_agreement",
  "suggested_name": "Standard Lease Agreement"
}

Return ONLY the JSON, no other text.`
      : `You are a legal document analyst. Analyze this rental/lease agreement and extract ALL fillable fields.

DOCUMENT CONTENT:
${documentText.substring(0, 20000)}

CRITICAL RULES FOR FIELD ASSIGNMENT:

1. **ADMIN fills BEFORE sending** (filled_by: "admin"):
   - Property address, unit number, city, county, state, zip
   - Landlord/management company name, address, phone, email
   - Monthly rent amount, security deposit, all fees (late fees, cleaning, etc.)
   - Lease start date, end date, move-in date
   - Rent due date, grace period, late fee policies
   - Utilities included/excluded, parking spaces
   - Number of bedrooms, bathrooms
   - Any property-specific terms or rules
   - Pet policies, pet deposits, pet rent
   - All financial terms and amounts
   - Landlord/Host signature and date (if document has host signature)

2. **GUEST fills WHEN SIGNING** (filled_by: "guest"):
   - Tenant/Guest name (their legal name)
   - Tenant email, phone, current address
   - Social Security Number (SSN), Driver's License
   - Date of Birth
   - Vehicle information (make, model, plate number)
   - Emergency contact name, phone, relationship
   - Number of occupants
   - **SIGNATURES** - Guest signature, initials
   - **DATES next to signatures** - Date tenant signs

3. **SIGNATURE FIELDS** - Mark these as type: "signature", category: "signature":
   - Look for "Tenant Signature", "Guest Signature", "Lessee Signature"
   - Look for "Landlord Signature", "Host Signature", "Lessor Signature", "Agent Signature"
   - Look for initials lines on each page

For each field, provide:
- api_id: snake_case identifier (e.g., "monthly_rent", "tenant_signature")
- label: User-friendly label (e.g., "Monthly Rent Amount", "Tenant Signature")
- type: One of "text", "number", "date", "email", "phone", "textarea", "checkbox", "signature"
- filled_by: "admin" or "guest" based on rules above
- category: One of "property", "financial", "dates", "occupancy", "contact", "identification", "vehicle", "emergency", "acknowledgment", "signature", "other"
- required: true/false (signatures are always required, text fields usually required)
- description: Brief help text explaining what to enter

Also determine the contract type:
- "co_hosting" - Co-hosting agreement
- "full_service" - Full-service property management
- "rental_agreement" - Rental/lease agreement
- "addendum" - Addendum
- "pet_policy" - Pet policy
- "early_termination" - Early termination
- "other" - Other

Return ONLY valid JSON in this format:
{
  "detected_contract_type": "rental_agreement",
  "suggested_name": "Standard Lease Agreement",
  "fields": [
    {
      "api_id": "property_address",
      "label": "Property Address",
      "type": "text",
      "filled_by": "admin",
      "category": "property",
      "required": true,
      "description": "Full street address of the rental property"
    },
    {
      "api_id": "monthly_rent",
      "label": "Monthly Rent",
      "type": "number",
      "filled_by": "admin",
      "category": "financial",
      "required": true,
      "description": "Monthly rent amount in dollars"
    },
    {
      "api_id": "tenant_name",
      "label": "Tenant Full Name",
      "type": "text",
      "filled_by": "guest",
      "category": "contact",
      "required": true,
      "description": "Legal name of the tenant"
    },
    {
      "api_id": "tenant_signature",
      "label": "Tenant Signature",
      "type": "signature",
      "filled_by": "guest",
      "category": "signature",
      "required": true,
      "description": "Tenant signs here to agree to lease terms"
    },
    {
      "api_id": "host_signature",
      "label": "Host/Landlord Signature",
      "type": "signature",
      "filled_by": "admin",
      "category": "signature",
      "required": true,
      "description": "Host/landlord signs after tenant"
    }
  ]
}`;

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
            content: `You are an expert legal document analyst. You analyze rental agreements, leases, and property management contracts to identify all fillable fields.

KEY PRINCIPLES:
1. Admin fills ALL property details, financial terms, and lease terms BEFORE sending to tenant
2. Guest/Tenant ONLY fills their personal info (name, contact, ID) and SIGNS
3. Signature fields are CRITICAL - identify all signature and initial lines
4. Use clear, user-friendly labels that explain what to enter
5. Return ONLY valid JSON - no markdown, no explanations`,
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

    let aiData;
    try {
      aiData = await aiResponse.json();
    } catch (jsonError) {
      console.error("Error parsing AI response JSON:", jsonError);
      return new Response(
        JSON.stringify({
          success: true,
          detected_contract_type: "other",
          suggested_name: "Document Template",
          fields: [],
          cached: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiContent = aiData.choices?.[0]?.message?.content || "{}";
    
    console.log("AI response:", aiContent.substring(0, 500));

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
        required?: boolean;
        description?: string;
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
    const rawFields = parsedResult.fields || [];

    // Post-process fields to ensure proper structure and assignments
    const fields: Array<{
      api_id: string;
      label: string;
      type: string;
      filled_by: string;
      category: string;
      required: boolean;
      description: string;
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = rawFields.map((f, index) => {
      // Ensure proper type
      const validTypes = ["text", "number", "date", "email", "phone", "textarea", "checkbox", "signature"];
      const fieldType = validTypes.includes(f.type) ? f.type : "text";
      
      // Force signature fields to signature category
      const category = fieldType === "signature" ? "signature" : (f.category || "other");
      
      // Ensure required is boolean
      const required = f.required !== false;
      
      return {
        api_id: f.api_id || `field_${index}`,
        label: f.label || f.api_id,
        type: fieldType,
        filled_by: f.filled_by === "guest" ? "guest" : "admin",
        category,
        required,
        description: f.description || "",
        // Default positioning - will be improved in future with PDF coordinate extraction
        page: 1,
        x: 10 + (index % 2) * 45,
        y: 10 + Math.floor(index / 2) * 8,
        width: 40,
        height: 4,
      };
    });

    // Ensure we have essential signature fields
    if (!detectTypeOnly && fields.length > 0) {
      const hasGuestSignature = fields.some(f => 
        f.type === "signature" && 
        (f.filled_by === "guest" || f.api_id.includes("tenant") || f.api_id.includes("guest"))
      );
      const hasHostSignature = fields.some(f =>
        f.type === "signature" && 
        (f.filled_by === "admin" || f.api_id.includes("host") || f.api_id.includes("landlord") || f.api_id.includes("agent"))
      );
      
      if (!hasGuestSignature) {
        fields.push({
          api_id: "tenant_signature",
          label: "Tenant Signature",
          type: "signature",
          filled_by: "guest",
          category: "signature",
          required: true,
          description: "Tenant signs here to agree to lease terms",
          page: 1,
          x: 10,
          y: 85,
          width: 35,
          height: 6,
        });
        fields.push({
          api_id: "tenant_date_signed",
          label: "Date Signed (Tenant)",
          type: "date",
          filled_by: "guest",
          category: "signature",
          required: true,
          description: "Date tenant signs the agreement",
          page: 1,
          x: 55,
          y: 85,
          width: 25,
          height: 4,
        });
      }
      
      if (!hasHostSignature) {
        fields.push({
          api_id: "host_signature",
          label: "Host/Landlord Signature",
          type: "signature",
          filled_by: "admin",
          category: "signature",
          required: true,
          description: "Host/landlord signs to execute the agreement",
          page: 1,
          x: 10,
          y: 92,
          width: 35,
          height: 6,
        });
        fields.push({
          api_id: "host_date_signed",
          label: "Date Signed (Host)",
          type: "date",
          filled_by: "admin",
          category: "signature",
          required: true,
          description: "Date host signs the agreement",
          page: 1,
          x: 55,
          y: 92,
          width: 25,
          height: 4,
        });
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
    console.log("Admin fields:", fields.filter(f => f.filled_by === "admin").length);
    console.log("Guest fields:", fields.filter(f => f.filled_by === "guest").length);
    console.log("Signature fields:", fields.filter(f => f.type === "signature").length);

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
