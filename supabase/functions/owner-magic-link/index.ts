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
          <body style="margin: 0; padding: 0; background: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <div style="max-width: 640px; margin: 0 auto; background: #ffffff;">
              
              <!-- Clean Header with Full Logo -->
              <div style="padding: 48px 40px 32px; border-bottom: 1px solid #e9ecef; text-align: center;">
                <img src="${logoUrl}" alt="PeachHaus Property Management" style="height: 72px; margin-bottom: 24px;" />
                <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #1a1a1a; letter-spacing: -0.5px;">Owner Portal</h1>
                ${propertyName ? `<p style="margin: 12px 0 0 0; font-size: 15px; color: #6c757d; font-weight: 400;">${propertyName}</p>` : ''}
                <p style="margin: 16px 0 0 0; display: inline-block; padding: 6px 16px; background: #f8f9fa; border-radius: 4px; font-size: 11px; font-weight: 600; color: #495057; text-transform: uppercase; letter-spacing: 1px;">${propertyTypeLabel}</p>
              </div>
              
              <!-- Main Content -->
              <div style="padding: 40px;">
                <p style="font-size: 16px; line-height: 1.6; color: #1a1a1a; margin: 0 0 24px 0;">
                  Dear ${owner.name.split(' ')[0]},
                </p>
                
                <p style="font-size: 15px; line-height: 1.75; color: #495057; margin: 0 0 32px 0;">
                  Your personalized owner dashboard is ready. This secure portal provides comprehensive access to your property's performance metrics, financial statements, and strategic market insights.
                </p>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 40px 0;">
                  <a href="${portalUrl}" style="display: inline-block; background: #1a1a1a; color: #ffffff; padding: 16px 48px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: 600; letter-spacing: 0.3px;">
                    Access Your Dashboard
                  </a>
                </div>
                
                <!-- Bookmark Notice -->
                <div style="text-align: center; margin: 32px 0; padding: 16px 24px; background: #f8f9fa; border-radius: 6px;">
                  <p style="font-size: 13px; color: #495057; margin: 0;">
                    <strong>Tip:</strong> Bookmark this link for instant access to your dashboard anytime.
                  </p>
                </div>
                
                <!-- Divider -->
                <hr style="border: none; border-top: 1px solid #e9ecef; margin: 40px 0;" />
                
                <!-- Portal Features -->
                <h2 style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin: 0 0 24px 0; text-transform: uppercase; letter-spacing: 1px;">What's Included</h2>
                
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #f1f3f4;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Performance Overview</p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #6c757d;">Revenue trends, occupancy rates, and key performance indicators.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #f1f3f4; background: #fffbf0;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Market Insights <span style="font-size: 10px; background: #1a1a1a; color: #fff; padding: 2px 6px; border-radius: 3px; margin-left: 6px; vertical-align: middle;">AI-POWERED</span></p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #6c757d;">
                        ${isMTR 
                          ? "Corporate housing demand analysis, insurance placement trends, and strategic positioning recommendations."
                          : "AI-driven market analysis, local event demand drivers, comparable properties, and revenue optimization strategies."
                        }
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #f1f3f4;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Bookings</p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #6c757d;">${isMTR ? "Current and historical tenant placements with complete guest details." : "Guest reservations, upcoming stays, and complete booking history."}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #f1f3f4;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Monthly Statements</p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #6c757d;">Detailed income statements with revenue breakdown and expense documentation.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #f1f3f4;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Receipts & Expenses</p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #6c757d;">Complete expense records with attached receipts and categorization.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Property Details</p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #6c757d;">Access codes, WiFi credentials, and property documentation.</p>
                    </td>
                  </tr>
                </table>
                
                <!-- Security Notice -->
                <div style="margin-top: 40px; padding: 16px 20px; background: #f8f9fa; border-left: 3px solid #1a1a1a; border-radius: 0 6px 6px 0;">
                  <p style="font-size: 12px; color: #495057; margin: 0; line-height: 1.6;">
                    <strong>Security Note:</strong> This is your private, secure link. Data is refreshed each time you access the portal.
                  </p>
                </div>
              </div>
              
              <!-- Signature Section -->
              <div style="padding: 40px; background: #f8f9fa; border-top: 1px solid #e9ecef;">
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                  <tr>
                    <td style="vertical-align: top; width: 80px;">
                      <img src="${headshotUrl}" alt="Ingo & Anja Schaer" style="width: 64px; height: 64px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.08);" />
                    </td>
                    <td style="vertical-align: top; padding-left: 16px;">
                      <img src="${signatureUrl}" alt="Signature" style="height: 36px; margin-bottom: 8px; opacity: 0.9;" />
                      <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">Ingo & Anja Schaer</p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #6c757d;">Founders, PeachHaus Group</p>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Footer -->
              <div style="padding: 24px 40px; background: #1a1a1a; text-align: center;">
                <p style="font-size: 12px; color: rgba(255,255,255,0.7); margin: 0 0 8px 0;">
                  PeachHaus Group LLC • Atlanta, Georgia
                </p>
                <p style="font-size: 11px; color: rgba(255,255,255,0.5); margin: 0;">
                  info@peachhausgroup.com • peachhausgroup.com
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
