import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshGoogleToken, validateOAuthSetup } from "../_shared/google-oauth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckResult {
  healthy: boolean;
  checks: {
    credentialsValid: boolean;
    tokenExists: boolean;
    tokenNotExpired: boolean;
    gmailApiEnabled: boolean;
    canFetchEmails: boolean;
  };
  errors: string[];
  recommendations: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const result: HealthCheckResult = {
    healthy: true,
    checks: {
      credentialsValid: false,
      tokenExists: false,
      tokenNotExpired: false,
      gmailApiEnabled: false,
      canFetchEmails: false,
    },
    errors: [],
    recommendations: [],
  };

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Starting Gmail health check...');

    // Check 0: Validate OAuth credentials are properly configured
    const credentialsCheck = validateOAuthSetup();
    if (!credentialsCheck.valid) {
      result.checks.credentialsValid = false;
      result.healthy = false;
      result.errors.push(`OAuth credentials issue: ${credentialsCheck.issues.join(', ')}`);
      result.recommendations.push('Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase secrets');
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    result.checks.credentialsValid = true;
    console.log('Credentials valid');

    // Check 1: Token exists
    const { data: tokenData, error: tokenError } = await supabase
      .from('gmail_oauth_tokens')
      .select('*')
      .single();

    if (tokenError || !tokenData) {
      result.checks.tokenExists = false;
      result.healthy = false;
      result.errors.push('No Gmail OAuth token found');
      result.recommendations.push('Connect Gmail account via the Email Insights card');
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    result.checks.tokenExists = true;
    console.log('Token exists');

    // Check 2: Token not expired (or can be refreshed)
    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();

    if (expiresAt <= now) {
      console.log('Token expired, attempting refresh...');
      try {
        const refreshResult = await refreshGoogleToken(tokenData.refresh_token);
        accessToken = refreshResult.accessToken;
        
        // Update the token
        await supabase
          .from('gmail_oauth_tokens')
          .update({
            access_token: accessToken,
            expires_at: new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', tokenData.user_id);

        result.checks.tokenNotExpired = true;
        console.log('Token refreshed successfully');
      } catch (refreshError) {
        result.checks.tokenNotExpired = false;
        result.healthy = false;
        result.errors.push(refreshError instanceof Error ? refreshError.message : 'Token refresh failed');
        result.recommendations.push('Reconnect Gmail account - the authorization may have expired or been revoked');
      }
    } else {
      result.checks.tokenNotExpired = true;
      console.log('Token is still valid');
    }

    // Check 3: Gmail API is enabled (try to fetch profile)
    if (result.checks.tokenNotExpired) {
      try {
        const profileResponse = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/profile',
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (profileResponse.ok) {
          result.checks.gmailApiEnabled = true;
          console.log('Gmail API is enabled');
        } else {
          const errorBody = await profileResponse.text();
          
          if (errorBody.includes('accessNotConfigured') || errorBody.includes('Gmail API has not been used')) {
            result.checks.gmailApiEnabled = false;
            result.healthy = false;
            result.errors.push('Gmail API is disabled in Google Cloud Console');
            result.recommendations.push('Enable Gmail API at: https://console.developers.google.com/apis/api/gmail.googleapis.com/overview');
          } else {
            result.checks.gmailApiEnabled = false;
            result.healthy = false;
            result.errors.push(`Gmail API error: ${errorBody}`);
          }
        }
      } catch (apiError) {
        result.checks.gmailApiEnabled = false;
        result.healthy = false;
        result.errors.push(`Failed to check Gmail API: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
      }
    }

    // Check 4: Can actually fetch emails
    if (result.checks.gmailApiEnabled) {
      try {
        const messagesResponse = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1',
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (messagesResponse.ok) {
          result.checks.canFetchEmails = true;
          console.log('Can fetch emails successfully');
        } else {
          const errorBody = await messagesResponse.text();
          result.checks.canFetchEmails = false;
          result.healthy = false;
          result.errors.push(`Cannot fetch emails: ${errorBody}`);
        }
      } catch (fetchError) {
        result.checks.canFetchEmails = false;
        result.healthy = false;
        result.errors.push(`Failed to fetch emails: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
      }
    }

    // Log result to email_scan_log if unhealthy
    if (!result.healthy) {
      await supabase.from('email_scan_log').insert({
        scan_status: 'health_check_failed',
        error_message: result.errors.join('; '),
        emails_processed: 0,
        insights_generated: 0,
      });
    }

    console.log('Health check complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Health check error:', error);
    result.healthy = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');

    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
