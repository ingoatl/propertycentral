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

const LOGO_URL = `${supabaseUrl}/storage/v1/object/public/property-images/peachhaus-logo.png`;
const INGO_HEADSHOT_URL = `${supabaseUrl}/storage/v1/object/public/property-images/ingo-headshot.png`;

interface ProcessW9UploadRequest {
  token: string;
  fileName: string;
  fileBase64: string;
  taxName?: string;
  einLast4?: string;
}

// Build confirmation email HTML
function buildConfirmationEmailHtml(firstName: string): string {
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
                  <div style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">W-9 Received Successfully</div>
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 32px 32px 16px 32px;">
                  <div style="font-size: 16px; color: #111827;">Hi <strong>${firstName}</strong>,</div>
                </td>
              </tr>

              <!-- Success Message -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 12px; padding: 24px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
                    <div style="font-size: 18px; font-weight: 600; color: #166534; margin-bottom: 8px;">Your W-9 Has Been Received</div>
                    <div style="font-size: 14px; color: #166534; line-height: 1.6;">
                      Thank you for submitting your W-9 form. We've securely stored it and will use the information to prepare your 1099 for tax purposes.
                    </div>
                  </div>
                </td>
              </tr>

              <!-- What's Next -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="padding: 12px 0; border-bottom: 2px solid #f59e0b; margin-bottom: 16px;">
                    <span style="font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">What Happens Next</span>
                  </div>
                  <table style="width: 100%;">
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                        <div style="display: flex; align-items: center;">
                          <span style="font-size: 20px; margin-right: 12px;">📋</span>
                          <div>
                            <div style="font-size: 14px; font-weight: 500; color: #111827;">Document on file</div>
                            <div style="font-size: 12px; color: #6b7280;">Your W-9 is now securely stored in your owner portal</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                        <div style="display: flex; align-items: center;">
                          <span style="font-size: 20px; margin-right: 12px;">📊</span>
                          <div>
                            <div style="font-size: 14px; font-weight: 500; color: #111827;">Year-end processing</div>
                            <div style="font-size: 12px; color: #6b7280;">We'll prepare your 1099-MISC for the current tax year</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0;">
                        <div style="display: flex; align-items: center;">
                          <span style="font-size: 20px; margin-right: 12px;">📬</span>
                          <div>
                            <div style="font-size: 14px; font-weight: 500; color: #111827;">1099 delivery</div>
                            <div style="font-size: 12px; color: #6b7280;">You'll receive your 1099 by January 31st</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Closing -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="font-size: 14px; color: #374151; line-height: 1.7;">
                    If you have any questions, just reply to this email or give us a call.
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
    const { token, fileName, fileBase64, taxName, einLast4 }: ProcessW9UploadRequest = await req.json();

    console.log("Processing W-9 upload with token");

    if (!token || !fileBase64) {
      throw new Error("Token and file are required");
    }

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from("owner_w9_tokens")
      .select("owner_id, expires_at")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      console.error("Invalid token:", tokenError);
      throw new Error("Invalid or expired upload link");
    }

    // Check expiry
    if (new Date(tokenData.expires_at) < new Date()) {
      throw new Error("Upload link has expired. Please request a new W-9 email.");
    }

    const ownerId = tokenData.owner_id;

    // Get owner details
    const { data: owner, error: ownerError } = await supabase
      .from("property_owners")
      .select("id, name, email, second_owner_email")
      .eq("id", ownerId)
      .single();

    if (ownerError || !owner) {
      throw new Error("Owner not found");
    }

    // Decode base64 and upload to storage
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `w9/${ownerId}/${timestamp}_${sanitizedFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("onboarding-documents")
      .upload(storagePath, bytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload file");
    }

    console.log("File uploaded to:", storagePath);

    // Update owner record
    const updateData: any = {
      owner_w9_uploaded_at: new Date().toISOString(),
      owner_w9_file_path: storagePath,
    };

    if (taxName) {
      updateData.owner_tax_name = taxName;
    }
    if (einLast4) {
      updateData.owner_ein_last4 = einLast4;
    }

    await supabase
      .from("property_owners")
      .update(updateData)
      .eq("id", ownerId);

    // Invalidate the token (one-time use)
    await supabase
      .from("owner_w9_tokens")
      .update({ expires_at: new Date().toISOString() })
      .eq("token", token);

    // Log communication
    await supabase.from("lead_communications").insert({
      communication_type: "document",
      direction: "inbound",
      subject: "W-9 Form Uploaded",
      body: `Owner uploaded their W-9 form for tax filing`,
      recipient_email: owner.email,
      owner_id: ownerId,
      status: "received",
      metadata: {
        document_type: "w9",
        file_path: storagePath,
        tax_name: taxName,
      },
    });

    // Send confirmation email
    const firstName = owner.name.split(" ")[0];
    const emailHtml = buildConfirmationEmailHtml(firstName);

    const recipients = [owner.email];
    if (owner.second_owner_email) {
      recipients.push(owner.second_owner_email);
    }

    await resend.emails.send({
      from: "PeachHaus Group LLC <ingo@peachhausgroup.com>",
      to: recipients,
      subject: "W-9 Received - PeachHaus Group",
      html: emailHtml,
    });

    console.log("Confirmation email sent to:", recipients);

    // Send Slack notification to team
    const slackWebhook = Deno.env.get("SLACK_BOT_TOKEN");
    if (slackWebhook) {
      try {
        await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${slackWebhook}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: "#owner-updates",
            text: `📄 *W-9 Received*\n*Owner:* ${owner.name}\n*Email:* ${owner.email}\n${taxName ? `*Tax Name:* ${taxName}\n` : ''}${einLast4 ? `*EIN Last 4:* ${einLast4}\n` : ''}✅ Ready for 1099 processing`,
          }),
        });
      } catch (slackError) {
        console.log("Slack notification failed (non-critical):", slackError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "W-9 uploaded successfully",
        ownerName: owner.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error processing W-9 upload:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
