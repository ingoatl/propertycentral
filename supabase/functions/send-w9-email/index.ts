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

// W-9 PDF URL (stored in public/documents)
const W9_URL = "https://propertycentral.lovable.app/documents/w9_Peachhausgroup.pdf";

interface W9EmailRequest {
  ownerId?: string;
  ownerEmail?: string;
  ownerName?: string;
  isManualSend?: boolean;
  testEmail?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { ownerId, ownerEmail, ownerName, isManualSend, testEmail }: W9EmailRequest = await req.json();
    
    const isTestMode = !!testEmail;
    
    console.log("Processing W-9 email request:", { ownerId, ownerEmail, isManualSend, isTestMode });

    let recipientEmail = testEmail || ownerEmail;
    let recipientName = ownerName || "Valued Partner";
    let ownerRecord: any = null;

    // If we have an ownerId, fetch the owner details
    if (ownerId) {
      const { data: owner, error } = await supabase
        .from("property_owners")
        .select("id, name, email, service_type, second_owner_name, second_owner_email")
        .eq("id", ownerId)
        .single();

      if (error || !owner) {
        throw new Error(`Owner not found: ${ownerId}`);
      }

      ownerRecord = owner;
      recipientEmail = testEmail || owner.email;
      recipientName = owner.name;

      // Check if this is a cohosting client
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

    if (!recipientEmail) {
      throw new Error("No recipient email provided");
    }

    const firstName = recipientName.split(" ")[0];
    
    // Fetch the W-9 PDF from storage or public URL
    let w9Attachment: { filename: string; content: string } | null = null;
    
    try {
      // Try to fetch from Supabase storage first
      const { data: storageData } = await supabase.storage
        .from("documents")
        .download("w9_Peachhausgroup.pdf");
      
      if (storageData) {
        const arrayBuffer = await storageData.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        w9Attachment = {
          filename: "PeachHaus_Group_W9.pdf",
          content: base64,
        };
        console.log("W-9 PDF loaded from storage");
      }
    } catch (storageError) {
      console.log("Could not load from storage, will use download link instead");
    }

    // Build beautiful HTML email
    const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PeachHaus Group W-9 Form</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
          
          <!-- Email Container -->
          <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
            
            <!-- Header with Logo -->
            <div style="background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%); padding: 32px 32px 28px 32px; text-align: center;">
              <img src="${LOGO_URL}" alt="PeachHaus Group" style="height: 40px; margin-bottom: 16px;" onerror="this.style.display='none'" />
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600; letter-spacing: -0.3px;">
                W-9 Form for Your Records
              </h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.7); font-size: 13px;">
                Tax Documentation for 1099 Reporting
              </p>
            </div>

            <!-- Main Content -->
            <div style="padding: 32px;">
              
              <!-- Greeting -->
              <p style="font-size: 15px; color: #333333; line-height: 1.7; margin: 0 0 20px 0;">
                Hi ${firstName},
              </p>
              
              <p style="font-size: 15px; color: #333333; line-height: 1.7; margin: 0 0 24px 0;">
                Welcome to PeachHaus Group! As we begin our partnership managing your property, I'm sending along some important tax documentation for your records.
              </p>

              <!-- W-9 Info Card -->
              <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <div style="display: flex; align-items: flex-start;">
                  <div style="background: #111111; border-radius: 8px; padding: 10px 12px; margin-right: 16px;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M14 2V8H20" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #111111;">
                      Attached: PeachHaus Group W-9 Form
                    </h3>
                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                      Please keep this in your records for year-end tax reporting.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Why This Matters Section -->
              <div style="border-left: 3px solid #111111; padding-left: 20px; margin-bottom: 24px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #111111; text-transform: uppercase; letter-spacing: 0.5px;">
                  Why You Need This
                </h4>
                <p style="font-size: 14px; color: #555555; line-height: 1.7; margin: 0;">
                  Because you'll be paying PeachHaus for management services, the IRS requires that you issue us a <strong>1099 at year-end</strong> if total payments are more than $600.
                </p>
              </div>

              <!-- What's Included -->
              <p style="font-size: 14px; color: #555555; line-height: 1.7; margin: 0 0 24px 0;">
                Our W-9 provides you with the tax information you'll need to complete that form, including:
              </p>

              <ul style="margin: 0 0 24px 0; padding-left: 20px;">
                <li style="font-size: 14px; color: #555555; line-height: 1.8;">Our legal business name and address</li>
                <li style="font-size: 14px; color: #555555; line-height: 1.8;">Federal Tax Identification Number (EIN)</li>
                <li style="font-size: 14px; color: #555555; line-height: 1.8;">Business classification</li>
              </ul>

              <!-- Download Button (fallback if attachment fails) -->
              ${!w9Attachment ? `
              <div style="text-align: center; margin: 28px 0;">
                <a href="${W9_URL}" 
                   style="display: inline-block; background: #111111; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; letter-spacing: 0.3px;">
                  Download W-9 Form →
                </a>
              </div>
              ` : ''}

              <!-- Closing -->
              <p style="font-size: 15px; color: #333333; line-height: 1.7; margin: 0 0 8px 0;">
                If you have any questions about this or anything else, just reply to this email.
              </p>
              
              <p style="font-size: 15px; color: #333333; line-height: 1.7; margin: 24px 0 0 0;">
                Looking forward to a great partnership!
              </p>

              <!-- Signature -->
              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
                <p style="margin: 0; font-size: 14px; color: #333333; font-weight: 500;">
                  Ingo Winzer
                </p>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #666666;">
                  Founder & CEO, PeachHaus Group
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div style="padding: 24px 32px; border-top: 1px solid #e5e5e5; background: #f9fafb;">
              <p style="font-size: 12px; color: #666666; margin: 0 0 12px 0; line-height: 1.5;">
                Questions? Reply to this email or contact <a href="mailto:info@peachhausgroup.com" style="color: #111111; text-decoration: underline;">info@peachhausgroup.com</a>
              </p>
              <div style="font-size: 10px; color: #999999; border-top: 1px solid #e5e5e5; padding-top: 12px; margin-top: 12px;">
                <div style="margin-bottom: 4px;">PeachHaus Group LLC</div>
                <div>Atlanta, Georgia</div>
              </div>
            </div>

          </div>
        </div>
      </body>
    </html>
    `;

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
      
      // BCC info@ for records
      // Note: Resend handles BCC differently, we'll add to main recipients
    }

    const emailSubject = isTestMode 
      ? `[TEST] PeachHaus Group W-9 Form for Your Records`
      : `PeachHaus Group W-9 Form for Your Records`;

    // Send the email
    const emailPayload: any = {
      from: "PeachHaus Group <admin@peachhausgroup.com>",
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
    if (!isTestMode && ownerId) {
      await supabase
        .from("lead_communications")
        .insert({
          owner_id: ownerId,
          communication_type: "email",
          direction: "outbound",
          subject: emailSubject,
          body: "W-9 form sent for tax records (1099 reporting)",
          recipient_email: recipientEmail,
          status: "sent",
          metadata: {
            email_type: "w9_form",
            message_id: emailResponse.data?.id,
          },
        });
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
