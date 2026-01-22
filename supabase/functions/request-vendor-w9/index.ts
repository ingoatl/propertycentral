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
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
const TELNYX_PHONE_NUMBER = Deno.env.get("TELNYX_PHONE_NUMBER");

// Company logo URL
const LOGO_URL = `${supabaseUrl}/storage/v1/object/public/property-images/peachhaus-logo.png`;
const INGO_HEADSHOT_URL = `${supabaseUrl}/storage/v1/object/public/property-images/ingo-headshot.png`;

// IRS W-9 fillable PDF URL
const IRS_W9_URL = "https://www.irs.gov/pub/irs-pdf/fw9.pdf";

// Vendor upload page
const VENDOR_UPLOAD_URL = "https://propertycentral.lovable.app/vendor/w9-upload";

interface RequestVendorW9Request {
  vendorId: string;
  testEmail?: string;
}

// Generate secure upload token
function generateUploadToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function formatPhoneForTelnyx(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  return phone.startsWith('+') ? phone : `+${cleaned}`;
}

async function sendSMS(phone: string, message: string): Promise<boolean> {
  if (!TELNYX_API_KEY || !TELNYX_PHONE_NUMBER) {
    console.log("Telnyx not configured, skipping SMS");
    return false;
  }

  try {
    const formattedPhone = formatPhoneForTelnyx(phone);
    console.log(`Sending SMS to ${formattedPhone}`);

    const response = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: TELNYX_PHONE_NUMBER,
        to: formattedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SMS send failed:", errorText);
      return false;
    }

    console.log("SMS sent successfully");
    return true;
  } catch (error) {
    console.error("SMS error:", error);
    return false;
  }
}

