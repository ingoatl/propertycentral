import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { uploadToGoogleDrive } from "../_shared/google-drive.ts";
import { refreshGoogleToken } from "../_shared/google-oauth.ts";

// Google Drive folder IDs for agreement backup
const COHOSTING_FOLDER_ID = "1gFES5ILUV_SMdjugluwZdm4Q_1OoJh2q";
const FULL_SERVICE_FOLDER_ID = "1zsQtJHcEsk0ls_UJnhEsGCdrGlRUDg20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";

// Convert Uint8Array to base64 in chunks to avoid stack overflow
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 32768; // Process in 32KB chunks
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// Generate SHA-256 hash of document
async function generateDocumentHash(pdfBytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(pdfBytes.length);
  new Uint8Array(buffer).set(pdfBytes);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sanitize text for PDF rendering - remove/replace special characters
function sanitizeTextForPdf(text: string): string {
  if (!text) return '';
  // Replace common special characters with safe alternatives
  return text
    .replace(/[""]/g, '"')  // Smart quotes to straight quotes
    .replace(/['']/g, "'")  // Smart apostrophes to straight
    .replace(/–/g, '-')     // En dash to hyphen
    .replace(/—/g, '-')     // Em dash to hyphen
    .replace(/…/g, '...')   // Ellipsis to periods
    .replace(/•/g, '-')     // Bullet to hyphen
    .replace(/©/g, '(c)')   // Copyright
    .replace(/®/g, '(R)')   // Registered
    .replace(/™/g, '(TM)')  // Trademark
    .replace(/°/g, ' deg')  // Degree symbol
    .replace(/½/g, '1/2')   // Fractions
    .replace(/¼/g, '1/4')
    .replace(/¾/g, '3/4')
    .replace(/[^\x00-\x7F]/g, ''); // Remove any remaining non-ASCII
}

// Parse user agent to readable format
function parseUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown Browser";
  
  // Extract browser info
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  
  if (userAgent.includes("Chrome")) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    browser = `Chrome ${match ? match[1] : ""}`;
  } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    const match = userAgent.match(/Version\/(\d+)/);
    browser = `Safari ${match ? match[1] : ""}`;
  } else if (userAgent.includes("Firefox")) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    browser = `Firefox ${match ? match[1] : ""}`;
  } else if (userAgent.includes("Edge")) {
    const match = userAgent.match(/Edg\/(\d+)/);
    browser = `Edge ${match ? match[1] : ""}`;
  }
  
  // Extract OS info
  if (userAgent.includes("Windows NT 10")) os = "Windows 10/11";
  else if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac OS X")) os = "macOS";
  else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("Linux")) os = "Linux";
  
  return `${browser} on ${os}`;
}

// Format date to EST timezone with full details
function formatDateEST(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });
}

