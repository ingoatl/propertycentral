import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Checking Gmail token health...');

    // Get the latest Gmail OAuth token
    const { data: tokens, error: tokensError } = await supabase
      .from('gmail_oauth_tokens')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      throw tokensError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('No Gmail tokens found - Gmail not connected');
      return new Response(
        JSON.stringify({ 
          status: 'not_connected',
          message: 'Gmail is not connected' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = tokens[0];
    const expiresAt = new Date(token.expires_at);
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Check if token is expired or will expire within 3 days
    const isExpired = expiresAt < now;
    const isExpiringSoon = expiresAt < threeDaysFromNow;

    console.log(`Token expires at: ${expiresAt.toISOString()}`);
    console.log(`Is expired: ${isExpired}, Is expiring soon: ${isExpiringSoon}`);

    // Try to refresh the token to verify it's still valid
    let tokenValid = true;
    if (isExpiringSoon && token.refresh_token) {
      try {
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
            client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
            refresh_token: token.refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          console.error('Token refresh failed:', errorText);
          tokenValid = false;
        } else {
          const newTokens = await refreshResponse.json();
          // Update the token in database
          const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
          await supabase
            .from('gmail_oauth_tokens')
            .update({
              access_token: newTokens.access_token,
              expires_at: newExpiresAt.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', token.id);
          
          console.log('Token refreshed successfully');
        }
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        tokenValid = false;
      }
    }

    // If token is invalid or expired, send alert email
    if (!tokenValid || isExpired) {
      console.log('Token is expired or invalid, sending alert email...');
      
      // Get admin emails from profiles
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('email')
          .in('id', admins.map(a => a.user_id));

        const adminEmails = adminProfiles?.map(p => p.email).filter(Boolean) || [];
        
        if (adminEmails.length > 0) {
          // Send alert email using Resend
          const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
          
          if (RESEND_API_KEY) {
            const appUrl = Deno.env.get('APP_URL') || 'https://peachhaus.lovable.app';
            
            const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Action Required</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Gmail Connection Expired</p>
  </div>
  
  <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-top: 0;">Hi Team,</p>
    
    <p>Your Gmail integration has <strong>expired</strong> and email scanning has stopped working.</p>
    
    <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <strong style="color: #856404;">What this means:</strong>
      <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #856404;">
        <li>New expenses from Amazon orders won't be automatically detected</li>
        <li>Utility bills won't be captured from email</li>
        <li>Property-related emails won't be analyzed</li>
      </ul>
    </div>
    
    <div style="background: #d4edda; border: 1px solid #28a745; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <strong style="color: #155724;">To reconnect (takes 30 seconds):</strong>
      <ol style="margin: 10px 0 0 0; padding-left: 20px; color: #155724;">
        <li>Log into PeachHaus</li>
        <li>Go to <strong>Admin → Integrations</strong> tab</li>
        <li>Click <strong>"Reconnect Gmail"</strong></li>
        <li>Follow the Google authorization prompts</li>
      </ol>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${appUrl}/admin" style="background: linear-gradient(135deg, #28a745 0%, #218838 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Reconnect Gmail Now →
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    
    <p style="font-size: 13px; color: #666; margin-bottom: 0;">
      <strong>Why did this happen?</strong><br>
      Google OAuth tokens expire periodically for security. To prevent this in the future, ensure the Google Cloud OAuth app is published to production mode.
    </p>
  </div>
  
  <p style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">
    PeachHaus Property Management System
  </p>
</body>
</html>`;

            for (const email of adminEmails) {
              try {
                const emailResponse = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    from: 'PeachHaus System <notifications@peachhaus.com>',
                    to: [email],
                    subject: '⚠️ Action Required: Gmail Connection Expired - PeachHaus',
                    html: emailHtml,
                  }),
                });

                if (emailResponse.ok) {
                  console.log(`Alert email sent to ${email}`);
                } else {
                  const errorText = await emailResponse.text();
                  console.error(`Failed to send alert to ${email}:`, errorText);
                }
              } catch (emailError) {
                console.error(`Error sending email to ${email}:`, emailError);
              }
            }
          } else {
            console.log('RESEND_API_KEY not configured, skipping email alert');
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          status: 'expired',
          message: 'Gmail token is expired or invalid. Alert emails sent.',
          expires_at: token.expires_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Token is healthy
    return new Response(
      JSON.stringify({ 
        status: 'healthy',
        message: 'Gmail token is valid',
        expires_at: token.expires_at,
        last_updated: token.updated_at
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-gmail-token-health:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
