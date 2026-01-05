import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubmitSignatureRequest {
  token: string;
  signatureData: string; // Base64 signature image
  agreedToTerms: boolean;
}

const buildConfirmationEmailHtml = (
  recipientName: string,
  documentName: string
): string => {
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
              <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Signature Complete!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 20px; font-weight: 600;">
                Hi ${recipientName.split(" ")[0]},
              </h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Thank you for signing. Your signature has been recorded successfully.
              </p>
              <div style="background-color: #ecfdf5; border-radius: 12px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #10b981;">
                <p style="margin: 0 0 8px; color: #065f46; font-weight: 600; font-size: 14px;">DOCUMENT SIGNED</p>
                <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">${documentName}</p>
              </div>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                You'll receive the final signed document once all parties have completed signing.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; border-top: 1px solid #e5e7eb;">
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

const buildNextSignerEmailHtml = (
  recipientName: string,
  documentName: string,
  signingUrl: string,
  previousSignerName: string
): string => {
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
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-radius: 16px 16px 0 0;">
              <div style="font-size: 48px; margin-bottom: 16px;">🍑</div>
              <h1 style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 700;">Your Turn to Sign</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 20px; font-weight: 600;">
                Hi ${recipientName.split(" ")[0]},
              </h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                <strong>${previousSignerName}</strong> has signed the agreement. It's now your turn to review and sign.
              </p>
              <div style="background-color: #fef3c7; border-radius: 12px; padding: 24px; margin-bottom: 32px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0 0 8px; color: #92400e; font-weight: 600; font-size: 14px;">DOCUMENT TO SIGN</p>
                <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">${documentName}</p>
              </div>
              <div style="text-align: center; margin-bottom: 32px;">
                <a href="${signingUrl}" style="display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #1f2937; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);">
                  ✍️ Review & Sign Document
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                🔒 Secured by PeachHaus • Legal under ESIGN Act
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

    const { token, signatureData, agreedToTerms }: SubmitSignatureRequest = await req.json();

    if (!agreedToTerms) {
      return new Response(
        JSON.stringify({ error: "You must agree to sign electronically" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get IP and user agent
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    console.log("Processing signature submission for token:", token.substring(0, 8) + "...");

    // Get the signing token
    const { data: signingToken, error: tokenError } = await supabase
      .from("signing_tokens")
      .select(`
        *,
        booking_documents (
          id,
          document_name,
          template_id,
          document_templates (name)
        )
      `)
      .eq("token", token)
      .single();

    if (tokenError || !signingToken) {
      return new Response(
        JSON.stringify({ error: "Invalid signing link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already signed
    if (signingToken.signed_at) {
      return new Response(
        JSON.stringify({ error: "You have already signed this document" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date() > new Date(signingToken.expires_at)) {
      return new Response(
        JSON.stringify({ error: "This signing link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();
    const documentName = signingToken.booking_documents?.document_name || 
                         signingToken.booking_documents?.document_templates?.name || 
                         "Agreement";

    // Update the signing token with signature
    await supabase
      .from("signing_tokens")
      .update({
        signed_at: now,
        signature_data: signatureData,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .eq("id", signingToken.id);

    // Log audit entry
    await supabase.from("document_audit_log").insert({
      document_id: signingToken.document_id,
      action: "signature_captured",
      metadata: {
        signer_email: signingToken.signer_email,
        signer_name: signingToken.signer_name,
        signer_type: signingToken.signer_type,
        consent_given: true,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // Update booking_documents based on signer type
    const updateFields: any = {};
    if (signingToken.signer_type === "owner" || signingToken.signer_type === "second_owner") {
      updateFields.guest_signed_at = now;
    } else if (signingToken.signer_type === "manager") {
      updateFields.host_signed_at = now;
    }

    await supabase
      .from("booking_documents")
      .update(updateFields)
      .eq("id", signingToken.document_id);

    // Send confirmation email to the signer
    await resend.emails.send({
      from: "PeachHaus Group <onboarding@resend.dev>",
      to: [signingToken.signer_email],
      subject: `✅ You've signed: ${documentName}`,
      html: buildConfirmationEmailHtml(signingToken.signer_name, documentName),
    });

    // Check if there are more signers
    const { data: allTokens } = await supabase
      .from("signing_tokens")
      .select("*")
      .eq("document_id", signingToken.document_id)
      .order("signing_order");

    const unsignedTokens = allTokens?.filter(t => !t.signed_at) || [];
    
    if (unsignedTokens.length === 0) {
      // All signers have signed - finalize document
      console.log("All signers complete, finalizing document");
      
      await supabase
        .from("booking_documents")
        .update({
          status: "completed",
          completed_at: now,
          all_signed_at: now,
        })
        .eq("id", signingToken.document_id);

      // Log completion
      await supabase.from("document_audit_log").insert({
        document_id: signingToken.document_id,
        action: "document_completed",
        metadata: {
          all_signers: allTokens?.map(t => ({
            name: t.signer_name,
            email: t.signer_email,
            signed_at: t.signed_at,
          })),
        },
      });

      // Trigger document finalization (generate signed PDF)
      await supabase.functions.invoke("finalize-signed-document", {
        body: { documentId: signingToken.document_id },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "All signatures complete! The document is now finalized.",
          allComplete: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Find the next signer in order
      const nextSigner = unsignedTokens.find(t => 
        t.signing_order === Math.min(...unsignedTokens.map(ut => ut.signing_order))
      );

      if (nextSigner && nextSigner.signing_order > signingToken.signing_order) {
        // Send email to next signer
        const signingUrl = `https://peachhaus.lovable.app/sign/${nextSigner.token}`;
        
        await resend.emails.send({
          from: "PeachHaus Group <onboarding@resend.dev>",
          to: [nextSigner.signer_email],
          subject: `📝 Your signature is needed - ${documentName}`,
          html: buildNextSignerEmailHtml(
            nextSigner.signer_name,
            documentName,
            signingUrl,
            signingToken.signer_name
          ),
        });

        console.log("Sent signing request to next signer:", nextSigner.signer_email);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Thank you for signing! Other parties will be notified.",
          allComplete: false,
          remainingSigners: unsignedTokens.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Error submitting signature:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
