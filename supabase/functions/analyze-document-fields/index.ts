import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Field category labels
const CATEGORY_LABELS: Record<string, string> = {
  property: "Property Details",
  financial: "Financial Terms",
  dates: "Lease Dates",
  landlord: "Landlord Info",
  tenant: "Tenant Info",
  occupancy: "Occupancy",
  identification: "Identification",
  vehicle: "Vehicle Info",
  emergency: "Emergency Contact",
  employment: "Employment",
  pets: "Pet Info",
  signature: "Signatures",
  acknowledgment: "Acknowledgments",
  package: "Service Package",
  other: "Other Fields",
};

// Semantic field patterns for AI-assisted labeling
const FIELD_SEMANTICS = [
  // Signatures
  { patterns: ["tenant.*signature", "lessee.*signature", "renter.*signature"], api_id: "tenant_signature", label: "Tenant Signature", type: "signature", filled_by: "tenant", category: "signature" },
  { patterns: ["guest.*signature"], api_id: "guest_signature", label: "Guest Signature", type: "signature", filled_by: "guest", category: "signature" },
  { patterns: ["landlord.*signature", "lessor.*signature", "owner.*signature"], api_id: "landlord_signature", label: "Landlord Signature", type: "signature", filled_by: "admin", category: "signature" },
  { patterns: ["host.*signature", "manager.*signature", "agent.*signature"], api_id: "host_signature", label: "Host Signature", type: "signature", filled_by: "admin", category: "signature" },
  
  // Property
  { patterns: ["property.*address", "rental.*address", "premises"], api_id: "property_address", label: "Property Address", type: "text", filled_by: "admin", category: "property" },
  { patterns: ["unit.*number", "apt.*number", "apartment"], api_id: "unit_number", label: "Unit Number", type: "text", filled_by: "admin", category: "property" },
  { patterns: ["^city$", "property.*city"], api_id: "city", label: "City", type: "text", filled_by: "admin", category: "property" },
  { patterns: ["^state$", "property.*state"], api_id: "state", label: "State", type: "text", filled_by: "admin", category: "property" },
  { patterns: ["^zip", "postal.*code"], api_id: "zip_code", label: "ZIP Code", type: "text", filled_by: "admin", category: "property" },
  
  // Financial
  { patterns: ["monthly.*rent", "rent.*amount", "base.*rent"], api_id: "monthly_rent", label: "Monthly Rent", type: "text", filled_by: "admin", category: "financial" },
  { patterns: ["security.*deposit", "damage.*deposit"], api_id: "security_deposit", label: "Security Deposit", type: "text", filled_by: "admin", category: "financial" },
  { patterns: ["late.*fee", "late.*charge"], api_id: "late_fee", label: "Late Fee", type: "text", filled_by: "admin", category: "financial" },
  { patterns: ["pet.*deposit"], api_id: "pet_deposit", label: "Pet Deposit", type: "text", filled_by: "admin", category: "financial" },
  
  // Dates
  { patterns: ["lease.*start", "start.*date", "commencement"], api_id: "lease_start_date", label: "Lease Start Date", type: "date", filled_by: "admin", category: "dates" },
  { patterns: ["lease.*end", "end.*date", "expiration"], api_id: "lease_end_date", label: "Lease End Date", type: "date", filled_by: "admin", category: "dates" },
  { patterns: ["move.*in.*date", "occupancy.*date"], api_id: "move_in_date", label: "Move-In Date", type: "date", filled_by: "admin", category: "dates" },
  { patterns: ["effective.*date"], api_id: "effective_date", label: "Effective Date", type: "date", filled_by: "admin", category: "dates" },
  
  // Tenant info (admin pre-fills)
  { patterns: ["tenant.*name", "lessee.*name", "renter.*name"], api_id: "tenant_name", label: "Tenant Name", type: "text", filled_by: "admin", category: "tenant" },
  { patterns: ["guest.*name"], api_id: "guest_name", label: "Guest Name", type: "text", filled_by: "admin", category: "tenant" },
  { patterns: ["tenant.*email"], api_id: "tenant_email", label: "Tenant Email", type: "email", filled_by: "admin", category: "tenant" },
  { patterns: ["tenant.*phone"], api_id: "tenant_phone", label: "Tenant Phone", type: "phone", filled_by: "admin", category: "tenant" },
  
  // Landlord info
  { patterns: ["landlord.*name", "lessor.*name", "owner.*name"], api_id: "landlord_name", label: "Landlord Name", type: "text", filled_by: "admin", category: "landlord" },
  { patterns: ["landlord.*address", "lessor.*address"], api_id: "landlord_address", label: "Landlord Address", type: "text", filled_by: "admin", category: "landlord" },
  { patterns: ["landlord.*phone"], api_id: "landlord_phone", label: "Landlord Phone", type: "phone", filled_by: "admin", category: "landlord" },
  { patterns: ["landlord.*email"], api_id: "landlord_email", label: "Landlord Email", type: "email", filled_by: "admin", category: "landlord" },
];

