import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

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
  property_address_hint: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailSubject, emailBody, senderEmail, emailDate } = await req.json();

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert at extracting utility bill data from emails. 
Extract the following information from utility bill emails:

1. utility_type: One of 'electric', 'gas', 'water', 'sewer', 'trash', 'internet'
2. provider: The utility company name (e.g., "Georgia Power", "Gas South", "DeKalb County Water")
3. account_number: The account/customer number if visible
4. bill_date: The date the bill was generated (YYYY-MM-DD format)
5. service_period_start: Start of billing period (YYYY-MM-DD format)
6. service_period_end: End of billing period (YYYY-MM-DD format)
7. due_date: Payment due date (YYYY-MM-DD format)
8. usage_amount: Numeric consumption value (e.g., 1234 for kWh)
9. usage_unit: Unit of measurement ('kWh', 'therms', 'CCF', 'gallons')
10. amount_due: Total amount due in dollars (numeric, e.g., 156.78)
11. property_address_hint: Any property address mentioned in the email

Provider identification hints:
- Georgia Power, Duke Energy → electric
- Gas South, SCANA Energy, Georgia Natural Gas → gas
- DeKalb County Water, Cobb County Water, Fulton County Water → water
- Waste Management, Republic Services → trash
- Comcast, AT&T, Xfinity → internet

Return ONLY a valid JSON object with these fields. If a field cannot be determined, use null.
For dates, always use YYYY-MM-DD format.
For amounts, return numbers only (no $ signs or commas).`;

    const userPrompt = `Extract utility bill data from this email:

From: ${senderEmail}
Date: ${emailDate}
Subject: ${emailSubject}

Body:
${emailBody}

Return a JSON object with the extracted data.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON from the response
    let utilityData: UtilityData;
    try {
      // Try to find JSON in the response
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

    // Validate required fields
    if (!utilityData.utility_type || !utilityData.amount_due) {
      console.error('Missing required fields:', utilityData);
      throw new Error('Missing required utility data fields');
    }

    console.log('Extracted utility data:', utilityData);

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
