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
    const { daysBack = 3, targetEmail = 'ingo@peachhausgroup.com' } = await req.json().catch(() => ({}));
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`Fetching Gmail inbox for ${targetEmail}, last ${daysBack} days...`);

    // Get OAuth tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('gmail_oauth_tokens')
      .select('*')
      .single();

    if (tokenError || !tokenData) {
      throw new Error('No Gmail connection found. Please authorize Gmail access first.');
    }

    let accessToken = tokenData.access_token;

    // Refresh token if expired
    if (new Date(tokenData.expires_at) <= new Date()) {
      console.log('Access token expired, refreshing...');
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

    // Calculate date filter
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - daysBack);
    const afterDate = Math.floor(daysAgo.getTime() / 1000);

    // Build search query - fetch emails TO the target email
    const query = `to:${targetEmail} after:${afterDate}`;

    console.log(`Fetching emails with query: ${query}`);

    const messagesResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(query)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!messagesResponse.ok) {
      const error = await messagesResponse.text();
      console.error('Failed to fetch messages:', error);
      throw new Error('Failed to fetch emails from Gmail');
    }

    const messagesData = await messagesResponse.json();
    const messageIds = messagesData.messages || [];

    console.log(`Found ${messageIds.length} emails`);

    // Fetch full email data for each message
    const emails = [];
    for (const msg of messageIds.slice(0, 50)) {
      try {
        const messageResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!messageResponse.ok) continue;

        const emailData = await messageResponse.json();
        const headers = emailData.payload.headers;
        
        const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No subject)';
        const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
        const to = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value || '';
        const dateStr = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';

        // Extract sender name and email
        const fromMatch = from.match(/^(.+?)\s*<(.+?)>$/) || [null, from, from];
        const senderName = fromMatch[1]?.replace(/"/g, '').trim() || from;
        const senderEmail = fromMatch[2]?.trim() || from;

        // Get email body - prefer HTML for proper display
        let bodyText = '';
        let bodyHtml = '';
        
        const extractBody = (payload: any): { text: string; html: string } => {
          let text = '';
          let html = '';
          
          if (payload.body?.data) {
            const decoded = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            if (payload.mimeType === 'text/html') {
              html = decoded;
            } else {
              text = decoded;
            }
          }
          
          if (payload.parts) {
            for (const part of payload.parts) {
              if (part.mimeType === 'text/plain' && part.body?.data) {
                text = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
              }
              if (part.mimeType === 'text/html' && part.body?.data) {
                html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
              }
              // Handle multipart/alternative
              if (part.parts) {
                const nested = extractBody(part);
                if (nested.text) text = nested.text;
                if (nested.html) html = nested.html;
              }
            }
          }
          
          return { text, html };
        };
        
        const extracted = extractBody(emailData.payload);
        bodyText = extracted.text;
        bodyHtml = extracted.html;

        emails.push({
          id: msg.id,
          threadId: emailData.threadId,
          subject,
          from: senderEmail,
          fromName: senderName,
          to,
          date: new Date(dateStr).toISOString(),
          body: bodyText.substring(0, 3000),
          bodyHtml: bodyHtml, // Full HTML for display
          snippet: emailData.snippet,
          labelIds: emailData.labelIds || [],
        });
      } catch (err) {
        console.error(`Error fetching email ${msg.id}:`, err);
      }
    }

    // Sort by date descending
    emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log(`Returning ${emails.length} emails`);

    return new Response(
      JSON.stringify({ success: true, emails }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-gmail-inbox:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
