import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateDocumentRequest {
  templateId: string;
  documentName: string;
  recipientName: string;
  recipientEmail: string;
  propertyId?: string;
  bookingId?: string;
  preFillData: Record<string, string>;
  detectedFields: Array<{
    api_id: string;
    label: string;
    type: string;
    category: string;
    filled_by: string;
  }>;
}

const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";
const APP_URL = "https://id-preview--9ed06ecd-51b7-4166-a07a-107b37f1e8c1.lovable.app";

const generateSecureToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const buildSigningEmailHtml = (
  recipientName: string,
  documentName: string,
  signingUrl: string,
  expiresIn: string,
  propertyAddress?: string
): string => {
  const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Ready for Signature</title>
</head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
    
    <!-- Header -->
    <div style="padding: 24px 32px; border-bottom: 2px solid #111111;">
      <table style="width: 100%;">
        <tr>
          <td style="vertical-align: middle;">
            <img src="${LOGO_URL}" alt="PeachHaus" style="height: 40px; width: auto;" />
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <div style="font-size: 16px; font-weight: 600; color: #111111; margin-bottom: 4px;">DOCUMENT FOR SIGNATURE</div>
            <div style="font-size: 10px; color: #666666;">${issueDate}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Document Info -->
    <div style="padding: 20px 32px; background: #f9f9f9; border-bottom: 1px solid #e5e5e5;">
      <table style="width: 100%;">
        <tr>
          <td style="vertical-align: top; width: 50%;">
            <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Document</div>
            <div style="font-size: 14px; font-weight: 600; color: #111111;">${documentName}</div>
          </td>
          <td style="vertical-align: top; text-align: right;">
            <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Expires</div>
            <div style="font-size: 14px; font-weight: 600; color: #111111;">${expiresIn}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Greeting -->
    <div style="padding: 24px 32px 16px 32px;">
      <p style="font-size: 14px; line-height: 1.6; color: #111111; margin: 0;">
        Dear ${recipientName.split(" ")[0]},
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #444444; margin: 12px 0 0 0;">
        ${propertyAddress 
          ? `Your rental agreement for <strong>${propertyAddress}</strong> is ready for signature.` 
          : 'Your document is ready for signature.'
        } Please review and sign at your convenience.
      </p>
    </div>

    <!-- CTA Button -->
    <div style="padding: 0 32px 24px 32px;">
      <table style="width: 100%; border: 2px solid #111111;">
        <tr>
          <td style="padding: 20px; text-align: center;">
            <a href="${signingUrl}" style="display: inline-block; background: #111111; color: #ffffff; text-decoration: none; padding: 14px 40px; font-weight: 600; font-size: 14px; letter-spacing: 0.3px;">
              REVIEW & SIGN DOCUMENT
            </a>
          </td>
        </tr>
      </table>
    </div>

    <!-- What to expect -->
    <div style="padding: 0 32px 24px 32px;">
      <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">What you'll complete</div>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">Review all document terms</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">Fill in any required fields</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">Add your electronic signature</td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding: 20px 32px; background: #f9f9f9; border-top: 1px solid #e5e5e5;">
      <p style="margin: 0 0 8px; color: #666666; font-size: 11px;">
        This document is legally binding under the Electronic Signatures in Global and National Commerce Act (ESIGN).
      </p>
      <p style="margin: 0; color: #999999; font-size: 11px;">
        Questions? Contact us at info@peachhausgroup.com
      </p>
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const body: CreateDocumentRequest = await req.json();
    const { 
      templateId, 
      documentName, 
      recipientName, 
      recipientEmail, 
      propertyId, 
      bookingId,
      preFillData,
      detectedFields 
    } = body;

    console.log("Creating document for signing:", documentName);
    console.log("Recipient:", recipientName, recipientEmail);
    console.log("Pre-fill data keys:", Object.keys(preFillData));

    // Get template details
    const { data: template, error: templateError } = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError) throw templateError;

    // Create booking document record
    const { data: bookingDoc, error: docError } = await supabase
      .from("booking_documents")
      .insert({
        template_id: templateId,
        booking_id: bookingId,
        property_id: propertyId,
        document_name: documentName,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        status: "draft",
        is_draft: true,
        document_type: template.contract_type || "rental_agreement",
        field_configuration: {
          preFillData,
          detectedFields,
        },
      })
      .select()
      .single();

    if (docError) throw docError;

    const documentId = bookingDoc.id;
    console.log("Created booking document:", documentId);

    // Create signing tokens for each signer
    const signers = [
      { name: recipientName, email: recipientEmail, type: "guest", order: 1 },
      { name: "PeachHaus Group", email: "info@peachhausgroup.com", type: "manager", order: 2 },
    ];

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const tokens: any[] = [];

    for (const signer of signers) {
      const token = generateSecureToken();
      
      const { data: tokenData, error: tokenError } = await supabase
        .from("signing_tokens")
        .insert({
          document_id: documentId,
          signer_email: signer.email,
          signer_name: signer.name,
          signer_type: signer.type,
          signing_order: signer.order,
          token,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (tokenError) throw tokenError;
      tokens.push(tokenData);
    }

    // Build signing URLs
    const guestToken = tokens.find(t => t.signer_type === "guest");
    const managerToken = tokens.find(t => t.signer_type === "manager");
    
    const guestSigningUrl = guestToken ? `${APP_URL}/sign/${guestToken.token}` : null;
    const hostSigningUrl = managerToken ? `${APP_URL}/sign/${managerToken.token}` : null;

    // Update booking document with signing URLs and mark as sent
    await supabase
      .from("booking_documents")
      .update({
        status: "pending",
        is_draft: false,
        sent_at: new Date().toISOString(),
        guest_signing_url: guestSigningUrl,
        host_signing_url: hostSigningUrl,
      })
      .eq("id", documentId);

    // Log audit entry
    await supabase.from("document_audit_log").insert({
      document_id: documentId,
      action: "document_created_for_signing",
      metadata: {
        signers: signers.map(s => ({ name: s.name, email: s.email, type: s.type })),
        expires_at: expiresAt.toISOString(),
        template_name: template.name,
        pre_filled_fields: Object.keys(preFillData).length,
      },
    });

    // Get property address for email
    let propertyAddress = preFillData.property_address || "";
    if (!propertyAddress && propertyId) {
      const { data: property } = await supabase
        .from("properties")
        .select("address")
        .eq("id", propertyId)
        .single();
      propertyAddress = property?.address || "";
    }

    // Send signing email to guest
    if (resend && guestSigningUrl) {
      const emailHtml = buildSigningEmailHtml(
        recipientName,
        documentName,
        guestSigningUrl,
        "48 hours",
        propertyAddress
      );

      try {
        const emailResult = await resend.emails.send({
          from: "PeachHaus Group <info@peachhausgroup.com>",
          to: [recipientEmail],
          subject: `📝 Document Ready for Signature - ${documentName}`,
          html: emailHtml,
        });

        console.log("Signing email sent:", emailResult);
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
        // Don't fail the whole operation if email fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        guestSigningUrl,
        hostSigningUrl,
        message: "Document created and signing invitation sent!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error creating document for signing:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
