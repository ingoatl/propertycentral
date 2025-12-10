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

// Utility providers - Gas providers first as requested
const UTILITY_PROVIDERS = [
  // Gas (prioritized)
  { domain: 'gassouth.com', type: 'gas', name: 'Gas South' },
  { domain: 'scanaenergy.com', type: 'gas', name: 'SCANA Energy' },
  { domain: 'southerncompanygas.com', type: 'gas', name: 'Southern Company Gas' },
  { domain: 'atlantagaslight.com', type: 'gas', name: 'Atlanta Gas Light' },
  { domain: 'nicor.com', type: 'gas', name: 'Nicor Gas' },
  { domain: 'speedpay.com', type: 'gas', name: 'Georgia Natural Gas' },
  { domain: 'infinite-energy.com', type: 'gas', name: 'Infinite Energy' },
  // Electric
  { domain: 'georgiapower.com', type: 'electric', name: 'Georgia Power' },
  { domain: 'duke-energy.com', type: 'electric', name: 'Duke Energy' },
  { domain: 'fpl.com', type: 'electric', name: 'Florida Power & Light' },
  { domain: 'sawnee.com', type: 'electric', name: 'Sawnee EMC' },
  { domain: 'jacksonemc.com', type: 'electric', name: 'Jackson EMC' },
  { domain: 'cobbelectric.com', type: 'electric', name: 'Cobb EMC' },
  { domain: 'cobb-emc.com', type: 'electric', name: 'Cobb EMC' },
  // Water
  { domain: 'dekalbcountyga.gov', type: 'water', name: 'DeKalb County Water' },
  { domain: 'cobbcounty.org', type: 'water', name: 'Cobb County Water' },
  { domain: 'fultoncountyga.gov', type: 'water', name: 'Fulton County Water' },
  { domain: 'gwinnettcounty.com', type: 'water', name: 'Gwinnett County Water' },
  { domain: 'forsythco.com', type: 'water', name: 'Forsyth County Water' },
  { domain: 'roswellgov.com', type: 'water', name: 'City of Roswell Water' },
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
  { domain: 'spectrum.net', type: 'internet', name: 'Spectrum' },
  { domain: 'charter.com', type: 'internet', name: 'Charter/Spectrum' },
  { domain: 'google.com', type: 'internet', name: 'Google Fiber' },
  { domain: 'fiber.google.com', type: 'internet', name: 'Google Fiber' },
  { domain: 'verizon.com', type: 'internet', name: 'Verizon' },
  { domain: 'tmobile.com', type: 'internet', name: 'T-Mobile Home Internet' },
];

// Parse email date to ISO format
function parseEmailDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}
  return new Date().toISOString().split('T')[0];
}

