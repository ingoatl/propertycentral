import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshGoogleToken } from "../_shared/google-oauth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Proper UTF-8 decoding for base64 email content
const decodeBase64Utf8 = (base64: string): string => {
  try {
    const binary = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    console.error('Error decoding base64:', e);
    return '';
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { daysBack = 3 } = await req.json().catch(() => ({}));
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch target emails from user_gmail_labels table for dynamic team member support
    const { data: gmailLabels, error: labelsError } = await supabase
      .from('user_gmail_labels')
      .select('label_name, email_address')
      .eq('is_active', true);

    // Build target emails list from database, with fallback to hardcoded values
    let targetEmails: string[] = [];
    
    if (gmailLabels && gmailLabels.length > 0) {
      // Use emails from the database
      targetEmails = gmailLabels
        .filter(l => l.email_address)
        .map(l => l.email_address!);
      
      // Also add common email domain variations
      const labels = gmailLabels.map(l => l.label_name.toLowerCase());
      for (const label of labels) {
        targetEmails.push(`${label}@peachhausgroup.com`);
        targetEmails.push(`${label}@peachhg.com`);
      }
    } else {
      // Fallback to hardcoded emails if no database entries
      targetEmails = [
        'ingo@peachhausgroup.com', 
        'anja@peachhausgroup.com',
        'alex@peachhausgroup.com',
        'ingo@peachhg.com',
        'anja@peachhg.com',
        'alex@peachhg.com'
      ];
    }
    
    // Remove duplicates
    targetEmails = [...new Set(targetEmails.filter(Boolean))];

    console.log(`Fetching Gmail inbox for ${targetEmails.join(', ')}, last ${daysBack} days...`);

    // Get ALL OAuth tokens (supporting multiple Gmail accounts)
    const { data: tokenDataList, error: tokenError } = await supabase
      .from('gmail_oauth_tokens')
      .select('*');

    if (tokenError || !tokenDataList || tokenDataList.length === 0) {
      throw new Error('No Gmail connection found. Please authorize Gmail access first.');
    }

    console.log(`Found ${tokenDataList.length} Gmail account(s) connected`);

    // Helper function to refresh token if needed
    const ensureValidToken = async (tokenData: any) => {
      let accessToken = tokenData.access_token;

      // Refresh token if expired
      if (new Date(tokenData.expires_at) <= new Date()) {
        console.log(`Access token expired for ${tokenData.email_address || tokenData.user_id}, refreshing...`);
        const refreshResult = await refreshGoogleToken(tokenData.refresh_token);
        accessToken = refreshResult.accessToken;
        
        await supabase
          .from('gmail_oauth_tokens')
          .update({
            access_token: accessToken,
            expires_at: new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', tokenData.id);
      }
      
      return accessToken;
    };

    // Calculate date filter
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - daysBack);
    const afterDate = Math.floor(daysAgo.getTime() / 1000);

    // Helper function to fetch emails from a single account
    const fetchEmailsFromAccount = async (tokenData: any, accountLabel: string) => {
      const accountEmails: any[] = [];
      
      try {
        const accessToken = await ensureValidToken(tokenData);
        
        // For individual accounts, fetch their own inbox
        // For shared account, fetch emails TO team members
        let query: string;
        
        if (tokenData.email_address && tokenData.label_name) {
          // Individual account - fetch their inbox directly (no TO filter)
          query = `in:inbox after:${afterDate}`;
          console.log(`[${accountLabel}] Fetching inbox emails`);
        } else {
          // Shared account - fetch emails TO team members
          const toQuery = targetEmails.map(e => `to:${e}`).join(' OR ');
          query = `(${toQuery}) after:${afterDate}`;
          console.log(`[${accountLabel}] Fetching with query: ${query}`);
        }

        const messagesResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=200&q=${encodeURIComponent(query)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!messagesResponse.ok) {
          const error = await messagesResponse.text();
          console.error(`[${accountLabel}] Failed to fetch messages:`, error);
          return [];
        }

        const messagesData = await messagesResponse.json();
        const messageIds = messagesData.messages || [];

        console.log(`[${accountLabel}] Found ${messageIds.length} emails`);

        // Fetch full email data for each message
        for (const msg of messageIds.slice(0, 100)) {
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

            // Get email body
            let bodyText = '';
            let bodyHtml = '';
            
            const extractBody = (payload: any): { text: string; html: string } => {
              let text = '';
              let html = '';
              
              if (payload.body?.data) {
                const decoded = decodeBase64Utf8(payload.body.data);
                if (payload.mimeType === 'text/html') {
                  html = decoded;
                } else {
                  text = decoded;
                }
              }
              
              if (payload.parts) {
                for (const part of payload.parts) {
                  if (part.mimeType === 'text/plain' && part.body?.data) {
                    text = decodeBase64Utf8(part.body.data);
                  }
                  if (part.mimeType === 'text/html' && part.body?.data) {
                    html = decodeBase64Utf8(part.body.data);
                  }
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

            // CRITICAL: If plain text is empty but HTML exists, extract text from HTML
            // Many emails are HTML-only and without this, AI receives empty body
            if (!bodyText && bodyHtml) {
              console.log(`[${accountLabel}] Extracting text from HTML for message ${msg.id}`);
              bodyText = bodyHtml
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style blocks
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script blocks
                .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\s+/g, ' ') // Collapse multiple spaces
                .trim();
            }

            // Determine targetInbox - use account label for individual accounts
            const toLower = to.toLowerCase();
            let targetInbox = tokenData.label_name || 'unknown';
            
            // For shared account, check TO field
            if (!tokenData.label_name && gmailLabels && gmailLabels.length > 0) {
              for (const label of gmailLabels) {
                const labelLower = label.label_name.toLowerCase();
                if (toLower.includes(`${labelLower}@`) || 
                    (label.email_address && toLower.includes(label.email_address.toLowerCase()))) {
                  targetInbox = labelLower;
                  break;
                }
              }
            }

            accountEmails.push({
              id: `${tokenData.id}_${msg.id}`, // Unique ID combining account + message
              threadId: emailData.threadId,
              subject,
              from: senderEmail,
              fromName: senderName,
              to,
              targetInbox,
              date: new Date(dateStr).toISOString(),
              body: bodyText.substring(0, 3000),
              bodyHtml: bodyHtml,
              snippet: emailData.snippet,
              labelIds: emailData.labelIds || [],
              accountSource: accountLabel,
            });
          } catch (err) {
            console.error(`[${accountLabel}] Error fetching email ${msg.id}:`, err);
          }
        }
      } catch (err) {
        console.error(`[${accountLabel}] Error:`, err);
      }
      
      return accountEmails;
    };

    // Fetch emails from ALL connected accounts in parallel
    const allEmailPromises = tokenDataList.map((tokenData, index) => {
      const label = tokenData.email_address || tokenData.label_name || `Account ${index + 1}`;
      return fetchEmailsFromAccount(tokenData, label);
    });

    const emailArrays = await Promise.all(allEmailPromises);
    const emails = emailArrays.flat();

    // Sort by date descending
    emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log(`Returning ${emails.length} emails`);

    // Auto-trigger insight extraction for new emails (background task)
    // Only process emails that don't already have insights
    if (emails.length > 0) {
      try {
        const emailIds = emails.map(e => e.id);
        
        // Check which emails already have insights
        const { data: existingInsights } = await supabase
          .from('email_insights')
          .select('gmail_message_id')
          .in('gmail_message_id', emailIds);
        
        const existingIds = new Set((existingInsights || []).map(i => i.gmail_message_id));
        const newEmails = emails.filter(e => !existingIds.has(e.id));
        
        if (newEmails.length > 0) {
          console.log(`[Auto-Insights] Found ${newEmails.length} new emails without insights`);
          
          // Process up to 10 new emails for insights (to avoid timeout)
          for (const email of newEmails.slice(0, 10)) {
            try {
              await supabase.functions.invoke('extract-insights', {
                body: {
                  email: {
                    subject: email.subject,
                    from: email.from,
                    fromName: email.fromName,
                    date: email.date,
                    body: email.body,
                    gmail_message_id: email.id,
                  }
                }
              });
              console.log(`[Auto-Insights] Extracted insights for: ${email.subject}`);
            } catch (insightErr) {
              console.error(`[Auto-Insights] Failed for email ${email.id}:`, insightErr);
            }
          }
        }
      } catch (insightError) {
        console.error('[Auto-Insights] Error checking/extracting insights:', insightError);
        // Don't fail the main request if insight extraction fails
      }
    }

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
