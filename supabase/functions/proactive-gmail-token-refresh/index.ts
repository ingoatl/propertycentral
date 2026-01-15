// Proactive Gmail Token Refresh
// Runs every 30 minutes via cron to ensure tokens never expire during user operations
// This is the "always-fresh" strategy that eliminates sync failures

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshGoogleToken, validateOAuthSetup } from "../_shared/google-oauth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Refresh threshold: 15 minutes before expiry
const REFRESH_THRESHOLD_MINUTES = 15;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[Proactive Refresh] Starting proactive token refresh check...');

  try {
    // Validate OAuth setup first
    const oauthValidation = validateOAuthSetup();
    if (!oauthValidation.valid) {
      console.error('[Proactive Refresh] OAuth not configured:', oauthValidation.issues);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'OAuth not configured',
          issues: oauthValidation.issues,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all tokens (in case of multiple users/accounts)
    const { data: tokens, error: tokensError } = await supabase
      .from('gmail_oauth_tokens')
      .select('*')
      .order('created_at', { ascending: false });

    if (tokensError) {
      throw new Error(`Failed to fetch tokens: ${tokensError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      console.log('[Proactive Refresh] No Gmail tokens found');
      return new Response(
        JSON.stringify({ success: true, message: 'No tokens to refresh', refreshed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{
      tokenId: string;
      userId: string;
      action: 'refreshed' | 'skipped' | 'failed';
      minutesUntilExpiry: number;
      error?: string;
    }> = [];

    for (const token of tokens) {
      const expiresAt = new Date(token.expires_at);
      const now = new Date();
      const minutesUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / 60000);

      console.log(`[Proactive Refresh] Token ${token.id}: expires in ${minutesUntilExpiry} minutes`);

      // Check if refresh is needed
      if (minutesUntilExpiry <= REFRESH_THRESHOLD_MINUTES) {
        console.log(`[Proactive Refresh] Token needs refresh (threshold: ${REFRESH_THRESHOLD_MINUTES}min)`);
        
        try {
          const result = await refreshGoogleToken(token.refresh_token);
          
          const newExpiresAt = new Date(Date.now() + result.expiresIn * 1000).toISOString();
          
          // Update token in database
          const { error: updateError } = await supabase
            .from('gmail_oauth_tokens')
            .update({
              access_token: result.accessToken,
              expires_at: newExpiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq('id', token.id);

          if (updateError) {
            throw new Error(`Failed to save token: ${updateError.message}`);
          }

          // Log successful refresh
          await supabase.from('gmail_token_refresh_log').insert({
            token_id: token.id,
            refresh_type: 'proactive',
            success: true,
            old_expires_at: token.expires_at,
            new_expires_at: newExpiresAt,
          });

          results.push({
            tokenId: token.id,
            userId: token.user_id,
            action: 'refreshed',
            minutesUntilExpiry,
          });

          console.log(`[Proactive Refresh] Token ${token.id} refreshed, new expiry: ${newExpiresAt}`);
        } catch (refreshError: any) {
          console.error(`[Proactive Refresh] Failed to refresh token ${token.id}:`, refreshError);

          // Log failed refresh
          await supabase.from('gmail_token_refresh_log').insert({
            token_id: token.id,
            refresh_type: 'proactive',
            success: false,
            old_expires_at: token.expires_at,
            error_message: refreshError.message,
          });

          results.push({
            tokenId: token.id,
            userId: token.user_id,
            action: 'failed',
            minutesUntilExpiry,
            error: refreshError.message,
          });

          // Check for critical errors that need alerts
          if (refreshError.message.includes('expired') || 
              refreshError.message.includes('revoked') ||
              refreshError.message.includes('invalid_grant')) {
            
            // Log to email_scan_log for visibility
            await supabase.from('email_scan_log').insert({
              scan_status: 'token_expired',
              error_message: `Gmail token expired or revoked: ${refreshError.message}`,
              total_emails: 0,
              emails_processed: 0,
            });
          }
        }
      } else {
        results.push({
          tokenId: token.id,
          userId: token.user_id,
          action: 'skipped',
          minutesUntilExpiry,
        });
        console.log(`[Proactive Refresh] Token ${token.id} still valid, skipping`);
      }
    }

    const refreshedCount = results.filter(r => r.action === 'refreshed').length;
    const failedCount = results.filter(r => r.action === 'failed').length;
    const duration = Date.now() - startTime;

    console.log(`[Proactive Refresh] Completed in ${duration}ms: ${refreshedCount} refreshed, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        refreshed: refreshedCount,
        failed: failedCount,
        skipped: results.filter(r => r.action === 'skipped').length,
        duration_ms: duration,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Proactive Refresh] Unexpected error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
