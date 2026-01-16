import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Field extraction patterns for lease documents
const EXTRACTION_PATTERNS = {
  // Property Information
  property_address: [
    /(?:property|premises|rental|leased)\s*(?:address|location)?:?\s*([^\n,]+(?:,\s*[A-Z]{2}\s*\d{5})?)/i,
    /located\s+at:?\s*([^\n]+)/i,
    /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Boulevard|Blvd)[^\n,]*(?:,\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5})?)/i,
  ],
  county: [
    /(?:county|located in)\s*(?:of|in)?:?\s*([A-Za-z\s]+(?:County)?)/i,
  ],
  state: [
    /(?:state\s+of|in the state of)\s*([A-Za-z\s]+)/i,
    /,\s*([A-Z]{2})\s+\d{5}/,
  ],
  
  // Financial Terms
  monthly_rent: [
    /(?:monthly\s*)?rent(?:al)?(?:\s*amount)?:?\s*\$?([\d,]+(?:\.\d{2})?)/i,
    /\$([\d,]+(?:\.\d{2})?)\s*(?:per\s*month|monthly|\/month)/i,
    /rent\s*(?:of|is|:)\s*\$?([\d,]+(?:\.\d{2})?)/i,
  ],
  security_deposit: [
    /security\s*deposit:?\s*\$?([\d,]+(?:\.\d{2})?)/i,
    /deposit\s*(?:of|amount)?:?\s*\$?([\d,]+(?:\.\d{2})?)/i,
  ],
  cleaning_fee: [
    /cleaning\s*fee:?\s*\$?([\d,]+(?:\.\d{2})?)/i,
  ],
  admin_fee: [
    /admin(?:istration|istrative)?\s*fee:?\s*\$?([\d,]+(?:\.\d{2})?)/i,
  ],
  application_fee: [
    /application\s*fee:?\s*\$?([\d,]+(?:\.\d{2})?)/i,
  ],
  late_fee: [
    /late\s*(?:payment\s*)?fee:?\s*\$?([\d,]+(?:\.\d{2})?)/i,
    /late\s*charge:?\s*\$?([\d,]+(?:\.\d{2})?)/i,
  ],
  pet_fee: [
    /pet\s*(?:fee|deposit):?\s*\$?([\d,]+(?:\.\d{2})?)/i,
  ],
  
  // Dates
  lease_start_date: [
    /(?:lease|term)\s*(?:start|begin|commence)s?:?\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
    /(?:beginning|starting|from)\s*(?:on)?:?\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
    /check[\s-]*in\s*(?:date)?:?\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
  ],
  lease_end_date: [
    /(?:lease|term)\s*(?:end|expire)s?:?\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
    /(?:ending|through|until|to)\s*(?:on)?:?\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
    /check[\s-]*out\s*(?:date)?:?\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
  ],
  rent_due_day: [
    /rent\s*(?:is\s*)?due\s*(?:on\s*)?(?:the\s*)?(\d{1,2})(?:st|nd|rd|th)?/i,
    /(?:due\s*on|payable\s*on)\s*(?:the\s*)?(\d{1,2})(?:st|nd|rd|th)?/i,
  ],
  
  // Parties
  landlord_name: [
    /(?:landlord|lessor|owner|property\s*manager):?\s*([A-Za-z\s]+(?:LLC|Inc|Corp|Company)?)/i,
    /(?:managed\s*by|PeachHaus|management\s*company):?\s*([A-Za-z\s]+(?:LLC|Inc)?)/i,
  ],
  tenant_name: [
    /(?:tenant|lessee|renter|resident)s?:?\s*([A-Za-z\s,]+)(?=\s*(?:and|,|\(|$))/i,
  ],
  occupants: [
    /(?:occupant|resident)s?:?\s*([A-Za-z\s,]+)/i,
    /(?:additional\s*)?(?:occupant|resident)s?\s*(?:include|are)?:?\s*([A-Za-z\s,]+)/i,
  ],
  
  // Bank/Payment Info
  escrow_bank: [
    /(?:escrow|bank|deposit\s*account):?\s*([A-Za-z\s]+(?:Bank|Credit\s*Union)?[^,\n]*)/i,
  ],
  
  // Property Details
  bedrooms: [
    /(\d+)\s*(?:bed(?:room)?s?|BR)/i,
  ],
  bathrooms: [
    /(\d+(?:\.\d)?)\s*(?:bath(?:room)?s?|BA)/i,
  ],
};

