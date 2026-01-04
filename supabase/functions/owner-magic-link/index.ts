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
  rentalType?: string;
}

const sendMagicLinkEmail = async (
  owner: OwnerEmailInfo,
  portalUrl: string,
  propertyInfo?: PropertyInfo
): Promise<boolean> => {
  try {
    const propertyName = propertyInfo?.name;
    const rentalType = propertyInfo?.rentalType || "hybrid";
    const isMTR = rentalType === "mid_term";

    const propertyTypeLabel = isMTR ? "Mid-Term Rental" : rentalType === "hybrid" ? "Hybrid Portfolio" : "Short-Term Rental";
    
    const storageUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images";
    const logoUrl = `${storageUrl}/peachhaus-logo.png`;
    const headshotUrl = `${storageUrl}/ingo-headshot.png`;
    const signatureUrl = `${storageUrl}/ingo-signature.png`;

    const { error: emailError } = await resend.emails.send({
      from: "PeachHaus Group LLC <admin@peachhausgroup.com>",
      to: [owner.email],
      subject: `Your Owner Portal Access${propertyName ? ` — ${propertyName}` : ''}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; margin-top: 32px; margin-bottom: 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
              
              <!-- Premium Header -->
              <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 40px; text-align: center;">
                <img src="${logoUrl}" alt="PeachHaus" style="height: 48px; margin-bottom: 24px;" />
                <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; line-height: 1.2;">Owner Portal</h1>
                ${propertyName ? `
                  <p style="margin: 16px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.85); font-weight: 400;">${propertyName}</p>
                ` : ''}
                <div style="margin-top: 20px;">
                  <span style="display: inline-block; padding: 8px 20px; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); border-radius: 100px; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1.5px;">${propertyTypeLabel}</span>
                </div>
              </div>
              
              <!-- Main Content -->
              <div style="padding: 48px 40px;">
                <p style="font-size: 18px; line-height: 1.5; color: #1a1a1a; margin: 0 0 8px 0; font-weight: 600;">
                  Dear ${owner.name.split(' ')[0]},
                </p>
                
                <p style="font-size: 15px; line-height: 1.75; color: #4a5568; margin: 16px 0 40px 0;">
                  Your personalized owner dashboard is ready. Access comprehensive performance metrics, financial statements, and AI-powered market insights—all in one secure location.
                </p>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 40px 0;">
                  <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 18px 56px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 4px 16px rgba(245,158,11,0.35); transition: all 0.2s ease;">
                    Access Your Dashboard →
                  </a>
                </div>
                
                <!-- Bookmark Tip -->
                <div style="text-align: center; margin: 32px 0; padding: 16px 24px; background: linear-gradient(135deg, #fef3c7 0%, #fef9e7 100%); border-radius: 8px; border: 1px solid #fcd34d;">
                  <p style="font-size: 13px; color: #92400e; margin: 0; font-weight: 500;">
                    💡 <strong>Pro tip:</strong> Bookmark this link for instant access anytime
                  </p>
                </div>
              </div>
              
              <!-- Features Section -->
              <div style="padding: 0 40px 48px;">
                <div style="border-top: 1px solid #e2e8f0; padding-top: 40px;">
                  <h2 style="font-size: 12px; font-weight: 700; color: #64748b; margin: 0 0 24px 0; text-transform: uppercase; letter-spacing: 1.5px;">What's Included</h2>
                  
                  <div style="display: block;">
                    <!-- Feature 1 -->
                    <div style="padding: 16px 0; border-bottom: 1px solid #f1f5f9;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td width="40" style="vertical-align: top;">
                            <div style="width: 32px; height: 32px; background: #f0fdf4; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">📊</div>
                          </td>
                          <td style="vertical-align: top; padding-left: 12px;">
                            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Performance Overview</p>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">Revenue trends, occupancy rates, and key performance indicators</p>
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                    <!-- Feature 2 - AI Insights (Highlighted) -->
                    <div style="padding: 16px; margin: 8px -16px; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-radius: 8px; border: 1px solid #fcd34d;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td width="40" style="vertical-align: top;">
                            <div style="width: 32px; height: 32px; background: #fbbf24; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">✨</div>
                          </td>
                          <td style="vertical-align: top; padding-left: 12px;">
                            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">
                              Market Insights 
                              <span style="display: inline-block; padding: 2px 8px; background: #1a1a1a; color: #fff; font-size: 9px; border-radius: 4px; margin-left: 8px; vertical-align: middle; font-weight: 700; letter-spacing: 0.5px;">AI-POWERED</span>
                            </p>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #78350f; line-height: 1.5;">
                              ${isMTR 
                                ? "Corporate housing demand, insurance placement trends, and positioning recommendations"
                                : "AI-driven market analysis, local event demand, and revenue optimization strategies"
                              }
                            </p>
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                    <!-- Feature 3 -->
                    <div style="padding: 16px 0; border-bottom: 1px solid #f1f5f9;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td width="40" style="vertical-align: top;">
                            <div style="width: 32px; height: 32px; background: #eff6ff; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">📅</div>
                          </td>
                          <td style="vertical-align: top; padding-left: 12px;">
                            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Bookings</p>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">${isMTR ? "Current and historical tenant placements" : "Guest reservations and booking history"}</p>
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                    <!-- Feature 4 -->
                    <div style="padding: 16px 0; border-bottom: 1px solid #f1f5f9;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td width="40" style="vertical-align: top;">
                            <div style="width: 32px; height: 32px; background: #f0fdf4; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">📄</div>
                          </td>
                          <td style="vertical-align: top; padding-left: 12px;">
                            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Monthly Statements</p>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">Detailed income statements with revenue breakdown</p>
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                    <!-- Feature 5 -->
                    <div style="padding: 16px 0; border-bottom: 1px solid #f1f5f9;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td width="40" style="vertical-align: top;">
                            <div style="width: 32px; height: 32px; background: #fef2f2; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">🧾</div>
                          </td>
                          <td style="vertical-align: top; padding-left: 12px;">
                            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Receipts & Expenses</p>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">Complete expense records with attached receipts</p>
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                    <!-- Feature 6 -->
                    <div style="padding: 16px 0;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td width="40" style="vertical-align: top;">
                            <div style="width: 32px; height: 32px; background: #f5f3ff; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">🏠</div>
                          </td>
                          <td style="vertical-align: top; padding-left: 12px;">
                            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Property Details</p>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">Access codes, WiFi credentials, and documentation</p>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </div>
                </div>
                
                <!-- Security Notice -->
                <div style="margin-top: 32px; padding: 20px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #1a1a1a;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td width="24" style="vertical-align: top;">
                        <span style="font-size: 16px;">🔒</span>
                      </td>
                      <td style="vertical-align: top; padding-left: 12px;">
                        <p style="font-size: 13px; color: #475569; margin: 0; line-height: 1.6;">
                          <strong style="color: #1e293b;">Security Note:</strong> This is your private, secure link. Your data is encrypted and refreshed each time you access the portal.
                        </p>
                      </td>
                    </tr>
                  </table>
                </div>
              </div>
              
              <!-- Signature Section -->
              <div style="padding: 40px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                  <tr>
                    <td style="vertical-align: top; width: 72px;">
                      <img src="${headshotUrl}" alt="Ingo & Anja Schaer" style="width: 64px; height: 64px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.08);" />
                    </td>
                    <td style="vertical-align: top; padding-left: 20px;">
                      <img src="${signatureUrl}" alt="Signature" style="height: 32px; margin-bottom: 8px; opacity: 0.85;" />
                      <p style="margin: 0; font-size: 15px; font-weight: 700; color: #1a1a1a;">Ingo & Anja Schaer</p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Founders, PeachHaus Group</p>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Footer -->
              <div style="padding: 24px 40px; background: #1a1a1a; text-align: center;">
                <p style="font-size: 12px; color: rgba(255,255,255,0.7); margin: 0 0 8px 0; font-weight: 500;">
                  PeachHaus Group LLC · Atlanta, Georgia
                </p>
                <p style="font-size: 11px; color: rgba(255,255,255,0.5); margin: 0;">
                  <a href="mailto:info@peachhausgroup.com" style="color: rgba(255,255,255,0.5); text-decoration: none;">info@peachhausgroup.com</a> · 
                  <a href="https://peachhausgroup.com" style="color: rgba(255,255,255,0.5); text-decoration: none;">peachhausgroup.com</a>
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
