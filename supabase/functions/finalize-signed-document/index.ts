import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";

const buildCompletionEmailHtml = (
  recipientName: string,
  documentName: string,
  signers: { name: string; email: string; signedAt: string; type: string }[],
  downloadUrl: string
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
        <div style="font-size: 11px; color: #10b981;">✓ ${new Date(s.signedAt).toLocaleDateString()}</div>
      </td>
    </tr>
  `).join('');

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
            <div style="font-size: 16px; font-weight: 600; color: #10b981; margin-bottom: 4px;">✓ DOCUMENT COMPLETE</div>
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
          <td style="vertical-align: middle;">
            <div style="font-size: 32px; margin-right: 16px;">🎉</div>
          </td>
          <td style="vertical-align: middle; width: 100%;">
            <div style="font-size: 18px; font-weight: 700; color: #065f46; margin-bottom: 4px;">Agreement Fully Executed</div>
            <div style="font-size: 13px; color: #047857;">All parties have signed. The document is now legally binding.</div>
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
            <div style="font-size: 12px; color: #065f46; margin-bottom: 12px;">Your signed copy is attached to this email</div>
            <a href="${downloadUrl}" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 32px; font-weight: 600; font-size: 14px; letter-spacing: 0.3px; border-radius: 6px;">
              📄 DOWNLOAD SIGNED DOCUMENT
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
              🍑 PeachHaus Group • info@peachhausgroup.com
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

    // Get document details
    const { data: document, error: docError } = await supabase
      .from("booking_documents")
      .select(`
        *,
        document_templates (
          id,
          name,
          file_path
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
    } else {
      // Create a new PDF if no template found
      console.log("No template PDF found, creating certificate-only document");
      pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      page.drawText(document.document_name || "Signed Agreement", { x: 50, y: 750, size: 24, font });
    }

    // Add signature certificate page
    const certPage = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let yPos = 750;
    
    // Header
    certPage.drawText("CERTIFICATE OF COMPLETION", {
      x: 150,
      y: yPos,
      size: 20,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    
    yPos -= 40;
    certPage.drawText(`Document: ${document.document_name || document.document_templates?.name || "Agreement"}`, {
      x: 50,
      y: yPos,
      size: 12,
      font,
    });
    
    yPos -= 20;
    certPage.drawText(`Document ID: ${documentId}`, {
      x: 50,
      y: yPos,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    
    yPos -= 15;
    certPage.drawText(`Completed: ${new Date().toLocaleString()}`, {
      x: 50,
      y: yPos,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    
    yPos -= 40;
    certPage.drawText("SIGNATURE DETAILS", {
      x: 50,
      y: yPos,
      size: 14,
      font: boldFont,
    });
    
    yPos -= 25;
    
    for (const sig of signatures || []) {
      certPage.drawText(`${sig.signer_name}`, {
        x: 50,
        y: yPos,
        size: 12,
        font: boldFont,
      });
      
      yPos -= 18;
      certPage.drawText(`Email: ${sig.signer_email}`, {
        x: 70,
        y: yPos,
        size: 10,
        font,
      });
      
      yPos -= 15;
      certPage.drawText(`Role: ${sig.signer_type.replace("_", " ").toUpperCase()}`, {
        x: 70,
        y: yPos,
        size: 10,
        font,
      });
      
      yPos -= 15;
      certPage.drawText(`Signed: ${sig.signed_at ? new Date(sig.signed_at).toLocaleString() : "N/A"}`, {
        x: 70,
        y: yPos,
        size: 10,
        font,
      });
      
      yPos -= 15;
      certPage.drawText(`IP Address: ${sig.ip_address || "N/A"}`, {
        x: 70,
        y: yPos,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      
      // Draw the signature image if available
      if (sig.signature_data && sig.signature_data.startsWith("data:image/png;base64,")) {
        try {
          const signatureBase64 = sig.signature_data.split(",")[1];
          const signatureBytes = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
          const signatureImage = await pdfDoc.embedPng(signatureBytes);
          
          yPos -= 5;
          certPage.drawImage(signatureImage, {
            x: 70,
            y: yPos - 40,
            width: 150,
            height: 40,
          });
          yPos -= 50;
        } catch (imgError) {
          console.error("Error embedding signature image:", imgError);
          yPos -= 10;
        }
      }
      
      yPos -= 25;
    }
    
    // Footer
    yPos = 100;
    certPage.drawText("This document was signed electronically and is legally binding under the ESIGN Act.", {
      x: 50,
      y: yPos,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    
    yPos -= 15;
    certPage.drawText("PeachHaus Group • Property Management Made Simple", {
      x: 50,
      y: yPos,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
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

    // Update document with signed PDF path
    await supabase
      .from("booking_documents")
      .update({
        signed_pdf_path: fileName,
        status: "completed",
      })
      .eq("id", documentId);

    // Log audit entry
    await supabase.from("document_audit_log").insert({
      document_id: documentId,
      action: "document_finalized",
      metadata: {
        signed_pdf_path: fileName,
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

    // Convert PDF bytes to base64 for attachment
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(modifiedPdfBytes)));
    const documentDisplayName = document.document_name || document.document_templates?.name || "Agreement";

    console.log("Sending completion emails to", signerDetails.length, "signers with PDF attachment");

    for (const signer of signerDetails) {
      try {
        await resend.emails.send({
          from: "PeachHaus Group <info@peachhausgroup.com>",
          to: [signer.email],
          subject: `🎉 Agreement Complete: ${documentDisplayName}`,
          html: buildCompletionEmailHtml(
            signer.name,
            documentDisplayName,
            signerDetails,
            downloadUrl
          ),
          attachments: [
            {
              filename: `${documentDisplayName.replace(/[^a-zA-Z0-9]/g, '_')}_Signed.pdf`,
              content: pdfBase64,
            },
          ],
        });
        console.log("Sent completion email with attachment to:", signer.email);
      } catch (emailError) {
        console.error("Error sending email to", signer.email, ":", emailError);
      }
    }

    // Update lead stage if associated and save to management_agreements
    const { data: lead } = await supabase
      .from("leads")
      .select("id, property_id, owner_id")
      .eq("signwell_document_id", documentId)
      .maybeSingle();

    if (lead) {
      // Update lead to contract_signed stage, then to onboarding
      await supabase
        .from("leads")
        .update({
          stage: "onboarding",
          stage_changed_at: new Date().toISOString(),
        })
        .eq("id", lead.id);

      await supabase.from("lead_timeline").insert({
        lead_id: lead.id,
        action: "Contract signed by all parties - Moving to onboarding",
        metadata: {
          document_id: documentId,
          signed_pdf_path: fileName,
          next_stage: "onboarding",
        },
      });

      // If this is a management agreement, save to management_agreements table
      if (document.contract_type === "management_agreement" && lead.property_id) {
        // Extract management fee from field configuration if available
        const fieldConfig = document.field_configuration as Record<string, any> | null;
        let managementFee = 20; // Default 20%
        
        if (fieldConfig) {
          // Try to find the selected package from field values
          const packageField = Object.entries(fieldConfig).find(([key, val]) => 
            key.toLowerCase().includes("package") && val === true
          );
          if (packageField) {
            const packageName = packageField[0].toLowerCase();
            if (packageName.includes("20")) managementFee = 20;
            else if (packageName.includes("25")) managementFee = 25;
            else if (packageName.includes("30")) managementFee = 30;
          }
        }

        // Get owner and manager signed timestamps
        const ownerSig = signatures?.find(s => s.signer_type === "owner");
        const managerSig = signatures?.find(s => s.signer_type === "manager");

        const { error: agreementError } = await supabase
          .from("management_agreements")
          .insert({
            property_id: lead.property_id,
            owner_id: lead.owner_id,
            agreement_date: new Date().toISOString().split('T')[0],
            effective_date: new Date().toISOString().split('T')[0],
            document_path: fileName,
            management_fee_percentage: managementFee,
            signed_by_owner: true,
            signed_by_owner_at: ownerSig?.signed_at || new Date().toISOString(),
            signed_by_company: true,
            signed_by_company_at: managerSig?.signed_at || new Date().toISOString(),
            status: "active",
          });

        if (agreementError) {
          console.error("Error saving management agreement:", agreementError);
        } else {
          console.log("Management agreement saved to database");
          
          // Add timeline entry for agreement creation
          await supabase.from("lead_timeline").insert({
            lead_id: lead.id,
            action: "Management agreement saved to database",
            metadata: {
              property_id: lead.property_id,
              management_fee: managementFee,
            },
          });
        }
      }
    }

    console.log("Document finalized successfully:", fileName);

    return new Response(
      JSON.stringify({
        success: true,
        signedPdfPath: fileName,
        signedUrl: downloadUrl,
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
