import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      subject,
      body,
      senderEmail,
      emailDate,
      gmailMessageId,
      properties,
      owners,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Create context for AI
    const propertyList = properties
      .map((p: any) => `${p.name} (${p.address})`)
      .join(', ');
    const ownerList = owners
      .map((o: any) => `${o.name} (${o.email})`)
      .join(', ');

    const systemPrompt = `You are an AI assistant analyzing property management emails with advanced sentiment analysis and expense detection capabilities.

Properties: ${propertyList}
Owners: ${ownerList}

Analyze the email comprehensively and extract:

1. **Relevance**: Is this email relevant to any property or owner? (yes/no)
2. **Property Match**: Which property is it related to? (match by name or address)
3. **Owner Match**: Which owner is it related to? (match by email or name)
4. **Category**: maintenance, payment, booking, tenant_communication, legal, insurance, utilities, expense, order, or other
5. **Summary**: 2-3 sentence summary of the email content
6. **Sentiment**: Analyze the overall tone - positive, negative, neutral, urgent, or concerning
7. **Action Required**: Does this need follow-up? (yes/no)
8. **Suggested Actions**: List 1-3 specific actionable next steps (e.g., "Schedule repair appointment", "Reply to tenant by Friday", "Review invoice details")
9. **Priority**: low, normal, high, urgent
10. **Due Date**: If action required, when is it due? (YYYY-MM-DD or null)

11. **Expense Detection**: 
   - Is this an expense/order/purchase? (yes/no)
   - Look for: Amazon orders, receipts, invoices, purchase confirmations, subscriptions, utility bills
   - Extract amount if present (as number, no currency symbols)
   - Extract what the expense is for (brief description)

Return ONLY a JSON object with these exact fields:
{
  "isRelevant": boolean,
  "propertyName": string or null,
  "ownerEmail": string or null,
  "category": string,
  "summary": string,
  "sentiment": string,
  "actionRequired": boolean,
  "suggestedActions": string (comma-separated actions),
  "priority": string,
  "dueDate": string or null,
  "expenseDetected": boolean,
  "expenseAmount": number or null,
  "expenseDescription": string or null
}`;

    const userPrompt = `Email from: ${senderEmail}
Subject: ${subject}
Body: ${body}

Analyze this email.`;

    console.log('Calling Lovable AI for email analysis...');

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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Lovable AI error:', error);
      throw new Error('Failed to analyze email with AI');
    }

    const aiData = await response.json();
    const aiResponse = aiData.choices[0].message.content;

    console.log('AI response:', aiResponse);

    // Parse AI response
    let analysis;
    try {
      // Extract JSON from response (AI might wrap it in markdown)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in AI response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return new Response(
        JSON.stringify({ shouldSave: false, error: 'Failed to parse AI response' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only save if relevant
    if (!analysis.isRelevant) {
      console.log('Email not relevant to properties/owners, skipping...');
      return new Response(
        JSON.stringify({ shouldSave: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find property and owner IDs
    const property = properties.find(
      (p: any) => p.name === analysis.propertyName || p.address.includes(analysis.propertyName)
    );
    const owner = owners.find((o: any) => o.email === analysis.ownerEmail);

    if (!property && !owner) {
      console.log('Could not match to any property or owner, skipping...');
      return new Response(
        JSON.stringify({ shouldSave: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already processed
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: existing } = await supabase
      .from('email_insights')
      .select('id')
      .eq('gmail_message_id', gmailMessageId)
      .single();

    if (existing) {
      console.log('Email already processed, skipping...');
      return new Response(
        JSON.stringify({ shouldSave: false, reason: 'Already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save insight
    const { data: insertedInsight, error: insertError } = await supabase
      .from('email_insights')
      .insert({
        property_id: property?.id || null,
        owner_id: owner?.id || null,
        email_date: emailDate,
        sender_email: senderEmail,
        subject,
        summary: analysis.summary,
        category: analysis.category,
        sentiment: analysis.sentiment,
        action_required: analysis.actionRequired,
        suggested_actions: analysis.suggestedActions,
        priority: analysis.priority,
        due_date: analysis.dueDate,
        expense_detected: analysis.expenseDetected || false,
        expense_amount: analysis.expenseAmount || null,
        expense_description: analysis.expenseDescription || null,
        status: 'new',
        gmail_message_id: gmailMessageId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to save insight:', insertError);
      throw insertError;
    }

    console.log('Insight saved successfully');

    // If expense detected and we have a property, create an expense record
    if (analysis.expenseDetected && analysis.expenseAmount && property?.id) {
      console.log('Creating expense record from email...');
      
      const { data: userData } = await supabase
        .from('gmail_oauth_tokens')
        .select('user_id')
        .single();

      const { error: expenseError } = await supabase
        .from('expenses')
        .insert({
          property_id: property.id,
          amount: analysis.expenseAmount,
          date: new Date(emailDate).toISOString().split('T')[0],
          purpose: analysis.expenseDescription || `Email expense: ${subject}`,
          category: 'Email Import',
          user_id: userData?.user_id || null,
        });

      if (expenseError) {
        console.error('Failed to create expense:', expenseError);
      } else {
        // Mark expense as created
        await supabase
          .from('email_insights')
          .update({ expense_created: true })
          .eq('id', insertedInsight.id);
        
        console.log('Expense record created successfully');
      }
    }

    return new Response(
      JSON.stringify({ shouldSave: true, analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in extract-insights:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage, shouldSave: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
