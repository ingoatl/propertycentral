import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailSubject, emailBody, senderEmail, emailDate, properties } = await req.json();

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Build property list for matching
    const propertyList = properties?.map((p: any) => 
      `ID: ${p.id} | Name: "${p.name}" | Address: "${p.address}"`
    ).join('\n') || 'No properties provided';

    const systemPrompt = `You are an expert at extracting utility bill data from emails and matching service addresses to properties.

CRITICAL RULES:
1. Extract ONLY what you can clearly see in the email - DO NOT guess or hallucinate data
2. For amounts, extract the EXACT number shown (positive values only)
3. For addresses, extract the COMPLETE service address from the bill
4. For property matching, ONLY match if the address clearly matches - if unsure, return null

EXTRACTION FIELDS:
- utility_type: One of 'electric', 'gas', 'water', 'sewer', 'trash', 'internet'
- provider: The utility company name
- account_number: Account/customer number if visible
- bill_date: Bill generation date (YYYY-MM-DD)
- service_period_start: Billing period start (YYYY-MM-DD)
- service_period_end: Billing period end (YYYY-MM-DD)  
- due_date: Payment due date (YYYY-MM-DD)
- usage_amount: Numeric consumption value
- usage_unit: 'kWh', 'therms', 'CCF', 'gallons', 'Mbps'
- amount_due: Total amount due (positive number, e.g., 156.78)
- service_address: The FULL service address from the bill (street, city, state, zip)
- matched_property_id: The property ID that matches the service address (or null if no clear match)
- confidence: 'high', 'medium', or 'low'

PROVIDER IDENTIFICATION:
- Georgia Power, Duke Energy, Sawnee EMC, Jackson EMC → electric
- Gas South, SCANA Energy, Georgia Natural Gas, Atlanta Gas Light → gas
- DeKalb County, Cobb County Water, Fulton County, Gwinnett County → water
- Waste Management, Republic Services → trash
- Comcast, Xfinity, AT&T, Spectrum, Google Fiber, Verizon → internet

PROPERTY MATCHING RULES:
- Match by street number + street name (e.g., "3155 Duvall" matches "3155 Duvall Pl, Kennesaw")
- Match by city + zip if street matches
- If multiple properties could match, return null (don't guess)
- If no clear match, return null for matched_property_id

Return ONLY valid JSON. No explanation text.`;

    const userPrompt = `Extract utility bill data and match to a property.

AVAILABLE PROPERTIES:
${propertyList}

EMAIL DATA:
From: ${senderEmail}
Date: ${emailDate}
Subject: ${emailSubject}

Body:
${emailBody}

Return JSON with extracted data. Match service_address to one of the properties above if there's a clear match.`;

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
        temperature: 0.1, // Low temperature for precision
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

    // Validate and sanitize
    if (!utilityData.utility_type || utilityData.amount_due === undefined) {
      console.error('Missing required fields:', utilityData);
      throw new Error('Missing required utility data fields');
    }

    // Ensure amount is positive
    utilityData.amount_due = Math.abs(utilityData.amount_due);

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
