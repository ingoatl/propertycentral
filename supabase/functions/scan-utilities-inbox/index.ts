import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

async function refreshAccessToken(refreshToken: string): Promise<string> {
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

  const data = await response.json();
  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

// Utility providers to look for in emails
const UTILITY_PROVIDERS = [
  // Electric
  { domain: 'georgiapower.com', type: 'electric', name: 'Georgia Power' },
  { domain: 'duke-energy.com', type: 'electric', name: 'Duke Energy' },
  { domain: 'fpl.com', type: 'electric', name: 'Florida Power & Light' },
  { domain: 'sawnee.com', type: 'electric', name: 'Sawnee EMC' },
  { domain: 'jacksonemc.com', type: 'electric', name: 'Jackson EMC' },
  { domain: 'cobbelectric.com', type: 'electric', name: 'Cobb EMC' },
  { domain: 'cobb-emc.com', type: 'electric', name: 'Cobb EMC' },
  // Gas
  { domain: 'gassouth.com', type: 'gas', name: 'Gas South' },
  { domain: 'scanaenergy.com', type: 'gas', name: 'SCANA Energy' },
  { domain: 'southerncompanygas.com', type: 'gas', name: 'Southern Company Gas' },
  { domain: 'atlantagaslight.com', type: 'gas', name: 'Atlanta Gas Light' },
  { domain: 'nicor.com', type: 'gas', name: 'Nicor Gas' },
  { domain: 'speedpay.com', type: 'gas', name: 'Georgia Natural Gas' },
  { domain: 'infinite-energy.com', type: 'gas', name: 'Infinite Energy' },
  // Water
  { domain: 'dekalbcountyga.gov', type: 'water', name: 'DeKalb County Water' },
  { domain: 'cobbcounty.org', type: 'water', name: 'Cobb County Water' },
  { domain: 'fultoncountyga.gov', type: 'water', name: 'Fulton County Water' },
  { domain: 'gwinnettcounty.com', type: 'water', name: 'Gwinnett County Water' },
  { domain: 'forsythco.com', type: 'water', name: 'Forsyth County Water' },
  { domain: 'cityofsouthfulton', type: 'water', name: 'City of South Fulton Water' },
  { domain: 'roswellgov.com', type: 'water', name: 'City of Roswell Water' },
  { domain: 'cityofatlanta', type: 'water', name: 'City of Atlanta Water' },
  { domain: 'smyrnaga.gov', type: 'water', name: 'City of Smyrna Water' },
  { domain: 'kennesaw-ga.gov', type: 'water', name: 'City of Kennesaw Water' },
  // Trash
  { domain: 'wm.com', type: 'trash', name: 'Waste Management' },
  { domain: 'republicservices.com', type: 'trash', name: 'Republic Services' },
  { domain: 'wasteconnections.com', type: 'trash', name: 'Waste Connections' },
  // Internet
  { domain: 'comcast.com', type: 'internet', name: 'Comcast/Xfinity' },
  { domain: 'xfinity.com', type: 'internet', name: 'Xfinity' },
  { domain: 'att.com', type: 'internet', name: 'AT&T' },
  { domain: 'spectrum.com', type: 'internet', name: 'Spectrum' },
  { domain: 'charter.com', type: 'internet', name: 'Charter/Spectrum' },
  { domain: 'google.com', type: 'internet', name: 'Google Fiber' },
  { domain: 'fiber.google.com', type: 'internet', name: 'Google Fiber' },
  { domain: 'verizon.com', type: 'internet', name: 'Verizon' },
  { domain: 'tmobile.com', type: 'internet', name: 'T-Mobile Home Internet' },
  { domain: 'earthlink.net', type: 'internet', name: 'EarthLink' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get months parameter from request body (default to 12 months)
    let monthsToScan = 12;
    try {
      const body = await req.json();
      if (body.months && typeof body.months === 'number') {
        monthsToScan = Math.min(body.months, 24);
      }
    } catch {
      // Use default
    }

    console.log(`Scanning utility inbox for last ${monthsToScan} months`);

    // Get OAuth tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('gmail_oauth_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      console.error('No OAuth tokens found');
      return new Response(JSON.stringify({ 
        error: 'Gmail OAuth not configured for utilities inbox' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refresh access token
    let accessToken: string;
    try {
      accessToken = await refreshAccessToken(tokenData.refresh_token);
      
      await supabase
        .from('gmail_oauth_tokens')
        .update({ 
          access_token: accessToken,
          updated_at: new Date().toISOString()
        })
        .eq('id', tokenData.id);
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      throw new Error('Failed to refresh Gmail access token');
    }

    // Get ALL properties for AI matching
    const { data: properties } = await supabase
      .from('properties')
      .select('id, name, address')
      .in('property_type', ['Client-Managed', 'Company-Owned']);

    console.log(`Loaded ${properties?.length || 0} properties for matching`);

    // Get utility accounts for matching by account number
    const { data: utilityAccounts } = await supabase
      .from('utility_accounts')
      .select('*')
      .eq('is_active', true);

    // Build search query for utility emails
    const providerQueries = UTILITY_PROVIDERS.map(p => `from:${p.domain}`).join(' OR ');
    const searchQuery = `(${providerQueries}) newer_than:${monthsToScan * 30}d`;

    console.log('Search query:', searchQuery);

    // Fetch emails from Gmail
    const gmailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=500`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (!gmailResponse.ok) {
      const errorText = await gmailResponse.text();
      console.error('Gmail API error:', errorText);
      throw new Error('Failed to fetch Gmail messages');
    }

    const gmailData = await gmailResponse.json();
    const messages = gmailData.messages || [];

    console.log(`Found ${messages.length} utility emails to process`);

    let processedCount = 0;
    let newReadingsCount = 0;
    let skippedCount = 0;
    let matchedCount = 0;

    for (const message of messages) {
      // Check if we've already processed this email
      const { data: existingReading } = await supabase
        .from('utility_readings')
        .select('id')
        .eq('raw_email_data->>gmail_message_id', message.id)
        .single();

      if (existingReading) {
        skippedCount++;
        continue;
      }

      // Fetch full email content
      const emailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );

      if (!emailResponse.ok) continue;

      const emailData = await emailResponse.json();
      const headers = emailData.payload?.headers || [];
      
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const date = headers.find((h: any) => h.name === 'Date')?.value || '';

      // Extract email body
      let body = '';
      const extractBody = (payload: any): string => {
        if (payload.body?.data) {
          return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
        if (payload.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            }
            const nested = extractBody(part);
            if (nested) return nested;
          }
          // If no plain text, try HTML
          for (const part of payload.parts) {
            if (part.mimeType === 'text/html' && part.body?.data) {
              const html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
              return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            }
          }
        }
        return '';
      };
      
      body = extractBody(emailData.payload);

      if (!body) {
        console.log(`No body found for email ${message.id}, skipping`);
        continue;
      }

      // Call extract-utility-data function with properties list for AI matching
      const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-utility-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          emailSubject: subject,
          emailBody: body.substring(0, 20000),
          senderEmail: from,
          emailDate: date,
          properties: properties, // Pass properties to AI for matching
        }),
      });

      if (!extractResponse.ok) {
        console.error(`Failed to extract utility data for email ${message.id}`);
        continue;
      }

      const extractResult = await extractResponse.json();
      if (!extractResult.success) {
        console.error(`Extraction failed for email ${message.id}:`, extractResult.error);
        continue;
      }

      const utilityData = extractResult.data;

      // Determine property ID - prefer AI match, then fallback to account number
      let matchedPropertyId: string | null = utilityData.matched_property_id || null;
      let matchMethod = utilityData.matched_property_id ? 'ai_match' : '';

      // If AI didn't match, try account number lookup
      if (!matchedPropertyId && utilityData.account_number && utilityAccounts) {
        const accountMatch = utilityAccounts.find(
          acc => acc.account_number === utilityData.account_number && 
                 acc.utility_type === utilityData.utility_type
        );
        if (accountMatch) {
          matchedPropertyId = accountMatch.property_id;
          matchMethod = 'account_number';
        }
      }

      if (matchedPropertyId) matchedCount++;

      // Insert utility reading
      const { error: insertError } = await supabase
        .from('utility_readings')
        .insert({
          property_id: matchedPropertyId,
          utility_type: utilityData.utility_type,
          provider: utilityData.provider,
          account_number: utilityData.account_number,
          bill_date: utilityData.bill_date,
          service_period_start: utilityData.service_period_start,
          service_period_end: utilityData.service_period_end,
          due_date: utilityData.due_date,
          usage_amount: utilityData.usage_amount,
          usage_unit: utilityData.usage_unit,
          amount_due: Math.abs(utilityData.amount_due), // Ensure positive
          raw_email_data: {
            gmail_message_id: message.id,
            subject,
            from,
            date,
            extracted_at: new Date().toISOString(),
            match_method: matchMethod || 'unmatched',
            service_address: utilityData.service_address,
            confidence: utilityData.confidence,
          },
        });

      if (insertError) {
        console.error('Failed to insert utility reading:', insertError);
      } else {
        newReadingsCount++;
        console.log(`Created: ${utilityData.provider} $${utilityData.amount_due} → ${matchMethod || 'unmatched'}`);
      }

      processedCount++;
      
      // Rate limit
      if (processedCount % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`Done: ${processedCount} processed, ${newReadingsCount} created, ${matchedCount} matched, ${skippedCount} skipped`);

    return new Response(JSON.stringify({ 
      success: true,
      processed: processedCount,
      newReadings: newReadingsCount,
      matched: matchedCount,
      skipped: skippedCount,
      totalFound: messages.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in scan-utilities-inbox:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