// Match service address to property using street number + name
function matchPropertyByAddress(serviceAddress: string, properties: any[]): string | null {
  if (!serviceAddress || !properties?.length) return null;
  
  const svcAddr = serviceAddress.toLowerCase().trim();
  
  // Extract street number and name from service address
  const svcStreetMatch = svcAddr.match(/^(\d+)\s+(.+?)(?:,|\s+(?:apt|unit|#|suite)|\s+(?:[a-z]{2}\s+\d{5}))/i);
  if (!svcStreetMatch) return null;
  
  const svcStreetNum = svcStreetMatch[1];
  const svcStreetName = svcStreetMatch[2].toLowerCase()
    .replace(/\s+(st|rd|ave|dr|ct|ln|pl|way|blvd|cir|ter|pkwy|hwy)\.?$/i, '')
    .trim();
  
  console.log(`Matching: "${svcStreetNum} ${svcStreetName}" from "${serviceAddress}"`);
  
  for (const prop of properties) {
    const propAddr = (prop.address || '').toLowerCase();
    
    // Extract property street number and name
    const propStreetMatch = propAddr.match(/^(\d+)\s+(.+?)(?:,|$)/);
    if (!propStreetMatch) continue;
    
    const propStreetNum = propStreetMatch[1];
    const propStreetName = propStreetMatch[2].toLowerCase()
      .replace(/\s+(st|rd|ave|dr|ct|ln|pl|way|blvd|cir|ter|pkwy|hwy)\.?$/i, '')
      .trim();
    
    // Match by street number first
    if (svcStreetNum !== propStreetNum) continue;
    
    // Then check if street names are similar
    if (propStreetName.includes(svcStreetName) || svcStreetName.includes(propStreetName)) {
      console.log(`  MATCHED to: ${prop.name} (${prop.address})`);
      return prop.id;
    }
    
    // Check for partial word match
    const svcWords = svcStreetName.split(/\s+/).filter((w: string) => w.length > 2);
    const propWords = propStreetName.split(/\s+/).filter((w: string) => w.length > 2);
    
    const hasWordMatch = svcWords.some((sw: string) => 
      propWords.some((pw: string) => pw.includes(sw) || sw.includes(pw))
    );
    
    if (hasWordMatch) {
      console.log(`  MATCHED (word) to: ${prop.name} (${prop.address})`);
      return prop.id;
    }
  }
  
  console.log(`  NO MATCH found for address`);
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get parameters from request body
    let monthsToScan = 12;
    try {
      const body = await req.json();
      if (body.months && typeof body.months === 'number') {
        monthsToScan = Math.min(body.months, 24);
      }
    } catch {}

    console.log(`Scanning utility inbox for last ${monthsToScan} months - Company-Owned properties ONLY`);

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

    // Get ONLY Company-Owned properties (not managed or mid-term)
    const { data: properties, error: propError } = await supabase
      .from('properties')
      .select('id, name, address')
      .eq('property_type', 'Company-Owned');

    if (propError) {
      console.error('Error fetching properties:', propError);
    }

    console.log(`Loaded ${properties?.length || 0} Company-Owned properties for matching:`);
    properties?.forEach(p => console.log(`  - ${p.name}: ${p.address}`));

    // Get utility accounts for matching by account number
    const { data: utilityAccounts } = await supabase
      .from('utility_accounts')
      .select('*')
      .eq('is_active', true);

    // Build search query for utility emails - Gas first
    const providerQueries = UTILITY_PROVIDERS.map(p => `from:${p.domain}`).join(' OR ');
    const searchQuery = `(${providerQueries}) newer_than:${monthsToScan * 30}d`;

    console.log('Gmail search query:', searchQuery);

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
    let errorCount = 0;

    for (const message of messages) {
      // Check if we've already processed this email
      const { data: existingReading } = await supabase
        .from('utility_readings')
        .select('id')
        .eq('gmail_message_id', message.id)
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
      const emailDateISO = parseEmailDate(date);

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

      // Call extract-utility-data function with Company-Owned properties only
      const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-utility-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          emailSubject: subject,
          emailBody: body.substring(0, 15000),
          senderEmail: from,
          emailDate: date,
          properties: properties || [],
        }),
      });

      if (!extractResponse.ok) {
        console.error(`Failed to extract utility data for email ${message.id}`);
        errorCount++;
        continue;
      }

      const extractResult = await extractResponse.json();
      if (!extractResult.success || !extractResult.data) {
        console.error(`Extraction failed for email ${message.id}:`, extractResult.error);
        errorCount++;
        continue;
      }

      const utilityData = extractResult.data;

      // Ensure bill_date is never null
      let billDate = utilityData.bill_date;
      if (!billDate || billDate === 'null' || billDate === 'undefined') {
        billDate = emailDateISO;
      }

      // Determine property ID
      let matchedPropertyId: string | null = utilityData.matched_property_id || null;
      let matchMethod = matchedPropertyId ? 'ai_match' : '';

      // If AI didn't match, try account number lookup
      if (!matchedPropertyId && utilityData.account_number && utilityAccounts) {
        const accountMatch = utilityAccounts.find(
          acc => acc.account_number === utilityData.account_number && 
                 acc.utility_type === utilityData.utility_type
        );
        if (accountMatch) {
          // Only assign if property is Company-Owned
          const isOwnedProperty = properties?.some(p => p.id === accountMatch.property_id);
          if (isOwnedProperty) {
            matchedPropertyId = accountMatch.property_id;
            matchMethod = 'account_number';
          }
        }
      }

      // If still no match, try manual address matching
      if (!matchedPropertyId && utilityData.service_address && properties) {
        matchedPropertyId = matchPropertyByAddress(utilityData.service_address, properties);
        if (matchedPropertyId) {
          matchMethod = 'address_match';
        }
      }

      if (matchedPropertyId) matchedCount++;

      // Insert utility reading with guaranteed bill_date
      const { error: insertError } = await supabase
        .from('utility_readings')
        .insert({
          property_id: matchedPropertyId,
          utility_type: utilityData.utility_type,
          provider: utilityData.provider,
          account_number: utilityData.account_number,
          bill_date: billDate, // Now guaranteed to have a value
          service_period_start: utilityData.service_period_start || null,
          service_period_end: utilityData.service_period_end || null,
          due_date: utilityData.due_date || null,
          usage_amount: utilityData.usage_amount || null,
          usage_unit: utilityData.usage_unit || null,
          amount_due: Math.abs(utilityData.amount_due || 0),
          service_address: utilityData.service_address || null,
          gmail_message_id: message.id,
          raw_email_data: {
            subject,
            from,
            date,
            extracted_at: new Date().toISOString(),
            match_method: matchMethod || 'unmatched',
            confidence: utilityData.confidence,
          },
        });

      if (insertError) {
        console.error('Failed to insert utility reading:', insertError);
        errorCount++;
      } else {
        newReadingsCount++;
        const propName = matchedPropertyId 
          ? properties?.find(p => p.id === matchedPropertyId)?.name || 'Unknown'
          : 'UNASSIGNED';
        console.log(`Created: ${utilityData.provider} $${utilityData.amount_due} → ${propName} (${matchMethod || 'none'})`);
      }

      processedCount++;
      
      // Rate limit
      if (processedCount % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`Done: ${processedCount} processed, ${newReadingsCount} created, ${matchedCount} matched, ${skippedCount} skipped, ${errorCount} errors`);

    return new Response(JSON.stringify({ 
      success: true,
      processed: processedCount,
      newReadings: newReadingsCount,
      matched: matchedCount,
      skipped: skippedCount,
      errors: errorCount,
      totalFound: messages.length,
      propertiesScanned: properties?.map(p => p.name) || [],
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
