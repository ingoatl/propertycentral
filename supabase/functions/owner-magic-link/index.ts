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
    
    const storageUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images";
    const logoUrl = `${storageUrl}/peachhaus-logo.png`;
    const headshotUrl = `${storageUrl}/ingo-headshot.png`;
    const signatureUrl = `${storageUrl}/ingo-signature.png`;

    const { error: emailError } = await resend.emails.send({
      from: "PeachHaus Group LLC <admin@peachhausgroup.com>",
      to: [owner.email],
      subject: `🍑 Your Owner Portal Access${propertyName ? ` - ${propertyName}` : ''}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #fef3e2 0%, #fde8d0 100%); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;">
            <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.12);">
              
              <!-- Logo Header -->
              <div style="padding: 32px 28px 20px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); text-align: center;">
                <img src="${logoUrl}" alt="PeachHaus" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.2); margin-bottom: 16px;" />
                <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Owner Portal</h1>
                ${propertyName ? `<p style="margin: 10px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 500;">${propertyName}</p>` : ''}
                <span style="display: inline-block; margin-top: 14px; padding: 6px 16px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 20px; font-size: 12px; font-weight: 600; color: #fff; text-transform: uppercase; letter-spacing: 0.5px;">${propertyTypeLabel}</span>
              </div>
              
              <!-- Content -->
              <div style="padding: 32px 28px;">
                <p style="font-size: 17px; line-height: 1.6; color: #1a1a2e; margin: 0 0 20px 0; font-weight: 500;">
                  Hi ${owner.name.split(' ')[0]},
                </p>
                
                <p style="font-size: 15px; line-height: 1.8; color: #4a5568; margin: 0 0 24px 0;">
                  Welcome to your personalized owner dashboard! This secure portal gives you <strong>24/7 access</strong> to everything about your property's performance, financials, and market insights.
                </p>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 18px 48px; border-radius: 12px; text-decoration: none; font-size: 17px; font-weight: 700; box-shadow: 0 6px 20px rgba(16,185,129,0.35); transition: transform 0.2s;">
                    Access Your Dashboard →
                  </a>
                </div>
                
                <!-- Bookmark Notice -->
                <div style="text-align: center; margin: 20px 0 32px 0; padding: 14px 20px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 10px; border: 1px solid #93c5fd;">
                  <p style="font-size: 14px; color: #1e40af; margin: 0; font-weight: 500;">
                    ⭐ <strong>Pro Tip:</strong> Bookmark this link for easy access anytime!
                  </p>
                </div>
                
                <!-- Tab Descriptions Section -->
                <div style="margin: 28px 0;">
                  <h2 style="font-size: 18px; font-weight: 700; color: #1a1a2e; margin: 0 0 20px 0; text-align: center;">What You'll Find Inside</h2>
                  
                  <div style="display: grid; gap: 12px;">
                    <!-- Overview Tab -->
                    <div style="padding: 16px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #3b82f6;">
                      <p style="margin: 0; font-size: 14px; font-weight: 700; color: #1e40af;">📊 Performance Overview</p>
                      <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">Revenue trends, occupancy rates, and key metrics at a glance.</p>
                    </div>
                    
                    <!-- Market Insights Tab - EMPHASIZED -->
                    <div style="padding: 20px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; border: 2px solid #f59e0b; position: relative;">
                      <div style="position: absolute; top: -10px; right: 16px; background: #f59e0b; color: white; padding: 4px 12px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase;">Featured</div>
                      <p style="margin: 0; font-size: 15px; font-weight: 700; color: #92400e;">🚀 Market Insights (AI-Powered)</p>
                      <p style="margin: 8px 0 0 0; font-size: 13px; color: #78350f; line-height: 1.6;">
                        ${isMTR 
                          ? "Discover corporate housing demand trends, insurance placement opportunities, and healthcare sector needs in your area. See how we're positioning your property for maximum mid-term rental income."
                          : "Explore AI-driven market analysis, upcoming local events driving demand, comparable properties in your area, and strategic opportunities to maximize your rental income."
                        }
                      </p>
                    </div>
                    
                    <!-- Bookings Tab -->
                    <div style="padding: 16px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #10b981;">
                      <p style="margin: 0; font-size: 14px; font-weight: 700; color: #065f46;">📅 Bookings</p>
                      <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">${isMTR ? "Current and past tenant placements including corporate, insurance, and healthcare guests." : "Guest reservations, upcoming stays, and complete booking history with guest details."}</p>
                    </div>
                    
                    <!-- Statements Tab -->
                    <div style="padding: 16px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #8b5cf6;">
                      <p style="margin: 0; font-size: 14px; font-weight: 700; color: #5b21b6;">📄 Monthly Statements</p>
                      <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">Detailed income statements with revenue breakdown, expenses, and net earnings.</p>
                    </div>
                    
                    <!-- Receipts Tab -->
                    <div style="padding: 16px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #ec4899;">
                      <p style="margin: 0; font-size: 14px; font-weight: 700; color: #9d174d;">🧾 Receipts & Expenses</p>
                      <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">All property expenses with attached receipts and documentation.</p>
                    </div>
                    
                    <!-- Property Tab -->
                    <div style="padding: 16px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #6366f1;">
                      <p style="margin: 0; font-size: 14px; font-weight: 700; color: #3730a3;">🏠 Property Details</p>
                      <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">Access codes, WiFi credentials, and all important property information.</p>
                    </div>
                  </div>
                </div>
                
                <!-- Secure Link Notice -->
                <div style="margin-top: 28px; padding: 16px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 10px; border: 1px solid #6ee7b7;">
                  <p style="font-size: 13px; color: #065f46; margin: 0; text-align: center;">
                    🔒 <strong>Secure & Private:</strong> This link is unique to you. Your data refreshes every time you visit.
                  </p>
                </div>
              </div>
              
              <!-- Signature Section with Headshots -->
              <div style="padding: 28px; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border-top: 1px solid #cbd5e1;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <p style="font-size: 14px; color: #64748b; margin: 0 0 16px 0;">Warmly,</p>
                  
                  <!-- Team Headshots -->
                  <div style="display: inline-block;">
                    <img src="${headshotUrl}" alt="Ingo & Anja" style="width: 70px; height: 70px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
                  </div>
                  
                  <!-- Signature -->
                  <div style="margin-top: 12px;">
                    <img src="${signatureUrl}" alt="Signature" style="height: 45px; opacity: 0.85;" />
                  </div>
                  
                  <p style="margin: 16px 0 0 0; font-size: 16px; font-weight: 700; color: #1a1a2e;">Ingo & Anja Schaer</p>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Founders, PeachHaus Group</p>
                </div>
                
                <div style="text-align: center; padding-top: 16px; border-top: 1px solid #cbd5e1;">
                  <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                    📧 info@peachhausgroup.com &nbsp;•&nbsp; 🌐 peachhausgroup.com
                  </p>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="padding: 20px 28px; background: #1a1a2e; text-align: center;">
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
