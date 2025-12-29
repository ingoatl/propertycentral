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
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // Contains return URL
    const error = url.searchParams.get('error');

    console.log('GBP OAuth callback received', { hasCode: !!code, state, error });

    // Handle OAuth errors
    if (error) {
      const errorDescription = url.searchParams.get('error_description') || '';
      console.error('OAuth error:', error, errorDescription);
      return new Response(
        `<html>
          <body>
            <h1>Authorization Failed</h1>
            <p>Error: ${error}</p>
            <p>${errorDescription}</p>
            <p>You can close this window.</p>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 400 }
      );
    }

    if (!code) {
      return new Response(
        `<html>
          <body>
            <h1>Missing Authorization Code</h1>
            <p>No authorization code received from Google.</p>
            <p>You can close this window.</p>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 400 }
      );
    }
    
    const GOOGLE_CLIENT_ID = Deno.env.get('GBP_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GBP_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/gbp-oauth`;

    console.log('Exchanging code for tokens...');

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(
        `<html>
          <body>
            <h1>Token Exchange Failed</h1>
            <pre>${errorText}</pre>
            <p>You can close this window.</p>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 500 }
      );
    }

    const tokens = await tokenResponse.json();
    console.log('Tokens received successfully');

    // Store tokens in database
    const supabase = createClient(
      SUPABASE_URL!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Check if settings exist
    const { data: existingSettings } = await supabase
      .from('gbp_settings')
      .select('id')
      .limit(1)
      .single();

    if (existingSettings) {
      // Update existing settings
      const { error: dbError } = await supabase
        .from('gbp_settings')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSettings.id);

      if (dbError) {
        console.error('Database update error:', dbError);
        throw dbError;
      }
    } else {
      // Insert new settings
      const { error: dbError } = await supabase
        .from('gbp_settings')
        .insert({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          gbp_account_id: '106698735661379366674', // PeachHaus account ID
        });

      if (dbError) {
        console.error('Database insert error:', dbError);
        throw dbError;
      }
    }

    console.log('Tokens stored successfully');

    // Determine return URL
    let returnUrl = '/admin?tab=gbp&oauth_success=true';
    if (state) {
      try {
        const stateData = JSON.parse(decodeURIComponent(state));
        if (stateData.returnUrl) {
          returnUrl = stateData.returnUrl + '&oauth_success=true';
        }
      } catch (e) {
        console.log('Could not parse state, using default return URL');
      }
    }

    // Return success page that redirects back to app
    return new Response(
      `<html>
        <head>
          <meta http-equiv="refresh" content="2;url=${returnUrl}">
        </head>
        <body style="font-family: system-ui, sans-serif; padding: 40px; text-align: center;">
          <h1>✅ Google Business Profile Connected!</h1>
          <p>Redirecting back to the app...</p>
          <p><a href="${returnUrl}">Click here if not redirected</a></p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Error in gbp-oauth:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      `<html>
        <body>
          <h1>Error Connecting Google Business Profile</h1>
          <p>${errorMessage}</p>
          <p>You can close this window.</p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});
