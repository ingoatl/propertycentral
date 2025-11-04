import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshAccessToken(refreshToken: string) {
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

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
    throw new Error('Failed to refresh access token');
  }

  const tokens = await response.json();
  return tokens.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { forceRescan } = req.method === 'POST' ? await req.json() : { forceRescan: false };
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // PHASE 4: If force rescan requested, clear email_insights to reprocess everything
    if (forceRescan) {
      console.log('Force rescan requested - clearing existing email insights...');
      const { error: clearError } = await supabase
        .from('email_insights')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (clearError) {
        console.error('Error clearing email insights:', clearError);
      } else {
        console.log('Email insights cleared successfully');
      }
    }

    console.log('Starting Gmail scan...');

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
      accessToken = await refreshAccessToken(tokenData.refresh_token);
      
      await supabase
        .from('gmail_oauth_tokens')
        .update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', tokenData.user_id);
    }

    // Fetch emails from last 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const afterDate = Math.floor(sixtyDaysAgo.getTime() / 1000);

    console.log(`Fetching emails after ${sixtyDaysAgo.toISOString()}`);

    const messagesResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=500&q=after:${afterDate}`,
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
    const messages = messagesData.messages || [];

    console.log(`Found ${messages.length} emails to process`);

    // Fetch properties and owners for matching
    const { data: properties } = await supabase.from('properties').select('*');
    const { data: owners } = await supabase.from('property_owners').select('*');

    let emailsProcessed = 0;
    let insightsGenerated = 0;

    // Process emails in batches
    for (const message of messages) {
      try {
        const messageResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!messageResponse.ok) continue;

        const emailData = await messageResponse.json();
        emailsProcessed++;

        const headers = emailData.payload.headers;
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
        const from = headers.find((h: any) => h.name === 'From')?.value || '';
        const dateStr = headers.find((h: any) => h.name === 'Date')?.value || '';
        const emailDate = new Date(dateStr);

        // Get email body (text and HTML)
        let body = '';
        let rawHtml = '';
        
        if (emailData.payload.body?.data) {
          body = atob(emailData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (emailData.payload.parts) {
          const textPart = emailData.payload.parts.find((p: any) => p.mimeType === 'text/plain');
          const htmlPart = emailData.payload.parts.find((p: any) => p.mimeType === 'text/html');
          
          if (textPart?.body?.data) {
            body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
          
          if (htmlPart?.body?.data) {
            rawHtml = atob(htmlPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
        }

        // Extract sender email
        const senderEmail = from.match(/<(.+?)>/)?.[1] || from;

        // Call extract-insights function
        const { data: insight } = await supabase.functions.invoke('extract-insights', {
          body: {
            subject,
            body: body.substring(0, 2000), // Limit body size
            rawHtml: rawHtml ? rawHtml.substring(0, 50000) : null, // Include HTML for receipt
            senderEmail,
            emailDate: emailDate.toISOString(),
            gmailMessageId: message.id,
            properties,
            owners,
          },
        });

        if (insight?.shouldSave) {
          insightsGenerated++;
        }

        console.log(`Processed email: ${subject.substring(0, 50)}...`);
      } catch (emailError) {
        console.error('Error processing email:', emailError);
      }
    }

    // Log scan results
    await supabase.from('email_scan_log').insert({
      emails_processed: emailsProcessed,
      insights_generated: insightsGenerated,
      scan_status: 'completed',
    });

    console.log(`Scan completed: ${emailsProcessed} emails processed, ${insightsGenerated} insights generated`);

    return new Response(
      JSON.stringify({
        success: true,
        emailsProcessed,
        insightsGenerated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scan-gmail:', error);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await supabase.from('email_scan_log').insert({
      scan_status: 'failed',
      error_message: errorMessage,
    });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
