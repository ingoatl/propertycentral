import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://propertycentral.lovable.app";
const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";

interface SubmitSignatureRequest {
  token: string;
  signatureData: string;
  agreedToTerms: boolean;
  fieldValues?: Record<string, string | boolean>;
}

const buildConfirmationEmailHtml = (
  recipientName: string,
  documentName: string,
  propertyAddress: string | null
): string => {
  const propertySection = propertyAddress ? `
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 16px; border-left: 4px solid #22c55e;">
      <p style="margin: 0 0 4px; color: #166534; font-weight: 600; font-size: 12px;">PROPERTY</p>
      <p style="margin: 0; color: #1f2937; font-size: 14px; font-weight: 600;">${propertyAddress}</p>
    </div>
  ` : '';

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
              ${propertySection}
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
                PeachHaus Group - Property Management Made Simple
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
  propertyAddress: string | null,
  signingUrl: string,
  previousSignerName: string
): string => {
  const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  const propertySection = propertyAddress ? `
    <!-- Property Info -->
    <div style="padding: 16px 32px; background: #f0fdf4; border-bottom: 1px solid #bbf7d0;">
      <table style="width: 100%;">
        <tr>
          <td style="vertical-align: top;">
            <div style="font-size: 10px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Property</div>
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
  <title>Your Signature is Needed</title>
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
            <div style="font-size: 16px; font-weight: 600; color: #111111; margin-bottom: 4px;">YOUR SIGNATURE NEEDED</div>
            <div style="font-size: 10px; color: #666666; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
              ${issueDate}
            </div>
          </td>
        </tr>
      </table>
    </div>

    ${propertySection}

    <!-- Document Info -->
    <div style="padding: 20px 32px; background: #fef3c7; border-bottom: 1px solid #fcd34d;">
      <table style="width: 100%;">
        <tr>
          <td style="vertical-align: top;">
            <div style="font-size: 10px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Document</div>
            <div style="font-size: 14px; font-weight: 600; color: #111111;">${documentName}</div>
          </td>
          <td style="vertical-align: top; text-align: right;">
            <div style="font-size: 10px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Previous Signer</div>
            <div style="font-size: 14px; font-weight: 600; color: #111111;">${previousSignerName}</div>
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
        <strong>${previousSignerName}</strong> has completed signing the agreement. It's now your turn to review and add your signature.
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
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { token, signatureData, agreedToTerms, fieldValues }: SubmitSignatureRequest = await req.json();

    if (!agreedToTerms) {
      return new Response(
        JSON.stringify({ error: "You must agree to sign electronically" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
          field_configuration,
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

    if (signingToken.signed_at) {
      return new Response(
        JSON.stringify({ error: "You have already signed this document" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date() > new Date(signingToken.expires_at)) {
      return new Response(
        JSON.stringify({ error: "This signing link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get property address and owner name - first try from the field values (what owner just entered)
    // then fall back to lead, then to property
    let propertyAddress: string | null = null;
    let ownerName: string | null = null;
    
    // First: Check if owner just entered property address and name in the form
    if (fieldValues) {
      propertyAddress = (fieldValues.property_address || fieldValues.PropertyAddress || 
                         fieldValues.property_street_address) as string | null;
      ownerName = (fieldValues.owner_name || fieldValues.owner_print_name || 
                   fieldValues.OwnerName || fieldValues.owner_1_name) as string | null;
    }
    
    // Second: Check saved field_configuration from document
    if (!propertyAddress || !ownerName) {
      const savedConfig = signingToken.booking_documents?.field_configuration as Record<string, any> | null;
      if (savedConfig) {
        if (!propertyAddress) {
          propertyAddress = savedConfig.property_address || savedConfig.PropertyAddress || 
                            savedConfig.property_street_address || null;
        }
        if (!ownerName) {
          ownerName = savedConfig.owner_name || savedConfig.owner_print_name || 
                      savedConfig.OwnerName || savedConfig.owner_1_name || null;
        }
      }
    }
    
    // Third: Fall back to lead data
    const { data: lead } = await supabase
      .from("leads")
      .select("id, property_address, property_id, name, stage")
      .eq("signwell_document_id", signingToken.document_id)
      .maybeSingle();
    
    if (lead) {
      if (!propertyAddress) {
        propertyAddress = lead.property_address;
        
        // If no property_address on lead, try to get from property
        if (!propertyAddress && lead.property_id) {
          const { data: property } = await supabase
            .from("properties")
            .select("address, name")
            .eq("id", lead.property_id)
            .single();
          
          if (property) {
            propertyAddress = property.address || property.name;
          }
        }
      }
      
      if (!ownerName) {
        ownerName = lead.name;
      }
    }

    console.log("Property address for document (from field values, then lead):", propertyAddress);
    console.log("Owner name for document:", ownerName);

    const now = new Date().toISOString();
    const documentName = signingToken.booking_documents?.document_name || 
                         signingToken.booking_documents?.document_templates?.name || 
                         "Agreement";

    // Build document display name with property address
    let documentDisplayName = documentName;
    if (propertyAddress && !documentDisplayName.includes(propertyAddress)) {
      documentDisplayName = `${documentName} - ${propertyAddress}`;
    }

    // Update the signing token with signature and field values
    await supabase
      .from("signing_tokens")
      .update({
        signed_at: now,
        signature_data: signatureData,
        ip_address: ipAddress,
        user_agent: userAgent,
        field_values: fieldValues || {},
      })
      .eq("id", signingToken.id);

    // Merge field values into booking_documents.field_configuration
    // Also update signature date fields with actual signing timestamp
    if (fieldValues && Object.keys(fieldValues).length > 0) {
      const existingFieldConfig = signingToken.booking_documents?.field_configuration || {};
      
      // Format the actual signing date in EST timezone
      const signingDate = new Date();
      const estDateStr = signingDate.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit'
      });
      
      // Create updated field values with correct dates based on signer type
      const updatedFieldValues = { ...fieldValues };
      
      // Update date fields based on signer type to use actual signing timestamp
      if (signingToken.signer_type === 'owner') {
        updatedFieldValues.owner_signature_date = estDateStr;
      } else if (signingToken.signer_type === 'second_owner') {
        updatedFieldValues.second_owner_signature_date = estDateStr;
      } else if (signingToken.signer_type === 'manager') {
        updatedFieldValues.manager_signature_date = estDateStr;
      }
      
      const mergedFieldConfig = { ...existingFieldConfig, ...updatedFieldValues };
      
      await supabase
        .from("booking_documents")
        .update({ field_configuration: mergedFieldConfig })
        .eq("id", signingToken.document_id);
        
      console.log("Updated signature date to actual signing time:", estDateStr, "for", signingToken.signer_type);
    }

    // Log audit entry
    await supabase.from("document_audit_log").insert({
      document_id: signingToken.document_id,
      action: "signature_captured",
      metadata: {
        signer_email: signingToken.signer_email,
        signer_name: signingToken.signer_name,
        signer_type: signingToken.signer_type,
        consent_given: true,
        field_values: fieldValues,
        property_address: propertyAddress,
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

    // Build email subject with property address
    let confirmationSubject = `You've signed: ${documentName}`;
    if (propertyAddress) {
      confirmationSubject = `Signed: ${propertyAddress} - ${documentName}`;
    }

    // Send confirmation email to the signer
    await resend.emails.send({
      from: "PeachHaus Group <info@peachhausgroup.com>",
      to: [signingToken.signer_email],
      subject: confirmationSubject,
      html: buildConfirmationEmailHtml(signingToken.signer_name, documentName, propertyAddress),
    });

    console.log("Sent confirmation email to:", signingToken.signer_email);

    // Check if there are more signers
    const { data: allTokens } = await supabase
      .from("signing_tokens")
      .select("*")
      .eq("document_id", signingToken.document_id)
      .order("signing_order");

    console.log("All tokens for document:", allTokens?.map(t => ({ 
      id: t.id, 
      type: t.signer_type, 
      email: t.signer_email,
      order: t.signing_order, 
      signed: !!t.signed_at 
    })));

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
          property_address: propertyAddress,
        },
      });

      // Update lead stage to "contract_signed" if this document is linked to a lead
      if (lead) {
        console.log("Document is linked to lead, updating stage to contract_signed");
        
        // Get the booking document to extract contract type and recipient info
        const { data: bookingDoc } = await supabase
          .from("booking_documents")
          .select("id, contract_type, recipient_name, recipient_email")
          .eq("id", signingToken.document_id)
          .single();

        // === CREATE OWNER RECORD NOW THAT AGREEMENT IS FULLY EXECUTED ===
        console.log("Creating owner record upon full agreement execution");
        
        // Extract service type from contract or field values
        const servicePackage = (fieldValues?.service_package || fieldValues?.package_selection) as string | null;
        let serviceType = "cohosting"; // default
        if (servicePackage?.toLowerCase().includes("full")) {
          serviceType = "full_service";
        } else if (bookingDoc?.contract_type === "full_service") {
          serviceType = "full_service";
        }
        
        // Get owner details from field values or signing token
        const finalOwnerName = ownerName || bookingDoc?.recipient_name || signingToken.signer_name;
        const finalOwnerEmail = bookingDoc?.recipient_email || signingToken.signer_email;
        const finalOwnerPhone = (fieldValues?.phone || fieldValues?.owner_phone) as string | null;
        const finalOwnerAddress = (fieldValues?.owner_mailing_address || fieldValues?.mailing_address) as string | null;
        
        // Check if owner already exists with this email
        const { data: existingOwner } = await supabase
          .from("property_owners")
          .select("id")
          .eq("email", finalOwnerEmail)
          .maybeSingle();
        
        let ownerId: string | null = null;
        
        if (existingOwner) {
          ownerId = existingOwner.id;
          console.log("Found existing owner:", ownerId);
        } else {
          // Create new owner record
          const { data: newOwner, error: ownerError } = await supabase
            .from("property_owners")
            .insert({
              name: finalOwnerName,
              email: finalOwnerEmail,
              phone: finalOwnerPhone || lead.property_address ? null : null, // Use lead phone if available
              address: finalOwnerAddress,
              payment_method: "ach",
              service_type: serviceType,
            })
            .select()
            .single();
          
          if (ownerError) {
            console.error("Error creating owner:", ownerError);
          } else {
            ownerId = newOwner.id;
            console.log("Created new owner:", ownerId);
          }
        }
        
        // Link owner to lead and booking document
        if (ownerId) {
          await supabase
            .from("leads")
            .update({ owner_id: ownerId })
            .eq("id", lead.id);
          
          await supabase
            .from("booking_documents")
            .update({ owner_id: ownerId })
            .eq("id", signingToken.document_id);
          
          console.log("Linked owner to lead and document");
        }
        // === END OWNER CREATION ===
        
        const { error: leadUpdateError } = await supabase
          .from("leads")
          .update({ 
            stage: "contract_signed",
            stage_changed_at: now,
            auto_stage_reason: "Contract fully signed",
            last_stage_auto_update_at: now,
          })
          .eq("signwell_document_id", signingToken.document_id);
        
        if (leadUpdateError) {
          console.error("Error updating lead stage:", leadUpdateError);
        } else {
          console.log("Lead stage updated to contract_signed");
          
          // Log the stage change in lead timeline
          await supabase.from("lead_timeline").insert({
            lead_id: lead.id,
            action: "stage_changed",
            previous_stage: lead.stage || "contract_out",
            new_stage: "contract_signed",
            performed_by_name: "System",
            metadata: {
              reason: "Document fully signed by all parties",
              document_id: signingToken.document_id,
              property_address: propertyAddress,
              owner_created: !!ownerId,
              owner_id: ownerId,
            },
          });
        }
      }

      // Trigger document finalization (generate signed PDF)
      try {
        const finalizeResult = await supabase.functions.invoke("finalize-signed-document", {
          body: { documentId: signingToken.document_id },
        });
        console.log("Finalize result:", finalizeResult);
      } catch (finalizeError) {
        console.error("Error invoking finalize-signed-document:", finalizeError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "All signatures complete! The document is now finalized.",
          allComplete: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Find the next signer by getting the lowest signing_order among unsigned tokens
      const nextSigningOrder = Math.min(...unsignedTokens.map(t => t.signing_order));
      const nextSigner = unsignedTokens.find(t => t.signing_order === nextSigningOrder);

      console.log("Next signer to notify:", nextSigner ? {
        email: nextSigner.signer_email,
        type: nextSigner.signer_type,
        order: nextSigner.signing_order
      } : "None found");

      if (nextSigner) {
        // Send email to next signer with property address and owner name in subject
        const signingUrl = `${APP_URL}/sign/${nextSigner.token}`;
        
        // Build subject with owner name and property address for admin
        // Use the current signer's name (who just signed) as the owner name for the admin
        const signerDisplayName = ownerName || signingToken.signer_name;
        let nextSignerSubject = `Your signature is needed - ${documentName}`;
        if (propertyAddress && signerDisplayName) {
          nextSignerSubject = `Signature Needed: ${signerDisplayName} - ${propertyAddress}`;
        } else if (propertyAddress) {
          nextSignerSubject = `Signature Needed: ${propertyAddress} - Management Agreement`;
        } else if (signerDisplayName) {
          nextSignerSubject = `Signature Needed: ${signerDisplayName} - ${documentName}`;
        }
        
        console.log("Sending signing request to:", nextSigner.signer_email, "Subject:", nextSignerSubject);
        
        const emailResult = await resend.emails.send({
          from: "PeachHaus Group <info@peachhausgroup.com>",
          to: [nextSigner.signer_email],
          subject: nextSignerSubject,
          html: buildNextSignerEmailHtml(
            nextSigner.signer_name,
            documentDisplayName,
            propertyAddress,
            signingUrl,
            signerDisplayName || signingToken.signer_name  // Use owner name if available
          ),
        });

        console.log("Sent signing request to next signer:", nextSigner.signer_email, "Result:", emailResult);
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
