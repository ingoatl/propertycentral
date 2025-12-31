import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

      console.log(`Token for user ${token.user_id} expires in ${daysUntilExpiry.toFixed(1)} days`);

      // Check if token is expired or expiring soon (within 3 days)
      if (hoursUntilExpiry <= 72) {
        const isExpired = hoursUntilExpiry <= 0;
        const alertType = isExpired ? 'EXPIRED' : 'EXPIRING_SOON';
        
        // Try to refresh the token if not expired
        if (!isExpired) {
          try {
            const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
            const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

            const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID!,
                client_secret: GOOGLE_CLIENT_SECRET!,
                refresh_token: token.refresh_token,
                grant_type: 'refresh_token',
              }),
            });

            if (refreshResponse.ok) {
              const newTokens = await refreshResponse.json();
              const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
              
              await supabase
                .from('gmail_oauth_tokens')
                .update({
                  access_token: newTokens.access_token,
                  expires_at: newExpiresAt.toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', token.user_id);

              console.log(`Token refreshed successfully for user ${token.user_id}`);
              results.push({ userId: token.user_id, status: 'refreshed' });
              continue;
            } else {
              const errorText = await refreshResponse.text();
              console.error('Token refresh failed:', errorText);
            }
          } catch (refreshError) {
            console.error('Error refreshing token:', refreshError);
          }
        }

        // Send alert email
        const subject = isExpired 
          ? '🚨 Gmail Token Expired - Action Required'
          : '⚠️ Gmail Token Expiring Soon';
        
        const message = isExpired
          ? `Your Gmail connection has expired. Please reconnect Gmail in the app to continue scanning emails.`
          : `Your Gmail token will expire in ${Math.ceil(hoursUntilExpiry)} hours. The system will attempt to auto-refresh, but if this fails, you may need to reconnect Gmail.`;

        try {
          await resend.emails.send({
            from: 'Peachhaus <notifications@peachhausgroup.com>',
            to: ['ingo@peachhausgroup.com'],
            subject: subject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: ${isExpired ? '#dc2626' : '#f59e0b'};">${subject}</h2>
                <p>${message}</p>
                <p style="margin-top: 20px;">
                  <strong>Token Details:</strong><br>
                  User ID: ${token.user_id}<br>
                  Expires: ${expiresAt.toLocaleString()}<br>
                  Status: ${alertType}
                </p>
                <p style="margin-top: 20px; color: #666;">
                  To fix this, open the app and reconnect your Gmail account.
                </p>
              </div>
            `,
          });
          
          console.log(`Alert email sent for token ${alertType}`);
          results.push({ userId: token.user_id, status: alertType, emailSent: true });
        } catch (emailError) {
          console.error('Failed to send alert email:', emailError);
          results.push({ userId: token.user_id, status: alertType, emailSent: false, error: String(emailError) });
        }
      } else {
        results.push({ userId: token.user_id, status: 'valid', daysRemaining: daysUntilExpiry.toFixed(1) });
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
