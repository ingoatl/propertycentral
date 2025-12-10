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

// Utility providers - Gas first as requested
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

// PROMOTIONAL/JUNK keywords - skip these emails
const PROMO_KEYWORDS = [
  'offer', 'giveaway', 'festival', 'giving tuesday', 'free pass', 'last chance', 
  'claim your', 'win ', 'sweepstakes', 'contest', 'congratulations', 'reward',
  'promo', 'discount', 'save now', 'limited time', 'act now', 'special deal',
  'newsletter', 'tips', 'energy saving', 'survey', 'feedback', 'rate us',
  'welcome to', 'thank you for', 'paperless', 'autopay', 'sign up', 'enroll',
  'outage', 'maintenance', 'alert', 'notification', 'update your', 'confirm your'
];

// BILL keywords - only process emails with these
const BILL_KEYWORDS = [
  'bill', 'invoice', 'statement', 'payment due', 'amount due', 'balance due',
  'your payment', 'total due', 'pay by', 'due date', 'billing statement',
  'monthly statement', 'your bill is ready', 'view your bill', 'bill is available'
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

// Company-Owned property addresses with parsed components for matching
interface PropertyMatch {
  id: string;
  name: string;
  address: string;
  streetNum: string;
  streetName: string;
  city: string;
  zip: string;
}

// Parse property address into components
function parsePropertyAddress(property: any): PropertyMatch {
  const addr = property.address || '';
  const streetMatch = addr.match(/^(\d+)\s+(.+?)(?:,|$)/i);
  const cityMatch = addr.match(/,\s*([^,]+),\s*GA/i);
  const zipMatch = addr.match(/\b(\d{5})\b/);
  
  return {
    id: property.id,
    name: property.name,
    address: addr,
    streetNum: streetMatch?.[1] || '',
    streetName: (streetMatch?.[2] || '').toLowerCase().replace(/\s+(st|rd|ave|dr|ct|ln|pl|way|blvd|cir|ter|pkwy|hwy)\.?$/i, '').trim(),
    city: (cityMatch?.[1] || '').toLowerCase().trim(),
    zip: zipMatch?.[1] || '',
  };
}

// Multi-layer property matching
function matchProperty(serviceAddress: string | null, properties: PropertyMatch[]): { id: string | null, method: string } {
  if (!serviceAddress || !properties?.length) {
    return { id: null, method: 'no_address' };
  }
  
  const svcAddr = serviceAddress.toLowerCase().trim();
  
  // Extract service address components
  const svcStreetMatch = svcAddr.match(/^(\d+)\s+(.+?)(?:,|\s+(?:apt|unit|#|suite|\d+\s*[a-z]?)|\s+(?:[a-z]{2}\s+\d{5}))/i);
  if (!svcStreetMatch) {
    // Try simpler extraction
    const simpleMatch = svcAddr.match(/^(\d+)\s+([a-z]+(?:\s+[a-z]+)?)/i);
    if (!simpleMatch) {
      return { id: null, method: 'parse_failed' };
    }
  }
  
  const svcStreetNum = svcStreetMatch?.[1] || svcAddr.match(/^(\d+)/)?.[1] || '';
  let svcStreetName = (svcStreetMatch?.[2] || '').toLowerCase()
    .replace(/\s+(st|rd|ave|dr|ct|ln|pl|way|blvd|cir|ter|pkwy|hwy)\.?$/i, '')
    .trim();
  
  const svcCityMatch = svcAddr.match(/,\s*([^,]+),?\s*(?:ga|georgia)/i);
  const svcCity = (svcCityMatch?.[1] || '').toLowerCase().trim();
  const svcZipMatch = svcAddr.match(/\b(\d{5})\b/);
  const svcZip = svcZipMatch?.[1] || '';
  
  console.log(`  Matching: streetNum="${svcStreetNum}" streetName="${svcStreetName}" city="${svcCity}" zip="${svcZip}"`);
  
  // Layer 1: Exact street number + name match
  for (const prop of properties) {
    if (svcStreetNum === prop.streetNum) {
      // Check for name similarity
      if (svcStreetName && prop.streetName) {
        const svcWords = svcStreetName.split(/\s+/).filter(w => w.length > 2);
        const propWords = prop.streetName.split(/\s+/).filter(w => w.length > 2);
        
        // Check if any significant word matches
        const wordMatch = svcWords.some(sw => 
          propWords.some(pw => pw.includes(sw) || sw.includes(pw))
        );
        
        if (wordMatch || prop.streetName.includes(svcStreetName) || svcStreetName.includes(prop.streetName)) {
          console.log(`    MATCH (street): ${prop.name}`);
          return { id: prop.id, method: 'street_match' };
        }
      }
    }
  }
  
  // Layer 2: Street number + zip code
  if (svcZip) {
    for (const prop of properties) {
      if (svcStreetNum === prop.streetNum && svcZip === prop.zip) {
        console.log(`    MATCH (zip): ${prop.name}`);
        return { id: prop.id, method: 'zip_match' };
      }
    }
  }
  
  // Layer 3: Street number + city
  if (svcCity) {
    for (const prop of properties) {
      if (svcStreetNum === prop.streetNum && prop.city.includes(svcCity)) {
        console.log(`    MATCH (city): ${prop.name}`);
        return { id: prop.id, method: 'city_match' };
      }
    }
  }
  
  // Layer 4: Just street number (last resort for unique numbers)
  const streetNumMatches = properties.filter(p => p.streetNum === svcStreetNum);
  if (streetNumMatches.length === 1) {
    console.log(`    MATCH (unique_num): ${streetNumMatches[0].name}`);
    return { id: streetNumMatches[0].id, method: 'unique_num' };
  }
  
  console.log(`    NO MATCH`);
  return { id: null, method: 'no_match' };
}

// Check if email is promotional/junk
function isPromotionalEmail(subject: string): boolean {
  const subjectLower = subject.toLowerCase();
  return PROMO_KEYWORDS.some(kw => subjectLower.includes(kw));
}

// Check if email is a bill
function isBillEmail(subject: string, body: string): boolean {
  const subjectLower = subject.toLowerCase();
  const bodyLower = body.toLowerCase().substring(0, 2000); // Check first 2000 chars
  
  // Must have bill keywords in subject OR body
  const hasBillKeyword = BILL_KEYWORDS.some(kw => 
    subjectLower.includes(kw) || bodyLower.includes(kw)
  );
  
  // Must have an amount pattern somewhere
  const hasAmount = /\$\s*\d+\.?\d*/i.test(body);
  
  return hasBillKeyword && hasAmount;
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
    let monthsToScan = 6;
    try {
      const body = await req.json();
      if (body.months && typeof body.months === 'number') {
        monthsToScan = Math.min(body.months, 12);
      }
    } catch {}

    console.log(`=== UTILITY SCAN START: ${monthsToScan} months, Company-Owned only ===`);

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

    // Get ONLY Company-Owned properties
    const { data: rawProperties, error: propError } = await supabase
      .from('properties')
      .select('id, name, address')
      .eq('property_type', 'Company-Owned');

    if (propError) {
      console.error('Error fetching properties:', propError);
      throw new Error('Failed to fetch properties');
    }

    const properties: PropertyMatch[] = (rawProperties || []).map(parsePropertyAddress);
    
    console.log(`\nCompany-Owned Properties (${properties.length}):`);
    properties.forEach(p => console.log(`  ${p.name}: ${p.streetNum} ${p.streetName}, ${p.city} ${p.zip}`));

    // Get utility accounts for account number matching
    const { data: utilityAccounts } = await supabase
      .from('utility_accounts')
      .select('*')
      .eq('is_active', true);

    // Build search query - Gas providers first
    const providerQueries = UTILITY_PROVIDERS.map(p => `from:${p.domain}`).join(' OR ');
    const searchQuery = `(${providerQueries}) newer_than:${monthsToScan * 30}d`;

    console.log('\nGmail search query:', searchQuery);

    // Fetch emails from Gmail
    const gmailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=500`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!gmailResponse.ok) {
      const errorText = await gmailResponse.text();
      console.error('Gmail API error:', errorText);
      throw new Error('Failed to fetch Gmail messages');
    }

    const gmailData = await gmailResponse.json();
    const messages = gmailData.messages || [];

    console.log(`\nFound ${messages.length} emails to process`);

    let processedCount = 0;
    let newReadingsCount = 0;
    let skippedDuplicate = 0;
    let skippedPromo = 0;
    let skippedNotBill = 0;
    let matchedCount = 0;
    let errorCount = 0;

    for (const message of messages) {
      // Check for existing reading
      const { data: existingReading } = await supabase
        .from('utility_readings')
        .select('id')
        .eq('gmail_message_id', message.id)
        .single();

      if (existingReading) {
        skippedDuplicate++;
        continue;
      }

      // Fetch email content
      const emailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!emailResponse.ok) continue;

      const emailData = await emailResponse.json();
      const headers = emailData.payload?.headers || [];
      
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const date = headers.find((h: any) => h.name === 'Date')?.value || '';
      const emailDateISO = parseEmailDate(date);

      // Filter: Skip promotional emails
      if (isPromotionalEmail(subject)) {
        console.log(`SKIP (promo): ${subject}`);
        skippedPromo++;
        continue;
      }

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
      if (!body) continue;

      // Filter: Must be a bill email
      if (!isBillEmail(subject, body)) {
        console.log(`SKIP (not bill): ${subject}`);
        skippedNotBill++;
        continue;
      }

      console.log(`\nPROCESS: ${subject}`);

      // Call extract-utility-data with all Company-Owned properties
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
          properties: rawProperties || [],
        }),
      });

      if (!extractResponse.ok) {
        console.error(`Extract failed for ${message.id}`);
        errorCount++;
        continue;
      }

      const extractResult = await extractResponse.json();
      if (!extractResult.success || !extractResult.data) {
        console.error(`No data extracted:`, extractResult.error);
        errorCount++;
        continue;
      }

      const utilityData = extractResult.data;

      // Skip $0 bills
      if (!utilityData.amount_due || utilityData.amount_due <= 0) {
        console.log(`SKIP ($0 amount): ${utilityData.provider}`);
        skippedNotBill++;
        continue;
      }

      // Ensure bill_date
      let billDate = utilityData.bill_date;
      if (!billDate || billDate === 'null') {
        billDate = emailDateISO;
      }

      // Multi-layer property matching
      let matchedPropertyId: string | null = utilityData.matched_property_id || null;
      let matchMethod = matchedPropertyId ? 'ai_match' : '';

      // Verify AI match is a Company-Owned property
      if (matchedPropertyId) {
        const isOwned = properties.some(p => p.id === matchedPropertyId);
        if (!isOwned) {
          console.log(`  AI matched non-owned property, clearing`);
          matchedPropertyId = null;
          matchMethod = '';
        }
      }

      // Try account number matching
      if (!matchedPropertyId && utilityData.account_number && utilityAccounts) {
        const accountMatch = utilityAccounts.find(
          acc => acc.account_number === utilityData.account_number && 
                 acc.utility_type === utilityData.utility_type
        );
        if (accountMatch) {
          const isOwned = properties.some(p => p.id === accountMatch.property_id);
          if (isOwned) {
            matchedPropertyId = accountMatch.property_id;
            matchMethod = 'account_match';
          }
        }
      }

      // Try address matching
      if (!matchedPropertyId && utilityData.service_address) {
        const addrMatch = matchProperty(utilityData.service_address, properties);
        if (addrMatch.id) {
          matchedPropertyId = addrMatch.id;
          matchMethod = addrMatch.method;
        }
      }

      // Fallback: Search for property addresses in the email body
      if (!matchedPropertyId) {
        for (const prop of properties) {
          const streetMatch = prop.address.match(/^(\d+)\s+(.+?)(?:,|$)/i);
          if (!streetMatch) continue;
          
          const streetNum = streetMatch[1];
          const streetName = streetMatch[2].split(' ')[0].toLowerCase();
          
          // Look for street number followed by partial street name
          const searchPattern = new RegExp(`\\b${streetNum}\\s+\\w*${streetName.substring(0, 4)}`, 'i');
          if (searchPattern.test(body)) {
            matchedPropertyId = prop.id;
            matchMethod = 'body_search';
            console.log(`  Found in body: ${streetNum} ${streetName} → ${prop.name}`);
            break;
          }
        }
      }

      if (matchedPropertyId) matchedCount++;

      // Insert reading
      const { error: insertError } = await supabase
        .from('utility_readings')
        .insert({
          property_id: matchedPropertyId,
          utility_type: utilityData.utility_type,
          provider: utilityData.provider,
          account_number: utilityData.account_number,
          bill_date: billDate,
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
        console.error('Insert error:', insertError);
        errorCount++;
      } else {
        newReadingsCount++;
        const propName = matchedPropertyId 
          ? properties.find(p => p.id === matchedPropertyId)?.name || 'Unknown'
          : 'UNASSIGNED';
        console.log(`  → ${utilityData.provider} $${utilityData.amount_due} → ${propName} (${matchMethod || 'none'})`);
      }

      processedCount++;
      
      // Rate limit
      if (processedCount % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`\n=== SCAN COMPLETE ===`);
    console.log(`Processed: ${processedCount}, New: ${newReadingsCount}, Matched: ${matchedCount}`);
    console.log(`Skipped - Duplicate: ${skippedDuplicate}, Promo: ${skippedPromo}, Not Bill: ${skippedNotBill}`);
    console.log(`Errors: ${errorCount}`);

    return new Response(JSON.stringify({ 
      success: true,
      processed: processedCount,
      newReadings: newReadingsCount,
      matched: matchedCount,
      skipped: {
        duplicate: skippedDuplicate,
        promotional: skippedPromo,
        notBill: skippedNotBill,
      },
      errors: errorCount,
      totalFound: messages.length,
      properties: properties.map(p => ({ name: p.name, address: p.address })),
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
