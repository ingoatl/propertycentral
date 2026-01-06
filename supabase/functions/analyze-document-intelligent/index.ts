import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Document type configurations with signing party mappings
const DOCUMENT_TYPE_CONFIG: Record<string, {
  label: string;
  signingParties: Array<{ role: string; filled_by: "admin" | "guest"; description: string }>;
  commonFields: Array<{ api_id: string; label: string; type: string; filled_by: "admin" | "guest"; category: string }>;
}> = {
  innkeeper_agreement: {
    label: "Innkeeper Agreement",
    signingParties: [
      { role: "Guest", filled_by: "guest", description: "The guest staying at the property" },
      { role: "Host/Manager", filled_by: "admin", description: "The property host or manager" }
    ],
    commonFields: [
      { api_id: "guest_name", label: "Guest Name", type: "text", filled_by: "guest", category: "contact" },
      { api_id: "guest_email", label: "Guest Email", type: "email", filled_by: "guest", category: "contact" },
      { api_id: "guest_phone", label: "Guest Phone", type: "phone", filled_by: "guest", category: "contact" },
      { api_id: "guest_address", label: "Guest Address", type: "text", filled_by: "guest", category: "contact" },
      { api_id: "check_in_date", label: "Check-In Date", type: "date", filled_by: "admin", category: "dates" },
      { api_id: "check_out_date", label: "Check-Out Date", type: "date", filled_by: "admin", category: "dates" },
      { api_id: "property_address", label: "Property Address", type: "text", filled_by: "admin", category: "property" },
      { api_id: "nightly_rate", label: "Nightly Rate", type: "text", filled_by: "admin", category: "financial" },
      { api_id: "total_amount", label: "Total Amount", type: "text", filled_by: "admin", category: "financial" },
      { api_id: "guest_signature", label: "Guest Signature", type: "signature", filled_by: "guest", category: "signature" },
      { api_id: "guest_signature_date", label: "Guest Signature Date", type: "date", filled_by: "guest", category: "signature" },
      { api_id: "host_signature", label: "Host Signature", type: "signature", filled_by: "admin", category: "signature" },
      { api_id: "host_signature_date", label: "Host Signature Date", type: "date", filled_by: "admin", category: "signature" },
    ]
  },
  management_agreement: {
    label: "Management Agreement",
    signingParties: [
      { role: "Owner", filled_by: "guest", description: "The property owner" },
      { role: "Manager", filled_by: "admin", description: "The property manager" }
    ],
    commonFields: [
      { api_id: "owner_name", label: "Owner Name", type: "text", filled_by: "guest", category: "contact" },
      { api_id: "owner_email", label: "Owner Email", type: "email", filled_by: "guest", category: "contact" },
      { api_id: "owner_phone", label: "Owner Phone", type: "phone", filled_by: "guest", category: "contact" },
      { api_id: "owner_address", label: "Owner Address", type: "text", filled_by: "guest", category: "contact" },
      { api_id: "property_address", label: "Property Address", type: "text", filled_by: "guest", category: "property" },
      { api_id: "effective_date", label: "Effective Date", type: "date", filled_by: "admin", category: "dates" },
      { api_id: "management_fee", label: "Management Fee", type: "text", filled_by: "admin", category: "financial" },
      { api_id: "owner_signature", label: "Owner Signature", type: "signature", filled_by: "guest", category: "signature" },
      { api_id: "owner_signature_date", label: "Owner Signature Date", type: "date", filled_by: "guest", category: "signature" },
      { api_id: "manager_signature", label: "Manager Signature", type: "signature", filled_by: "admin", category: "signature" },
      { api_id: "manager_signature_date", label: "Manager Signature Date", type: "date", filled_by: "admin", category: "signature" },
    ]
  },
  co_hosting: {
    label: "Co-Hosting Agreement",
    signingParties: [
      { role: "Owner", filled_by: "guest", description: "The property owner" },
      { role: "Co-Host", filled_by: "admin", description: "The co-host/manager" }
    ],
    commonFields: [
      { api_id: "owner_name", label: "Owner Name", type: "text", filled_by: "guest", category: "contact" },
      { api_id: "owner_email", label: "Owner Email", type: "email", filled_by: "guest", category: "contact" },
      { api_id: "owner_phone", label: "Owner Phone", type: "phone", filled_by: "guest", category: "contact" },
      { api_id: "owner_address", label: "Owner Address", type: "text", filled_by: "guest", category: "contact" },
      { api_id: "property_address", label: "Property Address", type: "text", filled_by: "guest", category: "property" },
      { api_id: "effective_date", label: "Effective Date", type: "date", filled_by: "admin", category: "dates" },
      { api_id: "owner_signature", label: "Owner Signature", type: "signature", filled_by: "guest", category: "signature" },
      { api_id: "owner_signature_date", label: "Owner Signature Date", type: "date", filled_by: "guest", category: "signature" },
      { api_id: "manager_signature", label: "Manager Signature", type: "signature", filled_by: "admin", category: "signature" },
      { api_id: "manager_signature_date", label: "Manager Signature Date", type: "date", filled_by: "admin", category: "signature" },
    ]
  },
  rental_agreement: {
    label: "Rental Agreement",
    signingParties: [
      { role: "Tenant", filled_by: "guest", description: "The tenant/renter" },
      { role: "Landlord", filled_by: "admin", description: "The landlord/property manager" }
    ],
    commonFields: [
      { api_id: "tenant_name", label: "Tenant Name", type: "text", filled_by: "guest", category: "contact" },
      { api_id: "tenant_email", label: "Tenant Email", type: "email", filled_by: "guest", category: "contact" },
      { api_id: "tenant_phone", label: "Tenant Phone", type: "phone", filled_by: "guest", category: "contact" },
      { api_id: "property_address", label: "Property Address", type: "text", filled_by: "admin", category: "property" },
      { api_id: "lease_start_date", label: "Lease Start Date", type: "date", filled_by: "admin", category: "dates" },
      { api_id: "lease_end_date", label: "Lease End Date", type: "date", filled_by: "admin", category: "dates" },
      { api_id: "monthly_rent", label: "Monthly Rent", type: "text", filled_by: "admin", category: "financial" },
      { api_id: "security_deposit", label: "Security Deposit", type: "text", filled_by: "admin", category: "financial" },
      { api_id: "tenant_signature", label: "Tenant Signature", type: "signature", filled_by: "guest", category: "signature" },
      { api_id: "tenant_signature_date", label: "Tenant Signature Date", type: "date", filled_by: "guest", category: "signature" },
      { api_id: "landlord_signature", label: "Landlord Signature", type: "signature", filled_by: "admin", category: "signature" },
      { api_id: "landlord_signature_date", label: "Landlord Signature Date", type: "date", filled_by: "admin", category: "signature" },
    ]
  },
  pet_policy: {
    label: "Pet Policy Agreement",
    signingParties: [
      { role: "Pet Owner/Guest", filled_by: "guest", description: "The guest with a pet" },
      { role: "Host", filled_by: "admin", description: "The property host" }
    ],
    commonFields: [
      { api_id: "guest_name", label: "Guest Name", type: "text", filled_by: "guest", category: "contact" },
      { api_id: "pet_name", label: "Pet Name", type: "text", filled_by: "guest", category: "other" },
      { api_id: "pet_breed", label: "Pet Breed", type: "text", filled_by: "guest", category: "other" },
      { api_id: "pet_weight", label: "Pet Weight", type: "text", filled_by: "guest", category: "other" },
      { api_id: "pet_deposit", label: "Pet Deposit", type: "text", filled_by: "admin", category: "financial" },
      { api_id: "guest_signature", label: "Guest Signature", type: "signature", filled_by: "guest", category: "signature" },
      { api_id: "guest_signature_date", label: "Guest Signature Date", type: "date", filled_by: "guest", category: "signature" },
    ]
  }
};

