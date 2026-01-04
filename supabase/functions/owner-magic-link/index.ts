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

    // Fetch owner details
    const { data: owner, error: ownerError } = await supabase
      .from("property_owners")
      .select("id, name, email")
      .eq("id", owner_id)
      .single();

    if (ownerError || !owner) {
      throw new Error("Owner not found");
    }

    // Generate secure token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    
    // Create session with 24-hour expiry
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const { error: sessionError } = await supabase
      .from("owner_portal_sessions")
      .insert({
        owner_id: owner.id,
        token,
        email: owner.email,
        expires_at: expiresAt,
      });

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      throw new Error("Failed to create session");
    }

    // Get app URL from env or use default
    const appUrl = Deno.env.get("VITE_APP_URL") || "https://propertycentral.lovable.app";
    const portalUrl = `${appUrl}/owner?token=${token}`;

    console.log(`Magic link generated for ${owner.email}: ${portalUrl}`);

    if (send_email) {
      // Send magic link email
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
                    Click the button below to access your owner portal, where you can view your statements, expenses, and property performance.
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
        console.error("Email error:", emailError);
        // Don't throw - still return the URL for testing
      } else {
        console.log(`Magic link email sent to ${owner.email}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        portal_url: portalUrl,
        expires_at: expiresAt,
        email_sent: send_email
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