// Use AI to extract structured data from document text
async function extractWithAI(
  documentText: string, 
  apiKey: string
): Promise<Record<string, string>> {
  const systemPrompt = `You are a document data extraction specialist. Extract all fillable field values from this lease/rental agreement.

Return ONLY a JSON object with the extracted data. Use these field names:
- property_address: Full property address
- county: County name
- state: State name
- monthly_rent: Monthly rent amount (include $ if present)
- security_deposit: Security deposit amount
- cleaning_fee: Cleaning fee if any
- admin_fee: Admin fee if any
- application_fee: Application fee if any
- late_fee: Late payment fee
- pet_fee: Pet fee/deposit if any
- lease_start_date: Lease start date
- lease_end_date: Lease end date
- rent_due_day: Day of month rent is due
- landlord_name: Landlord/management company name
- tenant_name: Tenant name(s)
- occupants: List of occupants
- escrow_bank: Bank name for deposits
- bedrooms: Number of bedrooms
- bathrooms: Number of bathrooms
- check_in_time: Check-in time if specified
- check_out_time: Check-out time if specified
- total_rent: Total rent for lease term
- utilities_included: Which utilities are included
- parking_info: Parking details
- pet_policy: Pet policy details

Only include fields that have actual values in the document. Do not guess or make up values.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extract all field values from this lease agreement:\n\n${documentText.substring(0, 15000)}` }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("AI extraction failed:", response.status);
      return {};
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("Failed to parse AI response:", e);
      }
    }
  } catch (error) {
    console.error("AI extraction error:", error);
  }
  
  return {};
}

// Regex-based extraction as fallback
function extractWithPatterns(documentText: string): Record<string, string> {
  const extracted: Record<string, string> = {};
  
  for (const [fieldName, patterns] of Object.entries(EXTRACTION_PATTERNS)) {
    for (const pattern of patterns) {
      const match = documentText.match(pattern);
      if (match && match[1]) {
        extracted[fieldName] = match[1].trim();
        break;
      }
    }
  }
  
  return extracted;
}

// Extract text from DOCX
async function extractDocxText(blob: Blob): Promise<string> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) {
      throw new Error("No document.xml found in DOCX");
    }
    
    // Extract text from XML
    const textContent = docXml
      .replace(/<w:p[^>]*>/g, "\n")
      .replace(/<w:tab[^>]*>/g, "\t")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();
    
    return textContent;
  } catch (error) {
    console.error("DOCX extraction error:", error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const fileUrl = formData.get("fileUrl") as string | null;

    if (!file && !fileUrl) {
      return new Response(
        JSON.stringify({ error: "No file or fileUrl provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let documentText = "";
    let fileName = file?.name || fileUrl || "document";

    // Get file content
    let fileBlob: Blob;
    if (file) {
      fileBlob = file;
    } else if (fileUrl) {
      // Handle Supabase storage URL
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (fileUrl.includes("supabase") || fileUrl.startsWith("/")) {
        const supabase = createClient(supabaseUrl!, supabaseKey!);
        const { data, error } = await supabase.storage
          .from("documents")
          .download(fileUrl.replace(/^\//, ""));
        
        if (error) throw error;
        fileBlob = data;
      } else {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Failed to fetch file from URL");
        fileBlob = await response.blob();
      }
    } else {
      throw new Error("No file content available");
    }

    // Extract text based on file type
    const fileType = fileName.toLowerCase();
    if (fileType.endsWith(".docx")) {
      documentText = await extractDocxText(fileBlob);
    } else if (fileType.endsWith(".txt")) {
      documentText = await fileBlob.text();
    } else if (fileType.endsWith(".pdf")) {
      // For PDF, we'll just send to AI for extraction
      // In a full implementation, you'd use a PDF parsing library
      documentText = await fileBlob.text();
    } else {
      // Try to read as text
      documentText = await fileBlob.text();
    }

    console.log(`Extracting data from: ${fileName}, text length: ${documentText.length}`);

    // Extract data using both methods
    const patternExtracted = extractWithPatterns(documentText);
    const aiExtracted = await extractWithAI(documentText, LOVABLE_API_KEY);

    // Merge results, preferring AI extraction
    const extractedData: Record<string, string> = {
      ...patternExtracted,
      ...aiExtracted,
    };

    // Clean up extracted values
    for (const [key, value] of Object.entries(extractedData)) {
      if (typeof value === "string") {
        extractedData[key] = value.trim().replace(/\s+/g, " ");
      }
    }

    // Map to common field aliases
    const fieldMappings: Record<string, string[]> = {
      property_address: ["address", "rental_address", "listing_address", "premises_address"],
      monthly_rent: ["rent", "rent_amount", "rental_amount"],
      lease_start_date: ["start_date", "lease_start", "check_in_date", "move_in_date"],
      lease_end_date: ["end_date", "lease_end", "check_out_date", "move_out_date"],
      landlord_name: ["host_name", "management_company", "property_manager", "agent_name"],
      tenant_name: ["guest_name", "renter_name", "occupant_name"],
      security_deposit: ["deposit", "deposit_amount"],
      late_fee: ["late_charge", "late_payment_fee"],
    };

    // Add aliases
    const finalData: Record<string, string> = { ...extractedData };
    for (const [primary, aliases] of Object.entries(fieldMappings)) {
      if (extractedData[primary]) {
        for (const alias of aliases) {
          if (!finalData[alias]) {
            finalData[alias] = extractedData[primary];
          }
        }
      }
    }

    console.log("Extracted fields:", Object.keys(finalData).length);

    return new Response(
      JSON.stringify({
        success: true,
        extractedData: finalData,
        fileName,
        fieldsExtracted: Object.keys(finalData).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Extract lease data error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
