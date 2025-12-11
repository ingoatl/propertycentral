import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Replace all [[placeholder]] tags in the DOCX XML content
function replacePlaceholders(xmlContent: string, replacements: Record<string, string>): string {
  let result = xmlContent;
  
  // First, clean up any Word-split placeholders (Word sometimes splits text across XML tags)
  // Match patterns like [[field]] that may have XML tags interspersed
  const placeholderRegex = /\[\[([^\]]+)\]\]/g;
  
  // Replace each placeholder with its value
  for (const [key, value] of Object.entries(replacements)) {
    // Try multiple formats: [[key]], {{key}}, {key}
    const patterns = [
      new RegExp(`\\[\\[${escapeRegex(key)}\\]\\]`, 'gi'),
      new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'gi'),
      new RegExp(`\\{${escapeRegex(key)}\\}`, 'gi'),
    ];
    
    for (const pattern of patterns) {
      result = result.replace(pattern, escapeXml(value));
    }
  }
  
  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Process DOCX file and replace placeholders
async function processDocx(docxBuffer: ArrayBuffer, replacements: Record<string, string>): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(docxBuffer);
  
  // Process the main document content
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (documentXml) {
    const processedXml = replacePlaceholders(documentXml, replacements);
    zip.file("word/document.xml", processedXml);
  }
  
  // Also process headers and footers
  const headerFooterFiles = Object.keys(zip.files).filter(
    name => name.match(/word\/(header|footer)\d*\.xml/)
  );
  
  for (const fileName of headerFooterFiles) {
    const content = await zip.file(fileName)?.async("string");
    if (content) {
      const processedContent = replacePlaceholders(content, replacements);
      zip.file(fileName, processedContent);
    }
  }
  
  // Generate the modified DOCX
  return await zip.generateAsync({ type: "uint8array" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SIGNWELL_API_KEY = Deno.env.get("SIGNWELL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SIGNWELL_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      templateId,
      documentName,
      recipientName,
      recipientEmail,
      propertyId,
      bookingId,
      preFillData,
      guestFields,
      detectedFields,
    } = await req.json();

    console.log("Creating draft document:", { templateId, documentName, recipientName });
    console.log("Pre-fill data received:", JSON.stringify(preFillData, null, 2));

    // Get template details
    const { data: template, error: templateError } = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      throw new Error("Template not found");
    }

    // Build replacements object with all variations of field names
    const replacements: Record<string, string> = {};
    
    // Add all pre-fill data fields
    if (preFillData && typeof preFillData === "object") {
      for (const [key, value] of Object.entries(preFillData)) {
        if (value && typeof value === "string" && value.trim()) {
          replacements[key] = value.trim();
          
          // Add common aliases
          if (key === "property_address") {
            const addr = value.trim();
            replacements["address"] = addr;
            replacements["listing_address"] = addr;
            
            // Extract city from address (format: "123 Street, City, State ZIP")
            const parts = addr.split(",").map(p => p.trim());
            if (parts.length >= 2) {
              // City is typically the second-to-last part before state/zip
              const cityPart = parts.length >= 3 ? parts[1] : parts[0];
              if (cityPart) {
                replacements["listing_city"] = cityPart;
                replacements["city"] = cityPart;
                replacements["property_city"] = cityPart;
              }
              // State is typically the last part (may include ZIP)
              if (parts.length >= 3) {
                const stateZip = parts[2].trim();
                const statePart = stateZip.split(" ")[0];
                if (statePart) {
                  replacements["listing_state"] = statePart;
                  replacements["state"] = statePart;
                }
              }
            }
          }
          if (key === "monthly_rent") {
            const formatted = value.startsWith("$") ? value : `$${value}`;
            replacements[key] = formatted;
            replacements["rent_amount"] = formatted;
            replacements["rent"] = formatted;
          }
          if (key === "security_deposit") {
            const formatted = value.startsWith("$") ? value : `$${value}`;
            replacements[key] = formatted;
            replacements["deposit_amount"] = formatted;
            replacements["deposit"] = formatted;
          }
          if (key === "lease_start_date" || key === "start_date") {
            try {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                const formatted = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                replacements[key] = formatted;
                replacements["start_date"] = formatted;
                replacements["lease_start"] = formatted;
              }
            } catch (e) {
              console.log("Could not parse start date:", value);
            }
          }
          if (key === "lease_end_date" || key === "end_date") {
            try {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                const formatted = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                replacements[key] = formatted;
                replacements["end_date"] = formatted;
                replacements["lease_end"] = formatted;
              }
            } catch (e) {
              console.log("Could not parse end date:", value);
            }
          }
          if (key === "brand_name" || key === "property_name") {
            replacements["property_name"] = value.trim();
            replacements["brand_name"] = value.trim();
          }
        }
      }
    }
    
    // Add guest info with all common variations
    if (recipientName) {
      replacements["guest_name"] = recipientName;
      replacements["guest_full_name"] = recipientName;
      replacements["tenant_name"] = recipientName;
      replacements["tenant_full_name"] = recipientName;
      replacements["renter_name"] = recipientName;
      replacements["lessee_name"] = recipientName;
      replacements["occupant_name"] = recipientName;
    }
    if (recipientEmail) {
      replacements["guest_email"] = recipientEmail;
      replacements["tenant_email"] = recipientEmail;
      replacements["renter_email"] = recipientEmail;
    }
    
    // Always set host/landlord/agent name to PeachHaus Group LLC
    replacements["host_name"] = "PeachHaus Group LLC";
    replacements["landlord_name"] = "PeachHaus Group LLC";
    replacements["agent_name"] = "PeachHaus Group LLC";
    replacements["innkeeper_name"] = "PeachHaus Group LLC";
    replacements["management_company"] = "PeachHaus Group LLC";
    replacements["company_name"] = "PeachHaus Group LLC";
    
    // Add today's date
    const today = new Date();
    const formattedToday = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    replacements["agreement_date"] = formattedToday;
    replacements["todays_date"] = formattedToday;
    replacements["today_date"] = formattedToday;
    replacements["current_date"] = formattedToday;

    console.log("Replacements to apply:", JSON.stringify(replacements, null, 2));

    // Determine the file URL
    const fileUrl = template.file_path.startsWith("http")
      ? template.file_path
      : `${SUPABASE_URL}/storage/v1/object/public/onboarding-documents/${template.file_path}`;
    
    // Check if it's a DOCX file that we can process
    const isDocx = template.file_path.toLowerCase().endsWith('.docx');
    let processedFileBase64: string | null = null;
    
    if (isDocx && Object.keys(replacements).length > 0) {
      console.log("Processing DOCX file for placeholder replacement...");
      
      // Download the DOCX file
      const docxResponse = await fetch(fileUrl);
      if (!docxResponse.ok) {
        throw new Error(`Failed to download template: ${docxResponse.status}`);
      }
      
      const docxBuffer = await docxResponse.arrayBuffer();
      console.log("Downloaded DOCX, size:", docxBuffer.byteLength);
      
      // Process the DOCX and replace placeholders
      const processedDocx = await processDocx(docxBuffer, replacements);
      console.log("Processed DOCX, size:", processedDocx.byteLength);
      
      // Convert to base64 for SignWell using chunked approach (avoids stack overflow)
      const chunks: string[] = [];
      const chunkSize = 8192;
      for (let i = 0; i < processedDocx.length; i += chunkSize) {
        const chunk = processedDocx.subarray(i, i + chunkSize);
        chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
      }
      processedFileBase64 = btoa(chunks.join(''));
    }

    // Build SignWell payload
    // with_signature_page: true auto-generates a signature page at the end
    // This eliminates the need for visual field placement or text tags for signatures
    // test_mode: true - uses test API which doesn't count against document limits
    
    // Note: When using with_signature_page: true, SignWell auto-generates signature fields
    // Custom fields array is not supported with this mode - guest-fillable text fields
    // must be handled via placeholder replacement in the DOCX or manual visual editor
    
    const signwellPayload: Record<string, unknown> = {
      test_mode: true,
      draft: false, // Set to false to skip visual editor - auto signature page handles it
      with_signature_page: true, // Auto-generate signature page at end of document
      reminders: true, // Enable email reminders
      apply_signing_order: false, // Allow parallel signing - both can sign at the same time
      embedded_signing: true,
      embedded_signing_notifications: true, // Enable signing notifications via email
      name: documentName || template.name,
      recipients: [
        {
          id: "guest",
          email: recipientEmail,
          name: recipientName,
          send_email: true, // Send email to guest automatically
        },
        {
          id: "host",
          email: "anja@peachhausgroup.com",
          name: "PeachHaus Group LLC",
          send_email: true, // Send email to host automatically
        },
      ],
    };
    
    // Note: fields array removed - not compatible with with_signature_page mode
    // Use processed file or original URL
    if (processedFileBase64) {
      signwellPayload.files = [
        {
          name: `${template.name.trim()}.docx`,
          file_base64: processedFileBase64,
        },
      ];
    } else if (template.signwell_template_id) {
      signwellPayload.template_id = template.signwell_template_id;
    } else {
      signwellPayload.files = [
        {
          name: template.file_path.includes(".")
            ? `${template.name.trim()}.${template.file_path.split(".").pop()}`
            : template.name,
          file_url: fileUrl,
        },
      ];
    }

    console.log("SignWell payload (excluding file_base64):", JSON.stringify({
      ...signwellPayload,
      files: signwellPayload.files ? (signwellPayload.files as any[]).map((f: any) => ({
        name: f.name,
        file_url: f.file_url,
        has_base64: !!f.file_base64,
      })) : undefined,
    }, null, 2));

    const signwellResponse = await fetch("https://www.signwell.com/api/v1/documents/", {
      method: "POST",
      headers: {
        "X-Api-Key": SIGNWELL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signwellPayload),
    });

    if (!signwellResponse.ok) {
      const errorText = await signwellResponse.text();
      console.error("SignWell API error:", errorText);
      throw new Error(`SignWell API error: ${errorText}`);
    }

    const signwellData = await signwellResponse.json();
    console.log("SignWell response:", JSON.stringify(signwellData, null, 2));

    // Get current user
    const authHeader = req.headers.get("Authorization");
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id;
    }

    // Create document record in database
    const { data: docRecord, error: docError } = await supabase
      .from("booking_documents")
      .insert({
        template_id: templateId,
        booking_id: bookingId || null,
        property_id: propertyId || null,
        document_name: documentName || template.name,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        signwell_document_id: signwellData.id,
        embedded_edit_url: signwellData.embedded_edit_url,
        is_draft: false, // No longer a draft - auto signature page is used
        status: "pending", // Ready for signatures
        guest_signing_url: signwellData.recipients?.find((r: any) => r.id === "guest")?.embedded_signing_url,
        host_signing_url: signwellData.recipients?.find((r: any) => r.id === "host")?.embedded_signing_url,
        field_configuration: { preFillData, guestFields, detectedFields, replacementsApplied: Object.keys(replacements) },
        created_by: userId,
      })
      .select()
      .single();

    if (docError) {
      console.error("Database error:", docError);
      throw new Error("Failed to save document record");
    }

    // Log audit entry
    await supabase.from("document_audit_log").insert({
      document_id: docRecord.id,
      action: "document_created",
      performed_by: userId || "system",
      metadata: { 
        signwellDocumentId: signwellData.id, 
        fieldsReplaced: Object.keys(replacements).length,
        wasDocxProcessed: !!processedFileBase64,
        withSignaturePage: true,
      },
    });

    // Extract signing URLs from recipients
    const guestSigningUrl = signwellData.recipients?.find((r: any) => r.id === "guest")?.embedded_signing_url;
    const hostSigningUrl = signwellData.recipients?.find((r: any) => r.id === "host")?.embedded_signing_url;

    return new Response(
      JSON.stringify({
        success: true,
        documentId: docRecord.id,
        signwellDocumentId: signwellData.id,
        embeddedEditUrl: signwellData.embedded_edit_url,
        guestSigningUrl,
        hostSigningUrl,
        status: "pending",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
