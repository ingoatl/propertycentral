import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshGoogleToken } from "../_shared/google-oauth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId } = await req.json();
    
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get OAuth tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('gmail_oauth_tokens')
      .select('*')
      .single();

    if (tokenError || !tokenData) {
      throw new Error('No Gmail connection found');
    }

    let accessToken = tokenData.access_token;

    // Refresh token if expired
    if (new Date(tokenData.expires_at) <= new Date()) {
      const refreshResult = await refreshGoogleToken(tokenData.refresh_token);
      accessToken = refreshResult.accessToken;
      
      await supabase
        .from('gmail_oauth_tokens')
        .update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', tokenData.user_id);
    }

    // Remove UNREAD label from the message
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          removeLabelIds: ['UNREAD']
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to mark message as read:', error);
      throw new Error('Failed to mark email as read');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in mark-gmail-read:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
