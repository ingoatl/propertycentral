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

    // Fetch Gmail labels from account to match with user_gmail_labels
    const fetchGmailLabels = async (accessToken: string): Promise<Map<string, string>> => {
      const labelMap = new Map<string, string>();
      try {
        const labelsResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/labels`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (labelsResponse.ok) {
          const labelsData = await labelsResponse.json();
          for (const label of labelsData.labels || []) {
            // Store label name -> label id mapping (lowercase for matching)
            labelMap.set(label.name.toLowerCase(), label.id);
          }
        }
      } catch (e) {
        console.error('Error fetching Gmail labels:', e);
      }
      return labelMap;
    };

    // Helper function to fetch emails from a single account
    const fetchEmailsFromAccount = async (tokenData: any, accountLabel: string) => {
      const accountEmails: any[] = [];
      
      try {
        const accessToken = await ensureValidToken(tokenData);
        
        // Get Gmail labels from the account
        const gmailLabelMap = await fetchGmailLabels(accessToken);
        console.log(`[${accountLabel}] Found ${gmailLabelMap.size} Gmail labels`);
        
        // For individual accounts, fetch their own inbox
        // For shared account, fetch emails by LABELS (not just TO addresses)
        let queries: { query: string; labelTarget: string | null }[] = [];
        
        if (tokenData.email_address && tokenData.label_name) {
          // Individual account - fetch their inbox directly (no TO filter)
          queries.push({ query: `in:inbox after:${afterDate}`, labelTarget: tokenData.label_name.toLowerCase() });
          console.log(`[${accountLabel}] Fetching inbox emails`);
        } else {
          // Shared account - fetch emails by Gmail labels for each team member
          // This is the key fix: use label:X instead of to:X to capture all assigned emails
          for (const gmailLabel of gmailLabels || []) {
            const labelName = gmailLabel.label_name.toLowerCase();
            // Check if this label exists in the Gmail account
            if (gmailLabelMap.has(labelName)) {
              queries.push({ 
                query: `label:${labelName} after:${afterDate}`, 
                labelTarget: labelName 
              });
              console.log(`[${accountLabel}] Adding label query: label:${labelName}`);
            }
          }
          
          // Fallback: also fetch by TO addresses for emails without labels
          const toQuery = targetEmails.map(e => `to:${e}`).join(' OR ');
          queries.push({ query: `(${toQuery}) after:${afterDate}`, labelTarget: null });
          console.log(`[${accountLabel}] Adding TO query: ${toQuery}`);
        }

        // Fetch emails for each query and deduplicate by message ID
        // CRITICAL: Track targetInbox per message to prefer labeled matches over TO-based matches
        const seenMessageIds = new Set<string>();
        const messageTargetInbox = new Map<string, string>(); // message_id -> best targetInbox
        const messageData = new Map<string, any>(); // message_id -> full email data
        
        // Sort queries to process label-based queries FIRST (they have priority)
        const sortedQueries = [...queries].sort((a, b) => {
          // Label queries first (labelTarget is set), then TO queries (labelTarget is null)
          if (a.labelTarget && !b.labelTarget) return -1;
          if (!a.labelTarget && b.labelTarget) return 1;
          return 0;
        });
        
        console.log(`[${accountLabel}] Processing ${sortedQueries.length} queries in order: ${sortedQueries.map(q => q.labelTarget || 'TO-fallback').join(', ')}`);
        
        for (const { query, labelTarget } of sortedQueries) {
          const messagesResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=${encodeURIComponent(query)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!messagesResponse.ok) {
            const error = await messagesResponse.text();
            console.error(`[${accountLabel}] Failed to fetch messages for query "${query}":`, error);
            continue;
          }

          const messagesData = await messagesResponse.json();
          const messageIds = messagesData.messages || [];
          console.log(`[${accountLabel}] Query "${labelTarget || 'TO-fallback'}" found ${messageIds.length} emails`);

          // Fetch full email data for each message
          for (const msg of messageIds.slice(0, 50)) {
            const existingTarget = messageTargetInbox.get(msg.id);
            
            // If we've already seen this message with a label-based target, skip it
            // Only upgrade from 'unknown' or null to a labeled target
            if (existingTarget && existingTarget !== 'unknown' && labelTarget) {
              // Already has a good target, skip
              continue;
            }
            
            // If this is a TO-fallback query and we already have this message, skip
            if (!labelTarget && seenMessageIds.has(msg.id)) {
              continue;
            }
            
            // If we have labelTarget and the message was seen but has 'unknown', we'll upgrade it
            const shouldUpgrade = labelTarget && existingTarget === 'unknown';
            
            if (shouldUpgrade) {
              // Upgrade the targetInbox for this message
              messageTargetInbox.set(msg.id, labelTarget);
              console.log(`[${accountLabel}] Upgrading message ${msg.id} targetInbox from 'unknown' to '${labelTarget}'`);
              continue;
            }
            
            seenMessageIds.add(msg.id);

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
              if (!bodyText && bodyHtml) {
                bodyText = bodyHtml
                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/\s+/g, ' ')
                  .trim();
              }

              // CRITICAL FIX: Determine targetInbox - PRIORITIZE the label we queried with
              let targetInbox = labelTarget || 'unknown';
              
              // If we don't have a label target from the query, check email's actual Gmail labels
              if (!labelTarget && gmailLabels && gmailLabels.length > 0) {
                // Check the email's actual labels to find matching user label
                const emailLabels = emailData.labelIds || [];
                for (const label of gmailLabels) {
                  const userLabelName = label.label_name.toLowerCase();
                  const gmailLabelId = gmailLabelMap.get(userLabelName);
                  if (gmailLabelId && emailLabels.includes(gmailLabelId)) {
                    targetInbox = userLabelName;
                    console.log(`[${accountLabel}] Email ${msg.id} matched label '${userLabelName}' via labelIds`);
                    break;
                  }
                }
                
                // Fallback to TO field matching if no label match
                if (targetInbox === 'unknown') {
                  const toLower = to.toLowerCase();
                  for (const label of gmailLabels) {
                    const labelLower = label.label_name.toLowerCase();
                    if (toLower.includes(`${labelLower}@`) || 
                        (label.email_address && toLower.includes(label.email_address.toLowerCase()))) {
                      targetInbox = labelLower;
                      break;
                    }
                  }
                }
              } else if (targetInbox !== 'unknown') {
                console.log(`[${accountLabel}] Email ${msg.id} assigned to '${targetInbox}' via label query`);
              }

              // Store the targetInbox and email data
              messageTargetInbox.set(msg.id, targetInbox);
              messageData.set(msg.id, {
                id: `${tokenData.id}_${msg.id}`,
                threadId: emailData.threadId,
                subject,
                from: senderEmail,
                fromName: senderName,
                to,
                targetInbox, // Will be updated later if needed
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
        }
        
        // Build final email list with best targetInbox assignments
        for (const [msgId, emailObj] of messageData.entries()) {
          const bestTarget = messageTargetInbox.get(msgId) || 'unknown';
          emailObj.targetInbox = bestTarget;
          accountEmails.push(emailObj);
        }
        
        // Log targetInbox distribution for debugging
        const inboxCounts = new Map<string, number>();
        for (const email of accountEmails) {
          const count = inboxCounts.get(email.targetInbox) || 0;
          inboxCounts.set(email.targetInbox, count + 1);
        }
        console.log(`[${accountLabel}] TargetInbox distribution:`, Object.fromEntries(inboxCounts));
        
        console.log(`[${accountLabel}] Total unique emails fetched: ${accountEmails.length}`);
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
