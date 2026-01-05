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
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Ready for Signature</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-radius: 16px 16px 0 0;">
              <div style="font-size: 48px; margin-bottom: 16px;">🍑</div>
              <h1 style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 700;">PeachHaus Group</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 22px; font-weight: 600;">
                Hi ${recipientName.split(" ")[0]},
              </h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Your agreement is ready for signature. Please review and sign the document at your convenience.
              </p>
              
              <!-- Document Card -->
              <div style="background-color: #fef3c7; border-radius: 12px; padding: 24px; margin-bottom: 32px; border-left: 4px solid #f59e0b;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <span style="font-size: 20px; margin-right: 12px;">📄</span>
                  <span style="color: #92400e; font-weight: 600; font-size: 14px;">DOCUMENT TO SIGN</span>
                </div>
                <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                  ${documentName}
                </p>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 32px;">
                <a href="${signingUrl}" style="display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #1f2937; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);">
                  ✍️ Review & Sign Document
                </a>
              </div>
              
              <!-- Expiry Notice -->
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                  ⏰ This link expires in <strong>${expiresIn}</strong>
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-align: center;">
                🔒 This document is legally binding under the ESIGN Act
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                Questions? Reply to this email or call us at (555) 123-4567
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
      { name: "PeachHaus Group", email: "anja@peachhausgroup.com", type: "manager", order: 2 },
    ];

    // Add second owner if provided
    if (secondOwnerName && secondOwnerEmail) {
      signers.splice(1, 0, { name: secondOwnerName, email: secondOwnerEmail, type: "second_owner", order: 1 });
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
    const signingUrl = `https://peachhaus.lovable.app/sign/${ownerToken.token}`;
    
    const emailHtml = buildSigningEmailHtml(
      ownerName,
      template.name,
      signingUrl,
      "48 hours"
    );

    const emailResult = await resend.emails.send({
      from: "PeachHaus Group <contracts@peachhausgroup.com>",
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
