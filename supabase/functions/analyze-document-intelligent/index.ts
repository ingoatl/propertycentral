import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lease-specific field assignment patterns
const LEASE_TENANT_PATTERNS = [
  'tenant', 'lessee', 'renter', 'occupant', 'applicant', 'resident',
  'co_tenant', 'cotenant', 'co-tenant', 'additional_tenant',
  'emergency_contact', 'vehicle', 'car', 'license_plate', 'auto',
  'pet_name', 'pet_breed', 'pet_weight', 'pet_description', 'animal',
  'employer', 'employment', 'income', 'references', 'reference',
  'social_security', 'ssn', 'driver_license', 'dl_number',
  'bank_name', 'account_number', 'routing_number',
  'move_in_condition', 'inventory', 'personal_property'
];

const LEASE_ADMIN_PATTERNS = [
  'landlord', 'lessor', 'owner', 'agent', 'property_manager', 'management',
  'premises', 'property_address', 'unit', 'apartment', 'suite',
  'lease_start', 'lease_end', 'term', 'commencement', 'expiration',
  'rent', 'deposit', 'fee', 'payment', 'amount', 'price', 'rate',
  'utility', 'utilities', 'parking', 'amenity', 'amenities',
  'rules', 'policy', 'policies', 'regulations', 'terms',
  'late_fee', 'penalty', 'notice_period', 'renewal'
];

