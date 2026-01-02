import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { refreshGoogleToken, validateOAuthSetup } from "../_shared/google-oauth.ts";

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

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    // First, validate OAuth credentials
    const credentialsCheck = validateOAuthSetup();
    if (!credentialsCheck.valid) {
      console.error('OAuth credentials issue:', credentialsCheck.issues);
      
      // Send alert about credentials issue
      try {
        await resend.emails.send({
          from: 'Peachhaus <notifications@peachhausgroup.com>',
          to: ['ingo@peachhausgroup.com'],
          subject: '🚨 Gmail OAuth Credentials Issue',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">Gmail OAuth Credentials Issue</h2>
              <p>The Gmail integration has detected a problem with the OAuth credentials:</p>
              <ul>
                ${credentialsCheck.issues.map(issue => `<li>${issue}</li>`).join('')}
              </ul>
              <p style="margin-top: 20px; color: #666;">
                Please verify the GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase secrets.
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send credentials alert:', emailError);
      }
      
      return new Response(
        JSON.stringify({ error: 'OAuth credentials issue', issues: credentialsCheck.issues }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all Gmail tokens
    const { data: tokens, error: tokenError } = await supabase
      .from('gmail_oauth_tokens')
      .select('*');

    if (tokenError || !tokens || tokens.length === 0) {
      console.log('No Gmail tokens found');
      return new Response(
        JSON.stringify({ message: 'No Gmail tokens to check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const token of tokens) {
      const expiresAt = new Date(token.expires_at);
      const now = new Date();
      const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      const daysUntilExpiry = hoursUntilExpiry / 24;

      console.log(`Token for user ${token.user_id} expires in ${daysUntilExpiry.toFixed(1)} days (${hoursUntilExpiry.toFixed(1)} hours)`);

      // Proactively refresh tokens that expire within 7 days
      const shouldRefresh = hoursUntilExpiry <= 168; // 7 days = 168 hours
      const isExpired = hoursUntilExpiry <= 0;

      if (!shouldRefresh) {
        // Token is still valid for more than 7 days
        results.push({ 
          userId: token.user_id, 
          status: 'valid', 
          daysRemaining: daysUntilExpiry.toFixed(1) 
        });
        continue;
      }

      console.log(`Token needs refresh: expires in ${hoursUntilExpiry.toFixed(1)} hours`);
      
      // Attempt to refresh the token using shared utility
      try {
        const refreshResult = await refreshGoogleToken(token.refresh_token);
        const newExpiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000);
        
        await supabase
          .from('gmail_oauth_tokens')
          .update({
            access_token: refreshResult.accessToken,
            expires_at: newExpiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', token.user_id);

        console.log(`Token refreshed successfully for user ${token.user_id}, new expiry: ${newExpiresAt.toISOString()}`);
        results.push({ 
          userId: token.user_id, 
          status: 'refreshed', 
          newExpiresAt: newExpiresAt.toISOString() 
        });
        continue;
      } catch (refreshError) {
        const errorMessage = refreshError instanceof Error ? refreshError.message : 'Unknown error';
        console.error('Token refresh failed:', errorMessage);

        // Determine if this is a credentials issue or token issue
        const isCredentialsIssue = errorMessage.includes('invalid_client') || errorMessage.includes('credentials');
        const isTokenRevoked = errorMessage.includes('invalid_grant') || errorMessage.includes('revoked');

        // If we get here, refresh failed - send alert if token is expiring soon (within 24h) or expired
        if (hoursUntilExpiry <= 24 || isCredentialsIssue || isTokenRevoked) {
          let alertType = isExpired ? 'EXPIRED' : 'EXPIRING_SOON';
          if (isCredentialsIssue) alertType = 'CREDENTIALS_INVALID';
          if (isTokenRevoked) alertType = 'TOKEN_REVOKED';

          const subject = isCredentialsIssue
            ? '🚨 Gmail OAuth Client Invalid - Check Credentials'
            : isTokenRevoked
            ? '🚨 Gmail Token Revoked - Reconnection Required'
            : isExpired 
            ? '🚨 Gmail Token Expired - Action Required'
            : '⚠️ Gmail Token Expiring Soon - Refresh Failed';
          
          const message = isCredentialsIssue
            ? `The Gmail OAuth client appears to be invalid. This usually means the OAuth app was deleted or the credentials are incorrect. Please verify the GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.`
            : isTokenRevoked
            ? `The Gmail refresh token has been revoked. The user may have removed app access from their Google account. Please reconnect Gmail.`
            : isExpired
            ? `Your Gmail connection has expired and automatic refresh failed. Please reconnect Gmail in the app to continue scanning emails.`
            : `Your Gmail token will expire in ${Math.ceil(hoursUntilExpiry)} hours and automatic refresh failed. Please reconnect Gmail in the app.`;

          try {
            await resend.emails.send({
              from: 'Peachhaus <notifications@peachhausgroup.com>',
              to: ['ingo@peachhausgroup.com'],
              subject: subject,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: ${isExpired || isCredentialsIssue || isTokenRevoked ? '#dc2626' : '#f59e0b'};">${subject}</h2>
                  <p>${message}</p>
                  <p style="margin-top: 20px;">
                    <strong>Token Details:</strong><br>
                    User ID: ${token.user_id}<br>
                    Expires: ${expiresAt.toLocaleString()}<br>
                    Status: ${alertType}<br>
                    Error: ${errorMessage}
                  </p>
                  <p style="margin-top: 20px; color: #666;">
                    ${isCredentialsIssue 
                      ? 'Check the Google Cloud Console to verify the OAuth client exists and the credentials in Supabase secrets are correct.'
                      : 'To fix this, open the app and reconnect your Gmail account.'}
                  </p>
                </div>
              `,
            });
            
            console.log(`Alert email sent for token ${alertType}`);
            results.push({ userId: token.user_id, status: alertType, emailSent: true, error: errorMessage });
          } catch (emailError) {
            console.error('Failed to send alert email:', emailError);
            results.push({ userId: token.user_id, status: alertType, emailSent: false, error: String(emailError) });
          }
        } else {
          // Refresh failed but token still has time - will try again on next run
          results.push({ 
            userId: token.user_id, 
            status: 'refresh_failed_will_retry', 
            hoursRemaining: hoursUntilExpiry.toFixed(1),
            error: errorMessage
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking token expiry:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
