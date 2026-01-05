import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const buildCompletionEmailHtml = (
  recipientName: string,
  documentName: string,
  signers: { name: string; email: string; signedAt: string }[]
): string => {
  const signersList = signers.map(s => 
    `<li style="margin-bottom: 8px;"><strong>${s.name}</strong> (${s.email}) - ${new Date(s.signedAt).toLocaleDateString()}</li>`
  ).join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px 16px 0 0;">
              <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Document Complete!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 20px; font-weight: 600;">
                Hi ${recipientName.split(" ")[0]},
              </h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Great news! All parties have signed the agreement. The document is now complete and legally binding.
              </p>
              
              <div style="background-color: #ecfdf5; border-radius: 12px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #10b981;">
                <p style="margin: 0 0 8px; color: #065f46; font-weight: 600; font-size: 14px;">COMPLETED DOCUMENT</p>
                <p style="margin: 0 0 16px; color: #1f2937; font-size: 18px; font-weight: 600;">${documentName}</p>
                <p style="margin: 0 0 8px; color: #065f46; font-weight: 600; font-size: 14px;">SIGNED BY:</p>
                <ul style="margin: 0; padding-left: 20px; color: #1f2937;">
                  ${signersList}
                </ul>
              </div>
              
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                A copy of the signed document is attached to this email for your records.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-align: center;">
                🔒 This document is legally binding under the ESIGN Act
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                🍑 PeachHaus Group • Property Management Made Simple
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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

    // Get the original PDF
    let pdfDoc: PDFDocument;
    
    if (document.document_templates?.file_path) {
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from("onboarding-documents")
        .download(document.document_templates.file_path);

      if (downloadError) throw downloadError;
      
      const pdfBytes = await pdfData.arrayBuffer();
      pdfDoc = await PDFDocument.load(pdfBytes);
    } else {
      // Create a new PDF if no template
      pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText("Signed Agreement", { x: 50, y: 750, size: 24, font });
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
      certPage.drawText(`Signed: ${new Date(sig.signed_at).toLocaleString()}`, {
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
    certPage.drawText("🍑 PeachHaus Group • Property Management Made Simple", {
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

    if (uploadError) throw uploadError;

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

    // Get signed URL for email attachment
    const { data: signedUrl } = await supabase.storage
      .from("signed-documents")
      .createSignedUrl(fileName, 604800); // 7 days

    // Send completion emails to all signers
    const signerDetails = signatures?.map(s => ({
      name: s.signer_name,
      email: s.signer_email,
      signedAt: s.signed_at,
    })) || [];

    for (const signer of signerDetails) {
      await resend.emails.send({
        from: "PeachHaus Group <onboarding@resend.dev>",
        to: [signer.email],
        subject: `🎉 Document Complete: ${document.document_name || document.document_templates?.name || "Agreement"}`,
        html: buildCompletionEmailHtml(
          signer.name,
          document.document_name || document.document_templates?.name || "Agreement",
          signerDetails
        ),
      });
    }

    // Update lead stage if associated
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("signwell_document_id", documentId)
      .maybeSingle();

    if (lead) {
      await supabase
        .from("leads")
        .update({
          stage: "contract_signed",
          stage_changed_at: new Date().toISOString(),
        })
        .eq("id", lead.id);

      await supabase.from("lead_timeline").insert({
        lead_id: lead.id,
        action: "Contract signed by all parties",
        metadata: {
          document_id: documentId,
          signed_pdf_path: fileName,
        },
      });
    }

    console.log("Document finalized successfully:", fileName);

    return new Response(
      JSON.stringify({
        success: true,
        signedPdfPath: fileName,
        signedUrl: signedUrl?.signedUrl,
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