// Document type configurations with signing party mappings - now includes "tenant" role
const DOCUMENT_TYPE_CONFIG: Record<string, {
  label: string;
  signingParties: Array<{ role: string; filled_by: "admin" | "guest" | "tenant"; description: string }>;
  commonFields: Array<{ api_id: string; label: string; type: string; filled_by: "admin" | "guest" | "tenant"; category: string }>;
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
  // Enhanced rental/lease agreement with proper tenant/admin split
  rental_agreement: {
    label: "Residential Lease Agreement",
    signingParties: [
      { role: "Tenant", filled_by: "tenant", description: "The tenant/renter who will occupy the property" },
      { role: "Co-Tenant", filled_by: "tenant", description: "Additional tenant(s)" },
      { role: "Landlord", filled_by: "admin", description: "The landlord/property manager" }
    ],
    commonFields: [
      // TENANT fills these
      { api_id: "tenant_name", label: "Tenant Name", type: "text", filled_by: "tenant", category: "contact" },
      { api_id: "tenant_email", label: "Tenant Email", type: "email", filled_by: "tenant", category: "contact" },
      { api_id: "tenant_phone", label: "Tenant Phone", type: "phone", filled_by: "tenant", category: "contact" },
      { api_id: "tenant_address", label: "Tenant Current Address", type: "text", filled_by: "tenant", category: "contact" },
      { api_id: "tenant_ssn", label: "Tenant SSN", type: "text", filled_by: "tenant", category: "identification" },
      { api_id: "tenant_dl", label: "Driver License", type: "text", filled_by: "tenant", category: "identification" },
      { api_id: "employer_name", label: "Employer Name", type: "text", filled_by: "tenant", category: "contact" },
      { api_id: "employer_phone", label: "Employer Phone", type: "phone", filled_by: "tenant", category: "contact" },
      { api_id: "monthly_income", label: "Monthly Income", type: "text", filled_by: "tenant", category: "financial" },
      { api_id: "co_tenant_name", label: "Co-Tenant Name", type: "text", filled_by: "tenant", category: "contact" },
      { api_id: "occupant_names", label: "Occupant Names", type: "text", filled_by: "tenant", category: "occupancy" },
      { api_id: "num_occupants", label: "Number of Occupants", type: "text", filled_by: "tenant", category: "occupancy" },
      { api_id: "vehicle_make", label: "Vehicle Make", type: "text", filled_by: "tenant", category: "vehicle" },
      { api_id: "vehicle_model", label: "Vehicle Model", type: "text", filled_by: "tenant", category: "vehicle" },
      { api_id: "vehicle_year", label: "Vehicle Year", type: "text", filled_by: "tenant", category: "vehicle" },
      { api_id: "vehicle_color", label: "Vehicle Color", type: "text", filled_by: "tenant", category: "vehicle" },
      { api_id: "license_plate", label: "License Plate", type: "text", filled_by: "tenant", category: "vehicle" },
      { api_id: "emergency_contact_name", label: "Emergency Contact Name", type: "text", filled_by: "tenant", category: "emergency" },
      { api_id: "emergency_contact_phone", label: "Emergency Contact Phone", type: "phone", filled_by: "tenant", category: "emergency" },
      { api_id: "emergency_contact_relationship", label: "Emergency Contact Relationship", type: "text", filled_by: "tenant", category: "emergency" },
      { api_id: "pet_type", label: "Pet Type", type: "text", filled_by: "tenant", category: "other" },
      { api_id: "pet_breed", label: "Pet Breed", type: "text", filled_by: "tenant", category: "other" },
      { api_id: "pet_weight", label: "Pet Weight", type: "text", filled_by: "tenant", category: "other" },
      { api_id: "tenant_signature", label: "Tenant Signature", type: "signature", filled_by: "tenant", category: "signature" },
      { api_id: "tenant_signature_date", label: "Tenant Signature Date", type: "date", filled_by: "tenant", category: "signature" },
      { api_id: "co_tenant_signature", label: "Co-Tenant Signature", type: "signature", filled_by: "tenant", category: "signature" },
      // ADMIN/LANDLORD fills these
      { api_id: "property_address", label: "Property Address", type: "text", filled_by: "admin", category: "property" },
      { api_id: "unit_number", label: "Unit Number", type: "text", filled_by: "admin", category: "property" },
      { api_id: "city", label: "City", type: "text", filled_by: "admin", category: "property" },
      { api_id: "state", label: "State", type: "text", filled_by: "admin", category: "property" },
      { api_id: "zip_code", label: "Zip Code", type: "text", filled_by: "admin", category: "property" },
      { api_id: "lease_start_date", label: "Lease Start Date", type: "date", filled_by: "admin", category: "dates" },
      { api_id: "lease_end_date", label: "Lease End Date", type: "date", filled_by: "admin", category: "dates" },
      { api_id: "move_in_date", label: "Move-In Date", type: "date", filled_by: "admin", category: "dates" },
      { api_id: "monthly_rent", label: "Monthly Rent", type: "text", filled_by: "admin", category: "financial" },
      { api_id: "security_deposit", label: "Security Deposit", type: "text", filled_by: "admin", category: "financial" },
      { api_id: "pet_deposit", label: "Pet Deposit", type: "text", filled_by: "admin", category: "financial" },
      { api_id: "late_fee", label: "Late Fee", type: "text", filled_by: "admin", category: "financial" },
      { api_id: "rent_due_day", label: "Rent Due Day", type: "text", filled_by: "admin", category: "financial" },
      { api_id: "parking_space", label: "Parking Space", type: "text", filled_by: "admin", category: "property" },
      { api_id: "landlord_name", label: "Landlord Name", type: "text", filled_by: "admin", category: "contact" },
      { api_id: "landlord_address", label: "Landlord Address", type: "text", filled_by: "admin", category: "contact" },
      { api_id: "landlord_phone", label: "Landlord Phone", type: "phone", filled_by: "admin", category: "contact" },
      { api_id: "landlord_signature", label: "Landlord Signature", type: "signature", filled_by: "admin", category: "signature" },
      { api_id: "landlord_signature_date", label: "Landlord Signature Date", type: "date", filled_by: "admin", category: "signature" },
    ]
  },
  // Alias for residential_lease
  residential_lease: {
    label: "Residential Lease Agreement",
    signingParties: [
      { role: "Tenant", filled_by: "tenant", description: "The tenant/renter who will occupy the property" },
      { role: "Co-Tenant", filled_by: "tenant", description: "Additional tenant(s)" },
      { role: "Landlord", filled_by: "admin", description: "The landlord/property manager" }
    ],
    commonFields: [] // Will use rental_agreement config
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

// Enhanced lease detection keywords
const LEASE_KEYWORDS = [
  "residential lease", "lease agreement", "rental agreement", "tenancy agreement",
  "tenant", "landlord", "lessor", "lessee", "renter",
  "monthly rent", "security deposit", "premises", "leased premises",
  "lease term", "rental period", "rent due", "rent payment",
  "eviction", "late fee", "lease violation", "notice to vacate",
  "move-in", "move-out", "occupant", "occupancy",
  "georgia residential", "ga lease", "apartment lease", "house rental"
];

// Research document type using Firecrawl
async function researchDocumentType(documentText: string, firecrawlApiKey: string, fileName?: string): Promise<{
  documentType: string;
  context: string;
  signingParties: string[];
  commonFieldsContext: string;
  isLeaseDocument: boolean;
}> {
  const lowerText = documentText.toLowerCase();
  const lowerFileName = (fileName || "").toLowerCase().replace(/[_-]/g, ' ').replace(/\.(pdf|doc|docx)$/i, '');
  
  // Check for lease/rental agreement first with high priority
  const leaseScore = LEASE_KEYWORDS.reduce((score, keyword) => {
    if (lowerFileName.includes(keyword)) return score + 5; // Filename match is strong
    if (lowerText.includes(keyword)) return score + 1;
    return score;
  }, 0);
  
  const isLeaseDocument = leaseScore >= 3 || 
    lowerFileName.includes('lease') || 
    lowerFileName.includes('rental') ||
    lowerFileName.includes('tenant') ||
    lowerText.includes('residential lease agreement') ||
    lowerText.includes('rental agreement') ||
    (lowerText.includes('tenant') && lowerText.includes('landlord'));
  
  console.log(`Lease detection: score=${leaseScore}, isLease=${isLeaseDocument}, fileName="${fileName}"`);

  // Document type detection with lease priority
  const docTypeKeywords = [
    { type: "rental_agreement", keywords: ["lease agreement", "residential lease", "tenant", "landlord", "monthly rent", "security deposit", "rental period", "rental agreement", "tenancy", "lessee", "lessor"] },
    { type: "innkeeper_agreement", keywords: ["innkeeper", "transient occupancy", "hotel", "lodging", "guest registration", "room rental"] },
    { type: "management_agreement", keywords: ["property management", "management fee", "owner agrees", "manager shall", "exclusive right to manage", "management agreement"] },
    { type: "co_hosting", keywords: ["co-host", "cohost", "co hosting", "cohosting", "airbnb management", "vacation rental management", "host services", "co-hosting agreement"] },
    { type: "pet_policy", keywords: ["pet policy", "pet agreement", "pet deposit", "pet weight", "animal policy"] },
    { type: "early_termination", keywords: ["early termination", "terminate agreement", "cancellation", "early end"] },
    { type: "addendum", keywords: ["addendum", "amendment", "supplement to", "in addition to"] },
  ];

  // If lease document, return immediately
  if (isLeaseDocument) {
    const config = DOCUMENT_TYPE_CONFIG.rental_agreement;
    return {
      documentType: "rental_agreement",
      context: "",
      signingParties: config.signingParties.map(p => p.role),
      commonFieldsContext: config.commonFields.map(f => `${f.label} (${f.filled_by})`).join(", "),
      isLeaseDocument: true
    };
  }

  let detectedType = "other";
  let maxScore = 0;
  
  // Check filename first with high priority
  for (const { type, keywords } of docTypeKeywords) {
    let score = 0;
    for (const kw of keywords) {
      if (lowerFileName.includes(kw)) {
        score += 3;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      detectedType = type;
    }
  }
  
  // If filename didn't give confident match, check document text
  if (maxScore < 3) {
    for (const { type, keywords } of docTypeKeywords) {
      const textScore = keywords.filter(kw => lowerText.includes(kw)).length;
      if (textScore > maxScore) {
        maxScore = textScore;
        detectedType = type;
      }
    }
  }
  
  console.log(`Document type detection: filename="${fileName}", detected="${detectedType}", score=${maxScore}`);

  let context = "";
  let signingParties: string[] = [];
  let commonFieldsContext = "";

  // Web research for unclear documents
  if (maxScore < 2 && firecrawlApiKey) {
    console.log("Document type unclear, performing web research...");
    try {
      const lines = documentText.split('\n').filter(l => l.trim().length > 0).slice(0, 5);
      const potentialTitle = lines.find(l => l.length < 100 && l.length > 5) || "property agreement";
      const searchQuery = `"${potentialTitle}" legal document fields who signs`;
      
      const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${firecrawlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: searchQuery, limit: 3 }),
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
          context = searchData.data.map((r: any) => r.description || r.title || "").join("\n");
        }
      }
    } catch (error) {
      console.error("Web research failed:", error);
    }
  }

  const config = DOCUMENT_TYPE_CONFIG[detectedType];
  if (config) {
    signingParties = config.signingParties.map(p => p.role);
    commonFieldsContext = config.commonFields.map(f => `${f.label} (${f.filled_by})`).join(", ");
  } else {
    signingParties = ["Owner/Guest", "Manager/Host"];
    commonFieldsContext = "name, email, phone, address, signature, date";
  }

  return {
    documentType: detectedType,
    context,
    signingParties,
    commonFieldsContext,
    isLeaseDocument: false
  };
}

