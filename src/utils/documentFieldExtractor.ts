/**
 * Unified Document Field Extractor
 * 
 * This is the SINGLE SOURCE OF TRUTH for extracting fields from PDF documents.
 * It combines PDF.js for accurate coordinate extraction with semantic labeling.
 * 
 * Key principles:
 * 1. Extract REAL positions from PDF annotations (AcroForm) or text patterns
 * 2. Semantic labeling (api_id, label, filled_by) comes from pattern matching
 * 3. Never guess coordinates - use actual PDF data
 */

import * as pdfjs from 'pdfjs-dist';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// ===================== TYPES =====================

export interface ExtractedField {
  api_id: string;
  label: string;
  type: 'text' | 'date' | 'email' | 'phone' | 'signature' | 'checkbox' | 'radio' | 'textarea';
  page: number;
  x: number; // percentage from left
  y: number; // percentage from top
  width: number; // percentage
  height: number; // percentage
  filled_by: 'admin' | 'guest' | 'tenant';
  category: string;
  required: boolean;
  description?: string;
  group_name?: string;
  original_name?: string; // Original field name from PDF
}

export interface TextLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface ExtractionResult {
  fields: ExtractedField[];
  textLines: TextLine[];
  totalPages: number;
  hasAcroForm: boolean;
  documentType: string;
}

// ===================== FIELD PATTERNS =====================