// Build professional W-9 request email HTML for vendors
function buildVendorW9EmailHtml(
  vendorName: string, 
  uploadUrl: string
): string {
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
                  <div style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">W-9 Request for Tax Filing</div>
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 32px 32px 16px 32px;">
                  <div style="font-size: 16px; color: #111827;">Dear <strong>${vendorName}</strong>,</div>
                </td>
              </tr>

              <!-- Intro Text -->
              <tr>
                <td style="padding: 0 32px 16px 32px;">
                  <div style="font-size: 14px; color: #374151; line-height: 1.7;">
                    Thank you for your continued partnership with PeachHaus Group. As we prepare for tax reporting, we need your completed W-9 form to issue your 1099-NEC for payments received through our services.
                  </div>
                </td>
              </tr>

              <!-- Why We Need Section -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 12px; padding: 20px 24px;">
                    <div style="font-size: 12px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">📋 Why We Need Your W-9</div>
                    <div style="font-size: 14px; color: #166534; line-height: 1.6;">
                      The IRS requires us to issue a <strong>1099-NEC</strong> to all vendors receiving $600 or more in payments during the tax year. Your W-9 provides the tax identification information we need to prepare this form accurately.
                    </div>
                  </div>
                </td>
              </tr>

              <!-- Two Options Section -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="padding: 12px 0; border-bottom: 2px solid #2563eb; margin-bottom: 20px;">
                    <span style="font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">Complete Your W-9</span>
                  </div>
                  
                  <!-- Option 1: IRS Website -->
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: flex-start;">
                      <div style="background: #2563eb; color: white; font-weight: bold; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; margin-right: 12px; flex-shrink: 0;">1</div>
                      <div style="flex: 1;">
                        <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">Fill Out on IRS.gov</div>
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Download the official fillable PDF from the IRS website, complete it, and save a copy.</div>
                        <a href="${IRS_W9_URL}" style="display: inline-block; padding: 10px 20px; background: #1e40af; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 13px;">
                          📄 Download IRS W-9 Form
                        </a>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Option 2: Upload to Portal -->
                  <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #93c5fd; border-radius: 12px; padding: 20px;">
                    <div style="display: flex; align-items: flex-start;">
                      <div style="background: #2563eb; color: white; font-weight: bold; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; margin-right: 12px; flex-shrink: 0;">2</div>
                      <div style="flex: 1;">
                        <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">Upload Your Completed W-9</div>
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Once you've completed the form, securely upload it using the button below. This goes directly to our secure portal.</div>
                        <a href="${uploadUrl}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
                          📤 Upload W-9 Now
                        </a>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>

              <!-- Deadline Notice -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px 20px; text-align: center;">
                    <div style="font-size: 14px; color: #991b1b; font-weight: 500;">
                      ⏰ <strong>Deadline:</strong> Please submit by <strong>December 15th</strong> to ensure timely 1099 delivery.
                    </div>
                  </div>
                </td>
              </tr>

              <!-- What We Need -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="margin: 20px 0; padding: 16px 20px; background: #f8fafc; border-left: 4px solid #64748b; border-radius: 0 8px 8px 0;">
                    <div style="font-size: 14px; color: #475569; font-weight: 500;">
                      <strong>What we need on your W-9:</strong>
                    </div>
                    <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #64748b; font-size: 13px;">
                      <li>Your legal name or business name</li>
                      <li>Federal tax classification (Individual, LLC, Corporation, etc.)</li>
                      <li>Address</li>
                      <li>Taxpayer Identification Number (SSN or EIN)</li>
                      <li>Your signature and date</li>
                    </ul>
                  </div>
                </td>
              </tr>

              <!-- Closing -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="font-size: 14px; color: #374151; line-height: 1.7;">
                    If you have any questions or need assistance, simply reply to this email or call us directly. We appreciate your partnership!
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
                      <td style="vertical-align: top; border-left: 3px solid #2563eb; padding-left: 12px;">
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
                    © ${new Date().getFullYear()} PeachHaus Group LLC · Atlanta, GA<br/>
                    <span style="color: #6b7280;">This email contains confidential tax-related information.</span>
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
    const { vendorId, testEmail }: RequestVendorW9Request = await req.json();
    
    const isTestMode = !!testEmail;
    console.log("Processing W-9 request for vendor:", vendorId, "test mode:", isTestMode);

    if (!vendorId) {
      throw new Error("Vendor ID is required");
    }

    // Fetch vendor details
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, name, company_name, email, phone, payments_ytd")
      .eq("id", vendorId)
      .single();

    if (vendorError || !vendor) {
      console.error("Vendor not found:", vendorError);
      throw new Error("Vendor not found");
    }

    if (!vendor.email) {
      throw new Error("Vendor has no email address");
    }

    // Generate secure upload token
    const uploadToken = generateUploadToken();
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 30); // 30 day expiry

    // Store the token for validation later
    await supabase.from("vendor_w9_tokens").upsert({
      vendor_id: vendorId,
      token: uploadToken,
      expires_at: tokenExpiry.toISOString(),
      created_at: new Date().toISOString(),
    }, { onConflict: 'vendor_id' });

    const uploadUrl = `${VENDOR_UPLOAD_URL}?token=${uploadToken}`;
    const vendorName = vendor.company_name || vendor.name;
    const firstName = vendor.name.split(" ")[0];

    // Build email HTML (no YTD payments shown)
    const emailHtml = buildVendorW9EmailHtml(vendorName, uploadUrl);

    // Determine recipient
    const recipient = isTestMode ? testEmail! : vendor.email;

    const emailSubject = isTestMode
      ? `[TEST] PeachHaus Group - W-9 Request for Tax Filing`
      : `PeachHaus Group - W-9 Request for Tax Filing`;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "PeachHaus Group LLC - Ingo Schaer <ingo@peachhausgroup.com>",
      to: [recipient],
      subject: emailSubject,
      html: emailHtml,
    });

    if (emailResponse.error) {
      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    console.log("Vendor W-9 request email sent:", emailResponse);

    // Send SMS if phone exists and not test mode
    let smsSent = false;
    if (!isTestMode && vendor.phone) {
      const smsMessage = `Hi ${firstName}! PeachHaus needs your W-9 form for tax filing.\n\n📤 Upload here: ${uploadUrl}\n\n⏰ Deadline: Dec 15th\n📞 Questions? Call (404) 800-5932\n\n- Ingo, PeachHaus`;
      smsSent = await sendSMS(vendor.phone, smsMessage);
    }

    // Update vendor record if not test mode
    if (!isTestMode) {
      await supabase
        .from("vendors")
        .update({ 
          w9_requested_at: new Date().toISOString(),
          w9_on_file: false 
        })
        .eq("id", vendorId);

      // Log communication
      await supabase.from("lead_communications").insert({
        communication_type: "email",
        direction: "outbound",
        subject: emailSubject,
        body: `Vendor W-9 form requested for tax filing${smsSent ? ' (SMS also sent)' : ''}`,
        recipient_email: vendor.email,
        vendor_id: vendorId,
        status: "sent",
        metadata: {
          email_type: "vendor_w9_request",
          message_id: emailResponse.data?.id,
          upload_url: uploadUrl,
          sms_sent: smsSent,
        },
      });

      console.log("Updated w9_requested_at for vendor:", vendorId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `W-9 request sent to ${recipient}${smsSent ? ' and SMS sent' : ''}`,
        messageId: emailResponse.data?.id,
        smsSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error requesting vendor W-9:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);