// Apply intelligent field assignment based on document type
function applyIntelligentFieldAssignment(
  fields: any[], 
  documentType: string, 
  isLeaseDocument: boolean
): any[] {
  return fields.map(field => {
    const apiIdLower = (field.api_id || '').toLowerCase();
    const labelLower = (field.label || '').toLowerCase();
    
    // For lease documents, use tenant patterns
    if (isLeaseDocument || documentType === 'rental_agreement' || documentType === 'residential_lease') {
      // Check tenant patterns
      const isTenantField = LEASE_TENANT_PATTERNS.some(pattern => 
        apiIdLower.includes(pattern) || labelLower.includes(pattern)
      );
      
      // Check admin/landlord patterns
      const isAdminField = LEASE_ADMIN_PATTERNS.some(pattern => 
        apiIdLower.includes(pattern) || labelLower.includes(pattern)
      );
      
      if (isTenantField && !isAdminField) {
        return { ...field, filled_by: 'tenant' };
      }
      if (isAdminField && !isTenantField) {
        return { ...field, filled_by: 'admin' };
      }
      
      // For signature fields in leases
      if (field.type === 'signature' || apiIdLower.includes('signature')) {
        if (apiIdLower.includes('tenant') || apiIdLower.includes('lessee') || apiIdLower.includes('renter')) {
          return { ...field, filled_by: 'tenant' };
        }
        if (apiIdLower.includes('landlord') || apiIdLower.includes('lessor') || apiIdLower.includes('owner') || apiIdLower.includes('agent')) {
          return { ...field, filled_by: 'admin' };
        }
      }
      
      // Default unclear fields in lease to tenant (they're the ones filling most info)
      return { ...field, filled_by: field.filled_by || 'tenant' };
    }
    
    return field;
  });
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
    const { templateId, fileUrl, textPositions, totalPages, forceReanalyze, existingContractType, mergeWithExisting, existingFields, fileName } = await req.json();

    console.log("Intelligent document analysis - templateId:", templateId, "totalPages:", totalPages);

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

    // Build document text from text positions
    if (textPositions && Array.isArray(textPositions)) {
      documentText = textPositions.map((t: any) => t.text).join("\n");
    }

    console.log("Document text length:", documentText.length);

    // Step 1: Research document type with enhanced lease detection
    const templateName = template?.name || fileName || "";
    const research = await researchDocumentType(documentText, FIRECRAWL_API_KEY || "", templateName);
    console.log("Research result:", {
      documentType: research.documentType,
      signingParties: research.signingParties,
      isLeaseDocument: research.isLeaseDocument,
    });

    // Get document config
    const docConfig = DOCUMENT_TYPE_CONFIG[research.documentType] || DOCUMENT_TYPE_CONFIG.rental_agreement;

    // Step 2: Process document in chunks
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
      
      // Build signing context based on document type
      const signingContext = docConfig.signingParties
        .map(p => `- "${p.role}" (filled_by: "${p.filled_by}"): ${p.description}`)
        .join("\n");

      const commonFieldsHint = docConfig.commonFields
        .slice(0, 15) // Limit to avoid too long prompts
        .map(f => `- ${f.api_id}: ${f.label} (${f.type}, filled_by: ${f.filled_by})`)
        .join("\n");

      // Enhanced system prompt for lease documents
      const leaseSpecificInstructions = research.isLeaseDocument ? `
CRITICAL LEASE DOCUMENT RULES:
This is a RESIDENTIAL LEASE AGREEMENT. There are TWO signing parties:
1. TENANT (filled_by: "tenant") - The renter/lessee who will occupy the property
2. LANDLORD (filled_by: "admin") - The property owner/manager

TENANT FILLS (filled_by: "tenant"):
- Tenant name, email, phone, current address
- Social security number, driver's license
- Employment information (employer, income)
- Co-tenant/occupant information
- Vehicle information (make, model, license plate)
- Emergency contact information
- Pet information (if applicable)
- Tenant signature and date

LANDLORD/ADMIN FILLS (filled_by: "admin"):
- Property address, unit number, city, state, zip
- Lease start date, end date, move-in date
- Monthly rent amount, security deposit
- Late fees, pet deposit, other fees
- Parking space assignments
- Landlord name, address, phone
- Landlord/Agent signature and date
- Rules, policies, terms` : '';

      const systemPrompt = `You are an expert document analyzer specializing in property management, rental, and hospitality agreements.

DOCUMENT TYPE DETECTED: ${research.documentType} (${docConfig.label})
DOCUMENT NAME: ${templateName || 'Unknown'}
${research.isLeaseDocument ? '\n*** THIS IS A LEASE/RENTAL AGREEMENT ***\n' : ''}
${leaseSpecificInstructions}

SIGNING PARTIES FOR THIS DOCUMENT TYPE:
${signingContext}

COMMON FIELDS FOR THIS DOCUMENT TYPE:
${commonFieldsHint}

CRITICAL RULES:
1. Identify ALL fillable fields including blanks, lines, checkboxes, and signature blocks
2. For LEASE documents, use "tenant" for tenant fields and "admin" for landlord fields
3. For other documents, use "guest" for the signing party and "admin" for management
4. Ensure signatures and dates are paired correctly
5. Use standardized api_id names (snake_case)

FIELD SIZE GUIDELINES:
- Text fields: height 2.0-2.5
- Date fields: width 20-25, height 2.0-2.5
- Signature fields: width 30-40, height 3.5-4.5
- Address fields: width 50-60, height 2.0-2.5`;

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

IMPORTANT: For lease documents, carefully distinguish between TENANT fields (filled_by: "tenant") and LANDLORD fields (filled_by: "admin").`;

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
              model: "google/gemini-3-flash-preview",
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
                        document_type: { type: "string" },
                        suggested_name: { type: "string" },
                        signing_parties: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              role: { type: "string" },
                              filled_by: { type: "string", enum: ["admin", "guest", "tenant"] }
                            },
                            required: ["role", "filled_by"]
                          }
                        },
                        fields: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              api_id: { type: "string" },
                              label: { type: "string" },
                              type: { type: "string", enum: ["text", "date", "email", "phone", "signature", "checkbox", "radio", "textarea"] },
                              page: { type: "number" },
                              x: { type: "number" },
                              y: { type: "number" },
                              width: { type: "number" },
                              height: { type: "number" },
                              filled_by: { type: "string", enum: ["admin", "guest", "tenant"] },
                              required: { type: "boolean" },
                              category: { type: "string", enum: ["property", "financial", "dates", "occupancy", "contact", "identification", "vehicle", "emergency", "signature", "other"] },
                              group_name: { type: "string" }
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
          
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall && toolCall.function?.arguments) {
            const args = JSON.parse(toolCall.function.arguments);
            if (args.fields && Array.isArray(args.fields)) {
              for (const field of args.fields) {
                let fieldHeight = 2.2;
                if (field.type === 'signature') {
                  fieldHeight = Math.max(3.5, Math.min(4.5, Number(field.height) || 4));
                } else if (field.type === 'textarea') {
                  fieldHeight = Math.max(4, Math.min(8, Number(field.height) || 5));
                } else {
                  fieldHeight = Math.max(1.8, Math.min(2.8, Number(field.height) || 2.2));
                }
                
                allFields.push({
                  api_id: String(field.api_id || 'field').replace(/[^a-z0-9_]/gi, '_').toLowerCase(),
                  label: String(field.label || field.api_id),
                  type: validateFieldType(field.type),
                  page: Math.max(1, Math.min(totalPages || 20, Number(field.page) || chunkPages)),
                  x: Math.max(0, Math.min(95, Number(field.x) || 20)),
                  y: Math.max(0, Math.min(95, Number(field.y) || 50)),
                  width: Math.max(5, Math.min(60, Number(field.width) || 35)),
                  height: fieldHeight,
                  filled_by: ["admin", "guest", "tenant"].includes(field.filled_by) ? field.filled_by : "tenant",
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
        }
      }
    }

    // Deduplicate fields
    const uniqueFields = new Map();
    for (const field of allFields) {
      if (!uniqueFields.has(field.api_id)) {
        uniqueFields.set(field.api_id, field);
      }
    }
    let finalFields = Array.from(uniqueFields.values());

    // Apply intelligent field assignment based on document type
    finalFields = applyIntelligentFieldAssignment(finalFields, research.documentType, research.isLeaseDocument);

    // Ensure essential signature fields exist
    const hasTenantSignature = finalFields.some(f => 
      f.api_id.includes('tenant_signature') || 
      f.api_id.includes('lessee_signature') ||
      f.api_id.includes('renter_signature')
    );
    const hasGuestSignature = finalFields.some(f => 
      f.api_id.includes('owner_signature') || 
      f.api_id.includes('guest_signature')
    );
    const hasAdminSignature = finalFields.some(f => 
      f.api_id.includes('manager_signature') || 
      f.api_id.includes('host_signature') ||
      f.api_id.includes('landlord_signature')
    );

    // Add missing signatures based on document type
    if (research.isLeaseDocument) {
      if (!hasTenantSignature) {
        finalFields.push({
          api_id: 'tenant_signature',
          label: 'Tenant Signature',
          type: 'signature',
          filled_by: 'tenant',
          category: 'signature',
          page: totalPages || 1,
          x: 10,
          y: 75,
          width: 35,
          height: 4,
          required: true
        });
        finalFields.push({
          api_id: 'tenant_signature_date',
          label: 'Tenant Signature Date',
          type: 'date',
          filled_by: 'tenant',
          category: 'signature',
          page: totalPages || 1,
          x: 50,
          y: 75,
          width: 25,
          height: 2.5,
          required: true
        });
      }
      if (!hasAdminSignature) {
        finalFields.push({
          api_id: 'landlord_signature',
          label: 'Landlord Signature',
          type: 'signature',
          filled_by: 'admin',
          category: 'signature',
          page: totalPages || 1,
          x: 10,
          y: 85,
          width: 35,
          height: 4,
          required: true
        });
        finalFields.push({
          api_id: 'landlord_signature_date',
          label: 'Landlord Signature Date',
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
    } else {
      // For non-lease documents
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
        }
      }
    }

    console.log(`Total unique fields extracted: ${finalFields.length}`);
    
    // Log field distribution
    const tenantCount = finalFields.filter(f => f.filled_by === 'tenant').length;
    const adminCount = finalFields.filter(f => f.filled_by === 'admin').length;
    const guestCount = finalFields.filter(f => f.filled_by === 'guest').length;
    console.log(`Field distribution: Tenant=${tenantCount}, Admin=${adminCount}, Guest=${guestCount}`);

    // Update template
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
        is_lease_document: research.isLeaseDocument,
        cached: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in intelligent document analysis:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function validateFieldType(type: string): string {
  const validTypes = ["text", "date", "email", "phone", "signature", "checkbox", "radio", "textarea"];
  return validTypes.includes(type) ? type : "text";
}