// Patterns to identify field types and semantics from PDF field names or nearby text
const FIELD_SEMANTICS: Array<{
  patterns: RegExp[];
  api_id: string;
  label: string;
  type: ExtractedField['type'];
  filled_by: 'admin' | 'guest' | 'tenant';
  category: string;
  required?: boolean;
}> = [
  // === SIGNATURES (highest priority) ===
  { patterns: [/tenant.*(signature|sign)/i, /lessee.*(signature|sign)/i, /renter.*(signature|sign)/i], api_id: 'tenant_signature', label: 'Tenant Signature', type: 'signature', filled_by: 'tenant', category: 'signature', required: true },
  { patterns: [/guest.*(signature|sign)/i], api_id: 'guest_signature', label: 'Guest Signature', type: 'signature', filled_by: 'guest', category: 'signature', required: true },
  { patterns: [/landlord.*(signature|sign)/i, /lessor.*(signature|sign)/i, /owner.*(signature|sign)/i], api_id: 'landlord_signature', label: 'Landlord Signature', type: 'signature', filled_by: 'admin', category: 'signature', required: true },
  { patterns: [/host.*(signature|sign)/i, /manager.*(signature|sign)/i, /agent.*(signature|sign)/i], api_id: 'host_signature', label: 'Host Signature', type: 'signature', filled_by: 'admin', category: 'signature', required: true },
  { patterns: [/co.?tenant.*(signature|sign)/i, /second.*(signature|sign)/i], api_id: 'co_tenant_signature', label: 'Co-Tenant Signature', type: 'signature', filled_by: 'tenant', category: 'signature' },
  
  // === INITIALS ===
  { patterns: [/tenant.*initial/i, /lessee.*initial/i, /guest.*initial/i], api_id: 'tenant_initials', label: 'Tenant Initials', type: 'signature', filled_by: 'tenant', category: 'signature' },
  { patterns: [/landlord.*initial/i, /host.*initial/i, /manager.*initial/i], api_id: 'host_initials', label: 'Host Initials', type: 'signature', filled_by: 'admin', category: 'signature' },
  
  // === SIGNATURE DATES ===
  { patterns: [/tenant.*date/i, /lessee.*date/i, /date.*tenant/i, /date.*sign.*tenant/i], api_id: 'tenant_signature_date', label: 'Tenant Signature Date', type: 'date', filled_by: 'tenant', category: 'signature' },
  { patterns: [/landlord.*date/i, /host.*date/i, /date.*landlord/i, /date.*sign.*landlord/i], api_id: 'landlord_signature_date', label: 'Landlord Signature Date', type: 'date', filled_by: 'admin', category: 'signature' },
  { patterns: [/guest.*date/i, /date.*guest/i], api_id: 'guest_signature_date', label: 'Guest Signature Date', type: 'date', filled_by: 'guest', category: 'signature' },
  
  // === PROPERTY DETAILS (Admin fills) ===
  { patterns: [/property.*address/i, /rental.*address/i, /premises.*address/i, /^address$/i], api_id: 'property_address', label: 'Property Address', type: 'text', filled_by: 'admin', category: 'property', required: true },
  { patterns: [/unit.*number/i, /apt.*number/i, /apartment.*number/i, /^unit$/i, /^apt$/i], api_id: 'unit_number', label: 'Unit Number', type: 'text', filled_by: 'admin', category: 'property' },
  { patterns: [/^city$/i, /property.*city/i], api_id: 'city', label: 'City', type: 'text', filled_by: 'admin', category: 'property' },
  { patterns: [/^state$/i, /property.*state/i], api_id: 'state', label: 'State', type: 'text', filled_by: 'admin', category: 'property' },
  { patterns: [/^zip/i, /postal.*code/i], api_id: 'zip_code', label: 'ZIP Code', type: 'text', filled_by: 'admin', category: 'property' },
  { patterns: [/^county$/i, /property.*county/i], api_id: 'county', label: 'County', type: 'text', filled_by: 'admin', category: 'property' },
  { patterns: [/bedroom/i, /^beds$/i], api_id: 'bedrooms', label: 'Bedrooms', type: 'text', filled_by: 'admin', category: 'property' },
  { patterns: [/bathroom/i, /^baths$/i], api_id: 'bathrooms', label: 'Bathrooms', type: 'text', filled_by: 'admin', category: 'property' },
  { patterns: [/square.*feet/i, /sq.*ft/i, /sqft/i], api_id: 'square_feet', label: 'Square Feet', type: 'text', filled_by: 'admin', category: 'property' },
  
  // === FINANCIAL (Admin fills) ===
  { patterns: [/monthly.*rent/i, /rent.*amount/i, /base.*rent/i], api_id: 'monthly_rent', label: 'Monthly Rent', type: 'text', filled_by: 'admin', category: 'financial', required: true },
  { patterns: [/security.*deposit/i, /damage.*deposit/i], api_id: 'security_deposit', label: 'Security Deposit', type: 'text', filled_by: 'admin', category: 'financial', required: true },
  { patterns: [/late.*fee/i, /late.*charge/i], api_id: 'late_fee', label: 'Late Fee', type: 'text', filled_by: 'admin', category: 'financial' },
  { patterns: [/pet.*deposit/i, /pet.*fee/i], api_id: 'pet_deposit', label: 'Pet Deposit', type: 'text', filled_by: 'admin', category: 'financial' },
  { patterns: [/pet.*rent/i], api_id: 'pet_rent', label: 'Pet Rent', type: 'text', filled_by: 'admin', category: 'financial' },
  { patterns: [/application.*fee/i], api_id: 'application_fee', label: 'Application Fee', type: 'text', filled_by: 'admin', category: 'financial' },
  { patterns: [/cleaning.*fee/i], api_id: 'cleaning_fee', label: 'Cleaning Fee', type: 'text', filled_by: 'admin', category: 'financial' },
  { patterns: [/parking.*fee/i, /garage.*fee/i], api_id: 'parking_fee', label: 'Parking Fee', type: 'text', filled_by: 'admin', category: 'financial' },
  { patterns: [/prorated.*rent/i], api_id: 'prorated_rent', label: 'Prorated Rent', type: 'text', filled_by: 'admin', category: 'financial' },
  { patterns: [/total.*due/i, /total.*amount/i, /move.*in.*total/i], api_id: 'total_due', label: 'Total Due at Signing', type: 'text', filled_by: 'admin', category: 'financial' },
  { patterns: [/grace.*period/i], api_id: 'grace_period', label: 'Grace Period', type: 'text', filled_by: 'admin', category: 'financial' },
  
  // === DATES (Admin fills) ===
  { patterns: [/lease.*start/i, /start.*date/i, /commencement/i, /begin.*date/i], api_id: 'lease_start_date', label: 'Lease Start Date', type: 'date', filled_by: 'admin', category: 'dates', required: true },
  { patterns: [/lease.*end/i, /end.*date/i, /expiration/i, /termination.*date/i], api_id: 'lease_end_date', label: 'Lease End Date', type: 'date', filled_by: 'admin', category: 'dates', required: true },
  { patterns: [/move.*in.*date/i, /occupancy.*date/i], api_id: 'move_in_date', label: 'Move-In Date', type: 'date', filled_by: 'admin', category: 'dates' },
  { patterns: [/effective.*date/i, /agreement.*date/i], api_id: 'effective_date', label: 'Effective Date', type: 'date', filled_by: 'admin', category: 'dates' },
  { patterns: [/rent.*due/i, /due.*date/i, /payment.*due/i], api_id: 'rent_due_day', label: 'Rent Due Day', type: 'text', filled_by: 'admin', category: 'dates' },
  
  // === LANDLORD INFO (Admin fills) ===
  { patterns: [/landlord.*name/i, /lessor.*name/i, /owner.*name/i, /management.*company/i], api_id: 'landlord_name', label: 'Landlord Name', type: 'text', filled_by: 'admin', category: 'landlord' },
  { patterns: [/landlord.*address/i, /lessor.*address/i, /payment.*address/i], api_id: 'landlord_address', label: 'Landlord Address', type: 'text', filled_by: 'admin', category: 'landlord' },
  { patterns: [/landlord.*phone/i, /lessor.*phone/i, /office.*phone/i], api_id: 'landlord_phone', label: 'Landlord Phone', type: 'phone', filled_by: 'admin', category: 'landlord' },
  { patterns: [/landlord.*email/i, /lessor.*email/i, /office.*email/i], api_id: 'landlord_email', label: 'Landlord Email', type: 'email', filled_by: 'admin', category: 'landlord' },
  
  // === TENANT INFO (Admin pre-fills from guest data) ===
  { patterns: [/tenant.*name/i, /lessee.*name/i, /renter.*name/i], api_id: 'tenant_name', label: 'Tenant Name', type: 'text', filled_by: 'admin', category: 'tenant', required: true },
  { patterns: [/guest.*name/i], api_id: 'guest_name', label: 'Guest Name', type: 'text', filled_by: 'admin', category: 'tenant', required: true },
  { patterns: [/tenant.*email/i, /lessee.*email/i], api_id: 'tenant_email', label: 'Tenant Email', type: 'email', filled_by: 'admin', category: 'tenant' },
  { patterns: [/guest.*email/i], api_id: 'guest_email', label: 'Guest Email', type: 'email', filled_by: 'admin', category: 'tenant' },
  { patterns: [/tenant.*phone/i, /lessee.*phone/i], api_id: 'tenant_phone', label: 'Tenant Phone', type: 'phone', filled_by: 'admin', category: 'tenant' },
  { patterns: [/guest.*phone/i], api_id: 'guest_phone', label: 'Guest Phone', type: 'phone', filled_by: 'admin', category: 'tenant' },
  { patterns: [/tenant.*address/i, /current.*address/i, /previous.*address/i], api_id: 'tenant_current_address', label: 'Tenant Current Address', type: 'text', filled_by: 'admin', category: 'tenant' },
  
  // === TENANT FILLS PERSONALLY (Identification - sensitive) ===
  { patterns: [/social.*security/i, /ssn/i], api_id: 'tenant_ssn', label: 'Social Security Number', type: 'text', filled_by: 'tenant', category: 'identification' },
  { patterns: [/driver.*license/i, /dl.*number/i, /license.*number/i], api_id: 'tenant_drivers_license', label: 'Driver\'s License', type: 'text', filled_by: 'tenant', category: 'identification' },
  { patterns: [/date.*birth/i, /dob/i, /birthdate/i], api_id: 'tenant_dob', label: 'Date of Birth', type: 'date', filled_by: 'tenant', category: 'identification' },
  
  // === VEHICLE INFO (Tenant fills) ===
  { patterns: [/vehicle.*make/i, /car.*make/i, /auto.*make/i], api_id: 'vehicle_make', label: 'Vehicle Make', type: 'text', filled_by: 'tenant', category: 'vehicle' },
  { patterns: [/vehicle.*model/i, /car.*model/i, /auto.*model/i], api_id: 'vehicle_model', label: 'Vehicle Model', type: 'text', filled_by: 'tenant', category: 'vehicle' },
  { patterns: [/vehicle.*year/i, /car.*year/i], api_id: 'vehicle_year', label: 'Vehicle Year', type: 'text', filled_by: 'tenant', category: 'vehicle' },
  { patterns: [/vehicle.*color/i, /car.*color/i], api_id: 'vehicle_color', label: 'Vehicle Color', type: 'text', filled_by: 'tenant', category: 'vehicle' },
  { patterns: [/license.*plate/i, /plate.*number/i, /tag.*number/i], api_id: 'license_plate', label: 'License Plate', type: 'text', filled_by: 'tenant', category: 'vehicle' },
  
  // === EMERGENCY CONTACT (Tenant fills) ===
  { patterns: [/emergency.*name/i, /emergency.*contact.*name/i], api_id: 'emergency_contact_name', label: 'Emergency Contact Name', type: 'text', filled_by: 'tenant', category: 'emergency' },
  { patterns: [/emergency.*phone/i, /emergency.*contact.*phone/i], api_id: 'emergency_contact_phone', label: 'Emergency Contact Phone', type: 'phone', filled_by: 'tenant', category: 'emergency' },
  { patterns: [/emergency.*relationship/i, /emergency.*relation/i], api_id: 'emergency_contact_relationship', label: 'Relationship', type: 'text', filled_by: 'tenant', category: 'emergency' },
  
  // === EMPLOYMENT (Tenant fills) ===
  { patterns: [/employer.*name/i, /company.*name/i], api_id: 'employer_name', label: 'Employer Name', type: 'text', filled_by: 'tenant', category: 'employment' },
  { patterns: [/employer.*address/i, /work.*address/i], api_id: 'employer_address', label: 'Employer Address', type: 'text', filled_by: 'tenant', category: 'employment' },
  { patterns: [/employer.*phone/i, /work.*phone/i], api_id: 'employer_phone', label: 'Employer Phone', type: 'phone', filled_by: 'tenant', category: 'employment' },
  { patterns: [/monthly.*income/i, /gross.*income/i], api_id: 'monthly_income', label: 'Monthly Income', type: 'text', filled_by: 'tenant', category: 'employment' },
  
  // === OCCUPANCY (Admin fills) ===
  { patterns: [/num.*occupants/i, /number.*occupants/i, /total.*occupants/i], api_id: 'num_occupants', label: 'Number of Occupants', type: 'text', filled_by: 'admin', category: 'occupancy' },
  { patterns: [/occupant.*names/i, /names.*of.*occupants/i], api_id: 'occupant_names', label: 'Occupant Names', type: 'text', filled_by: 'admin', category: 'occupancy' },
  { patterns: [/co.*tenant.*name/i, /additional.*tenant/i, /second.*tenant/i], api_id: 'co_tenant_name', label: 'Co-Tenant Name', type: 'text', filled_by: 'admin', category: 'occupancy' },
  
  // === PET INFO ===
  { patterns: [/pet.*type/i, /pet.*species/i, /animal.*type/i], api_id: 'pet_type', label: 'Pet Type', type: 'text', filled_by: 'tenant', category: 'pets' },
  { patterns: [/pet.*name/i, /animal.*name/i], api_id: 'pet_name', label: 'Pet Name', type: 'text', filled_by: 'tenant', category: 'pets' },
  { patterns: [/pet.*breed/i, /animal.*breed/i], api_id: 'pet_breed', label: 'Pet Breed', type: 'text', filled_by: 'tenant', category: 'pets' },
  { patterns: [/pet.*weight/i, /animal.*weight/i], api_id: 'pet_weight', label: 'Pet Weight', type: 'text', filled_by: 'tenant', category: 'pets' },
  
  // === CHECKBOXES ===
  { patterns: [/15\s*%/i], api_id: 'package_15', label: '15% Package', type: 'checkbox', filled_by: 'admin', category: 'package' },
  { patterns: [/18\s*%/i], api_id: 'package_18', label: '18% Package', type: 'checkbox', filled_by: 'admin', category: 'package' },
  { patterns: [/20\s*%/i], api_id: 'package_20', label: '20% Package', type: 'checkbox', filled_by: 'admin', category: 'package' },
  { patterns: [/25\s*%/i], api_id: 'package_25', label: '25% Package', type: 'checkbox', filled_by: 'admin', category: 'package' },
];

