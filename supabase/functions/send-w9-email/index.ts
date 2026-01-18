import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Company logo URL
const LOGO_URL = `${supabaseUrl}/storage/v1/object/public/property-images/peachhaus-logo.png`;
const INGO_HEADSHOT_URL = `${supabaseUrl}/storage/v1/object/public/property-images/ingo-headshot.png`;

// W-9 PDF URL (stored in public/documents)
const W9_URL = "https://propertycentral.lovable.app/documents/w9_Peachhausgroup.pdf";

interface W9EmailRequest {
  ownerId?: string;
  leadId?: string;
  ownerEmail?: string;
  ownerName?: string;
  propertyAddress?: string;
  isManualSend?: boolean;
  testEmail?: string;
}

// Build beautiful branded W9 email HTML
function buildW9EmailHtml(firstName: string, w9DownloadUrl: string, hasAttachment: boolean): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); padding: 32px; text-align: center;">
                  <img src="${LOGO_URL}" alt="PeachHaus" style="height: 48px; margin-bottom: 16px;" />
                  <div style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">W-9 Form for Your Records</div>
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 32px 32px 16px 32px;">
                  <div style="font-size: 16px; color: #111827;">Hi <strong>${firstName}</strong>,</div>
                </td>
              </tr>

              <!-- Intro Text -->
              <tr>
                <td style="padding: 0 32px 16px 32px;">
                  <div style="font-size: 14px; color: #374151; line-height: 1.7;">
                    Attached is PeachHaus Group's W-9 form. Please keep this in your records.
                  </div>
                </td>
              </tr>

              <!-- Why This Matters Card -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 12px; padding: 20px 24px;">
                    <div style="font-size: 12px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">Why You Need This</div>
                    <div style="font-size: 14px; color: #166534; line-height: 1.6;">
                      Because you'll be paying PeachHaus for management services, the IRS requires that you issue us a <strong>1099 at year-end</strong> if total payments are more than $600. Our W-9 provides you with the tax information you'll need to complete that form.
                    </div>
                  </div>
                </td>
              </tr>

              <!-- What's Included -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="padding: 12px 0; border-bottom: 2px solid #f59e0b; margin-bottom: 16px;">
                    <span style="font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">What's Included</span>
                  </div>
                  <table style="width: 100%;">
                    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">Our legal business name and address</td></tr>
                    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">Federal Tax Identification Number (EIN)</td></tr>
                    <tr><td style="padding: 8px 0; font-size: 14px; color: #374151;">Business classification</td></tr>
                  </table>
                </td>
              </tr>

              <!-- Download Button -->
              <tr>
                <td style="padding: 0 32px 24px 32px; text-align: center;">
                  <a href="${w9DownloadUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
                    Download W-9 Form
                  </a>
                  ${hasAttachment ? '<div style="margin-top: 8px; font-size: 12px; color: #6b7280;">Also attached to this email</div>' : ''}
                </td>
              </tr>

              <!-- What's Next -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="margin: 20px 0; padding: 16px 20px; background: #f8fafc; border-left: 4px solid #64748b; border-radius: 0 8px 8px 0;">
                    <div style="font-size: 14px; color: #475569; font-weight: 500;">📧 <strong>What's Next:</strong> Shortly you'll receive a secure link to set up your payment details for our management services.</div>
                  </div>
                </td>
              </tr>

              <!-- Closing -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="font-size: 14px; color: #374151; line-height: 1.7;">
                    If you have any questions about this or anything else, just reply to this email.
                  </div>
                </td>
              </tr>
              
              <!-- Signature -->
              <tr>
                <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align: top; padding-right: 16px;">
                        <img src="${INGO_HEADSHOT_URL}" alt="Ingo" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover;" />
                      </td>
                      <td style="vertical-align: top; border-left: 3px solid #f59e0b; padding-left: 12px;">
                        <div style="font-weight: 700; font-size: 14px; color: #111827;">Ingo Schaer</div>
                        <div style="font-size: 12px; color: #6b7280;">Co-Founder, Operations Manager</div>
                        <div style="font-size: 12px; color: #111827; margin-top: 4px;">PeachHaus Group LLC</div>
                        <div style="font-size: 12px; margin-top: 4px;">
                          <a href="tel:+14048005932" style="color: #111827; text-decoration: none;">(404) 800-5932</a> · 
                          <a href="mailto:ingo@peachhausgroup.com" style="color: #2563eb; text-decoration: none;">ingo@peachhausgroup.com</a>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <div style="font-size: 11px; color: #9ca3af;">
                    © ${new Date().getFullYear()} PeachHaus Group LLC · Atlanta, GA
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { ownerId, leadId, ownerEmail, ownerName, propertyAddress, isManualSend, testEmail }: W9EmailRequest = await req.json();
    
    const isTestMode = !!testEmail;
    
    console.log("Processing W-9 email request:", { ownerId, leadId, ownerEmail, isManualSend, isTestMode });

    let recipientEmail = testEmail || ownerEmail;
    let recipientName = ownerName || "Valued Partner";
    let ownerRecord: any = null;
    let leadRecord: any = null;

    // If we have a leadId, fetch the lead details
    if (leadId) {
      const { data: lead, error } = await supabase
        .from("leads")
        .select("id, name, email, owner_id, property_address")
        .eq("id", leadId)
        .single();

      if (error || !lead) {
        console.error(`Lead not found: ${leadId}`, error);
      } else {
        leadRecord = lead;
        recipientEmail = testEmail || lead.email;
        recipientName = lead.name || recipientName;
        
        // Also fetch owner if lead has owner_id
        if (lead.owner_id && !ownerId) {
          const { data: owner } = await supabase
            .from("property_owners")
            .select("id, name, email, service_type, second_owner_name, second_owner_email")
            .eq("id", lead.owner_id)
            .single();
          if (owner) {
            ownerRecord = owner;
          }
        }
      }
    }

    // If we have an ownerId, fetch the owner details
    if (ownerId) {
      const { data: owner, error } = await supabase
        .from("property_owners")
        .select("id, name, email, service_type, second_owner_name, second_owner_email")
        .eq("id", ownerId)
        .single();

      if (error || !owner) {
        console.error(`Owner not found: ${ownerId}`, error);
      } else {
        ownerRecord = owner;
        recipientEmail = testEmail || owner.email;
        recipientName = owner.name;

        // Check if this is a cohosting client (only they need W-9)
        if (owner.service_type !== "cohosting" && !isManualSend) {
          console.log(`Owner ${owner.name} is not a cohosting client (${owner.service_type}), skipping W-9 email`);
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: "Owner is not a cohosting client - W-9 not required",
              skipped: true 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    if (!recipientEmail) {
      throw new Error("No recipient email provided");
    }

    const firstName = recipientName.split(" ")[0];
    
    // Fetch the W-9 PDF from public URL (always attach it)
    let w9Attachment: { filename: string; content: string } | null = null;
    
    try {
      // Fetch from public URL
      const pdfResponse = await fetch(W9_URL);
      if (pdfResponse.ok) {
        const arrayBuffer = await pdfResponse.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        w9Attachment = {
          filename: "PeachHaus_Group_W9.pdf",
          content: base64,
        };
        console.log("W-9 PDF fetched and attached from public URL");
      } else {
        console.log("Could not fetch PDF from URL:", pdfResponse.status);
      }
    } catch (pdfError) {
      console.log("Could not fetch PDF, will use download link instead:", pdfError);
    }

    // Build beautiful HTML email
    const emailHtml = buildW9EmailHtml(firstName, W9_URL, !!w9Attachment);

    // Build recipient list
    const recipients: string[] = [];
    
    if (isTestMode) {
      recipients.push(testEmail!);
    } else {
      recipients.push(recipientEmail);
      
      // Add second owner if exists
      if (ownerRecord?.second_owner_email) {
        recipients.push(ownerRecord.second_owner_email);
      }
    }

    const emailSubject = isTestMode 
      ? `[TEST] PeachHaus Group W-9 Form for Your Records`
      : `PeachHaus Group W-9 Form for Your Records`;

    // Send the email
    const emailPayload: any = {
      from: "PeachHaus Group LLC - Ingo Schaer <ingo@peachhausgroup.com>",
      to: recipients,
      subject: emailSubject,
      html: emailHtml,
    };

    if (w9Attachment) {
      emailPayload.attachments = [w9Attachment];
      console.log("W-9 PDF attached to email");
    }

    const emailResponse = await resend.emails.send(emailPayload);

    if (emailResponse.error) {
      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    console.log("W-9 email sent successfully:", emailResponse);

    // Log the email send
    if (!isTestMode) {
      const communicationData: any = {
        communication_type: "email",
        direction: "outbound",
        subject: emailSubject,
        body: "W-9 form sent for tax records (1099 reporting)",
        recipient_email: recipientEmail,
        status: "sent",
        metadata: {
          email_type: "w9_form",
          message_id: emailResponse.data?.id,
          has_attachment: !!w9Attachment,
        },
      };

      // Link to lead or owner
      if (leadId || leadRecord?.id) {
        communicationData.lead_id = leadId || leadRecord?.id;
      }
      if (ownerId || ownerRecord?.id) {
        communicationData.owner_id = ownerId || ownerRecord?.id;
      }

      await supabase.from("lead_communications").insert(communicationData);

      // Add timeline entry if we have a lead
      if (leadId || leadRecord?.id) {
        await supabase.from("lead_timeline").insert({
          lead_id: leadId || leadRecord?.id,
          action: "W-9 form email sent",
          metadata: { 
            email_type: "w9_form",
            message_id: emailResponse.data?.id,
            recipients: recipients,
          },
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `W-9 email sent to ${recipients.join(", ")}`,
        messageId: emailResponse.data?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error sending W-9 email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
