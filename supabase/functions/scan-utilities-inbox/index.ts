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
  // Gas
  { domain: 'gassouth.com', type: 'gas', name: 'Gas South' },
  { domain: 'scanaenergy.com', type: 'gas', name: 'SCANA Energy' },
  { domain: 'southerncompanygas.com', type: 'gas', name: 'Southern Company Gas' },
  { domain: 'atlantagaslight.com', type: 'gas', name: 'Atlanta Gas Light' },
  { domain: 'nicor.com', type: 'gas', name: 'Nicor Gas' },
  // Water
  { domain: 'dekalbcountyga.gov', type: 'water', name: 'DeKalb County Water' },
  { domain: 'cobbcounty.org', type: 'water', name: 'Cobb County Water' },
  { domain: 'fultoncountyga.gov', type: 'water', name: 'Fulton County Water' },
  { domain: 'gwinnettcounty.com', type: 'water', name: 'Gwinnett County Water' },
  { domain: 'forsythco.com', type: 'water', name: 'Forsyth County Water' },
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
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get OAuth tokens for utilities inbox
    // For now, we'll use the same tokens as the main inbox
    // In production, you'd have separate tokens for utilities@peachhausgroup.com
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
      
      // Update stored access token
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

    // Build search query for utility emails
    const providerQueries = UTILITY_PROVIDERS.map(p => `from:${p.domain}`).join(' OR ');
    const searchQuery = `(${providerQueries}) newer_than:30d`;

    // Fetch emails from Gmail
    const gmailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=50`,
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

    console.log(`Found ${messages.length} utility emails`);

    // Get properties for matching
    const { data: properties } = await supabase
      .from('properties')
      .select('id, name, address')
      .neq('property_type', 'Inactive');

    let processedCount = 0;
    let newReadingsCount = 0;

    for (const message of messages) {
      // Check if we've already processed this email
      const { data: existingReading } = await supabase
        .from('utility_readings')
        .select('id')
        .eq('raw_email_data->>gmail_message_id', message.id)
        .single();

      if (existingReading) {
        console.log(`Skipping already processed email: ${message.id}`);
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
      const parts = emailData.payload?.parts || [emailData.payload];
      for (const part of parts) {
        if (part?.mimeType === 'text/plain' && part?.body?.data) {
          body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          break;
        }
        if (part?.mimeType === 'text/html' && part?.body?.data && !body) {
          const html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          body = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
        }
      }

      if (!body && emailData.payload?.body?.data) {
        body = atob(emailData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }

      // Call extract-utility-data function
      const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-utility-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          emailSubject: subject,
          emailBody: body.substring(0, 10000), // Limit body size
          senderEmail: from,
          emailDate: date,
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

      // Enhanced property matching
      let matchedPropertyId: string | null = null;
      
      // First, try to match by account number from utility_accounts table
      if (utilityData.account_number) {
        const { data: accountMatch } = await supabase
          .from('utility_accounts')
          .select('property_id')
          .eq('account_number', utilityData.account_number)
          .eq('is_active', true)
          .single();
        
        if (accountMatch) {
          matchedPropertyId = accountMatch.property_id;
          console.log(`Matched property by account number: ${utilityData.account_number}`);
        }
      }

      // If no account match, try address matching with improved logic
      if (!matchedPropertyId && properties) {
        const hint = (utilityData.property_address_hint || '').toLowerCase();
        const emailBody = body.toLowerCase();
        
        for (const prop of properties) {
          const propAddress = prop.address.toLowerCase();
          const propName = prop.name.toLowerCase();
          
          // Extract street number and name from property address
          const propStreetMatch = propAddress.match(/^(\d+)\s+(.+?)(?:,|$)/);
          const propStreetNumber = propStreetMatch?.[1];
          const propStreetName = propStreetMatch?.[2]?.split(/[,\s]+/)[0];
          
          // Check if hint contains property address components
          if (hint) {
            // Direct address match
            if (hint.includes(propAddress) || propAddress.includes(hint)) {
              matchedPropertyId = prop.id;
              console.log(`Matched property by direct address: ${prop.name}`);
              break;
            }
            
            // Street number + partial street name match
            if (propStreetNumber && propStreetName) {
              if (hint.includes(propStreetNumber) && hint.includes(propStreetName)) {
                matchedPropertyId = prop.id;
                console.log(`Matched property by street components: ${prop.name}`);
                break;
              }
            }
          }
          
          // Also check the full email body for address mentions
          if (propStreetNumber && propStreetName) {
            if (emailBody.includes(propStreetNumber) && emailBody.includes(propStreetName)) {
              matchedPropertyId = prop.id;
              console.log(`Matched property by email body address: ${prop.name}`);
              break;
            }
          }
          
          // Check if property name is mentioned
          if (propName.length > 5 && emailBody.includes(propName)) {
            matchedPropertyId = prop.id;
            console.log(`Matched property by name: ${prop.name}`);
            break;
          }
        }
      }

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
          amount_due: utilityData.amount_due,
          raw_email_data: {
            gmail_message_id: message.id,
            subject,
            from,
            date,
            extracted_at: new Date().toISOString(),
          },
        });

      if (insertError) {
        console.error('Failed to insert utility reading:', insertError);
      } else {
        newReadingsCount++;
      }

      processedCount++;
    }

    console.log(`Processed ${processedCount} emails, created ${newReadingsCount} new readings`);

    return new Response(JSON.stringify({ 
      success: true,
      processed: processedCount,
      newReadings: newReadingsCount,
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