// Text patterns that indicate fillable areas (underlines, checkboxes, etc)
const UNDERLINE_PATTERN = /_{4,}/;
const CHECKBOX_PATTERN = /[☐□◯○◻▢\[\]]/;

// ===================== MAIN EXTRACTION FUNCTION =====================

/**
 * Extract all fields from a PDF document
 * This is the main entry point - use this for all field extraction
 */
export async function extractDocumentFields(pdfUrl: string): Promise<ExtractionResult> {
  console.log('[DocumentFieldExtractor] Starting extraction from:', pdfUrl);
  
  const loadingTask = pdfjs.getDocument({
    url: pdfUrl,
    useSystemFonts: true,
  });
  
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  
  const fields: ExtractedField[] = [];
  const textLines: TextLine[] = [];
  let hasAcroForm = false;
  const usedApiIds = new Set<string>();
  
  // Process each page
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;
    
    // 1. Extract AcroForm annotations (actual form fields in PDF)
    const annotations = await page.getAnnotations();
    
    for (const annot of annotations) {
      if (annot.subtype === 'Widget' && annot.rect) {
        hasAcroForm = true;
        
        // Convert PDF coordinates to percentage positions
        const viewportRect = viewport.convertToViewportRectangle(annot.rect);
        const x1 = Math.min(viewportRect[0], viewportRect[2]);
        const y1 = Math.min(viewportRect[1], viewportRect[3]);
        const x2 = Math.max(viewportRect[0], viewportRect[2]);
        const y2 = Math.max(viewportRect[1], viewportRect[3]);
        
        const xPercent = (x1 / pageWidth) * 100;
        const yPercent = (y1 / pageHeight) * 100;
        const widthPercent = ((x2 - x1) / pageWidth) * 100;
        const heightPercent = ((y2 - y1) / pageHeight) * 100;
        
        // Determine field type from annotation
        let fieldType: ExtractedField['type'] = 'text';
        if (annot.fieldType === 'Sig') {
          fieldType = 'signature';
        } else if (annot.fieldType === 'Btn') {
          fieldType = annot.checkBox ? 'checkbox' : 'radio';
        } else if (annot.fieldType === 'Tx') {
          const name = (annot.fieldName || '').toLowerCase();
          if (name.includes('date')) fieldType = 'date';
          else if (name.includes('email')) fieldType = 'email';
          else if (name.includes('phone')) fieldType = 'phone';
        }
        
        // Get semantic info from field name
        const fieldName = annot.fieldName || '';
        const semantics = findFieldSemantics(fieldName, fieldType);
        
        // Generate unique api_id
        let apiId = semantics?.api_id || sanitizeApiId(fieldName) || `field_p${pageNum}_${fields.length}`;
        if (usedApiIds.has(apiId)) {
          apiId = `${apiId}_${pageNum}_${fields.length}`;
        }
        usedApiIds.add(apiId);
        
        fields.push({
          api_id: apiId,
          label: semantics?.label || humanizeFieldName(fieldName),
          type: semantics?.type || fieldType,
          page: pageNum,
          x: Math.max(0, Math.min(xPercent, 95)),
          y: Math.max(0, Math.min(yPercent, 95)),
          width: Math.max(5, Math.min(widthPercent, 80)),
          height: Math.max(2, Math.min(heightPercent, 15)),
          filled_by: semantics?.filled_by || 'admin',
          category: semantics?.category || 'other',
          required: semantics?.required || annot.required || false,
          original_name: fieldName,
          ...(annot.radioButton && { group_name: fieldName }),
        });
      }
    }
    
    // 2. Extract text content for pattern-based detection
    const textContent = await page.getTextContent();
    const pageTextItems: Array<{ text: string; x: number; y: number; width: number; height: number }> = [];
    
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        const tx = item.transform;
        const pdfX = tx[4];
        const pdfY = tx[5];
        const itemWidth = item.width || 50;
        const itemHeight = item.height || 12;
        
        const textRect = [pdfX, pdfY, pdfX + itemWidth, pdfY + itemHeight];
        const viewportRect = viewport.convertToViewportRectangle(textRect);
        
        const screenX = Math.min(viewportRect[0], viewportRect[2]);
        const screenY = Math.min(viewportRect[1], viewportRect[3]);
        const screenWidth = Math.abs(viewportRect[2] - viewportRect[0]);
        const screenHeight = Math.abs(viewportRect[3] - viewportRect[1]);
        
        pageTextItems.push({
          text: item.str,
          x: (screenX / pageWidth) * 100,
          y: (screenY / pageHeight) * 100,
          width: (screenWidth / pageWidth) * 100,
          height: (screenHeight / pageHeight) * 100,
        });
        
        textLines.push({
          text: item.str,
          x: (screenX / pageWidth) * 100,
          y: (screenY / pageHeight) * 100,
          width: (screenWidth / pageWidth) * 100,
          height: (screenHeight / pageHeight) * 100,
          page: pageNum,
        });
      }
    }
    
    // 3. If no AcroForm, detect fields from text patterns
    if (!hasAcroForm) {
      const patternFields = detectFieldsFromTextPatterns(pageTextItems, pageNum, usedApiIds);
      fields.push(...patternFields);
    }
  }
  
  // Determine document type
  const documentType = detectDocumentType(textLines);
  
  // Ensure we have essential signature fields
  ensureSignatureFields(fields, totalPages, usedApiIds, documentType);
  
  console.log(`[DocumentFieldExtractor] Extracted ${fields.length} fields from ${totalPages} pages, hasAcroForm: ${hasAcroForm}, type: ${documentType}`);
  
  return {
    fields,
    textLines,
    totalPages,
    hasAcroForm,
    documentType,
  };
}

