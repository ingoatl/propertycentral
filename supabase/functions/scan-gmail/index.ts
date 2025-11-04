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

// Background task to process emails
async function processEmailsInBackground(
  accessToken: string,
  messages: any[],
  properties: any[],
  owners: any[],
  forceRescan: boolean,
  supabase: any,
  scanLogId: string
) {
  let emailsProcessed = 0;
  let insightsGenerated = 0;

  try {
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(messages.length/BATCH_SIZE)} (${batch.length} emails)`);

      for (const message of batch) {
        try {
          // Check if this email was already processed
          const { data: existingInsight } = await supabase
            .from('email_insights')
            .select('id')
            .eq('gmail_message_id', message.id)
            .single();

          if (existingInsight) {
            emailsProcessed++;
            console.log(`Skipping already processed email: ${message.id}`);
            continue;
          }

          const messageResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!messageResponse.ok) {
            emailsProcessed++;
            continue;
          }

          const emailData = await messageResponse.json();
          emailsProcessed++;

          const headers = emailData.payload.headers;
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
          const from = headers.find((h: any) => h.name === 'From')?.value || '';
          const dateStr = headers.find((h: any) => h.name === 'Date')?.value || '';
          const emailDate = new Date(dateStr);

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

          const senderEmail = from.match(/<(.+?)>/)?.[1] || from;

          const { data: insight } = await supabase.functions.invoke('extract-insights', {
            body: {
              subject,
              body: body.substring(0, 2000),
              rawHtml: rawHtml ? rawHtml.substring(0, 50000) : null,
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

          // Update progress every 10 emails
          if (emailsProcessed % 10 === 0) {
            await supabase
              .from('email_scan_log')
              .update({
                emails_processed: emailsProcessed,
                insights_generated: insightsGenerated,
              })
              .eq('id', scanLogId);
          }

          console.log(`Processed ${emailsProcessed}/${messages.length}: ${subject.substring(0, 50)}...`);
        } catch (emailError) {
          console.error('Error processing email:', emailError);
        }
      }
    }

    // Final update
    await supabase
      .from('email_scan_log')
      .update({
        emails_processed: emailsProcessed,
        insights_generated: insightsGenerated,
        scan_status: 'completed',
      })
      .eq('id', scanLogId);

    console.log(`Scan completed: ${emailsProcessed} emails, ${insightsGenerated} insights`);
  } catch (error) {
    console.error('Background processing error:', error);
    await supabase
      .from('email_scan_log')
      .update({
        emails_processed: emailsProcessed,
        insights_generated: insightsGenerated,
        scan_status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', scanLogId);
  }
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

    // Fetch emails from last 35 days
    const thirtyFiveDaysAgo = new Date();
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);
    const afterDate = Math.floor(thirtyFiveDaysAgo.getTime() / 1000);

    console.log(`Fetching emails after ${thirtyFiveDaysAgo.toISOString()}`);

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

    // Create initial scan log entry
    const { data: scanLog, error: logError } = await supabase
      .from('email_scan_log')
      .insert({
        emails_processed: 0,
        insights_generated: 0,
        scan_status: 'in_progress',
        total_emails: messages.length,
      })
      .select()
      .single();

    if (logError || !scanLog) {
      throw new Error('Failed to create scan log entry');
    }

    // Start background processing
    const backgroundTask = processEmailsInBackground(
      accessToken,
      messages,
      properties || [],
      owners || [],
      forceRescan,
      supabase,
      scanLog.id
    );

    // Use waitUntil to process in background
    // @ts-ignore
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundTask);
    } else {
      // Fallback: start processing but don't wait
      backgroundTask.catch(err => console.error('Background task error:', err));
    }

    console.log(`Scan started with ${messages.length} emails. Processing in background...`);
    
    return new Response(
      JSON.stringify({
        success: true,
        scanLogId: scanLog.id,
        totalEmails: messages.length,
        message: 'Scan started in background',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scan-gmail:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
