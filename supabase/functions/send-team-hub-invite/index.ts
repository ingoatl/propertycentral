import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { inviteId, email } = await req.json();

    if (!inviteId || !email) {
      return new Response(
        JSON.stringify({ error: "Missing inviteId or email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get invite details
    const { data: invite, error: inviteError } = await supabase
      .from("team_hub_invites")
      .select("*")
      .eq("id", inviteId)
      .single();

    if (inviteError || !invite) {
      console.error("Invite not found:", inviteError);
      return new Response(
        JSON.stringify({ error: "Invite not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get inviter profile separately
    let inviterName = "The Team";
    if (invite.inviter_id) {
      const { data: inviterProfile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", invite.inviter_id)
        .single();
      inviterName = inviterProfile?.first_name || "The Team";
    }
    const appUrl = "https://propertycentral.lovable.app";
    const firstName = email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);

    // Professional email HTML template (styled like owner statements)
    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Team Hub</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #18181b 0%, #27272a 100%); padding: 40px 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                      PeachHaus Group
                    </h1>
                    <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.7);">
                      Team Hub Invitation
                    </p>
                  </td>
                  <td align="right" valign="top">
                    <div style="background: rgba(255,255,255,0.15); border-radius: 12px; padding: 12px 16px;">
                      <span style="font-size: 24px;">👋</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 18px; font-weight: 600; color: #18181b;">
                Hi ${firstName},
              </p>
              
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.7; color: #3f3f46;">
                <strong>${inviterName}</strong> has invited you to join <strong>Team Hub</strong> — our new internal communication platform that replaces Slack for all team coordination.
              </p>

              <!-- Feature Box -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: #fafafa; border-radius: 12px; border: 1px solid #e4e4e7; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #18181b; text-transform: uppercase; letter-spacing: 0.5px;">
                      What you can do in Team Hub
                    </p>
                    
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="padding: 8px 0;">
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td style="width: 32px; vertical-align: top;">
                                <span style="font-size: 16px;">💬</span>
                              </td>
                              <td style="font-size: 15px; color: #3f3f46; line-height: 1.5;">
                                <strong>Real-time messaging</strong> — Chat with the team in organized channels
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td style="width: 32px; vertical-align: top;">
                                <span style="font-size: 16px;">🏠</span>
                              </td>
                              <td style="font-size: 15px; color: #3f3f46; line-height: 1.5;">
                                <strong>Context linking</strong> — Tag messages with properties, leads, and work orders
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td style="width: 32px; vertical-align: top;">
                                <span style="font-size: 16px;">📎</span>
                              </td>
                              <td style="font-size: 15px; color: #3f3f46; line-height: 1.5;">
                                <strong>File sharing</strong> — Upload and share documents, images, and files
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td style="width: 32px; vertical-align: top;">
                                <span style="font-size: 16px;">🔔</span>
                              </td>
                              <td style="font-size: 15px; color: #3f3f46; line-height: 1.5;">
                                <strong>Smart notifications</strong> — Get alerted to @mentions and important updates
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td style="width: 32px; vertical-align: top;">
                                <span style="font-size: 16px;">🎯</span>
                              </td>
                              <td style="font-size: 15px; color: #3f3f46; line-height: 1.5;">
                                <strong>Focus Mode</strong> — Block notifications during deep work
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Getting Started Box -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: #fef3c7; border-radius: 12px; border: 1px solid #fcd34d; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #92400e;">
                      ⚡ Quick Setup (2 minutes)
                    </p>
                    <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #78350f; line-height: 1.8;">
                      <li>Click the button below to accept your invite</li>
                      <li><strong>Upload your profile picture</strong> so the team recognizes you</li>
                      <li>Enable push notifications to stay connected</li>
                      <li>Join #general and say hello! 👋</li>
                    </ol>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/team-hub" style="display: inline-block; background: linear-gradient(135deg, #18181b 0%, #27272a 100%); color: #ffffff; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                      Join Team Hub →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 32px 0 0; font-size: 14px; color: #71717a; text-align: center;">
                We're excited to have you on the team!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #fafafa; padding: 24px 40px; border-top: 1px solid #e4e4e7;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                      © ${new Date().getFullYear()} PeachHaus Group LLC
                    </p>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #a1a1aa;">
                      Atlanta's Premier Property Management
                    </p>
                  </td>
                  <td align="right">
                    <a href="${appUrl}" style="font-size: 12px; color: #71717a; text-decoration: none;">
                      propertycentral.lovable.app
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Post-footer note -->
        <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">
          This invitation expires in 7 days. Having trouble? Reply to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send email via Resend
    if (resendApiKey) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "PeachHaus Team <notifications@peachhausgroup.com>",
          to: [email],
          subject: `${inviterName} invited you to Team Hub 👋`,
          html: emailHtml,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error("Resend error:", errorText);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to send email" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Team Hub invite email sent to ${email}`);
    } else {
      console.log(`RESEND_API_KEY not configured, skipping email to ${email}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