// ===================== HELPER FUNCTIONS =====================

/**
 * Find semantic info for a field based on its name/context
 */
function findFieldSemantics(fieldName: string, fieldType?: ExtractedField['type']): (typeof FIELD_SEMANTICS)[number] | null {
  const normalized = fieldName.toLowerCase().replace(/[_\-\.]/g, ' ');
  
  for (const semantic of FIELD_SEMANTICS) {
    for (const pattern of semantic.patterns) {
      if (pattern.test(normalized) || pattern.test(fieldName)) {
        // If we know it's a signature type, prefer signature semantics
        if (fieldType === 'signature' && semantic.type !== 'signature') {
          continue;
        }
        return semantic;
      }
    }
  }
  
  return null;
}

/**
 * Convert PDF field name to a clean api_id
 */
function sanitizeApiId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
}

/**
 * Convert field name to human-readable label
 */
function humanizeFieldName(name: string): string {
  return name
    .replace(/[_\-\.]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim() || 'Field';
}

/**
 * Detect fields from text patterns (underlines, checkboxes, etc)
 */
function detectFieldsFromTextPatterns(
  textItems: Array<{ text: string; x: number; y: number; width: number; height: number }>,
  pageNum: number,
  usedApiIds: Set<string>
): ExtractedField[] {
  const fields: ExtractedField[] = [];
  
  // Sort by Y then X for line grouping
  const sorted = [...textItems].sort((a, b) => {
    const yDiff = a.y - b.y;
    return Math.abs(yDiff) < 1.5 ? a.x - b.x : yDiff;
  });
  
  // Group items by approximate line
  const lines: Array<{ items: typeof textItems; y: number }> = [];
  let currentLine: typeof textItems = [];
  let currentY = -100;
  
  for (const item of sorted) {
    if (Math.abs(item.y - currentY) > 2) {
      if (currentLine.length > 0) {
        lines.push({ items: currentLine, y: currentY });
      }
      currentLine = [item];
      currentY = item.y;
    } else {
      currentLine.push(item);
    }
  }
  if (currentLine.length > 0) {
    lines.push({ items: currentLine, y: currentY });
  }
  
  // Analyze each line for fillable patterns
  for (const line of lines) {
    const lineText = line.items.map(i => i.text).join(' ');
    
    // Check for underline patterns (indicates blank field)
    if (UNDERLINE_PATTERN.test(lineText)) {
      // Find the label (text before underlines)
      const match = lineText.match(/^(.+?)(?:\s*:?\s*)_{4,}/);
      if (match) {
        const labelText = match[1].trim();
        const semantics = findSemanticFromLabel(labelText);
        
        if (semantics) {
          let apiId = semantics.api_id;
          if (usedApiIds.has(apiId)) {
            apiId = `${apiId}_${pageNum}_${fields.length}`;
          }
          usedApiIds.add(apiId);
          
          // Field starts after the label
          const labelItem = line.items.find(i => i.text.includes(labelText));
          const fieldX = labelItem ? labelItem.x + labelItem.width + 2 : line.items[0].x + 20;
          
          fields.push({
            api_id: apiId,
            label: semantics.label,
            type: semantics.type,
            page: pageNum,
            x: Math.min(fieldX, 90),
            y: line.y - 0.5,
            width: semantics.type === 'signature' ? 35 : 40,
            height: semantics.type === 'signature' ? 6 : 3,
            filled_by: semantics.filled_by,
            category: semantics.category,
            required: semantics.required || false,
          });
        }
      }
    }
    
    // Check for checkbox patterns
    if (CHECKBOX_PATTERN.test(lineText)) {
      const checkboxItem = line.items.find(i => CHECKBOX_PATTERN.test(i.text));
      if (checkboxItem) {
        // Get text after checkbox
        const afterText = line.items
          .filter(i => i.x > checkboxItem.x)
          .map(i => i.text)
          .join(' ')
          .trim();
        
        // Check for package selection patterns
        const packageMatch = afterText.match(/(\d{1,2})\s*%/);
        if (packageMatch) {
          const apiId = `package_${packageMatch[1]}`;
          if (!usedApiIds.has(apiId)) {
            usedApiIds.add(apiId);
            fields.push({
              api_id: apiId,
              label: `${packageMatch[1]}% Package`,
              type: 'radio',
              page: pageNum,
              x: checkboxItem.x,
              y: checkboxItem.y,
              width: 4,
              height: 3,
              filled_by: 'admin',
              category: 'package',
              required: true,
              group_name: 'package_selection',
            });
          }
        } else if (afterText.length > 0) {
          const apiId = sanitizeApiId(afterText.substring(0, 30)) || `checkbox_${pageNum}_${fields.length}`;
          if (!usedApiIds.has(apiId)) {
            usedApiIds.add(apiId);
            fields.push({
              api_id: apiId,
              label: afterText.substring(0, 50),
              type: 'checkbox',
              page: pageNum,
              x: checkboxItem.x,
              y: checkboxItem.y,
              width: 4,
              height: 3,
              filled_by: 'admin',
              category: 'acknowledgment',
              required: false,
            });
          }
        }
      }
    }
    
    // Check for signature-like patterns (labels without underlines but in signature areas)
    const sigMatch = lineText.match(/^(OWNER|TENANT|LANDLORD|MANAGER|HOST|GUEST|AGENT)\s*:?\s*$/i);
    if (sigMatch) {
      const role = sigMatch[1].toLowerCase();
      const isAdmin = ['landlord', 'manager', 'host', 'agent', 'owner'].includes(role);
      const isTenant = ['tenant', 'lessee', 'renter'].includes(role);
      
      // Determine appropriate api_id based on role
      let apiId: string;
      let label: string;
      let filledBy: 'admin' | 'guest' | 'tenant';
      
      if (role === 'owner') {
        apiId = 'owner_signature';
        label = 'Owner Signature';
        filledBy = 'guest'; // In management agreements, owner is the guest
      } else if (isAdmin) {
        apiId = `${role}_signature`;
        label = `${role.charAt(0).toUpperCase() + role.slice(1)} Signature`;
        filledBy = 'admin';
      } else if (isTenant) {
        apiId = 'tenant_signature';
        label = 'Tenant Signature';
        filledBy = 'tenant';
      } else {
        apiId = 'guest_signature';
        label = 'Guest Signature';
        filledBy = 'guest';
      }
      
      if (!usedApiIds.has(apiId)) {
        usedApiIds.add(apiId);
        fields.push({
          api_id: apiId,
          label: label,
          type: 'signature',
          page: pageNum,
          x: line.items[0].x,
          y: line.y + 3, // Position below the label
          width: 35,
          height: 6,
          filled_by: filledBy,
          category: 'signature',
          required: true,
        });
        
        // Add corresponding date field
        const dateApiId = `${apiId.replace('_signature', '')}_signature_date`;
        if (!usedApiIds.has(dateApiId)) {
          usedApiIds.add(dateApiId);
          fields.push({
            api_id: dateApiId,
            label: `${label.replace(' Signature', '')} Signature Date`,
            type: 'date',
            page: pageNum,
            x: line.items[0].x + 40,
            y: line.y + 3,
            width: 20,
            height: 3,
            filled_by: filledBy,
            category: 'signature',
            required: true,
          });
        }
      }
    }
  }
  
  return fields;
}

/**
 * Find semantic info from label text
 */
function findSemanticFromLabel(label: string): (typeof FIELD_SEMANTICS)[number] | null {
  const normalized = label.toLowerCase();
  
  for (const semantic of FIELD_SEMANTICS) {
    for (const pattern of semantic.patterns) {
      if (pattern.test(normalized) || pattern.test(label)) {
        return semantic;
      }
    }
  }
  
  return null;
}

/**
 * Detect the type of document from its content
 */
function detectDocumentType(textLines: TextLine[]): string {
  const allText = textLines.map(t => t.text.toLowerCase()).join(' ');
  
  // Lease/rental patterns
  const leasePatterns = ['residential lease', 'lease agreement', 'rental agreement', 'tenancy agreement', 'landlord', 'tenant', 'monthly rent', 'security deposit'];
  const leaseScore = leasePatterns.filter(p => allText.includes(p)).length;
  
  // Management agreement patterns
  const mgmtPatterns = ['management agreement', 'property management', 'management fee', 'owner agrees'];
  const mgmtScore = mgmtPatterns.filter(p => allText.includes(p)).length;
  
  // Innkeeper/guest patterns
  const guestPatterns = ['innkeeper', 'transient occupancy', 'guest registration', 'check-in', 'nightly rate'];
  const guestScore = guestPatterns.filter(p => allText.includes(p)).length;
  
  // Co-hosting patterns
  const cohostPatterns = ['co-host', 'cohost', 'co hosting', 'vacation rental management'];
  const cohostScore = cohostPatterns.filter(p => allText.includes(p)).length;
  
  if (leaseScore >= 3) return 'rental_agreement';
  if (mgmtScore >= 2) return 'management_agreement';
  if (guestScore >= 2) return 'innkeeper_agreement';
  if (cohostScore >= 2) return 'co_hosting';
  
  return 'other';
}

/**
 * Ensure document has essential signature fields
 */
function ensureSignatureFields(
  fields: ExtractedField[],
  totalPages: number,
  usedApiIds: Set<string>,
  documentType: string
): void {
  const signaturePage = totalPages; // Signatures typically on last page
  
  // Check what signature fields already exist
  const hasGuestSig = fields.some(f => f.type === 'signature' && (f.filled_by === 'guest' || f.api_id.includes('guest') || f.api_id.includes('tenant') || f.api_id.includes('owner')));
  const hasAdminSig = fields.some(f => f.type === 'signature' && f.filled_by === 'admin');
  
  // Add missing guest/tenant signature
  if (!hasGuestSig) {
    let apiId: string;
    let label: string;
    let filledBy: 'admin' | 'guest' | 'tenant';
    
    if (documentType === 'rental_agreement') {
      apiId = 'tenant_signature';
      label = 'Tenant Signature';
      filledBy = 'tenant';
    } else if (documentType === 'management_agreement' || documentType === 'co_hosting') {
      apiId = 'owner_signature';
      label = 'Owner Signature';
      filledBy = 'guest';
    } else {
      apiId = 'guest_signature';
      label = 'Guest Signature';
      filledBy = 'guest';
    }
    
    if (!usedApiIds.has(apiId)) {
      usedApiIds.add(apiId);
      fields.push({
        api_id: apiId,
        label: label,
        type: 'signature',
        page: signaturePage,
        x: 10,
        y: 70,
        width: 35,
        height: 6,
        filled_by: filledBy,
        category: 'signature',
        required: true,
      });
      
      // Add date field
      const dateApiId = `${apiId.replace('_signature', '')}_signature_date`;
      usedApiIds.add(dateApiId);
      fields.push({
        api_id: dateApiId,
        label: `${label.replace(' Signature', '')} Date`,
        type: 'date',
        page: signaturePage,
        x: 50,
        y: 70,
        width: 20,
        height: 3,
        filled_by: filledBy,
        category: 'signature',
        required: true,
      });
    }
  }
  
  // Add missing admin signature
  if (!hasAdminSig) {
    let apiId: string;
    let label: string;
    
    if (documentType === 'rental_agreement') {
      apiId = 'landlord_signature';
      label = 'Landlord Signature';
    } else {
      apiId = 'host_signature';
      label = 'Host Signature';
    }
    
    if (!usedApiIds.has(apiId)) {
      usedApiIds.add(apiId);
      fields.push({
        api_id: apiId,
        label: label,
        type: 'signature',
        page: signaturePage,
        x: 10,
        y: 85,
        width: 35,
        height: 6,
        filled_by: 'admin',
        category: 'signature',
        required: true,
      });
      
      // Add date field
      const dateApiId = `${apiId.replace('_signature', '')}_signature_date`;
      usedApiIds.add(dateApiId);
      fields.push({
        api_id: dateApiId,
        label: `${label.replace(' Signature', '')} Date`,
        type: 'date',
        page: signaturePage,
        x: 50,
        y: 85,
        width: 20,
        height: 3,
        filled_by: 'admin',
        category: 'signature',
        required: true,
      });
    }
  }
}

/**
 * Export for backward compatibility with existing code
 */
export async function extractPdfFormFields(pdfUrl: string) {
  const result = await extractDocumentFields(pdfUrl);
  return {
    formFields: result.fields,
    textPositions: result.textLines,
    totalPages: result.totalPages,
    hasAcroForm: result.hasAcroForm,
  };
}