// Research document type using Firecrawl
async function researchDocumentType(documentText: string, firecrawlApiKey: string): Promise<{
  documentType: string;
  context: string;
  signingParties: string[];
  commonFieldsContext: string;
}> {
  // First, identify what type of document this might be
  const docTypeKeywords = [
    { type: "innkeeper_agreement", keywords: ["innkeeper", "transient occupancy", "hotel", "lodging", "guest registration", "room rental"] },
    { type: "management_agreement", keywords: ["property management", "management fee", "owner agrees", "manager shall", "exclusive right to manage"] },
    { type: "co_hosting", keywords: ["co-host", "cohost", "airbnb management", "vacation rental management", "host services"] },
    { type: "rental_agreement", keywords: ["lease agreement", "tenant", "landlord", "monthly rent", "security deposit", "rental period"] },
    { type: "pet_policy", keywords: ["pet policy", "pet agreement", "pet deposit", "pet weight", "animal policy"] },
    { type: "early_termination", keywords: ["early termination", "terminate agreement", "cancellation", "early end"] },
    { type: "addendum", keywords: ["addendum", "amendment", "supplement to", "in addition to"] },
  ];

  const lowerText = documentText.toLowerCase();
  let detectedType = "other";
  let maxScore = 0;

  for (const { type, keywords } of docTypeKeywords) {
    const score = keywords.filter(kw => lowerText.includes(kw)).length;
    if (score > maxScore) {
      maxScore = score;
      detectedType = type;
    }
  }

  // If we couldn't confidently detect the type, use web research
  let context = "";
  let signingParties: string[] = [];
  let commonFieldsContext = "";

  if (maxScore < 2 && firecrawlApiKey) {
    console.log("Document type unclear, performing web research...");

    try {
      // Extract potential document title from first few lines
      const lines = documentText.split('\n').filter(l => l.trim().length > 0).slice(0, 5);
      const potentialTitle = lines.find(l => l.length < 100 && l.length > 5) || "property agreement";

      // Search for document type information
      const searchQuery = `"${potentialTitle}" legal document fields who signs`;
      
      const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${firecrawlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 3,
        }),
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
          context = searchData.data.map((r: any) => r.description || r.title || "").join("\n");
          console.log("Web research context:", context.substring(0, 500));
        }
      }
    } catch (error) {
      console.error("Web research failed:", error);
    }
  }

  // Get signing parties based on detected type
  const config = DOCUMENT_TYPE_CONFIG[detectedType];
  if (config) {
    signingParties = config.signingParties.map(p => p.role);
    commonFieldsContext = config.commonFields.map(f => `${f.label} (${f.filled_by})`).join(", ");
  } else {
    // Default for unknown documents - assume owner/manager structure
    signingParties = ["Owner/Guest", "Manager/Host"];
    commonFieldsContext = "name, email, phone, address, signature, date";
  }

  return {
    documentType: detectedType,
    context,
    signingParties,
    commonFieldsContext
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { templateId, fileUrl, textPositions, totalPages, forceReanalyze, existingContractType, mergeWithExisting, existingFields } = await req.json();

    console.log("Intelligent document analysis - templateId:", templateId, "totalPages:", totalPages, "mergeWithExisting:", mergeWithExisting);

    let documentText = "";
    let template = null;

    // Fetch template if ID provided
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

      // Check cache unless force re-analyze
      if (!forceReanalyze && template.field_mappings && Array.isArray(template.field_mappings) && template.field_mappings.length > 0) {
        console.log("Using cached field mappings");
        return new Response(
          JSON.stringify({
            success: true,
            fields: template.field_mappings,
            document_type: template.contract_type,
            cached: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Use existing contract type if provided (for better context in re-analysis)
    const knownContractType = existingContractType || template?.contract_type;

    // Build document text from text positions
    if (textPositions && Array.isArray(textPositions)) {
      documentText = textPositions.map((t: any) => t.text).join("\n");
    }

    console.log("Document text length:", documentText.length);
    console.log("Document preview:", documentText.substring(0, 500));

    // Step 1: Research document type with web search if needed
    const research = await researchDocumentType(documentText, FIRECRAWL_API_KEY || "");
    console.log("Research result:", {
      documentType: research.documentType,
      signingParties: research.signingParties,
    });

    // Get document config or use defaults
    const docConfig = DOCUMENT_TYPE_CONFIG[research.documentType] || {
      label: "Document",
      signingParties: [
        { role: "Primary Signer", filled_by: "guest", description: "The primary signer" },
        { role: "Secondary Signer", filled_by: "admin", description: "The secondary signer" }
      ],
      commonFields: []
    };

    // Step 2: Use AI with tool calling for structured field extraction
    // Process in chunks for large documents
    const maxChunkSize = 15000;
    const chunks: string[] = [];
    
    for (let i = 0; i < documentText.length; i += maxChunkSize) {
      chunks.push(documentText.substring(i, i + maxChunkSize));
    }

    console.log(`Processing ${chunks.length} chunk(s) of document`);

    const allFields: any[] = [];
    let retryCount = 0;
    const maxRetries = 3;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const chunkPages = Math.ceil((chunkIndex + 1) * (totalPages || 1) / chunks.length);
      
      // Build context-aware prompt
      const signingContext = docConfig.signingParties
        .map(p => `- "${p.role}" (filled_by: "${p.filled_by}"): ${p.description}`)
        .join("\n");

      const commonFieldsHint = docConfig.commonFields
        .map(f => `- ${f.api_id}: ${f.label} (${f.type}, filled_by: ${f.filled_by})`)
        .join("\n");

      const systemPrompt = `You are an expert document analyzer specializing in property management, rental, and hospitality agreements.

DOCUMENT TYPE DETECTED: ${research.documentType} (${docConfig.label})
${research.context ? `\nWEB RESEARCH CONTEXT:\n${research.context}` : ''}

SIGNING PARTIES FOR THIS DOCUMENT TYPE:
${signingContext}

COMMON FIELDS FOR THIS DOCUMENT TYPE:
${commonFieldsHint}

CRITICAL RULES:
1. Identify ALL fillable fields in the document including blanks, lines, checkboxes, and signature blocks
2. Assign filled_by based on WHO should fill it:
   - "guest" = the person signing/receiving the document (owner for management agreements, tenant for rental, guest for innkeeper)
   - "admin" = the property manager/host (you, the company)
3. Ensure signatures and dates are paired correctly
4. Use standardized api_id names (snake_case)
5. The page number should be within the document's actual page count`;

      const userPrompt = `Analyze this document section and extract ALL fillable fields.

DOCUMENT SECTION (Chunk ${chunkIndex + 1}/${chunks.length}):
${chunk}

TOTAL PAGES: ${totalPages || 1}
APPROXIMATE PAGE FOR THIS SECTION: ${chunkPages}

Extract fields using the extract_document_fields function. Include:
- All text blanks (name, address, phone, email fields)
- All date fields
- All signature lines
- All checkboxes or radio buttons
- Package selection options (if applicable)

Return accurate field positions relative to the page layout.`;

      let success = false;
      while (!success && retryCount < maxRetries) {
        try {
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "extract_document_fields",
                    description: "Extract and return all detected fillable fields from the document",
                    parameters: {
                      type: "object",
                      properties: {
                        document_type: {
                          type: "string",
                          description: "The type of document detected"
                        },
                        suggested_name: {
                          type: "string",
                          description: "A suggested name for this template"
                        },
                        signing_parties: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              role: { type: "string" },
                              filled_by: { type: "string", enum: ["admin", "guest"] }
                            },
                            required: ["role", "filled_by"]
                          }
                        },
                        fields: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              api_id: { type: "string", description: "Unique field identifier in snake_case" },
                              label: { type: "string", description: "Human-readable label" },
                              type: { type: "string", enum: ["text", "date", "email", "phone", "signature", "checkbox", "radio", "textarea"] },
                              page: { type: "number", description: "Page number (1-indexed)" },
                              x: { type: "number", description: "X position as percentage (0-100)" },
                              y: { type: "number", description: "Y position as percentage (0-100)" },
                              width: { type: "number", description: "Width as percentage (0-100)" },
                              height: { type: "number", description: "Height as percentage (0-100)" },
                              filled_by: { type: "string", enum: ["admin", "guest"] },
                              required: { type: "boolean" },
                              category: { type: "string", enum: ["property", "financial", "dates", "occupancy", "contact", "identification", "signature", "other"] },
                              group_name: { type: "string", description: "For radio buttons, the group name" }
                            },
                            required: ["api_id", "label", "type", "filled_by", "required"]
                          }
                        }
                      },
                      required: ["fields"]
                    }
                  }
                }
              ],
              tool_choice: { type: "function", function: { name: "extract_document_fields" } },
            }),
          });

          if (!response.ok) {
            if (response.status === 429) {
              console.log("Rate limited, waiting...");
              await new Promise(resolve => setTimeout(resolve, 2000));
              retryCount++;
              continue;
            }
            throw new Error(`AI API error: ${response.status}`);
          }

          const aiData = await response.json();
          
          // Extract tool call result
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall && toolCall.function?.arguments) {
            const args = JSON.parse(toolCall.function.arguments);
            if (args.fields && Array.isArray(args.fields)) {
              // Add fields with proper defaults
              for (const field of args.fields) {
                allFields.push({
                  api_id: String(field.api_id || 'field').replace(/[^a-z0-9_]/gi, '_').toLowerCase(),
                  label: String(field.label || field.api_id),
                  type: validateFieldType(field.type),
                  page: Math.max(1, Math.min(totalPages || 20, Number(field.page) || chunkPages)),
                  x: Math.max(0, Math.min(95, Number(field.x) || 20)),
                  y: Math.max(0, Math.min(95, Number(field.y) || 50)),
                  width: Math.max(5, Math.min(60, Number(field.width) || 35)),
                  height: field.type === 'signature' 
                    ? Math.min(4, Number(field.height) || 4)
                    : Math.min(3, Number(field.height) || 2.5),
                  filled_by: field.filled_by === "admin" ? "admin" : "guest",
                  required: field.required !== false,
                  category: field.category || "other",
                  ...(field.group_name && { group_name: String(field.group_name) }),
                });
              }
              console.log(`Extracted ${args.fields.length} fields from chunk ${chunkIndex + 1}`);
            }
          }
          
          success = true;
        } catch (error) {
          console.error(`Error processing chunk ${chunkIndex + 1}:`, error);
          retryCount++;
          if (retryCount >= maxRetries) {
            console.log("Max retries reached, using fallback fields");
          }
        }
      }
    }

    // Deduplicate fields by api_id
    const uniqueFields = new Map();
    for (const field of allFields) {
      if (!uniqueFields.has(field.api_id)) {
        uniqueFields.set(field.api_id, field);
      }
    }
    let finalFields = Array.from(uniqueFields.values());

    // Ensure we have essential signature fields
    const hasGuestSignature = finalFields.some(f => 
      f.api_id.includes('owner_signature') || 
      f.api_id.includes('guest_signature') ||
      f.api_id.includes('tenant_signature')
    );
    const hasAdminSignature = finalFields.some(f => 
      f.api_id.includes('manager_signature') || 
      f.api_id.includes('host_signature') ||
      f.api_id.includes('landlord_signature')
    );

    // Add missing essential signatures based on document type
    if (!hasGuestSignature) {
      const guestSigField = docConfig.commonFields.find(f => f.type === 'signature' && f.filled_by === 'guest');
      if (guestSigField) {
        finalFields.push({
          ...guestSigField,
          page: totalPages || 1,
          x: 10,
          y: 75,
          width: 35,
          height: 4,
          required: true
        });
        finalFields.push({
          api_id: guestSigField.api_id.replace('_signature', '_signature_date'),
          label: guestSigField.label.replace('Signature', 'Signature Date'),
          type: 'date',
          filled_by: 'guest',
          category: 'signature',
          page: totalPages || 1,
          x: 50,
          y: 75,
          width: 25,
          height: 2.5,
          required: true
        });
      }
    }

    if (!hasAdminSignature) {
      const adminSigField = docConfig.commonFields.find(f => f.type === 'signature' && f.filled_by === 'admin');
      if (adminSigField) {
        finalFields.push({
          ...adminSigField,
          page: totalPages || 1,
          x: 10,
          y: 85,
          width: 35,
          height: 4,
          required: true
        });
        finalFields.push({
          api_id: adminSigField.api_id.replace('_signature', '_signature_date'),
          label: adminSigField.label.replace('Signature', 'Signature Date'),
          type: 'date',
          filled_by: 'admin',
          category: 'signature',
          page: totalPages || 1,
          x: 50,
          y: 85,
          width: 25,
          height: 2.5,
          required: true
        });
      }
    }

    console.log(`Total unique fields extracted: ${finalFields.length}`);

    // Update template if we have one
    if (template && finalFields.length > 0) {
      const { error: updateError } = await supabase
        .from("document_templates")
        .update({ 
          field_mappings: finalFields,
          contract_type: research.documentType !== 'other' ? research.documentType : template.contract_type,
        })
        .eq("id", templateId);

      if (updateError) {
        console.error("Error updating template:", updateError);
      } else {
        console.log("Saved field mappings to template");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_type: research.documentType,
        document_type_label: docConfig.label,
        signing_parties: docConfig.signingParties,
        fields: finalFields,
        total_pages: totalPages,
        web_research_used: !!research.context,
        cached: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in intelligent document analysis:", error);
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

function validateFieldType(type: string): string {
  const validTypes = ["text", "date", "email", "phone", "signature", "checkbox", "radio", "textarea"];
  return validTypes.includes(type) ? type : "text";
}
