import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckResult {
  healthy: boolean;
  checks: {
    tokenExists: boolean;
    tokenNotExpired: boolean;
    gmailApiEnabled: boolean;
    canFetchEmails: boolean;
  };
  errors: string[];
  recommendations: string[];
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')?.trim();
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const tokens = await response.json();
  return tokens.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const result: HealthCheckResult = {
    healthy: true,
    checks: {
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
        accessToken = await refreshAccessToken(tokenData.refresh_token);
        
        // Update the token
        await supabase
          .from('gmail_oauth_tokens')
          .update({
            access_token: accessToken,
            expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', tokenData.user_id);

        result.checks.tokenNotExpired = true;
        console.log('Token refreshed successfully');
      } catch (refreshError) {
        result.checks.tokenNotExpired = false;
        result.healthy = false;
        result.errors.push(`Token refresh failed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`);
        result.recommendations.push('Reconnect Gmail account - the refresh token may have been revoked');
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