interface DetectedField {
  api_id: string;
  label: string;
  type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  filled_by: "admin" | "guest" | "tenant";
  category: string;
  required: boolean;
  description?: string;
  original_name?: string;
}

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
    const { 
      templateId, 
      forceReanalyze, 
      fileUrl, 
      detectTypeOnly,
      // New: Accept pre-extracted fields from client-side PDF.js
      extractedFields,
      textContent,
      totalPages: clientTotalPages,
      hasAcroForm: clientHasAcroForm
    } = await req.json();

    console.log("Analyzing document - templateId:", templateId, "hasExtractedFields:", !!extractedFields);

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

      // Check for cached field mappings (unless force re-analyze)
      if (!forceReanalyze && !detectTypeOnly && template.field_mappings && 
          Array.isArray(template.field_mappings) && template.field_mappings.length > 0) {
        console.log("Using cached field mappings:", template.field_mappings.length, "fields");
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

    // If we have pre-extracted fields from client-side PDF.js, use them directly
    // This is the preferred path - client extracts real coordinates, we just enhance semantics
    if (extractedFields && Array.isArray(extractedFields) && extractedFields.length > 0) {
      console.log("Using pre-extracted fields from client:", extractedFields.length);
      
      // Enhance fields with AI if needed for better semantic labeling
      const enhancedFields = await enhanceFieldsWithAI(extractedFields, textContent, LOVABLE_API_KEY);
      
      // Save to template
      if (template && !detectTypeOnly) {
        await supabase
          .from("document_templates")
          .update({ 
            field_mappings: enhancedFields,
            contract_type: detectDocumentType(textContent || ""),
          })
          .eq("id", templateId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          fields: enhancedFields,
          detected_contract_type: detectDocumentType(textContent || ""),
          totalPages: clientTotalPages,
          hasAcroForm: clientHasAcroForm,
          cached: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: Download and analyze document server-side
    if (!documentUrl) {
      throw new Error("No document URL provided");
    }

    const fileUrlFull = documentUrl.startsWith("http")
      ? documentUrl
      : `${SUPABASE_URL}/storage/v1/object/public/onboarding-documents/${documentUrl}`;

    console.log("Fetching document from:", fileUrlFull);

    const fileResponse = await fetch(fileUrlFull);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch document: ${fileResponse.status}`);
    }

    // Extract text content
    const fileBuffer = await fileResponse.arrayBuffer();
    let documentText = "";

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

    console.log("Document text length:", documentText.length);

    // Detect document type
    const detectedType = detectDocumentType(documentText);

    if (detectTypeOnly) {
      return new Response(
        JSON.stringify({
          success: true,
          detected_contract_type: detectedType,
          suggested_name: getSuggestedName(detectedType),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use AI to extract fields from document text
    const fields = await extractFieldsWithAI(documentText, detectedType, LOVABLE_API_KEY);

    // Update template if we have one
    if (template) {
      await supabase
        .from("document_templates")
        .update({ 
          field_mappings: fields,
          contract_type: detectedType,
        })
        .eq("id", templateId);
    }

    console.log(`Extracted ${fields.length} fields, type: ${detectedType}`);

    return new Response(
      JSON.stringify({
        success: true,
        detected_contract_type: detectedType,
        suggested_name: getSuggestedName(detectedType),
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

/**
 * Detect document type from content
 */
function detectDocumentType(text: string): string {
  const lower = text.toLowerCase();
  
  const patterns: Record<string, string[]> = {
    rental_agreement: ["residential lease", "lease agreement", "rental agreement", "tenant", "landlord", "monthly rent", "security deposit"],
    management_agreement: ["management agreement", "property management", "management fee", "owner agrees"],
    co_hosting: ["co-host", "cohost", "vacation rental management", "airbnb management"],
    innkeeper_agreement: ["innkeeper", "transient occupancy", "hotel", "lodging", "guest registration"],
    pet_policy: ["pet policy", "pet agreement", "pet deposit", "pet weight"],
    early_termination: ["early termination", "terminate agreement", "cancellation"],
    addendum: ["addendum", "amendment", "supplement to"],
  };

  let bestMatch = "other";
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(patterns)) {
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = type;
    }
  }

  return bestScore >= 2 ? bestMatch : "other";
}

/**
 * Get suggested name for document type
 */
function getSuggestedName(type: string): string {
  const names: Record<string, string> = {
    rental_agreement: "Residential Lease Agreement",
    management_agreement: "Property Management Agreement",
    co_hosting: "Co-Hosting Agreement",
    innkeeper_agreement: "Innkeeper Agreement",
    pet_policy: "Pet Policy Agreement",
    early_termination: "Early Termination Agreement",
    addendum: "Lease Addendum",
    other: "Document Template",
  };
  return names[type] || "Document Template";
}

/**
 * Enhance pre-extracted fields with better semantic labeling using AI
 */
async function enhanceFieldsWithAI(
  fields: DetectedField[], 
  textContent: string | undefined,
  apiKey: string
): Promise<DetectedField[]> {
  // For now, just apply local pattern matching to improve labels
  // This avoids unnecessary AI calls when client-side extraction is good
  return fields.map(field => {
    const enhanced = findBetterSemantics(field);
    return { ...field, ...enhanced };
  });
}

/**
 * Find better semantic info for a field
 */
function findBetterSemantics(field: DetectedField): Partial<DetectedField> {
  const fieldName = (field.original_name || field.api_id || "").toLowerCase();
  const label = (field.label || "").toLowerCase();
  const combined = `${fieldName} ${label}`;

  for (const semantic of FIELD_SEMANTICS) {
    for (const pattern of semantic.patterns) {
      const regex = new RegExp(pattern, "i");
      if (regex.test(combined)) {
        return {
          api_id: semantic.api_id,
          label: semantic.label,
          type: semantic.type as DetectedField["type"],
          filled_by: semantic.filled_by as DetectedField["filled_by"],
          category: semantic.category,
        };
      }
    }
  }

  return {};
}

/**
 * Extract fields using AI (fallback when no client-side extraction)
 */
async function extractFieldsWithAI(
  documentText: string, 
  documentType: string,
  apiKey: string
): Promise<DetectedField[]> {
  const prompt = `Analyze this ${documentType} document and extract all fillable fields.

DOCUMENT CONTENT:
${documentText.substring(0, 15000)}

FIELD ASSIGNMENT RULES:
1. ADMIN fills BEFORE sending: property address, landlord info, rent amounts, dates, fees, lease terms
2. TENANT/GUEST fills WHEN SIGNING: signatures, initials, signature dates, SSN, driver's license, DOB
3. All other tenant info (name, email, phone) is pre-filled by ADMIN from guest data

For each field return:
- api_id: snake_case identifier
- label: User-friendly label
- type: text/number/date/email/phone/textarea/checkbox/signature
- filled_by: admin/guest/tenant
- category: property/financial/dates/landlord/tenant/signature/other
- required: true/false
- page: estimated page number (1-based)
- x: horizontal position 0-100%
- y: vertical position 0-100%
- width: field width %
- height: field height %

Return ONLY valid JSON with a "fields" array.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a document analysis expert. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    
    // Parse JSON
    let jsonStr = content;
    if (jsonStr.includes("```json")) {
      jsonStr = jsonStr.split("```json")[1].split("```")[0];
    } else if (jsonStr.includes("```")) {
      jsonStr = jsonStr.split("```")[1].split("```")[0];
    }
    
    const parsed = JSON.parse(jsonStr.trim());
    const rawFields = parsed.fields || [];

    // Validate and sanitize fields
    const fields: DetectedField[] = rawFields.map((f: any, index: number) => ({
      api_id: String(f.api_id || `field_${index}`).replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
      label: String(f.label || f.api_id || "Field"),
      type: ["text", "number", "date", "email", "phone", "textarea", "checkbox", "signature"].includes(f.type) ? f.type : "text",
      page: Math.max(1, Math.min(20, Number(f.page) || 1)),
      x: Math.max(0, Math.min(95, Number(f.x) || 10)),
      y: Math.max(0, Math.min(95, Number(f.y) || 10 + index * 5)),
      width: Math.max(5, Math.min(80, Number(f.width) || 40)),
      height: Math.max(2, Math.min(15, Number(f.height) || 3)),
      filled_by: ["admin", "guest", "tenant"].includes(f.filled_by) ? f.filled_by : "admin",
      category: f.category || "other",
      required: f.required !== false,
      description: f.description || "",
    }));

    // Ensure essential signature fields exist
    ensureSignatureFields(fields, documentType);

    return fields;
  } catch (error) {
    console.error("AI extraction error:", error);
    // Return minimal default fields
    return getDefaultFields(documentType);
  }
}

/**
 * Ensure essential signature fields exist
 */
function ensureSignatureFields(fields: DetectedField[], documentType: string): void {
  const apiIds = new Set(fields.map(f => f.api_id));
  
  // Guest/tenant signature
  if (!apiIds.has("tenant_signature") && !apiIds.has("guest_signature") && !apiIds.has("owner_signature")) {
    const isLease = documentType === "rental_agreement";
    fields.push({
      api_id: isLease ? "tenant_signature" : "guest_signature",
      label: isLease ? "Tenant Signature" : "Guest Signature",
      type: "signature",
      page: 4,
      x: 10,
      y: 70,
      width: 35,
      height: 6,
      filled_by: isLease ? "tenant" : "guest",
      category: "signature",
      required: true,
    });
  }

  // Host/landlord signature
  if (!apiIds.has("landlord_signature") && !apiIds.has("host_signature")) {
    const isLease = documentType === "rental_agreement";
    fields.push({
      api_id: isLease ? "landlord_signature" : "host_signature",
      label: isLease ? "Landlord Signature" : "Host Signature",
      type: "signature",
      page: 4,
      x: 10,
      y: 85,
      width: 35,
      height: 6,
      filled_by: "admin",
      category: "signature",
      required: true,
    });
  }
}

/**
 * Get default fields for a document type
 */
function getDefaultFields(documentType: string): DetectedField[] {
  const isLease = documentType === "rental_agreement";
  
  return [
    {
      api_id: "property_address",
      label: "Property Address",
      type: "text",
      page: 1,
      x: 10,
      y: 20,
      width: 60,
      height: 3,
      filled_by: "admin",
      category: "property",
      required: true,
    },
    {
      api_id: isLease ? "tenant_name" : "guest_name",
      label: isLease ? "Tenant Name" : "Guest Name",
      type: "text",
      page: 1,
      x: 10,
      y: 30,
      width: 40,
      height: 3,
      filled_by: "admin",
      category: "tenant",
      required: true,
    },
    {
      api_id: isLease ? "tenant_signature" : "guest_signature",
      label: isLease ? "Tenant Signature" : "Guest Signature",
      type: "signature",
      page: 4,
      x: 10,
      y: 70,
      width: 35,
      height: 6,
      filled_by: isLease ? "tenant" : "guest",
      category: "signature",
      required: true,
    },
    {
      api_id: isLease ? "landlord_signature" : "host_signature",
      label: isLease ? "Landlord Signature" : "Host Signature",
      type: "signature",
      page: 4,
      x: 10,
      y: 85,
      width: 35,
      height: 6,
      filled_by: "admin",
      category: "signature",
      required: true,
    },
  ];
}
