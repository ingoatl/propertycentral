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

const sendMagicLinkEmail = async (
  owner: OwnerEmailInfo,
  portalUrl: string,
  propertyName?: string
): Promise<boolean> => {
  try {
    const { error: emailError } = await resend.emails.send({
      from: "PeachHaus Group LLC <admin@peachhausgroup.com>",
      to: [owner.email],
      subject: "Access Your Owner Portal",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;">
            <div style="max-width: 500px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
              
              <!-- Header -->
              <div style="padding: 24px; border-bottom: 1px solid #e5e5e5;">
                <h1 style="margin: 0; font-size: 18px; font-weight: 600; color: #111111;">PeachHaus Owner Portal</h1>
              </div>
              
              <!-- Content -->
              <div style="padding: 24px;">
                <p style="font-size: 14px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                  Hi ${owner.name.split(' ')[0]},
                </p>
                
                <p style="font-size: 14px; line-height: 1.6; color: #333333; margin: 0 0 24px 0;">
                  Click the button below to access your owner portal${propertyName ? ` for ${propertyName}` : ''}, where you can view your statements, expenses, bookings, and property performance insights.
                </p>
                
                <a href="${portalUrl}" style="display: inline-block; background: #111111; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
                  Access Owner Portal
                </a>
                
                <p style="font-size: 12px; line-height: 1.5; color: #666666; margin: 24px 0 0 0;">
                  This link expires in 24 hours. If you didn't request this, you can safely ignore this email.
                </p>
              </div>
              
              <!-- Footer -->
              <div style="padding: 16px 24px; background: #f9f9f9; border-top: 1px solid #e5e5e5;">
                <p style="font-size: 11px; color: #888888; margin: 0;">
                  PeachHaus Group LLC • info@peachhausgroup.com
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

    // Fetch owner's active property
    const { data: property } = await supabase
      .from("properties")
      .select("id, name")
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
        property?.name
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
            property?.name
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
