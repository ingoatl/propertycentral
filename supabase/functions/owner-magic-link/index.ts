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

interface OwnerEmailInfo {
  name: string;
  email: string;
}

interface PropertyInfo {
  name?: string;
  address?: string;
  rentalType?: string;
}

const sendMagicLinkEmail = async (
  owner: OwnerEmailInfo,
  portalUrl: string,
  propertyInfo?: PropertyInfo
): Promise<boolean> => {
  try {
    const propertyName = propertyInfo?.name || "Your Property";
    const propertyAddress = propertyInfo?.address || "";
    const rentalType = propertyInfo?.rentalType || "hybrid";
    
    const accessTypeLabel = rentalType === "mid_term" 
      ? "MID-TERM" 
      : rentalType === "long_term" 
        ? "LONG-TERM" 
        : "SHORT-TERM";

    const storageUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images";
    const logoUrl = `${storageUrl}/peachhaus-logo.png`;
    const headshotUrl = `${storageUrl}/ingo-headshot.png`;
    const signatureUrl = `${storageUrl}/ingo-signature.png`;

    const { error: emailError } = await resend.emails.send({
      from: "PeachHaus Group LLC <admin@peachhausgroup.com>",
      to: [owner.email],
      subject: `Your Owner Portal Access — ${propertyName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background: #f5f9ff; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            <div style="max-width: 650px; margin: 0 auto; background: #ffffff; margin-top: 32px; margin-bottom: 32px;">
              
              <!-- Header Section - Matching Statement Layout -->
              <div style="padding: 32px 40px; border-bottom: 1px solid #e5e7eb;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="vertical-align: middle;">
                      <img src="${logoUrl}" alt="PeachHaus Property Management" style="height: 56px;" />
                    </td>
                    <td style="text-align: right; vertical-align: middle;">
                      <p style="margin: 0; font-size: 24px; font-weight: 700; color: #1a3b4c; letter-spacing: 1px;">OWNER PORTAL</p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; font-weight: 500; letter-spacing: 0.5px;">INVITE</p>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Property Info Row -->
              <div style="padding: 24px 40px; background: #f8fafc; border-bottom: 1px solid #e5e7eb;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="vertical-align: top;">
                      <p style="margin: 0; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">PROPERTY</p>
                      <p style="margin: 6px 0 0 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">${propertyName}</p>
                      ${propertyAddress ? `<p style="margin: 2px 0 0 0; font-size: 13px; color: #64748b;">${propertyAddress}</p>` : ''}
                    </td>
                    <td style="text-align: right; vertical-align: top;">
                      <p style="margin: 0; font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">ACCESS TYPE</p>
                      <p style="margin: 6px 0 0 0; font-size: 14px; font-weight: 600; color: #1a3b4c;">${accessTypeLabel}</p>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Main Content -->
              <div style="padding: 40px;">
                <p style="font-size: 16px; line-height: 1.5; color: #1a1a1a; margin: 0 0 8px 0;">
                  Dear ${owner.name.split(' ')[0]},
                </p>
                
                <p style="font-size: 15px; line-height: 1.75; color: #4a5568; margin: 20px 0 32px 0;">
                  Welcome to your personalized Owner Portal! We're excited to give you instant access to everything happening with your property—all in one secure, easy-to-use dashboard.
                </p>
                
                <!-- CTA Box -->
                <div style="background: #1a3b4c; border-radius: 8px; padding: 32px; text-align: center; margin: 32px 0;">
                  <p style="margin: 0 0 20px 0; font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px;">ACCESS YOUR PORTAL</p>
                  <a href="${portalUrl}" style="display: inline-block; background: #f59e0b; color: #ffffff; padding: 16px 48px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
                    Open Portal →
                  </a>
                  <p style="margin: 20px 0 0 0; font-size: 12px; color: rgba(255,255,255,0.6);">
                    Bookmark this link for instant access anytime
                  </p>
                </div>
                
                <!-- What You'll Discover Section -->
                <div style="margin-top: 40px;">
                  <p style="margin: 0 0 24px 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px;">What You'll Discover</p>
                  
                  <p style="font-size: 14px; line-height: 1.8; color: #4a5568; margin: 0 0 24px 0;">
                    Your portal is packed with powerful features designed to keep you informed and in control:
                  </p>
                  
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <!-- Feature 1 -->
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr>
                            <td width="28" style="vertical-align: top;">
                              <span style="color: #10b981; font-size: 16px;">✓</span>
                            </td>
                            <td style="vertical-align: top;">
                              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Live Performance Dashboard</p>
                              <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">Watch your revenue, occupancy, and growth metrics update in real-time with beautiful charts and insights</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Feature 2 - AI Insights Highlighted -->
                    <tr>
                      <td style="padding: 16px; margin: 8px 0; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-radius: 8px; border: 1px solid #fcd34d;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr>
                            <td width="28" style="vertical-align: top;">
                              <span style="color: #f59e0b; font-size: 16px;">✨</span>
                            </td>
                            <td style="vertical-align: top;">
                              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">
                                AI-Powered Market Insights
                                <span style="display: inline-block; padding: 2px 8px; background: #1a1a1a; color: #fff; font-size: 9px; border-radius: 4px; margin-left: 8px; vertical-align: middle; font-weight: 700; letter-spacing: 0.5px;">NEW</span>
                              </p>
                              <p style="margin: 4px 0 0 0; font-size: 13px; color: #78350f; line-height: 1.5;">Get personalized recommendations on pricing, demand trends, and opportunities to maximize your returns</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Feature 3 -->
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr>
                            <td width="28" style="vertical-align: top;">
                              <span style="color: #10b981; font-size: 16px;">✓</span>
                            </td>
                            <td style="vertical-align: top;">
                              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Complete Booking History</p>
                              <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">See every reservation with guest details, check-in/out dates, and earnings breakdown</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Feature 4 -->
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr>
                            <td width="28" style="vertical-align: top;">
                              <span style="color: #10b981; font-size: 16px;">✓</span>
                            </td>
                            <td style="vertical-align: top;">
                              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Monthly Statements</p>
                              <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">Download professional PDF statements showing income, fees, expenses, and net earnings</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Feature 5 -->
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr>
                            <td width="28" style="vertical-align: top;">
                              <span style="color: #10b981; font-size: 16px;">✓</span>
                            </td>
                            <td style="vertical-align: top;">
                              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Receipts & Expense Records</p>
                              <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">Full transparency on every purchase made for your property with photos of receipts</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Feature 6 -->
                    <tr>
                      <td style="padding: 12px 0;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr>
                            <td width="28" style="vertical-align: top;">
                              <span style="color: #10b981; font-size: 16px;">✓</span>
                            </td>
                            <td style="vertical-align: top;">
                              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Property Details & Access Codes</p>
                              <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">WiFi passwords, door codes, and important property documentation all in one place</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </div>
                
                <!-- View Your Owner Portal Box -->
                <div style="margin-top: 40px; padding: 24px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="vertical-align: middle;">
                        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">View Your Owner Portal</p>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Access your dashboard anytime, anywhere</p>
                      </td>
                      <td style="text-align: right; vertical-align: middle;">
                        <a href="${portalUrl}" style="display: inline-block; background: #f59e0b; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
                          Open Portal →
                        </a>
                      </td>
                    </tr>
                  </table>
                </div>
                
                <!-- Security Notice -->
                <div style="margin-top: 32px; padding: 16px 20px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #1a3b4c;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td width="24" style="vertical-align: top;">
                        <span style="font-size: 14px;">🔒</span>
                      </td>
                      <td style="vertical-align: top; padding-left: 8px;">
                        <p style="font-size: 12px; color: #475569; margin: 0; line-height: 1.6;">
                          <strong style="color: #1e293b;">Security Note:</strong> This is your private, secure link. Your data is encrypted and refreshed each time you access the portal.
                        </p>
                      </td>
                    </tr>
                  </table>
                </div>
              </div>
              
              <!-- Signature Section -->
              <div style="padding: 32px 40px; background: #f8fafc; border-top: 1px solid #e5e7eb;">
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                  <tr>
                    <td style="vertical-align: top; width: 72px;">
                      <img src="${headshotUrl}" alt="Ingo & Anja Schaer" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.08);" />
                    </td>
                    <td style="vertical-align: top; padding-left: 16px;">
                      <img src="${signatureUrl}" alt="Signature" style="height: 28px; margin-bottom: 6px; opacity: 0.85;" />
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Ingo & Anja Schaer</p>
                      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Founders, PeachHaus Group</p>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Footer -->
              <div style="padding: 20px 40px; background: #1a3b4c; text-align: center;">
                <p style="font-size: 12px; color: rgba(255,255,255,0.8); margin: 0 0 4px 0; font-weight: 500;">
                  PeachHaus Group LLC · Atlanta, Georgia
                </p>
                <p style="font-size: 11px; color: rgba(255,255,255,0.6); margin: 0;">
                  <a href="mailto:info@peachhausgroup.com" style="color: rgba(255,255,255,0.6); text-decoration: none;">info@peachhausgroup.com</a> · 
                  <a href="https://peachhausgroup.com" style="color: rgba(255,255,255,0.6); text-decoration: none;">peachhausgroup.com</a>
                </p>
              </div>
              
            </div>
          </body>
        </html>
      `,
    });

    if (emailError) {
      console.error(`Email error for ${owner.email}:`, emailError);
      return false;
    }
    console.log(`Magic link email sent to ${owner.email}`);
    return true;
  } catch (err) {
    console.error(`Failed to send email to ${owner.email}:`, err);
    return false;
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { owner_id, send_email = true } = await req.json();

    if (!owner_id) {
      throw new Error("owner_id is required");
    }

    // Fetch owner details including second owner
    const { data: owner, error: ownerError } = await supabase
      .from("property_owners")
      .select("id, name, email, second_owner_name, second_owner_email")
      .eq("id", owner_id)
      .single();

    if (ownerError || !owner) {
      throw new Error("Owner not found");
    }

    // Fetch owner's active property with rental type
    const { data: property } = await supabase
      .from("properties")
      .select("id, name, rental_type")
      .eq("owner_id", owner_id)
      .is("offboarded_at", null)
      .single();

    const appUrl = Deno.env.get("VITE_APP_URL") || "https://propertycentral.lovable.app";
    // Token never expires - set to 100 years from now
    const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
    
    const results: { email: string; success: boolean; portal_url: string }[] = [];

    // Generate and send to primary owner
    const primaryToken = crypto.randomUUID() + "-" + crypto.randomUUID();
    const primaryPortalUrl = `${appUrl}/owner?token=${primaryToken}`;
    
    const { error: primarySessionError } = await supabase
      .from("owner_portal_sessions")
      .insert({
        owner_id: owner.id,
        token: primaryToken,
        email: owner.email,
        expires_at: expiresAt,
        property_id: property?.id || null,
        property_name: property?.name || null,
      });

    if (primarySessionError) {
      console.error("Primary session creation error:", primarySessionError);
      throw new Error("Failed to create session");
    }

    console.log(`Magic link generated for primary owner ${owner.email}: ${primaryPortalUrl}`);

    let primaryEmailSent = false;
    if (send_email) {
      primaryEmailSent = await sendMagicLinkEmail(
        { name: owner.name, email: owner.email },
        primaryPortalUrl,
        { name: property?.name, rentalType: property?.rental_type }
      );
    }
    
    results.push({
      email: owner.email,
      success: true,
      portal_url: primaryPortalUrl,
    });

    // Check for second owner and send invite
    let secondOwnerInviteSent = false;
    if (owner.second_owner_email && owner.second_owner_name) {
      const secondToken = crypto.randomUUID() + "-" + crypto.randomUUID();
      const secondPortalUrl = `${appUrl}/owner?token=${secondToken}`;
      
      const { error: secondSessionError } = await supabase
        .from("owner_portal_sessions")
        .insert({
          owner_id: owner.id,
          token: secondToken,
          email: owner.second_owner_email,
          expires_at: expiresAt,
          property_id: property?.id || null,
          property_name: property?.name || null,
        });

      if (secondSessionError) {
        console.error("Second owner session creation error:", secondSessionError);
      } else {
        console.log(`Magic link generated for second owner ${owner.second_owner_email}: ${secondPortalUrl}`);

        if (send_email) {
          secondOwnerInviteSent = await sendMagicLinkEmail(
            { name: owner.second_owner_name, email: owner.second_owner_email },
            secondPortalUrl,
            { name: property?.name, rentalType: property?.rental_type }
          );
        }
        
        results.push({
          email: owner.second_owner_email,
          success: true,
          portal_url: secondPortalUrl,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        portal_url: primaryPortalUrl,
        expires_at: expiresAt,
        email_sent: send_email && primaryEmailSent,
        second_owner_invited: secondOwnerInviteSent,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Magic link error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
