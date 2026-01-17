import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Common field patterns for extraction
const EXTRACTION_PATTERNS: Record<string, RegExp[]> = {
  // Tenant Info
  tenant_name: [
    /(?:tenant|lessee|renter|guest)(?:'s)?\s*(?:name|full name)?[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*(?:hereinafter|herein|\(the\s+"?tenant)/gi,
  ],
  tenant_email: [
    /(?:tenant|lessee|renter|guest)(?:'s)?\s*email[\s:]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /email[\s:]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
  ],
  tenant_phone: [
    /(?:tenant|lessee|renter|guest)(?:'s)?\s*(?:phone|tel|telephone)[\s:]+(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/gi,
    /(?:phone|tel|telephone)[\s:]+(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/gi,
  ],

  // Property Info
  property_address: [
    /(?:property|rental|premises|located at)[\s:]+(\d+[^,\n]+(?:,\s*[^,\n]+){1,3})/gi,
    /(\d+\s+[A-Za-z]+(?:\s+[A-Za-z]+)*(?:\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Boulevard|Blvd))[^,\n]*(?:,\s*[A-Za-z\s]+)?(?:,\s*[A-Z]{2})?(?:\s+\d{5})?)/gi,
  ],
  
  // Financial
  monthly_rent: [
    /monthly\s*rent[\s:of]*\$?([\d,]+(?:\.\d{2})?)/gi,
    /rent\s*(?:shall be|is|of)[\s:]*\$?([\d,]+(?:\.\d{2})?)\s*(?:per month|monthly|\/month)/gi,
    /\$?([\d,]+(?:\.\d{2})?)\s*(?:per month|monthly|\/month)/gi,
  ],
  security_deposit: [
    /security\s*deposit[\s:of]*\$?([\d,]+(?:\.\d{2})?)/gi,
    /deposit[\s:of]*\$?([\d,]+(?:\.\d{2})?)/gi,
  ],
  late_fee: [
    /late\s*(?:fee|charge|penalty)[\s:of]*\$?([\d,]+(?:\.\d{2})?)/gi,
  ],
  cleaning_fee: [
    /cleaning\s*(?:fee|charge)[\s:of]*\$?([\d,]+(?:\.\d{2})?)/gi,
  ],

  // Dates
  lease_start_date: [
    /(?:lease\s*)?(?:start|begin(?:ning)?|commence(?:ment)?)\s*date[\s:]+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
    /(?:from|starting|beginning)\s*(?:on\s*)?([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
  ],
  lease_end_date: [
    /(?:lease\s*)?(?:end|termination|expir(?:ation|e))\s*date[\s:]+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
    /(?:to|until|ending)\s*(?:on\s*)?([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
  ],
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
    
    // Handle form data (file upload) or JSON (URL)
    let documentText = "";
    let fileName = "";

    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      
      if (!file) {
        throw new Error("No file provided");
      }
      
      fileName = file.name;
      const fileBuffer = await file.arrayBuffer();
      
      // Handle DOCX files
      if (fileName.toLowerCase().endsWith(".docx")) {
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
      } else if (fileName.toLowerCase().endsWith(".pdf")) {
        // For PDF, we'll use AI to extract text
        documentText = new TextDecoder().decode(fileBuffer);
      } else {
        // Plain text
        documentText = new TextDecoder().decode(fileBuffer);
      }
    } else {
      // JSON body with URL
      const { fileUrl } = await req.json();
      
      if (!fileUrl) {
        throw new Error("No file URL provided");
      }
      
      // Download the file
      const fileUrlFull = fileUrl.startsWith("http")
        ? fileUrl
        : `${SUPABASE_URL}/storage/v1/object/public/onboarding-documents/${fileUrl}`;
      
      const fileResponse = await fetch(fileUrlFull);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch document: ${fileResponse.status}`);
      }
      
      const fileBuffer = await fileResponse.arrayBuffer();
      fileName = fileUrl.split("/").pop() || "document";
      
      // Handle DOCX files
      if (fileName.toLowerCase().endsWith(".docx")) {
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
    }

    console.log("Extracted document text length:", documentText.length);
    console.log("Document preview:", documentText.substring(0, 300));

    // First try regex extraction
    const regexExtracted: Record<string, string> = {};
    
    for (const [fieldId, patterns] of Object.entries(EXTRACTION_PATTERNS)) {
      for (const pattern of patterns) {
        const match = pattern.exec(documentText);
        if (match && match[1]) {
          regexExtracted[fieldId] = match[1].trim();
          break;
        }
        // Reset regex lastIndex
        pattern.lastIndex = 0;
      }
    }

    console.log("Regex extracted fields:", Object.keys(regexExtracted).length);

    // Use AI for comprehensive extraction
    const aiPrompt = `Extract all filled-in values from this lease/rental agreement document.

DOCUMENT CONTENT:
${documentText.substring(0, 15000)}

Extract the following information if present (use the exact field names as keys):

TENANT INFORMATION:
- tenant_name: Full legal name of tenant/guest
- tenant_email: Tenant's email address
- tenant_phone: Tenant's phone number
- tenant_address: Tenant's current/previous address
- tenant_ssn: Social Security Number (partial OK)
- tenant_dob: Date of birth
- tenant_dl: Driver's license number
- occupant_count: Number of occupants

PROPERTY INFORMATION:
- property_address: Full street address of rental
- property_name: Property name if given
- unit_number: Apartment/unit number
- city: City
- county: County
- state: State
- zip_code: ZIP code
- bedrooms: Number of bedrooms
- bathrooms: Number of bathrooms

FINANCIAL TERMS:
- monthly_rent: Monthly rent amount
- security_deposit: Security deposit amount
- late_fee: Late fee amount
- cleaning_fee: Cleaning fee
- pet_deposit: Pet deposit
- pet_rent: Monthly pet rent
- application_fee: Application fee
- admin_fee: Admin/processing fee
- total_due: Total move-in amount

LEASE DATES:
- lease_start_date: Lease start date
- lease_end_date: Lease end date
- move_in_date: Move-in date
- rent_due_day: Day of month rent is due
- grace_period: Grace period in days

LANDLORD/MANAGEMENT:
- landlord_name: Landlord or management company name
- landlord_address: Landlord address
- landlord_phone: Landlord phone
- landlord_email: Landlord email

VEHICLE INFO:
- vehicle_make: Vehicle make
- vehicle_model: Vehicle model
- vehicle_year: Vehicle year
- vehicle_plate: License plate number

EMERGENCY CONTACT:
- emergency_name: Emergency contact name
- emergency_phone: Emergency contact phone
- emergency_relationship: Relationship to tenant

Return ONLY a JSON object with the extracted values. Use null for fields not found.
Only include fields that have actual values in the document.

Example response:
{
  "tenant_name": "John Smith",
  "monthly_rent": "$2,500",
  "property_address": "123 Main St, Atlanta, GA 30301",
  "lease_start_date": "January 1, 2025",
  "landlord_name": "ABC Property Management"
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting data from legal documents. Extract all filled-in values and return them as JSON. Be precise and only return actual values found in the document.",
          },
          { role: "user", content: aiPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      // Fall back to regex extraction only
      return new Response(
        JSON.stringify({
          success: true,
          extractedData: regexExtracted,
          fieldsExtracted: Object.keys(regexExtracted).length,
          source: "regex",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let aiData;
    try {
      aiData = await aiResponse.json();
    } catch (jsonError) {
      console.error("Error parsing AI response:", jsonError);
      return new Response(
        JSON.stringify({
          success: true,
          extractedData: regexExtracted,
          fieldsExtracted: Object.keys(regexExtracted).length,
          source: "regex",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiContent = aiData.choices?.[0]?.message?.content || "{}";
    console.log("AI extraction response:", aiContent.substring(0, 500));

    let aiExtracted: Record<string, string> = {};
    try {
      let jsonStr = aiContent;
      if (jsonStr.includes("```json")) {
        jsonStr = jsonStr.split("```json")[1].split("```")[0];
      } else if (jsonStr.includes("```")) {
        jsonStr = jsonStr.split("```")[1].split("```")[0];
      }
      aiExtracted = JSON.parse(jsonStr.trim());
      
      // Remove null values
      for (const key of Object.keys(aiExtracted)) {
        if (aiExtracted[key] === null || aiExtracted[key] === "") {
          delete aiExtracted[key];
        }
      }
    } catch (parseError) {
      console.error("Error parsing AI extraction:", parseError);
    }

    // Merge results, preferring AI extraction
    const mergedData = { ...regexExtracted, ...aiExtracted };

    // Clean up values
    for (const key of Object.keys(mergedData)) {
      if (typeof mergedData[key] === "string") {
        mergedData[key] = mergedData[key].trim();
      }
    }

    console.log("Total extracted fields:", Object.keys(mergedData).length);
    console.log("Extracted data:", mergedData);

    return new Response(
      JSON.stringify({
        success: true,
        extractedData: mergedData,
        fieldsExtracted: Object.keys(mergedData).length,
        source: "ai+regex",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error extracting lease data:", error);
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
