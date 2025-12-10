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
    // Try direct ISO parse
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {}
  
  // Try parsing common formats
  const patterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
    /(\d{1,2})-(\d{1,2})-(\d{4})/,   // MM-DD-YYYY
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, // Month DD, YYYY
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailSubject, emailBody, senderEmail, emailDate, properties } = await req.json();

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Parse the email date as fallback
    const emailDateParsed = parseToISODate(emailDate, new Date().toISOString().split('T')[0]);

    // Build property list for matching with full address details
    const propertyList = properties?.map((p: any) => {
      // Extract address components for better matching
      const address = p.address || '';
      const streetMatch = address.match(/^(\d+)\s+(.+?),/);
      const streetNum = streetMatch?.[1] || '';
      const streetName = streetMatch?.[2] || '';
      
      return `ID: ${p.id} | Name: "${p.name}" | Full Address: "${p.address}" | Street: "${streetNum} ${streetName}"`;
    }).join('\n') || 'No properties provided';

    const systemPrompt = `You are an expert at extracting utility bill data from emails and matching service addresses to properties.

CRITICAL RULES:
1. Extract ONLY what you can clearly see in the email - DO NOT guess or hallucinate
2. For amounts, extract the EXACT number shown (positive values only)
3. For dates, use email date as bill_date if not explicitly shown
4. For property matching, match by STREET NUMBER AND STREET NAME - these are the key identifiers

EXTRACTION FIELDS (ALL REQUIRED):
- utility_type: One of 'electric', 'gas', 'water', 'sewer', 'trash', 'internet' (REQUIRED)
- provider: The utility company name (REQUIRED)
- account_number: Account/customer number if visible (can be null)
- bill_date: Bill date in YYYY-MM-DD format - USE EMAIL DATE IF NOT VISIBLE (REQUIRED, never null)
- service_period_start: Billing period start YYYY-MM-DD (can be null)
- service_period_end: Billing period end YYYY-MM-DD (can be null)
- due_date: Payment due date YYYY-MM-DD (can be null)
- usage_amount: Numeric consumption value (can be null)
- usage_unit: 'kWh', 'therms', 'CCF', 'gallons', 'Mbps' (can be null)
- amount_due: Total amount due as positive number (REQUIRED, default to 0 if unclear)
- service_address: The service address from the bill (can be null)
- matched_property_id: UUID of matched property (REQUIRED - match by street number + name)
- confidence: 'high', 'medium', or 'low' (REQUIRED)

PROVIDER TO UTILITY TYPE:
- Georgia Power, Duke Energy, Sawnee EMC, Jackson EMC → electric
- Gas South, SCANA Energy, Georgia Natural Gas, Atlanta Gas Light → gas
- DeKalb County, Cobb County Water, Fulton County, Gwinnett County → water
- Waste Management, Republic Services → trash
- Comcast, Xfinity, AT&T, Spectrum, Google Fiber, Verizon → internet

PROPERTY MATCHING (MOST IMPORTANT):
1. Extract the service address street number (e.g., "3155" from "3155 Duvall Pl")
2. Extract the street name (e.g., "Duvall" or "Duvall Pl")
3. Match to a property where BOTH street number AND a portion of street name match
4. Example: Service "3155 Duvall Place" matches "3155 Duvall Pl, Kennesaw, GA"
5. Example: Service "5360 Durham Ridge" matches "5360 Durham Ridge Ct, Lilburn"
6. If you find a street number + name match, return that property's ID
7. If no clear match, return null

TODAY'S DATE FOR REFERENCE: ${emailDateParsed}

Return ONLY valid JSON. Never include explanations outside JSON.`;

    const userPrompt = `Extract utility bill data and match to a property.

AVAILABLE PROPERTIES (match by street number + name):
${propertyList}

EMAIL DATA:
From: ${senderEmail}
Date: ${emailDate} (use as bill_date: ${emailDateParsed} if bill date not shown)
Subject: ${emailSubject}

Body:
${emailBody}

Return JSON with these exact fields: utility_type, provider, account_number, bill_date (YYYY-MM-DD, never null), service_period_start, service_period_end, due_date, usage_amount, usage_unit, amount_due, service_address, matched_property_id, confidence`;

    console.log('Calling OpenAI for utility extraction...');

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
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('OpenAI response:', content);

    // Extract JSON from the response
    let utilityData: UtilityData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        utilityData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse utility data from AI response');
    }

    // Validate and sanitize required fields
    if (!utilityData.utility_type) {
      console.error('Missing utility_type:', utilityData);
      throw new Error('Missing utility_type field');
    }

    // Ensure bill_date is never null - use email date as fallback
    if (!utilityData.bill_date) {
      utilityData.bill_date = emailDateParsed;
    } else {
      utilityData.bill_date = parseToISODate(utilityData.bill_date, emailDateParsed);
    }

    // Parse other dates
    if (utilityData.service_period_start) {
      utilityData.service_period_start = parseToISODate(utilityData.service_period_start, null as any) || null;
    }
    if (utilityData.service_period_end) {
      utilityData.service_period_end = parseToISODate(utilityData.service_period_end, null as any) || null;
    }
    if (utilityData.due_date) {
      utilityData.due_date = parseToISODate(utilityData.due_date, null as any) || null;
    }

    // Ensure amount is positive and defaulted
    utilityData.amount_due = Math.abs(utilityData.amount_due || 0);

    // Default confidence if missing
    if (!utilityData.confidence) {
      utilityData.confidence = utilityData.matched_property_id ? 'medium' : 'low';
    }

    console.log('Extracted utility data:', JSON.stringify(utilityData, null, 2));

    return new Response(JSON.stringify({ 
      success: true, 
      data: utilityData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in extract-utility-data:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
