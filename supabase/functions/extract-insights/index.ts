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

CRITICAL INSTRUCTIONS FOR EXPENSE EXTRACTION:
You MUST extract ALL details accurately. Missing fields cause problems.

Analyze the email comprehensively and extract:

1. **Relevance**: Is this email relevant to any property or owner? (yes/no)
2. **Property Match**: Which property is it related to? (match by name or address in email body - look carefully!)
3. **Owner Match**: Which owner is it related to? (match by email or name)
4. **Category**: maintenance, payment, booking, tenant_communication, legal, insurance, utilities, expense, order, or other
5. **Summary**: 2-3 sentence summary of the email content
6. **Sentiment**: Analyze the overall tone - positive, negative, neutral, urgent, or concerning
7. **Action Required**: Does this need follow-up? (yes/no)
8. **Suggested Actions**: List 1-3 specific actionable next steps
9. **Priority**: low, normal, high, urgent
10. **Due Date**: If action required, when is it due? (YYYY-MM-DD or null)

11. **EXPENSE DETECTION - READ EVERY WORD CAREFULLY**: 
   
   **CRITICAL - FOR AMAZON EMAILS:**
   - Amazon emails have VERY specific patterns you MUST recognize
   - Look for "Order Confirmation" headers (can appear multiple times)
   - Each order has:
     * Order number in format: ###-#######-####### (EXTRACT THIS!)
     * Delivery estimate like "Tuesday, October 1" (CONVERT TO YYYY-MM-DD!)
     * Item list with individual prices
     * Delivery address (EXTRACT FULL ADDRESS!)
   
   **STEP BY STEP EXTRACTION PROCESS:**
   
   Step 1: Find ALL order numbers
   - Search for patterns like "order #113-4868842-1944206"
   - Or in links: "amazon.com/your-orders/order-details?orderID=113-4868842-1944206"
   - Save the FIRST order number you find
   
   Step 2: Find delivery address
   - Look for "Shipping address:" or "Deliver to:"
   - Extract the COMPLETE address including street, city, state, ZIP
   - Format: "123 Main St, City, State 12345"
   
   Step 3: Find ALL items and prices
   - Look for item names followed by prices like "$339.99"
   - Sum ALL prices across ALL orders in the email
   - List ALL items purchased
   
   Step 4: Find dates - CRITICAL YEAR DETECTION
   - Look for "Delivery estimate:" or "arriving:" or "Guaranteed delivery:"
   - IMPORTANT: The current year is 2025, NOT 2024
   - When you see dates like "Tuesday, October 1" or "October 7", assume year 2025 unless explicitly stated otherwise
   - If the email date is in 2025 and delivery date has no year, use 2025
   - Convert to YYYY-MM-DD format (e.g., "Tuesday, October 1" → "2025-10-01", "October 7" → "2025-10-07")
   - Use the EARLIEST date if multiple orders
   
   **FOR NON-AMAZON EXPENSES:**
   - Extract vendor name from sender or email body
   - Look for invoice numbers, PO numbers as order numbers
   - Extract total amount clearly stated
   - Find any address mentioned
   
   **VALIDATION:**
   - orderNumber MUST be extracted if this is an Amazon order
   - deliveryAddress MUST be extracted if shipping address is mentioned
   - expenseAmount MUST be the SUM of all items
   - orderDate MUST be in YYYY-MM-DD format

Return ONLY a JSON object:
{
  "isRelevant": boolean,
  "propertyName": string or null,
  "ownerEmail": string or null,
  "category": string,
  "summary": string,
  "sentiment": string,
  "actionRequired": boolean,
  "suggestedActions": string,
  "priority": string,
  "dueDate": string or null,
  "expenseDetected": boolean,
  "expenseAmount": number or null,
  "expenseDescription": string or null,
  "orderNumber": string or null (REQUIRED for Amazon),
  "orderDate": string or null (YYYY-MM-DD),
  "trackingNumber": string or null,
  "vendor": string or null,
  "deliveryAddress": string or null (REQUIRED if address in email)
}`;

    const userPrompt = `Email from: ${senderEmail}
Subject: ${subject}
Body: ${body}

ANALYZE CAREFULLY - Extract ALL order details including order number and delivery address.`;

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
        temperature: 0.1,
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if already processed
    const { data: existing } = await supabase
      .from('email_insights')
      .select('id')
      .eq('gmail_message_id', gmailMessageId)
      .maybeSingle();

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

    // If expense detected and we have a property, check for duplicates before creating
    if (analysis.expenseDetected && analysis.expenseAmount && property?.id) {
      console.log('Checking for duplicate expenses...');
      
      // Check if duplicate using the database function
      const { data: isDuplicate } = await supabase.rpc('is_duplicate_expense', {
        p_property_id: property.id,
        p_amount: analysis.expenseAmount,
        p_date: analysis.orderDate || new Date(emailDate).toISOString().split('T')[0],
        p_purpose: analysis.expenseDescription || subject,
        p_order_number: analysis.orderNumber
      });

      if (isDuplicate) {
        console.log('Duplicate expense detected, skipping creation...');
        await supabase
          .from('email_insights')
          .update({ 
            expense_created: false,
            suggested_actions: (analysis.suggestedActions || '') + ' (Duplicate expense detected - not created)'
          })
          .eq('id', insertedInsight.id);
      } else {
        console.log('Creating expense record with full details...');
        
        const { data: userData } = await supabase
          .from('gmail_oauth_tokens')
          .select('user_id')
          .maybeSingle();

        const { error: expenseError } = await supabase
          .from('expenses')
          .insert({
            property_id: property.id,
            amount: analysis.expenseAmount,
            date: analysis.orderDate || new Date(emailDate).toISOString().split('T')[0],
            purpose: analysis.expenseDescription || `Email expense: ${subject}`,
            category: analysis.category || 'order',
            order_number: analysis.orderNumber || null,
            order_date: analysis.orderDate || null,
            tracking_number: analysis.trackingNumber || null,
            vendor: analysis.vendor || null,
            items_detail: analysis.expenseDescription || null,
            delivery_address: analysis.deliveryAddress || null,
            user_id: userData?.user_id || null,
          });

        if (expenseError) {
          console.error('Failed to create expense:', expenseError);
        } else {
          await supabase
            .from('email_insights')
            .update({ expense_created: true })
            .eq('id', insertedInsight.id);
          
          console.log('Expense record created successfully with order details');
        }
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
