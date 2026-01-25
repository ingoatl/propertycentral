import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

interface ProviderRecommendation {
  property_id: string;
  property_name: string;
  property_address: string;
  utility_type: string;
  current_provider: string;
  current_avg_cost: number;
  recommended_provider: string;
  estimated_savings: number;
  savings_percentage: number;
  reason: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting utility provider recommendations analysis...');

    // Get utility readings from last 6 months with property info
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const { data: readings, error: readingsError } = await supabase
      .from('utility_readings')
      .select(`
        *,
        properties:property_id (
          id,
          name,
          address
        )
      `)
      .gte('bill_date', sixMonthsAgo)
      .order('bill_date', { ascending: false });

    if (readingsError) {
      throw new Error(`Failed to fetch readings: ${readingsError.message}`);
    }

    if (!readings || readings.length === 0) {
      console.log('No utility readings found for analysis');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No utility data available for analysis',
        recommendations: [],
        emailsSent: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group readings by property and utility type to calculate averages
    const groupedData: Record<string, {
      property_id: string;
      property_name: string;
      property_address: string;
      utility_type: string;
      provider: string;
      readings: { amount: number; usage: number | null; date: string }[];
    }> = {};

    for (const reading of readings) {
      if (!reading.property_id || !reading.properties) continue;
      
      const key = `${reading.property_id}-${reading.utility_type}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          property_id: reading.property_id,
          property_name: reading.properties.name,
          property_address: reading.properties.address,
          utility_type: reading.utility_type,
          provider: reading.provider || 'Unknown',
          readings: [],
        };
      }
      groupedData[key].readings.push({
        amount: reading.amount_due,
        usage: reading.usage_amount,
        date: reading.bill_date,
      });
    }

    // Prepare data for AI analysis
    const analysisData = Object.values(groupedData).map(group => ({
      property_name: group.property_name,
      property_address: group.property_address,
      utility_type: group.utility_type,
      current_provider: group.provider,
      avg_monthly_cost: group.readings.reduce((sum, r) => sum + r.amount, 0) / group.readings.length,
      avg_monthly_usage: group.readings[0].usage ? 
        group.readings.filter(r => r.usage).reduce((sum, r) => sum + (r.usage || 0), 0) / group.readings.filter(r => r.usage).length : null,
      months_of_data: group.readings.length,
    }));

    console.log(`Analyzing ${analysisData.length} property-utility combinations`);

    // Use OpenAI to analyze and recommend cheaper providers
    const aiPrompt = `You are an expert utility cost analyst for the Atlanta, Georgia metro area. Analyze the following utility data and recommend cheaper providers where significant savings (>10%) are possible.

Current utility data:
${JSON.stringify(analysisData, null, 2)}

For each property-utility combination, consider:
1. Current provider rates vs market alternatives in Atlanta metro area
2. Georgia's deregulated natural gas market (providers: SCANA Energy, Georgia Natural Gas, Constellation, Infinite Energy)
3. Internet providers (AT&T Fiber, Xfinity, Google Fiber where available)
4. Georgia Power is the only electric provider in most areas (cannot be changed)
5. Water/sewer is typically through county (DeKalb, Fulton, Cobb) - cannot be changed

Return ONLY a JSON array of recommendations where meaningful savings exist. Each recommendation should have:
{
  "property_name": string,
  "utility_type": string,
  "current_provider": string,
  "current_avg_cost": number,
  "recommended_provider": string,
  "estimated_monthly_savings": number,
  "savings_percentage": number,
  "reason": string (brief explanation)
}

Only include recommendations where:
- Savings are at least 10% or $15/month
- The switch is actually possible (don't recommend switching electric or water providers)
- The recommendation is realistic for Georgia market

If no meaningful savings opportunities exist, return an empty array: []`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a utility cost optimization expert. Return only valid JSON arrays.' },
          { role: 'user', content: aiPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let recommendations: ProviderRecommendation[] = [];

    try {
      const content = aiData.choices[0].message.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse AI recommendations:', parseError);
    }

    console.log(`Found ${recommendations.length} provider recommendations`);

    // Store recommendations in database
    if (recommendations.length > 0) {
      // Find property IDs for recommendations
      for (const rec of recommendations) {
        const propertyData = Object.values(groupedData).find(
          g => g.property_name === rec.property_name && g.utility_type === rec.utility_type
        );
        if (propertyData) {
          (rec as any).property_id = propertyData.property_id;
          (rec as any).property_address = propertyData.property_address;
        }
      }

      // Store in utility_provider_recommendations table (create if needed)
      for (const rec of recommendations) {
        const monthlySavings = (rec as any).estimated_monthly_savings || rec.estimated_savings || 0;
        await supabase
          .from('utility_provider_recommendations')
          .upsert({
            property_id: (rec as any).property_id,
            utility_type: rec.utility_type,
            current_provider: rec.current_provider,
            current_avg_cost: rec.current_avg_cost,
            recommended_provider: rec.recommended_provider,
            estimated_savings: monthlySavings,
            savings_percentage: rec.savings_percentage,
            reason: rec.reason,
            created_at: new Date().toISOString(),
          }, {
            onConflict: 'property_id,utility_type',
          });
      }

      // Send email with recommendations
      const recsHtml = recommendations.map(rec => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; font-weight: 500;">${rec.property_name}</td>
          <td style="padding: 12px;">${rec.utility_type.toUpperCase()}</td>
          <td style="padding: 12px;">${rec.current_provider}</td>
          <td style="padding: 12px;">${rec.recommended_provider}</td>
          <td style="padding: 12px; color: #059669; font-weight: 600;">
            $${(rec as any).estimated_monthly_savings?.toFixed(2) || rec.estimated_savings?.toFixed(2)}/mo
            <br><span style="font-size: 12px; color: #6b7280;">(${rec.savings_percentage}% savings)</span>
          </td>
          <td style="padding: 12px; font-size: 13px; color: #6b7280;">${rec.reason}</td>
        </tr>
      `).join('');

      const totalAnnualSavings = recommendations.reduce(
        (sum, rec) => sum + ((rec as any).estimated_monthly_savings || rec.estimated_savings || 0) * 12, 
        0
      );

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
            .container { max-width: 900px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { text-align: left; padding: 12px; background: #f9fafb; font-weight: 600; font-size: 13px; }
            .savings-badge { background: #d1fae5; color: #047857; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">💡 Cheaper Utility Provider Found!</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.9;">${recommendations.length} cost-saving opportunity${recommendations.length > 1 ? 's' : ''} identified</p>
            </div>
            <div class="content">
              <div style="text-align: center; margin-bottom: 24px;">
                <span class="savings-badge">Potential Annual Savings: $${totalAnnualSavings.toFixed(2)}</span>
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Utility</th>
                    <th>Current</th>
                    <th>Recommended</th>
                    <th>Est. Savings</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  ${recsHtml}
                </tbody>
              </table>
              
              <div style="margin-top: 24px; padding: 16px; background: #f0fdf4; border-radius: 8px;">
                <h3 style="margin: 0 0 8px 0; color: #047857;">Next Steps</h3>
                <ul style="margin: 0; padding-left: 20px; color: #374151;">
                  <li>Review the recommendations in Property Central's Utilities dashboard</li>
                  <li>Contact recommended providers for exact quotes</li>
                  <li>Consider switching during low-usage months to minimize transition issues</li>
                </ul>
              </div>
              
              <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
                This analysis is based on current market rates and your historical usage. Actual savings may vary.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        await resend.emails.send({
          from: 'PeachHaus <notifications@peachhausgroup.com>',
          to: ['info@peachhausgroup.com'],
          subject: `💡 Cheaper Utility Provider Found - Save $${totalAnnualSavings.toFixed(0)}/year`,
          html: emailHtml,
        });
        console.log('Sent provider recommendations email');
      } catch (emailError) {
        console.error('Failed to send recommendations email:', emailError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      recommendationsFound: recommendations.length,
      recommendations,
      emailsSent: recommendations.length > 0 ? 1 : 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in utility-provider-recommendations:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
