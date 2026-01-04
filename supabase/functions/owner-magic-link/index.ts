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
    const isHybrid = rentalType === "hybrid";

    // Customize messaging based on rental type
    const propertyTypeLabel = isMTR ? "Mid-Term Rental" : isHybrid ? "Hybrid STR/MTR" : "Short-Term Rental";
    
    const tabDescriptions = isMTR ? `
      <div style="margin: 20px 0; padding: 16px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #10b981;">
        <p style="font-size: 13px; font-weight: 600; color: #111; margin: 0 0 12px 0;">📊 What's Inside Your Portal:</p>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #444; line-height: 1.8;">
          <li><strong>Statements</strong> — Monthly income statements with detailed MTR revenue breakdown</li>
          <li><strong>Bookings</strong> — Current and past tenant placements (corporate, insurance, healthcare)</li>
          <li><strong>Expenses</strong> — Property expenses with receipt documentation</li>
          <li><strong>Property Info</strong> — Access codes, credentials, and property details</li>
          <li><strong>Market Insights</strong> — Corporate housing demand & insurance placement trends</li>
        </ul>
      </div>
    ` : `
      <div style="margin: 20px 0; padding: 16px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #10b981;">
        <p style="font-size: 13px; font-weight: 600; color: #111; margin: 0 0 12px 0;">📊 What's Inside Your Portal:</p>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #444; line-height: 1.8;">
          <li><strong>Statements</strong> — Monthly income statements with STR & MTR revenue breakdown</li>
          <li><strong>Bookings</strong> — Guest reservations, upcoming stays, and booking history</li>
          <li><strong>Expenses</strong> — Property expenses with receipt documentation</li>
          <li><strong>Property Info</strong> — Access codes, WiFi, and property credentials</li>
          <li><strong>Market Insights</strong> — AI-powered market analysis, upcoming events & demand drivers</li>
          <li><strong>Reviews</strong> — Guest reviews and your property's ratings</li>
        </ul>
      </div>
    `;

    const { error: emailError } = await resend.emails.send({
      from: "PeachHaus Group LLC <admin@peachhausgroup.com>",
      to: [owner.email],
      subject: `Your Owner Portal Access${propertyName ? ` - ${propertyName}` : ''}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;">
            <div style="max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              
              <!-- Header with gradient -->
              <div style="padding: 32px 28px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); text-align: center;">
                <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff;">🍑 PeachHaus Owner Portal</h1>
                ${propertyName ? `<p style="margin: 8px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.8);">${propertyName}</p>` : ''}
                <span style="display: inline-block; margin-top: 12px; padding: 4px 12px; background: rgba(255,255,255,0.15); border-radius: 20px; font-size: 11px; color: #fff;">${propertyTypeLabel}</span>
              </div>
              
              <!-- Content -->
              <div style="padding: 28px;">
                <p style="font-size: 15px; line-height: 1.6; color: #333333; margin: 0 0 16px 0;">
                  Hi ${owner.name.split(' ')[0]},
                </p>
                
                <p style="font-size: 14px; line-height: 1.7; color: #444444; margin: 0 0 20px 0;">
                  Welcome to your personalized owner dashboard! This secure portal gives you 24/7 access to everything about your property's performance, financials, and market insights.
                </p>
                
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
                    Access Your Dashboard →
                  </a>
                </div>
                
                ${tabDescriptions}
                
                <div style="margin-top: 24px; padding: 16px; background: #fffbeb; border-radius: 8px; border: 1px solid #fcd34d;">
                  <p style="font-size: 12px; color: #92400e; margin: 0;">
                    🔒 <strong>Secure Link:</strong> This link is unique to you and expires in 24 hours. Don't share it with others.
                  </p>
                </div>
              </div>
              
              <!-- Signature -->
              <div style="padding: 24px 28px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                  <tr>
                    <td style="vertical-align: top; padding-right: 16px; width: 60px;">
                      <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" style="width: 50px; height: 50px; border-radius: 50%; border: 2px solid #e5e7eb;" />
                    </td>
                    <td style="vertical-align: top;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111;">The PeachHaus Team</p>
                      <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">Professional Property Management</p>
                      <p style="margin: 8px 0 0 0; font-size: 12px; color: #888;">
                        📧 info@peachhausgroup.com<br/>
                        🌐 peachhausgroup.com
                      </p>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Footer -->
              <div style="padding: 16px 28px; background: #1a1a2e; text-align: center;">
                <p style="font-size: 11px; color: rgba(255,255,255,0.6); margin: 0;">
                  © ${new Date().getFullYear()} PeachHaus Group LLC • Atlanta, Georgia
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
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
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
