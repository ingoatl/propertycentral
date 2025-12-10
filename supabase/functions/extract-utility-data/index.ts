import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface UtilityData {
  utility_type: string;
  provider: string;
  account_number: string | null;
  bill_date: string;
  service_period_start: string | null;
  service_period_end: string | null;
  due_date: string | null;
  usage_amount: number | null;
  usage_unit: string | null;
  amount_due: number;
  service_address: string | null;
  matched_property_id: string | null;
  confidence: string;
}

// Parse various date formats into YYYY-MM-DD
function parseToISODate(dateStr: string | null | undefined, fallbackDate: string): string {
  if (!dateStr) return fallbackDate;
  
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {}
  
  // Try common formats
  const patterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /(\d{1,2})-(\d{1,2})-(\d{4})/,
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
  ];
  
  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      } catch {}
    }
  }
  
  return fallbackDate;
}

// Search for property address patterns in email body
function findAddressInBody(emailBody: string, properties: any[]): { id: string; address: string } | null {
  const bodyLower = emailBody.toLowerCase();
  
  for (const prop of properties) {
    if (!prop.address) continue;
    
    // Extract street number and name from property address
    const addrMatch = prop.address.match(/^(\d+)\s+(.+?)(?:,|$)/i);
    if (!addrMatch) continue;
    
    const streetNum = addrMatch[1];
    const streetName = addrMatch[2].toLowerCase()
      .replace(/\s+(st|rd|ave|dr|ct|ln|pl|way|blvd|cir|ter|pkwy|hwy)\.?$/i, '')
      .trim();
    
    // Search for street number followed by street name
    const searchPattern = new RegExp(`${streetNum}\\s+${streetName.split(' ')[0]}`, 'i');
    if (searchPattern.test(emailBody)) {
      console.log(`Found address pattern for ${prop.name}: ${streetNum} ${streetName}`);
      return { id: prop.id, address: prop.address };
    }
    
    // Also try just the street number with any partial match on street name
    const streetNumPattern = new RegExp(`\\b${streetNum}\\s+\\w+\\s*${streetName.split(' ')[0].substring(0, 4)}`, 'i');
    if (streetNumPattern.test(emailBody)) {
      console.log(`Found partial address pattern for ${prop.name}: ${streetNum}`);
      return { id: prop.id, address: prop.address };
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailSubject, emailBody, senderEmail, emailDate, properties } = await req.json();

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const emailDateParsed = parseToISODate(emailDate, new Date().toISOString().split('T')[0]);

    // First, try to find property address directly in email body
    const bodyMatch = findAddressInBody(emailBody, properties || []);
    
    // Build detailed property list for matching
    const propertyList = properties?.map((p: any) => {
      const addr = p.address || '';
      // Parse address components
      const streetMatch = addr.match(/^(\d+)\s+(.+?)(?:,|$)/);
      const cityMatch = addr.match(/,\s*([^,]+),\s*GA/i);
      const zipMatch = addr.match(/\b(\d{5})\b/);
      
      return `- ID: ${p.id}
  Name: "${p.name}"
  Address: "${addr}"
  Street#: ${streetMatch?.[1] || 'unknown'}
  StreetName: ${streetMatch?.[2] || 'unknown'}
  City: ${cityMatch?.[1] || 'unknown'}
  Zip: ${zipMatch?.[1] || 'unknown'}`;
    }).join('\n\n') || 'No properties provided';

    const systemPrompt = `You are an expert utility bill data extractor. Your job is to:
1. Extract billing data from utility company emails
2. Match the SERVICE ADDRESS to the correct property

CRITICAL RULES:
- Extract ONLY data you can see - NEVER guess or make up values
- The amount_due MUST be a positive number > 0. If you can't find a bill amount, return 0.
- bill_date is REQUIRED - use email date "${emailDateParsed}" if bill date not shown
- service_address is CRITICAL - search the ENTIRE email for ANY street address

WHERE TO FIND SERVICE ADDRESS:
- Look for "Service Location", "Service Address", "Account Location"
- Look for addresses in the format "1234 Street Name"
- Look for addresses after labels like "Address:", "Location:", "Service at:"
- Look in email headers, footers, and body text
- Gas South often includes address after "Service Address" or in account details
- If you find multiple addresses, pick the one that looks like a residential service address

UTILITY TYPE MAPPING:
- Georgia Power, Duke Energy, EMC → electric
- Gas South, SCANA, Georgia Natural Gas, Atlanta Gas Light → gas
- DeKalb County, Cobb County Water, Fulton County, Gwinnett County → water
- Waste Management, Republic Services → trash
- Comcast, Xfinity, AT&T, Spectrum, Google Fiber → internet

PROPERTY MATCHING RULES:
You MUST match service addresses to properties by comparing:
1. Street NUMBER must match exactly (e.g., "3155" = "3155")
2. Street NAME should match partially (e.g., "Duvall" matches "Duvall Pl")
3. If street number matches and street name is similar, return that property ID
4. Only return a property ID from the list provided - NEVER make one up
5. If you cannot find a clear match, return null for matched_property_id

RETURN FORMAT (valid JSON only):
{
  "utility_type": "electric|gas|water|sewer|trash|internet",
  "provider": "Company Name",
  "account_number": "123456" or null,
  "bill_date": "YYYY-MM-DD",
  "service_period_start": "YYYY-MM-DD" or null,
  "service_period_end": "YYYY-MM-DD" or null,
  "due_date": "YYYY-MM-DD" or null,
  "usage_amount": 123.45 or null,
  "usage_unit": "kWh|therms|CCF|gallons" or null,
  "amount_due": 123.45,
  "service_address": "Full address from bill" or null,
  "matched_property_id": "uuid" or null,
  "confidence": "high|medium|low"
}`;

    const userPrompt = `Extract utility bill data and match to a property.

AVAILABLE PROPERTIES TO MATCH:
${propertyList}

${bodyMatch ? `\nHINT: A property address was found in the email body. Property "${properties?.find((p: any) => p.id === bodyMatch.id)?.name}" (${bodyMatch.address}) may be the match.` : ''}

EMAIL DETAILS:
From: ${senderEmail}
Date: ${emailDate} (use "${emailDateParsed}" as bill_date if not found)
Subject: ${emailSubject}

BODY:
${emailBody}

INSTRUCTIONS:
1. Find the SERVICE ADDRESS in the email - search everywhere including headers and footers
2. Extract the amount due (look for "Amount Due", "Total Due", "Balance", dollar amounts)
3. Match the service address to one of the properties above by street number and name
4. Return JSON only, no other text`;

    console.log('Calling OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('OpenAI response:', content.substring(0, 500));

    // Parse JSON
    let utilityData: UtilityData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        utilityData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.error('Parse failed:', content);
      throw new Error('Failed to parse AI response');
    }

    // Validate required fields
    if (!utilityData.utility_type) {
      throw new Error('Missing utility_type');
    }

    // Ensure bill_date
    if (!utilityData.bill_date) {
      utilityData.bill_date = emailDateParsed;
    } else {
      utilityData.bill_date = parseToISODate(utilityData.bill_date, emailDateParsed);
    }

    // Parse other dates
    if (utilityData.service_period_start) {
      utilityData.service_period_start = parseToISODate(utilityData.service_period_start, '') || null;
    }
    if (utilityData.service_period_end) {
      utilityData.service_period_end = parseToISODate(utilityData.service_period_end, '') || null;
    }
    if (utilityData.due_date) {
      utilityData.due_date = parseToISODate(utilityData.due_date, '') || null;
    }

    // Ensure positive amount
    utilityData.amount_due = Math.abs(utilityData.amount_due || 0);

    // Validate matched_property_id is from our list
    if (utilityData.matched_property_id) {
      const isValidId = properties?.some((p: any) => p.id === utilityData.matched_property_id);
      if (!isValidId) {
        console.log(`Invalid property ID "${utilityData.matched_property_id}" - not in provided list`);
        utilityData.matched_property_id = null;
      }
    }

    // If AI didn't find a match but we found one in body search, use that
    if (!utilityData.matched_property_id && bodyMatch) {
      console.log(`Using body search match: ${bodyMatch.id}`);
      utilityData.matched_property_id = bodyMatch.id;
      utilityData.service_address = utilityData.service_address || bodyMatch.address;
    }

    // Default confidence
    if (!utilityData.confidence) {
      utilityData.confidence = utilityData.matched_property_id ? 'medium' : 'low';
    }

    console.log('Extracted:', JSON.stringify({
      provider: utilityData.provider,
      amount: utilityData.amount_due,
      address: utilityData.service_address,
      matched: utilityData.matched_property_id ? 'YES' : 'NO'
    }));

    return new Response(JSON.stringify({ 
      success: true, 
      data: utilityData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
