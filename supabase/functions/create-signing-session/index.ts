import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SigningRequest {
  documentId: string;
  templateId: string;
  ownerName: string;
  ownerEmail: string;
  secondOwnerName?: string;
  secondOwnerEmail?: string;
  leadId?: string;
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
  expiresIn: string
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
    
    <!-- Header - Corporate Minimal with Logo -->
    <div style="padding: 24px 32px; border-bottom: 2px solid #111111;">
      <table style="width: 100%;">
        <tr>
          <td style="vertical-align: middle;">
            <img src="${LOGO_URL}" alt="PeachHaus" style="height: 40px; width: auto;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
            <div style="display: none; font-size: 20px; font-weight: 700; color: #111111; letter-spacing: -0.3px;">PeachHaus</div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <div style="font-size: 16px; font-weight: 600; color: #111111; margin-bottom: 4px;">DOCUMENT FOR SIGNATURE</div>
            <div style="font-size: 10px; color: #666666; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
              ${issueDate}
            </div>
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
        Your property management agreement with PeachHaus Group is ready for signature. Please review the document and sign at your convenience.
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
          <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">Review agreement terms</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">Fill in property address</td>
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const appUrl = Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", ".lovable.app");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const body: SigningRequest = await req.json();
    const { documentId, templateId, ownerName, ownerEmail, secondOwnerName, secondOwnerEmail, leadId } = body;

    console.log("Creating signing session for document:", documentId);

    // Get template details
    const { data: template, error: templateError } = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError) throw templateError;

    // Create signing tokens for each signer
    const signers = [
      { name: ownerName, email: ownerEmail, type: "owner", order: 1 },
    ];

    // Add second owner if provided with a DIFFERENT email
    if (secondOwnerName && secondOwnerEmail && secondOwnerEmail !== ownerEmail) {
      signers.push({ name: secondOwnerName, email: secondOwnerEmail, type: "second_owner", order: 2 });
      // Manager comes after second owner
      signers.push({ name: "PeachHaus Group", email: "anja@peachhausgroup.com", type: "manager", order: 3 });
    } else {
      // No second owner, manager is order 2
      signers.push({ name: "PeachHaus Group", email: "anja@peachhausgroup.com", type: "manager", order: 2 });
    }

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

    // Update booking document status
    await supabase
      .from("booking_documents")
      .update({
        status: "pending",
        is_draft: false,
        sent_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    // Log audit entry
    await supabase.from("document_audit_log").insert({
      document_id: documentId,
      action: "signing_session_created",
      metadata: {
        signers: signers.map(s => ({ name: s.name, email: s.email, type: s.type })),
        expires_at: expiresAt.toISOString(),
      },
    });

    // Send signing email to the first signer (owner)
    const ownerToken = tokens.find(t => t.signer_type === "owner");
    const signingUrl = `${APP_URL}/sign/${ownerToken.token}`;
    
    const emailHtml = buildSigningEmailHtml(
      ownerName,
      template.name,
      signingUrl,
      "48 hours"
    );

    const emailResult = await resend.emails.send({
      from: "PeachHaus Group <info@peachhausgroup.com>",
      to: [ownerEmail],
      subject: `📝 Your Agreement is Ready for Signature - ${template.name}`,
      html: emailHtml,
    });

    console.log("Signing email sent:", emailResult);

    // Log timeline entry if lead is provided
    if (leadId) {
      await supabase.from("lead_timeline").insert({
        lead_id: leadId,
        action: "Signing email sent",
        metadata: {
          document_id: documentId,
          template_name: template.name,
          recipient: ownerEmail,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        tokens: tokens.map(t => ({ id: t.id, signerType: t.signer_type, email: t.signer_email })),
        signingUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error creating signing session:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
