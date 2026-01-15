// Shared Google OAuth utilities for all Gmail-related edge functions
// This ensures consistent credential handling and error messages across all functions

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
}

export interface TokenRefreshResult {
  accessToken: string;
  expiresIn: number;
}

/**
 * Get Google OAuth credentials with proper trimming and validation.
 * This is the single source of truth for credential handling.
 */
export function getGoogleCredentials(): GoogleCredentials {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase secrets."
    );
  }

  // Validate format - client IDs should end with .apps.googleusercontent.com
  if (!clientId.includes(".apps.googleusercontent.com")) {
    console.warn(
      "GOOGLE_CLIENT_ID may be invalid - expected format: xxx.apps.googleusercontent.com"
    );
  }

  return { clientId, clientSecret };
}

/**
 * Refresh a Google OAuth access token using a refresh token.
 * Provides detailed error messages for common OAuth issues.
 */
export async function refreshGoogleToken(
  refreshToken: string
): Promise<TokenRefreshResult> {
  const { clientId, clientSecret } = getGoogleCredentials();

  console.log("Refreshing Google OAuth token...");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();

  if (data.error) {
    // Provide specific, actionable error messages
    switch (data.error) {
      case "invalid_grant":
        throw new Error(
          "Gmail authorization expired or revoked. Please reconnect Gmail in Settings → Integrations. " +
            "If the Google Cloud OAuth app is in Testing mode, tokens expire after 7 days."
        );

      case "invalid_client":
        throw new Error(
          "Gmail OAuth client is invalid. The OAuth client may have been deleted or the credentials are incorrect. " +
            "Please verify the GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase secrets match your Google Cloud Console."
        );

      case "unauthorized_client":
        throw new Error(
          "Gmail OAuth client is not authorized. Please check the Google Cloud Console settings and ensure the client is properly configured."
        );

      case "access_denied":
        throw new Error(
          "Access to Gmail was denied. The user may have revoked permissions. Please reconnect Gmail."
        );

      default:
        throw new Error(
          `Token refresh failed: ${data.error_description || data.error}. ` +
            "Please try reconnecting Gmail in Settings → Integrations."
        );
    }
  }

  if (!data.access_token) {
    throw new Error(
      "Token refresh returned no access token. Please reconnect Gmail."
    );
  }

  console.log("Google OAuth token refreshed successfully");

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * Validate that OAuth is properly configured.
 * Returns an object with validation status and any issues found.
 */
export function validateOAuthSetup(): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Always trim whitespace automatically - never treat it as an error
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim();

  if (!clientId) {
    issues.push("GOOGLE_CLIENT_ID is not set");
  } else if (!clientId.includes(".apps.googleusercontent.com")) {
    issues.push(
      "GOOGLE_CLIENT_ID format appears invalid (expected: xxx.apps.googleusercontent.com)"
    );
  }

  if (!clientSecret) {
    issues.push("GOOGLE_CLIENT_SECRET is not set");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