// Generate unique certificate ID
function generateCertificateId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PH-${timestamp}-${random}`;
}

// Extract owner and property data from field configuration
interface ExtractedContractData {
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  ownerAddress: string | null;
  secondOwnerName: string | null;
  secondOwnerEmail: string | null;
  propertyAddress: string | null;
  serviceType: 'cohosting' | 'full_service' | 'mid_term';
  managementFee: number;
  visitPrice: number;
  rentalType: 'hybrid' | 'mid_term';
  effectiveDate: string | null;
}

function extractContractData(fieldConfig: Record<string, any> | null): ExtractedContractData {
  const data: ExtractedContractData = {
    ownerName: null,
    ownerEmail: null,
    ownerPhone: null,
    ownerAddress: null,
    secondOwnerName: null,
    secondOwnerEmail: null,
    propertyAddress: null,
    serviceType: 'cohosting',
    managementFee: 20,
    visitPrice: 40,
    rentalType: 'hybrid',
    effectiveDate: null,
  };

  if (!fieldConfig) return data;

  // Extract owner information - check various field name patterns
  data.ownerName = fieldConfig.owner_name || fieldConfig.owner_print_name || 
                   fieldConfig.OwnerName || fieldConfig.owner_1_name || null;
  data.ownerEmail = fieldConfig.owner_email || fieldConfig.OwnerEmail || 
                    fieldConfig.owner_1_email || null;
  data.ownerPhone = fieldConfig.owner_phone || fieldConfig.OwnerPhone || 
                    fieldConfig.owner_1_phone || null;
  data.ownerAddress = fieldConfig.owner_address || fieldConfig.OwnerAddress || null;

  // Extract second owner info
  data.secondOwnerName = fieldConfig.second_owner_print_name || fieldConfig.owner2_print_name || 
                         fieldConfig.owner_2_name || fieldConfig.SecondOwnerName || null;
  data.secondOwnerEmail = fieldConfig.second_owner_email || fieldConfig.owner2_email || 
                          fieldConfig.owner_2_email || fieldConfig.SecondOwnerEmail || null;

  // Extract property address - this is the key field the owner fills in
  data.propertyAddress = fieldConfig.property_address || fieldConfig.PropertyAddress || 
                         fieldConfig.property_street_address || fieldConfig.address || null;

  // Extract effective date
  data.effectiveDate = fieldConfig.effective_date || fieldConfig.EffectiveDate || 
                       fieldConfig.agreement_date || null;

  // Determine service type and visit price from package selection
  // Package naming patterns: package_18, package_20, package_25, etc.
  const packageKeys = Object.keys(fieldConfig).filter(k => 
    k.toLowerCase().includes('package') && fieldConfig[k] === true
  );

  if (packageKeys.length > 0) {
    const selectedPackage = packageKeys[0].toLowerCase();
    
    if (selectedPackage.includes('18')) {
      data.serviceType = 'cohosting';
      data.managementFee = 18;
      data.visitPrice = 35;
      data.rentalType = 'hybrid';
    } else if (selectedPackage.includes('20')) {
      data.serviceType = 'cohosting';
      data.managementFee = 20;
      data.visitPrice = 40;
      data.rentalType = 'hybrid';
    } else if (selectedPackage.includes('25')) {
      data.serviceType = 'full_service'; // Use full_service for 25% package
      data.managementFee = 25;
      data.visitPrice = 50;
      data.rentalType = 'mid_term';
    } else if (selectedPackage.includes('30')) {
      data.serviceType = 'full_service';
      data.managementFee = 30;
      data.visitPrice = 60;
      data.rentalType = 'mid_term';
    }
  }

  // Also check for explicit service type fields
  if (fieldConfig.service_type) {
    if (fieldConfig.service_type === 'mid_term' || fieldConfig.service_type === 'full_service') {
      data.serviceType = 'full_service';
      data.rentalType = 'mid_term';
    }
  }

  return data;
}

// Fill PDF form fields with values and embed signatures
async function fillPdfWithValues(
  pdfDoc: PDFDocument,
  fieldConfig: Record<string, any>,
  fieldMappings: any[] | null,
  signatures: any[] | null,
  font: any
): Promise<void> {
  if (!fieldConfig || Object.keys(fieldConfig).length === 0) {
    console.log("No field configuration to fill");
    return;
  }

  const pages = pdfDoc.getPages();
  console.log("Filling PDF with", Object.keys(fieldConfig).length, "field values across", pages.length, "pages");

  // First, try to fill actual PDF form fields (AcroForm)
  const form = pdfDoc.getForm();
  const formFields = form.getFields();
  
  if (formFields.length > 0) {
    console.log("Found", formFields.length, "AcroForm fields");
    for (const field of formFields) {
      const fieldName = field.getName();
      const value = fieldConfig[fieldName];
      if (value !== undefined && value !== null) {
        try {
          const textField = form.getTextField(fieldName);
          textField.setText(sanitizeTextForPdf(String(value)));
          console.log("Filled form field:", fieldName);
        } catch (e) {
          // Field might not be a text field
        }
      }
    }
    // Flatten form to make it non-editable
    form.flatten();
  }

  // Build a map of signature data by signer type with signed_at timestamp
  const signatureByType: Record<string, { data: string; name: string; signedAt: string | null }> = {};
  if (signatures && Array.isArray(signatures)) {
    for (const sig of signatures) {
      if (sig.signature_data && sig.signer_type) {
        signatureByType[sig.signer_type] = {
          data: sig.signature_data,
          name: sig.signer_name || 'Signer',
          signedAt: sig.signed_at || null,
        };
      }
    }
  }
  console.log("Signature types available:", Object.keys(signatureByType));

  // Check if there's a second owner (by checking if they have data filled in)
  const hasSecondOwner = Boolean(
    fieldConfig.second_owner_signature_print_name || 
    fieldConfig.owner2_print_name ||
    fieldConfig.second_owner_name ||
    (signatureByType['second_owner']?.data)
  );
  console.log("Has second owner:", hasSecondOwner);

  // Now draw field values at their positions from field_mappings
  if (fieldMappings && Array.isArray(fieldMappings)) {
    for (const mapping of fieldMappings) {
      const { api_id, x, y, page: pageNum, width, height } = mapping;
      
      // Skip if no position data
      if (x === undefined || x === null || y === undefined || y === null) {
        continue;
      }
      
      // Skip second owner fields if there's no second owner
      if (!hasSecondOwner && api_id.toLowerCase().includes('second_owner')) {
        console.log("Skipping second owner field (no second owner):", api_id);
        continue;
      }
      if (!hasSecondOwner && api_id.toLowerCase().includes('owner2')) {
        console.log("Skipping owner2 field (no second owner):", api_id);
        continue;
      }
      
      let value = fieldConfig[api_id];
      
      // For date fields, use the actual signed_at timestamp from the signer
      if (api_id.toLowerCase().includes('date') && api_id.toLowerCase().includes('signature')) {
        let signerType = 'owner';
        if (api_id.toLowerCase().includes('manager')) {
          signerType = 'manager';
        } else if (api_id.toLowerCase().includes('second_owner') || api_id.toLowerCase().includes('owner2')) {
          signerType = 'second_owner';
        }
        
        const sigData = signatureByType[signerType];
        if (sigData?.signedAt) {
          // Use the actual signing timestamp, formatted in EST
          const signedDate = new Date(sigData.signedAt);
          value = signedDate.toLocaleDateString('en-US', { 
            timeZone: 'America/New_York',
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
          });
          console.log("Using actual signed_at for", api_id, ":", value);
        }
      }
      
      if (value !== undefined && value !== null && pageNum && pageNum <= pages.length) {
        const page = pages[pageNum - 1]; // Pages are 0-indexed
        const { width: pageWidth, height: pageHeight } = page.getSize();
        
        // Convert percentage positions to absolute coordinates
        const absX = (x / 100) * pageWidth;
        // PDF y-coordinates start from bottom, so convert from top-based percentage
        const absY = pageHeight - ((y / 100) * pageHeight);
        const absWidth = (width / 100) * pageWidth;
        const absHeight = (height / 100) * pageHeight;
        
        const textValue = sanitizeTextForPdf(String(value));
        const fontSize = Math.min(10, absHeight * 0.6);
        
        // The field x,y represents where the fillable area starts (after label colon)
        // For proper alignment, draw text/signatures starting from this x position
        // And on the SAME vertical line (not above or below)
        const drawX = absX;
        // Y should be adjusted so text sits ON the baseline of the line
        // The y% points to where the label text is - we need to draw at same baseline
        const drawY = absY;
        
        try {
          // Handle signature fields - determine which signer's signature to embed
          if (api_id.toLowerCase().includes('signature') && !api_id.toLowerCase().includes('print') && !api_id.toLowerCase().includes('date')) {
            let signerType = 'owner';
            if (api_id.toLowerCase().includes('manager')) {
              signerType = 'manager';
            } else if (api_id.toLowerCase().includes('second_owner') || api_id.toLowerCase().includes('owner2')) {
              signerType = 'second_owner';
            }
            
            const sigData = signatureByType[signerType];
            
            if (sigData?.data && sigData.data.startsWith('data:image/png')) {
              try {
                const base64Data = sigData.data.split(',')[1];
                const sigBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                const sigImage = await pdfDoc.embedPng(sigBytes);
                
                // Signature dimensions - keep compact but readable
                const sigWidth = Math.min(absWidth * 0.5, 100);
                const sigHeight = Math.min(22, absHeight * 1.2);
                
                // Draw signature so its BOTTOM sits on the line (baseline)
                // The line is at drawY, signature should sit on top of it
                page.drawImage(sigImage, {
                  x: drawX,
                  y: drawY - 2, // Bottom of signature at the line
                  width: sigWidth,
                  height: sigHeight,
                });
                console.log("Embedded signature for", signerType, "at", api_id, "position:", drawX, drawY);
              } catch (sigError) {
                console.error("Error embedding signature for", signerType, ":", sigError);
                page.drawText(`[Signed by ${sigData.name}]`, {
                  x: drawX,
                  y: drawY,
                  size: 8,
                  font,
                  color: rgb(0.3, 0.3, 0.3),
                });
              }
            } else if (sigData?.name) {
              page.drawText(`[Signed by ${sigData.name}]`, {
                x: drawX,
                y: drawY,
                size: 8,
                font,
                color: rgb(0.3, 0.3, 0.3),
              });
            }
          } else if (typeof value === 'boolean') {
            if (value === true) {
              page.drawText('X', {
                x: drawX + 2,
                y: drawY,
                size: 12,
                font,
                color: rgb(0, 0, 0),
              });
            }
          } else if (value !== '') {
            // Regular text/date field - draw value on the SAME LINE as label
            // PDF text baseline: y is where the bottom of text sits
            page.drawText(textValue.substring(0, 80), {
              x: drawX,
              y: drawY, // Same baseline as the label
              size: fontSize,
              font,
              color: rgb(0, 0, 0),
            });
          }
        } catch (drawError) {
          console.error("Error drawing field", api_id, ":", drawError);
        }
      }
    }
  }
  
  console.log("Finished filling PDF fields");
}

const buildCompletionEmailHtml = (
  recipientName: string,
  documentName: string,
  propertyAddress: string | null,
  signers: { name: string; email: string; signedAt: string; type: string }[],
  downloadUrl: string,
  certificateId: string
): string => {
  const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  const signerRows = signers.map(s => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e5e5e5;">
        <div style="font-size: 13px; font-weight: 600; color: #111111;">${s.name}</div>
        <div style="font-size: 11px; color: #666666;">${s.email}</div>
      </td>
      <td style="padding: 12px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">
        <div style="font-size: 11px; color: #666666; text-transform: uppercase;">${s.type.replace('_', ' ')}</div>
        <div style="font-size: 11px; color: #10b981;">Signed ${new Date(s.signedAt).toLocaleDateString()}</div>
      </td>
    </tr>
  `).join('');

  const propertySection = propertyAddress ? `
    <div style="padding: 16px 32px; background: #f0fdf4; border-bottom: 1px solid #bbf7d0;">
      <table style="width: 100%;">
        <tr>
          <td>
            <div style="font-size: 10px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Property</div>
            <div style="font-size: 14px; font-weight: 600; color: #111111;">${propertyAddress}</div>
          </td>
        </tr>
      </table>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Complete</title>
</head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
    
    <!-- Header -->
    <div style="padding: 24px 32px; border-bottom: 2px solid #10b981;">
      <table style="width: 100%;">
        <tr>
          <td style="vertical-align: middle;">
            <img src="${LOGO_URL}" alt="PeachHaus" style="height: 40px; width: auto;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
            <div style="display: none; font-size: 20px; font-weight: 700; color: #111111; letter-spacing: -0.3px;">PeachHaus</div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <div style="font-size: 16px; font-weight: 600; color: #10b981; margin-bottom: 4px;">DOCUMENT COMPLETE</div>
            <div style="font-size: 10px; color: #666666; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
              ${issueDate}
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Success Banner -->
    <div style="padding: 24px 32px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-bottom: 1px solid #a7f3d0;">
      <table style="width: 100%;">
        <tr>
          <td style="vertical-align: middle; width: 100%;">
            <div style="font-size: 18px; font-weight: 700; color: #065f46; margin-bottom: 4px;">Agreement Fully Executed</div>
            <div style="font-size: 13px; color: #047857;">All parties have signed. The document is now legally binding.</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Property Section -->
    ${propertySection}

    <!-- Certificate ID -->
    <div style="padding: 16px 32px; background: #f9fafb; border-bottom: 1px solid #e5e5e5;">
      <table style="width: 100%;">
        <tr>
          <td>
            <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px;">Certificate ID</div>
            <div style="font-size: 12px; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; color: #111111;">${certificateId}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Document Details -->
    <div style="padding: 24px 32px;">
      <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Document</div>
      <div style="font-size: 16px; font-weight: 600; color: #111111; margin-bottom: 24px;">${documentName}</div>
      
      <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Signatures</div>
      <table style="width: 100%; border-collapse: collapse;">
        ${signerRows}
      </table>
    </div>

    <!-- Download Button -->
    <div style="padding: 0 32px 32px 32px;">
      <table style="width: 100%; border: 2px solid #10b981; border-radius: 8px; overflow: hidden;">
        <tr>
          <td style="padding: 20px; text-align: center; background: #ecfdf5;">
            <div style="font-size: 12px; color: #065f46; margin-bottom: 12px;">Your signed copy with Certificate of Completion is attached</div>
            <a href="${downloadUrl}" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 32px; font-weight: 600; font-size: 14px; letter-spacing: 0.3px; border-radius: 6px;">
              DOWNLOAD SIGNED DOCUMENT
            </a>
          </td>
        </tr>
      </table>
    </div>

    <!-- What's Next -->
    <div style="padding: 24px 32px; background: #f9f9f9; border-top: 1px solid #e5e5e5;">
      <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">What Happens Next</div>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
            <span style="color: #10b981; margin-right: 8px;">1.</span>
            Keep your signed copy for your records
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
            <span style="color: #10b981; margin-right: 8px;">2.</span>
            Our team will begin the onboarding process
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #111111;">
            <span style="color: #10b981; margin-right: 8px;">3.</span>
            You'll receive updates as we get your property ready
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding: 20px 32px; background: #111111;">
      <table style="width: 100%;">
        <tr>
          <td>
            <p style="margin: 0 0 8px; color: #a3a3a3; font-size: 11px;">
              This document is legally binding under the Electronic Signatures in Global and National Commerce Act (ESIGN).
            </p>
            <p style="margin: 0; color: #737373; font-size: 11px;">
              PeachHaus Group - info@peachhausgroup.com
            </p>
          </td>
        </tr>
      </table>
    </div>

  </div>
</body>
</html>
`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { documentId } = await req.json();

    console.log("Finalizing signed document:", documentId);

    // Get document details with template and field_mappings
    const { data: document, error: docError } = await supabase
      .from("booking_documents")
      .select(`
        *,
        document_templates (
          id,
          name,
          file_path,
          field_mappings,
          contract_type
        )
      `)
      .eq("id", documentId)
      .single();

    if (docError) throw docError;

    // Get all signatures
    const { data: signatures, error: sigError } = await supabase
      .from("signing_tokens")
      .select("*")
      .eq("document_id", documentId)
      .order("signing_order");

    if (sigError) throw sigError;

    console.log("Found", signatures?.length, "signatures for document");

    // Extract contract data from field_configuration
    const fieldConfig = document.field_configuration as Record<string, any> | null;
    const contractData = extractContractData(fieldConfig);

    console.log("Extracted contract data:", JSON.stringify(contractData, null, 2));

    // Property address comes from the contract (what the owner entered)
    let propertyAddress = contractData.propertyAddress;

    // Get lead data - try multiple lookups
    let leadData: any = null;
    
    // First try: lookup by signwell_document_id
    const { data: lead } = await supabase
      .from("leads")
      .select("id, property_id, owner_id, property_address, contact_name, email, phone, stage")
      .eq("signwell_document_id", documentId)
      .maybeSingle();
    
    if (lead) {
      leadData = lead;
    } else {
      // Second try: lookup by booking_document_id if stored in leads
      const { data: leadByDocId } = await supabase
        .from("leads")
        .select("id, property_id, owner_id, property_address, contact_name, email, phone, stage")
        .eq("booking_document_id", documentId)
        .maybeSingle();
      
      if (leadByDocId) {
        leadData = leadByDocId;
      } else {
        // Third try: find lead by matching owner email from contract
        if (contractData.ownerEmail) {
          const { data: leadByEmail } = await supabase
            .from("leads")
            .select("id, property_id, owner_id, property_address, contact_name, email, phone, stage")
            .eq("email", contractData.ownerEmail)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (leadByEmail) {
            leadData = leadByEmail;
          }
        }
      }
    }
    
    if (leadData) {
      console.log("Found lead:", leadData.id, "stage:", leadData.stage);
      // If contract doesn't have property address, try lead (fallback)
      if (!propertyAddress) {
        propertyAddress = leadData.property_address;
      }
    } else {
      console.log("No lead found for document");
    }

    console.log("Property address from contract:", propertyAddress);

    // Get audit log entries for detailed timeline
    const { data: auditLogs } = await supabase
      .from("document_audit_log")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });

    // Build signer timeline from audit logs
    const signerTimelines: Record<string, { sent?: string; viewed?: string; signed?: string; userAgent?: string }> = {};
    
    for (const log of auditLogs || []) {
      const email = (log.metadata as any)?.signer_email || (log.metadata as any)?.email;
      if (email) {
        if (!signerTimelines[email]) signerTimelines[email] = {};
        
        if (log.action === 'signing_session_created' || log.action === 'signing_email_sent') {
          signerTimelines[email].sent = log.created_at;
        } else if (log.action === 'document_viewed' || log.action === 'token_validated') {
          if (!signerTimelines[email].viewed) {
            signerTimelines[email].viewed = log.created_at;
          }
          if (log.user_agent) {
            signerTimelines[email].userAgent = log.user_agent;
          }
        } else if (log.action === 'signature_submitted' || log.action === 'signature_captured') {
          signerTimelines[email].signed = log.created_at;
          if (log.user_agent) {
            signerTimelines[email].userAgent = log.user_agent;
          }
        }
      }
    }

    // ========================================
    // CREATE/UPDATE OWNER AND PROPERTY RECORDS
    // ========================================
    
    let ownerId: string | null = leadData?.owner_id || null;
    let propertyId: string | null = leadData?.property_id || null;

    // Only create owner/property if we have the necessary data from contract
    if (contractData.ownerEmail || contractData.ownerName) {
      const ownerEmail = contractData.ownerEmail || leadData?.email;
      const ownerName = contractData.ownerName || leadData?.contact_name;
      const ownerPhone = contractData.ownerPhone || leadData?.phone;

      if (ownerEmail) {
        // Check if owner already exists
        const { data: existingOwner } = await supabase
          .from("property_owners")
          .select("id")
          .eq("email", ownerEmail)
          .maybeSingle();

        if (existingOwner) {
          ownerId = existingOwner.id;
          
          // Update existing owner with contract data
          const { error: updateOwnerError } = await supabase
            .from("property_owners")
            .update({
              name: ownerName || undefined,
              phone: ownerPhone || undefined,
              second_owner_name: contractData.secondOwnerName || undefined,
              second_owner_email: contractData.secondOwnerEmail || undefined,
              service_type: contractData.serviceType,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingOwner.id);

          if (updateOwnerError) {
            console.error("Error updating owner:", updateOwnerError);
          } else {
            console.log("Updated existing owner:", existingOwner.id);
          }
        } else {
          // Create new owner
          const { data: newOwner, error: createOwnerError } = await supabase
            .from("property_owners")
            .insert({
              name: ownerName || "Property Owner",
              email: ownerEmail,
              phone: ownerPhone,
              second_owner_name: contractData.secondOwnerName,
              second_owner_email: contractData.secondOwnerEmail,
              service_type: contractData.serviceType,
              payment_method: 'ach',
            })
            .select()
            .single();

          if (createOwnerError) {
            console.error("Error creating owner:", createOwnerError);
          } else {
            ownerId = newOwner?.id;
            console.log("Created new owner:", ownerId);
          }
        }
      }
    }

    // Create property record if we have an address
    if (propertyAddress && ownerId && !propertyId) {
      // Check if property already exists with this address
      const { data: existingProperty } = await supabase
        .from("properties")
        .select("id")
        .eq("address", propertyAddress)
        .maybeSingle();

      if (existingProperty) {
        propertyId = existingProperty.id;
        
        // Update property with contract data
        await supabase
          .from("properties")
          .update({
            owner_id: ownerId,
            visit_price: contractData.visitPrice,
            management_fee_percentage: contractData.managementFee,
            rental_type: contractData.rentalType,
            updated_at: new Date().toISOString(),
          })
          .eq("id", propertyId);
        
        console.log("Updated existing property:", propertyId);
      } else {
        // Create new property
        const { data: newProperty, error: createPropertyError } = await supabase
          .from("properties")
          .insert({
            name: propertyAddress,
            address: propertyAddress,
            owner_id: ownerId,
            visit_price: contractData.visitPrice,
            management_fee_percentage: contractData.managementFee,
            rental_type: contractData.rentalType,
            property_type: 'Client-Managed',
          })
          .select()
          .single();

        if (createPropertyError) {
          console.error("Error creating property:", createPropertyError);
        } else {
          propertyId = newProperty?.id;
          console.log("Created new property:", propertyId, "with visit_price:", contractData.visitPrice);
        }
      }
    }

    // Update lead with property address and IDs from contract
    if (leadData && (propertyAddress || ownerId || propertyId)) {
      const leadUpdateData: any = {
        stage: "onboarding",
        stage_changed_at: new Date().toISOString(),
      };
      
      if (propertyAddress && !leadData.property_address) {
        leadUpdateData.property_address = propertyAddress;
      }
      if (ownerId && !leadData.owner_id) {
        leadUpdateData.owner_id = ownerId;
      }
      if (propertyId && !leadData.property_id) {
        leadUpdateData.property_id = propertyId;
      }

      await supabase
        .from("leads")
        .update(leadUpdateData)
        .eq("id", leadData.id);

      console.log("Updated lead with contract data:", leadUpdateData);
    }

    // Get the original PDF - try both storage buckets
    let pdfBytes: ArrayBuffer | null = null;
    const templatePath = document.document_templates?.file_path;
    
    if (templatePath) {
      // If it's a full URL, extract the path
      let storagePath = templatePath;
      if (templatePath.startsWith('http')) {
        // Extract path from URL like https://.../storage/v1/object/public/bucket/path
        const match = templatePath.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
        if (match) {
          const [, bucket, path] = match;
          const { data, error } = await supabase.storage.from(bucket).download(path);
          if (!error && data) {
            pdfBytes = await data.arrayBuffer();
          }
        }
      } else {
        // Try signed-documents bucket first
        const { data: pdfData, error: downloadError } = await supabase.storage
          .from("signed-documents")
          .download(storagePath);

        if (!downloadError && pdfData) {
          pdfBytes = await pdfData.arrayBuffer();
        } else {
          // Fallback to onboarding-documents bucket
          const { data: pdfData2 } = await supabase.storage
            .from("onboarding-documents")
            .download(storagePath);
          
          if (pdfData2) {
            pdfBytes = await pdfData2.arrayBuffer();
          }
        }
      }
    }

    let pdfDoc: PDFDocument;
    
    if (pdfBytes) {
      pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Get field mappings from template
      const fieldMappings = document.document_templates?.field_mappings as any[] | null;
      
      // Embed font for text drawing
      const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      // FILL PDF WITH FIELD VALUES
      await fillPdfWithValues(pdfDoc, fieldConfig || {}, fieldMappings, signatures, textFont);
      console.log("Filled PDF with field values");
    } else {
      // Create a new PDF if no template found
      console.log("No template PDF found, creating certificate-only document");
      pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const createFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      page.drawText(sanitizeTextForPdf(document.document_name || "Signed Agreement"), { x: 50, y: 750, size: 24, font: createFont });
    }

    // Generate certificate ID
    const certificateId = generateCertificateId();

    // Add enhanced signature certificate page (DocuSign-style)
    const certPage = pdfDoc.addPage([612, 792]); // US Letter size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const pageWidth = 612;
    const margin = 50;
    let yPos = 742;
    
    // Colors
    const darkGray = rgb(0.2, 0.2, 0.2);
    const mediumGray = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.6, 0.6, 0.6);
    const greenColor = rgb(0.063, 0.722, 0.525); // #10b981
    const bgGray = rgb(0.96, 0.96, 0.96);
    
    // === HEADER ===
    // Draw header background
    certPage.drawRectangle({
      x: 0,
      y: 718,
      width: pageWidth,
      height: 74,
      color: rgb(0.98, 0.98, 0.98),
    });
    
    // Header accent line at top of header section
    certPage.drawRectangle({
      x: 0,
      y: 790,
      width: pageWidth,
      height: 2,
      color: greenColor,
    });
    
    // Title
    certPage.drawText("CERTIFICATE OF COMPLETION", {
      x: margin,
      y: yPos,
      size: 18,
      font: boldFont,
      color: darkGray,
    });
    
    yPos -= 22;
    certPage.drawText(`Certificate ID: ${certificateId}`, {
      x: margin,
      y: yPos,
      size: 9,
      font,
      color: mediumGray,
    });
    
    // Status badge (right side) - Use ASCII text instead of Unicode
    certPage.drawText("COMPLETED", {
      x: pageWidth - margin - 70,
      y: 742,
      size: 11,
      font: boldFont,
      color: greenColor,
    });
    
    yPos = 690;
    
    // === DOCUMENT DETAILS SECTION ===
    certPage.drawText("DOCUMENT DETAILS", {
      x: margin,
      y: yPos,
      size: 10,
      font: boldFont,
      color: darkGray,
    });
    
    yPos -= 20;
    certPage.drawText("Document Name:", {
      x: margin,
      y: yPos,
      size: 9,
      font,
      color: mediumGray,
    });
    
    // Build document display name with property address
    let documentDisplayName = document.document_name || document.document_templates?.name || "Agreement";
    if (propertyAddress && !documentDisplayName.includes(propertyAddress)) {
      documentDisplayName = `${documentDisplayName} - ${propertyAddress}`;
    }
    
    certPage.drawText(documentDisplayName.substring(0, 60) + (documentDisplayName.length > 60 ? "..." : ""), {
      x: margin + 100,
      y: yPos,
      size: 9,
      font: boldFont,
      color: darkGray,
    });
    
    yPos -= 15;
    certPage.drawText("Document ID:", {
      x: margin,
      y: yPos,
      size: 9,
      font,
      color: mediumGray,
    });
    certPage.drawText(documentId, {
      x: margin + 100,
      y: yPos,
      size: 8,
      font,
      color: mediumGray,
    });
    
    // Add property address if available
    if (propertyAddress) {
      yPos -= 15;
      certPage.drawText("Property:", {
        x: margin,
        y: yPos,
        size: 9,
        font,
        color: mediumGray,
      });
      certPage.drawText(propertyAddress.substring(0, 50) + (propertyAddress.length > 50 ? "..." : ""), {
        x: margin + 100,
        y: yPos,
        size: 9,
        font,
        color: darkGray,
      });
    }
    
    yPos -= 15;
    certPage.drawText("Completed:", {
      x: margin,
      y: yPos,
      size: 9,
      font,
      color: mediumGray,
    });
    certPage.drawText(formatDateEST(new Date()), {
      x: margin + 100,
      y: yPos,
      size: 9,
      font,
      color: darkGray,
    });
    
    yPos -= 15;
    certPage.drawText("Total Pages:", {
      x: margin,
      y: yPos,
      size: 9,
      font,
      color: mediumGray,
    });
    certPage.drawText(`${pdfDoc.getPageCount()} (including this certificate)`, {
      x: margin + 100,
      y: yPos,
      size: 9,
      font,
      color: darkGray,
    });
    
    // Divider
    yPos -= 25;
    certPage.drawRectangle({
      x: margin,
      y: yPos,
      width: pageWidth - (margin * 2),
      height: 1,
      color: rgb(0.9, 0.9, 0.9),
    });
    
    yPos -= 25;
    
    // === SIGNING AUDIT TRAIL ===
    certPage.drawText("SIGNING AUDIT TRAIL", {
      x: margin,
      y: yPos,
      size: 10,
      font: boldFont,
      color: darkGray,
    });
    
    yPos -= 5;
    
    // Process each signer
    for (let i = 0; i < (signatures || []).length; i++) {
      const sig = signatures![i];
      const timeline = signerTimelines[sig.signer_email] || {};
      
      yPos -= 20;
      
      // Signer header background
      certPage.drawRectangle({
        x: margin,
        y: yPos - 5,
        width: pageWidth - (margin * 2),
        height: 22,
        color: bgGray,
      });
      
      // Signer number and name
      certPage.drawText(`SIGNER ${i + 1}:`, {
        x: margin + 8,
        y: yPos,
        size: 8,
        font: boldFont,
        color: mediumGray,
      });
      certPage.drawText(sig.signer_name, {
        x: margin + 58,
        y: yPos,
        size: 10,
        font: boldFont,
        color: darkGray,
      });
      
      // Role on the right
      const roleText = sig.signer_type === 'owner' ? 'Property Owner' : 
                       sig.signer_type === 'second_owner' ? 'Co-Owner' : 'Property Manager';
      certPage.drawText(roleText, {
        x: pageWidth - margin - 90,
        y: yPos,
        size: 8,
        font,
        color: mediumGray,
      });
      
      yPos -= 22;
      
      // Email
      certPage.drawText("Email:", {
        x: margin + 15,
        y: yPos,
        size: 8,
        font,
        color: mediumGray,
      });
      certPage.drawText(sig.signer_email, {
        x: margin + 55,
        y: yPos,
        size: 8,
        font,
        color: darkGray,
      });
      
      yPos -= 14;
      
      // Timeline events
      const events = [
        { label: "Sent:", time: timeline.sent || document.created_at },
        { label: "Viewed:", time: timeline.viewed },
        { label: "Signed:", time: sig.signed_at },
      ];
      
      for (const event of events) {
        certPage.drawText(event.label, {
          x: margin + 15,
          y: yPos,
          size: 8,
          font,
          color: mediumGray,
        });
        certPage.drawText(event.time ? formatDateEST(event.time) : "N/A", {
          x: margin + 55,
          y: yPos,
          size: 8,
          font,
          color: event.time ? darkGray : lightGray,
        });
        yPos -= 12;
      }
      
      // IP Address
      certPage.drawText("IP Address:", {
        x: margin + 15,
        y: yPos,
        size: 8,
        font,
        color: mediumGray,
      });
      certPage.drawText(sig.ip_address || "N/A", {
        x: margin + 75,
        y: yPos,
        size: 8,
        font,
        color: darkGray,
      });
      
      yPos -= 12;
      
      // Browser/Device
      certPage.drawText("Browser:", {
        x: margin + 15,
        y: yPos,
        size: 8,
        font,
        color: mediumGray,
      });
      certPage.drawText(parseUserAgent(timeline.userAgent || sig.user_agent || null), {
        x: margin + 75,
        y: yPos,
        size: 8,
        font,
        color: darkGray,
      });
      
      yPos -= 5;
      
      // Draw signature image if available
      if (sig.signature_data && sig.signature_data.startsWith("data:image/png;base64,")) {
        try {
          const signatureBase64 = sig.signature_data.split(",")[1];
          const signatureBytes = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
          const signatureImage = await pdfDoc.embedPng(signatureBytes);
          
          yPos -= 5;
          
          // Draw signature box
          certPage.drawRectangle({
            x: margin + 15,
            y: yPos - 35,
            width: 140,
            height: 35,
            borderColor: rgb(0.85, 0.85, 0.85),
            borderWidth: 0.5,
          });
          
          certPage.drawImage(signatureImage, {
            x: margin + 20,
            y: yPos - 32,
            width: 130,
            height: 30,
          });
          yPos -= 45;
        } catch (imgError) {
          console.error("Error embedding signature image:", imgError);
          yPos -= 10;
        }
      }
      
      yPos -= 10;
    }
    
    // === SECURITY VERIFICATION SECTION ===
    yPos -= 15;
    certPage.drawRectangle({
      x: margin,
      y: yPos,
      width: pageWidth - (margin * 2),
      height: 1,
      color: rgb(0.9, 0.9, 0.9),
    });
    
    yPos -= 25;
    
    certPage.drawText("SECURITY VERIFICATION", {
      x: margin,
      y: yPos,
      size: 10,
      font: boldFont,
      color: darkGray,
    });
    
    yPos -= 20;
    
    // Generate document hash (before adding this certificate page content - use original PDF)
    let documentHash = "Generating...";
    if (pdfBytes) {
      documentHash = await generateDocumentHash(new Uint8Array(pdfBytes));
    } else {
      // Generate hash from current PDF state
      const tempBytes = await pdfDoc.save();
      documentHash = await generateDocumentHash(tempBytes);
    }
    
    certPage.drawText("Document Hash (SHA-256):", {
      x: margin,
      y: yPos,
      size: 8,
      font,
      color: mediumGray,
    });
    
    yPos -= 12;
    certPage.drawText(documentHash, {
      x: margin,
      y: yPos,
      size: 7,
      font,
      color: darkGray,
    });
    
    yPos -= 20;
    
    // Tamper-evident statement
    certPage.drawRectangle({
      x: margin,
      y: yPos - 35,
      width: pageWidth - (margin * 2),
      height: 45,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 0.5,
    });
    
    // Use ASCII text instead of emoji
    certPage.drawText("TAMPER-EVIDENT SEAL", {
      x: margin + 10,
      y: yPos - 8,
      size: 8,
      font: boldFont,
      color: darkGray,
    });
    
    certPage.drawText("This document is secured with a cryptographic hash. Any modification to the", {
      x: margin + 10,
      y: yPos - 20,
      size: 7,
      font,
      color: mediumGray,
    });
    certPage.drawText("document content after signing will invalidate this certificate.", {
      x: margin + 10,
      y: yPos - 30,
      size: 7,
      font,
      color: mediumGray,
    });
    
    // === FOOTER ===
    // Legal disclaimer
    certPage.drawText("This document is legally binding under the Electronic Signatures in Global and National", {
      x: margin,
      y: 70,
      size: 7,
      font,
      color: lightGray,
    });
    certPage.drawText("Commerce Act (ESIGN) and the Uniform Electronic Transactions Act (UETA).", {
      x: margin,
      y: 60,
      size: 7,
      font,
      color: lightGray,
    });
    
    // Footer branding
    certPage.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: 45,
      color: rgb(0.07, 0.07, 0.07),
    });
    
    certPage.drawText("PeachHaus Group", {
      x: margin,
      y: 25,
      size: 10,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    certPage.drawText("Property Management Made Simple", {
      x: margin,
      y: 12,
      size: 8,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });
    certPage.drawText("info@peachhausgroup.com", {
      x: pageWidth - margin - 120,
      y: 18,
      size: 8,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    
    // Upload to storage
    const fileName = `signed/${documentId}-signed.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("signed-documents")
      .upload(fileName, modifiedPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }

    console.log("Uploaded signed PDF to:", fileName);

    // Upload to Google Drive as backup
    let googleDriveUrl: string | null = null;
    try {
      // Get Gmail OAuth token for Drive access
      const { data: tokenData, error: tokenError } = await supabase
        .from("gmail_oauth_tokens")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (tokenData && !tokenError) {
        // Check if token is expired
        const expiresAt = new Date(tokenData.expires_at);
        let accessToken = tokenData.access_token;

        if (expiresAt <= new Date()) {
          console.log("Google token expired, refreshing...");
          try {
            const refreshResult = await refreshGoogleToken(tokenData.refresh_token);
            accessToken = refreshResult.accessToken;

            // Update token in database
            await supabase
              .from("gmail_oauth_tokens")
              .update({
                access_token: accessToken,
                expires_at: new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", tokenData.id);
          } catch (refreshError) {
            console.error("Failed to refresh Google token:", refreshError);
          }
        }

        if (accessToken) {
          // Determine folder based on service type
          const folderId = contractData.serviceType === "full_service" 
            ? FULL_SERVICE_FOLDER_ID 
            : COHOSTING_FOLDER_ID;

          // Create subfolder name: "FirstName - PropertyAddress"
          const ownerFirstName = contractData.ownerName?.split(" ")[0] || "Owner";
          const propertyShort = (propertyAddress || "Property").replace(/[^a-zA-Z0-9\s]/g, "").substring(0, 50).trim();
          const subfolderName = `${ownerFirstName} - ${propertyShort}`;

          const driveFileName = `${(propertyAddress || documentDisplayName).replace(/[^a-zA-Z0-9\s]/g, "_")}_Agreement_${new Date().toISOString().split("T")[0]}.pdf`;

          console.log(`Uploading to Google Drive folder ${contractData.serviceType === "full_service" ? "Full Service" : "Co-Hosting"}/${subfolderName}: ${driveFileName}`);

          const driveResult = await uploadToGoogleDrive(
            accessToken,
            driveFileName,
            modifiedPdfBytes,
            "application/pdf",
            folderId,
            subfolderName
          );

          googleDriveUrl = driveResult.webViewLink;
          console.log("Google Drive upload successful:", googleDriveUrl);
        }
      } else {
        console.log("No Gmail OAuth tokens found, skipping Google Drive backup");
      }
    } catch (driveError) {
      console.error("Google Drive upload failed (non-fatal):", driveError);
      // Continue without Drive backup - this is non-fatal
    }

    // Update document with signed PDF path and Google Drive URL
    await supabase
      .from("booking_documents")
      .update({
        signed_pdf_path: fileName,
        status: "completed",
        google_drive_url: googleDriveUrl,
      })
      .eq("id", documentId);

    // Log audit entry
    await supabase.from("document_audit_log").insert({
      document_id: documentId,
      action: "document_finalized",
      metadata: {
        signed_pdf_path: fileName,
        google_drive_url: googleDriveUrl,
        certificate_id: certificateId,
        document_hash: documentHash,
        property_address: propertyAddress,
        owner_id: ownerId,
        property_id: propertyId,
        contract_data: contractData,
        all_signers: signatures?.map(s => ({
          name: s.signer_name,
          email: s.signer_email,
          signed_at: s.signed_at,
        })),
      },
    });

    // Get signed URL for email download link
    const { data: signedUrlData } = await supabase.storage
      .from("signed-documents")
      .createSignedUrl(fileName, 604800); // 7 days

    const downloadUrl = signedUrlData?.signedUrl || "";

    // Send completion emails with PDF attachment to all signers
    const signerDetails = signatures?.map(s => ({
      name: s.signer_name,
      email: s.signer_email,
      signedAt: s.signed_at,
      type: s.signer_type,
    })) || [];

    // Convert PDF bytes to base64 for attachment (using chunked method to avoid stack overflow)
    const pdfBase64 = uint8ArrayToBase64(modifiedPdfBytes);

    console.log("Sending completion emails to", signerDetails.length, "signers with PDF attachment");

    // Build email subject with property address
    let emailSubject = `Agreement Complete: ${documentDisplayName}`;
    if (propertyAddress) {
      emailSubject = `Agreement Complete - ${propertyAddress}`;
    }

    for (const signer of signerDetails) {
      try {
        const emailResult = await resend.emails.send({
          from: "PeachHaus Group <info@peachhausgroup.com>",
          to: [signer.email],
          subject: emailSubject,
          html: buildCompletionEmailHtml(
            signer.name,
            documentDisplayName,
            propertyAddress,
            signerDetails,
            downloadUrl,
            certificateId
          ),
          attachments: [
            {
              filename: `${(propertyAddress || documentDisplayName).replace(/[^a-zA-Z0-9]/g, '_')}_Signed.pdf`,
              content: pdfBase64,
            },
          ],
        });
        console.log("Sent completion email with attachment to:", signer.email, "Result:", emailResult);
      } catch (emailError) {
        console.error("Error sending email to", signer.email, ":", emailError);
      }
    }

    // Store executed document in property_documents table for Document Hub
    // ALWAYS try to save if we have propertyId
    console.log("Attempting to save to Document Hub - propertyId:", propertyId, "documentId:", documentId);
    
    if (propertyId) {
      // Create unique filename with timestamp to avoid duplicates
      const timestamp = new Date().toISOString().split('T')[0];
      const safePropertyName = sanitizeTextForPdf(propertyAddress || documentDisplayName).replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50);
      const uniqueFileName = `${safePropertyName}_Agreement_${timestamp}.pdf`;
      
      // Check if document already exists for this property
      const { data: existingDoc, error: existingDocError } = await supabase
        .from("property_documents")
        .select("id")
        .eq("property_id", propertyId)
        .eq("document_type", "management_agreement")
        .maybeSingle();
      
      if (existingDocError) {
        console.error("Error checking existing property_documents:", existingDocError);
      }
      
      if (existingDoc) {
        // Update existing document
        const { error: docUpdateError } = await supabase
          .from("property_documents")
          .update({
            file_path: fileName,
            file_name: uniqueFileName,
            description: `Executed agreement - ${propertyAddress || documentDisplayName}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingDoc.id);
        
        if (docUpdateError) {
          console.error("Error updating property_documents:", docUpdateError);
        } else {
          console.log("Updated existing agreement in property_documents (Document Hub) - id:", existingDoc.id);
        }
      } else {
        // Insert new document
        const { data: insertedDoc, error: docInsertError } = await supabase
          .from("property_documents")
          .insert({
            property_id: propertyId,
            file_name: uniqueFileName,
            file_path: fileName,
            file_type: "application/pdf",
            document_type: "management_agreement",
            description: `Executed agreement - ${propertyAddress || documentDisplayName}`,
          })
          .select()
          .single();
        
        if (docInsertError) {
          console.error("Error saving to property_documents:", docInsertError);
        } else {
          console.log("Saved executed agreement to property_documents (Document Hub) - id:", insertedDoc?.id);
        }
      }
    } else {
      console.log("Skipping Document Hub save - no propertyId available");
    }

    // Save to management_agreements table (GREC compliance)
    // Include all agreement types
    const contractType = document.contract_type || document.document_templates?.contract_type || 'management_agreement';
    console.log("Attempting to save to management_agreements - propertyId:", propertyId, "contractType:", contractType);
    
    if (propertyId) {
      // Get owner and manager signed timestamps
      const ownerSig = signatures?.find(s => s.signer_type === "owner");
      const managerSig = signatures?.find(s => s.signer_type === "manager");

      // First check if an agreement already exists for this property
      const { data: existingAgreement } = await supabase
        .from("management_agreements")
        .select("id")
        .eq("property_id", propertyId)
        .maybeSingle();

      const agreementData = {
        property_id: propertyId,
        owner_id: ownerId,
        agreement_date: new Date().toISOString().split('T')[0],
        effective_date: contractData.effectiveDate || new Date().toISOString().split('T')[0],
        document_path: fileName,
        management_fee_percentage: contractData.managementFee,
        order_minimum_fee: contractData.visitPrice,
        signed_by_owner: true,
        signed_by_owner_at: ownerSig?.signed_at || new Date().toISOString(),
        signed_by_company: true,
        signed_by_company_at: managerSig?.signed_at || new Date().toISOString(),
        status: "active",
        updated_at: new Date().toISOString(),
      };

      let agreementResult;
      if (existingAgreement) {
        // Update existing
        agreementResult = await supabase
          .from("management_agreements")
          .update(agreementData)
          .eq("id", existingAgreement.id)
          .select()
          .single();
        
        if (agreementResult.error) {
          console.error("Error updating management agreement:", agreementResult.error);
        } else {
          console.log("Updated management agreement (GREC compliance) - id:", agreementResult.data?.id);
        }
      } else {
        // Insert new
        agreementResult = await supabase
          .from("management_agreements")
          .insert(agreementData)
          .select()
          .single();
        
        if (agreementResult.error) {
          console.error("Error inserting management agreement:", agreementResult.error);
        } else {
          console.log("Created management agreement (GREC compliance) - id:", agreementResult.data?.id);
        }
      }
    } else {
      console.log("Skipping management_agreements save - no propertyId available");
    }

    // Update lead stage and timeline if we have a lead
    if (leadData) {
      // Update lead stage to contract_signed
      const { error: leadUpdateError } = await supabase
        .from("leads")
        .update({
          stage: "contract_signed",
          stage_changed_at: new Date().toISOString(),
          property_id: propertyId || leadData.property_id,
          owner_id: ownerId || leadData.owner_id,
          property_address: propertyAddress || leadData.property_address,
        })
        .eq("id", leadData.id);
      
      if (leadUpdateError) {
        console.error("Error updating lead stage:", leadUpdateError);
      } else {
        console.log("Updated lead stage to contract_signed");
      }
      
      // Add timeline entry
      await supabase.from("lead_timeline").insert({
        lead_id: leadData.id,
        action: "Contract signed by all parties - moved to contract_signed stage",
        metadata: {
          document_id: documentId,
          signed_pdf_path: fileName,
          certificate_id: certificateId,
          property_address: propertyAddress,
          owner_id: ownerId,
          property_id: propertyId,
          service_type: contractData.serviceType,
          management_fee: contractData.managementFee,
          visit_price: contractData.visitPrice,
          previous_stage: leadData.stage,
          new_stage: "contract_signed",
        },
      });
    }

    // Fetch property image from RapidAPI if we have property ID and address
    if (propertyId && propertyAddress) {
      try {
        console.log("Fetching property image from RapidAPI for:", propertyAddress);
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        
        const imageResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-property-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ address: propertyAddress, propertyId }),
        });
        
        if (imageResponse.ok) {
          const imageResult = await imageResponse.json();
          console.log("Property image fetch result:", imageResult.success ? "success" : "failed");
        }
      } catch (imgError) {
        console.error("Failed to fetch property image (non-blocking):", imgError);
      }
    }

    console.log("Document finalized successfully:", fileName, "Certificate ID:", certificateId);
    console.log("Created/Updated - Owner:", ownerId, "Property:", propertyId, "Visit Price:", contractData.visitPrice);

    return new Response(
      JSON.stringify({
        success: true,
        signedPdfPath: fileName,
        signedUrl: downloadUrl,
        certificateId,
        documentHash,
        propertyAddress,
        ownerId,
        propertyId,
        contractData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error finalizing document:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
