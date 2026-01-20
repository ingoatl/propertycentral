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
      .select("*, profiles:inviter_id(first_name, email)")
      .eq("id", inviteId)
      .single();

    if (inviteError || !invite) {
      console.error("Invite not found:", inviteError);
      return new Response(
        JSON.stringify({ error: "Invite not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inviterName = (invite.profiles as any)?.first_name || "Your team";
    const appUrl = "https://propertycentral.lovable.app";

    // Email HTML template
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to Team Hub!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; color: #18181b;">You're invited to Team Hub! 🚀</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 30px;">
              <p style="font-size: 16px; color: #3f3f46; line-height: 1.6;">
                Hi there,
              </p>
              <p style="font-size: 16px; color: #3f3f46; line-height: 1.6;">
                <strong>${inviterName}</strong> has invited you to join <strong>Team Hub</strong> — our new internal communication platform.
              </p>
              <p style="font-size: 16px; color: #3f3f46; line-height: 1.6;">
                Team Hub replaces Slack for all internal team communication with:
              </p>
              <ul style="font-size: 16px; color: #3f3f46; line-height: 1.8;">
                <li>✉️ Real-time messaging with your team</li>
                <li>🏠 Property & lead context attached to messages</li>
                <li>🎯 Focus Mode for deep work</li>
                <li>📱 Push notifications on your phone</li>
              </ul>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px;">
                <p style="font-size: 14px; color: #71717a; margin: 0 0 10px;">
                  <strong>Get started:</strong>
                </p>
                <ol style="font-size: 14px; color: #3f3f46; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Click the link below to accept your invite</li>
                  <li>Enable push notifications when prompted</li>
                  <li>Set your notification preferences</li>
                </ol>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <a href="${appUrl}/team-hub" style="display: inline-block; background-color: #18181b; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Accept Invite →
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 30px; text-align: center;">
              <p style="font-size: 14px; color: #a1a1aa; margin: 0;">
                Your channels are ready and waiting!
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="font-size: 12px; color: #a1a1aa; margin: 0;">
                © ${new Date().getFullYear()} PeachHaus Group. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
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
          subject: "You're invited to Team Hub! 🚀",
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

      console.log(`Invite email sent to ${email}`);
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
