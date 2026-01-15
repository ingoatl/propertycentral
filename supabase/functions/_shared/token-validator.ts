// Centralized token validation with aggressive pre-flight refresh
// Ensures all Gmail functions always have a valid token

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshGoogleToken } from "./google-oauth.ts";

export interface ValidatedToken {
  accessToken: string;
  tokenId: string;
  wasRefreshed: boolean;
}

// Buffer time before expiry to trigger refresh (5 minutes)
const PRE_FLIGHT_BUFFER_MS = 5 * 60 * 1000;

/**
 * Ensures a valid Gmail token is available, refreshing proactively if needed.
 * This is the single entry point for token validation across all Gmail functions.
 * 
 * @param supabase - Supabase client instance
 * @returns ValidatedToken with access token and metadata
 * @throws Error if no token exists or refresh fails
 */
export async function ensureValidToken(supabase: ReturnType<typeof createClient>): Promise<ValidatedToken> {
  // Get the most recent token
  const { data: token, error: tokenError } = await supabase
    .from('gmail_oauth_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (tokenError || !token) {
    throw new Error('No Gmail token configured. Please connect Gmail in Settings → Integrations.');
  }

  const expiresAt = new Date(token.expires_at);
  const now = new Date();
  const timeUntilExpiry = expiresAt.getTime() - now.getTime();

  // Check if token needs refresh (expired or within buffer)
  if (timeUntilExpiry < PRE_FLIGHT_BUFFER_MS) {
    console.log(`[Token Validator] Token expires in ${Math.round(timeUntilExpiry / 1000)}s, refreshing...`);
    
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
        console.error('[Token Validator] Failed to save refreshed token:', updateError);
        throw new Error('Failed to save refreshed token');
      }

      // Log successful refresh
      await logTokenRefresh(supabase, token.id, 'pre-flight', true, token.expires_at, newExpiresAt);

      console.log('[Token Validator] Token refreshed successfully, new expiry:', newExpiresAt);
      
      return {
        accessToken: result.accessToken,
        tokenId: token.id,
        wasRefreshed: true,
      };
    } catch (refreshError: any) {
      // Log failed refresh
      await logTokenRefresh(supabase, token.id, 'pre-flight', false, token.expires_at, null, refreshError.message);
      
      throw refreshError;
    }
  }

  console.log(`[Token Validator] Token valid for ${Math.round(timeUntilExpiry / 60000)} more minutes`);
  
  return {
    accessToken: token.access_token,
    tokenId: token.id,
    wasRefreshed: false,
  };
}

/**
 * Log token refresh attempts for monitoring and debugging
 */
async function logTokenRefresh(
  supabase: ReturnType<typeof createClient>,
  tokenId: string,
  refreshType: 'pre-flight' | 'proactive' | 'on-demand' | 'cron',
  success: boolean,
  oldExpiresAt: string,
  newExpiresAt: string | null,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase
      .from('gmail_token_refresh_log')
      .insert({
        token_id: tokenId,
        refresh_type: refreshType,
        success,
        old_expires_at: oldExpiresAt,
        new_expires_at: newExpiresAt,
        error_message: errorMessage,
      });
  } catch (e) {
    // Don't fail the main operation if logging fails
    console.error('[Token Validator] Failed to log refresh:', e);
  }
}

/**
 * Get token status without refreshing - for monitoring purposes
 */
export async function getTokenStatus(supabase: ReturnType<typeof createClient>): Promise<{
  exists: boolean;
  expiresAt: Date | null;
  minutesUntilExpiry: number | null;
  needsRefresh: boolean;
}> {
  const { data: token } = await supabase
    .from('gmail_oauth_tokens')
    .select('expires_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!token) {
    return {
      exists: false,
      expiresAt: null,
      minutesUntilExpiry: null,
      needsRefresh: true,
    };
  }

  const expiresAt = new Date(token.expires_at);
  const now = new Date();
  const minutesUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / 60000);

  return {
    exists: true,
    expiresAt,
    minutesUntilExpiry,
    needsRefresh: minutesUntilExpiry < 15, // 15-minute threshold
  };
}
