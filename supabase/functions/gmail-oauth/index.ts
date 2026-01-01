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
    const userId = url.searchParams.get('state'); // userId passed as state
    const error = url.searchParams.get('error');

    console.log('OAuth callback received', { hasCode: !!code, userId, error });

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

    if (!code || !userId) {
      return new Response(
        `<html>
          <body>
            <h1>Missing Parameters</h1>
            <p>Missing authorization code or user ID</p>
            <p>You can close this window.</p>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 400 }
      );
    }
    
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')?.trim();
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim();
    const REDIRECT_URI = `${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-oauth`;

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
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const { error: dbError } = await supabase
      .from('gmail_oauth_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        `<html>
          <body>
            <h1>Database Error</h1>
            <pre>${JSON.stringify(dbError, null, 2)}</pre>
            <p>You can close this window.</p>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 500 }
      );
    }

    console.log('Tokens stored successfully');

    // Return success page that closes the window
    return new Response(
      `<html>
        <body>
          <h1>Gmail Connected Successfully!</h1>
          <p>You can close this window and return to the app.</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Error in gmail-oauth:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      `<html>
        <body>
          <h1>Error Connecting Gmail</h1>
          <p>${errorMessage}</p>
          <p>You can close this window.</p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});
