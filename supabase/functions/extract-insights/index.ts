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
      rawHtml,
    } = await req.json();

    // PHASE 1: EMAIL FILTERING - Reject internal PeachHaus emails immediately
    const internalSenders = [
      'admin@peachhausgroup.com',
      'ingo@peachhausgroup.com',
      'anja@peachhausgroup.com',
    ];
    
    const isInternalSender = internalSenders.some(sender => 
      senderEmail.toLowerCase().includes(sender.toLowerCase())
    ) || senderEmail.toLowerCase().includes('@peachhausgroup.com');
    
    if (isInternalSender) {
      console.log('Skipping internal PeachHaus email from:', senderEmail);
      return new Response(
        JSON.stringify({ 
          shouldSave: false, 
          reason: 'Internal email filtered',
          sender: senderEmail 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // PHASE 1: SUBJECT LINE FILTERING - Skip system-generated emails
    const skipSubjects = [
      'team performance summary',
      'monthly owner statement',
      'property performance report',
      '[test]',
      'daily digest',
      'performance digest',
      'owner statement',
    ];
    
    const shouldSkipSubject = skipSubjects.some(skip => 
      subject.toLowerCase().includes(skip)
    );
    
    if (shouldSkipSubject) {
      console.log('Skipping system email with subject:', subject);
      return new Response(
        JSON.stringify({ 
          shouldSave: false, 
          reason: 'System email filtered',
          subject: subject 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Create context for AI
    const propertyList = properties
      .map((p: any) => `${p.name} (${p.address})`)
      .join(', ');
    const ownerList = owners
      .map((o: any) => `${o.name} (${o.email})`)
      .join(', ');

    const systemPrompt = `You are an AI assistant analyzing property management emails with advanced sentiment analysis and expense detection capabilities.

**CRITICAL VALIDATION RULES - REJECT EMAILS THAT:**
1. Mention "Multiple expenses logged" or "multiple properties" in description
2. Contain aggregated data from internal reports
3. Are from @peachhausgroup.com senders (should already be filtered)
4. Have no clear vendor or order information for expense claims

**CRITICAL: Search for EXACT FULL NAMES of owners anywhere in the email (subject or body):**
${ownerList}

**Properties and their addresses:**
${propertyList}

**MATCHING RULES - IF EITHER OWNER NAME OR PROPERTY ADDRESS IS FOUND, MARK AS RELEVANT:**

**Owner Matching (HIGHEST PRIORITY):**
1. Search the ENTIRE email text (subject + body + shipping addresses) for EXACT FULL owner names from the list above
2. Owner names must match EXACTLY as shown (case-insensitive but complete name)
3. Examples: "Canadian Way Owner - Michael Georgiades", "Shaletha Colbert", "Timberlake - John Hackney", "PeachHausGroup - Shaletha Colbert"
4. If found, set ownerEmail to that owner's email

**Property Matching (SECOND PRIORITY - ENHANCED FOR SHIPPING ADDRESSES):**
1. Search for property addresses ANYWHERE in the email, especially in shipping/delivery sections
2. CRITICAL: Addresses may appear with PREFIXES like "CompanyName - OwnerName - Address"
3. Look for STREET ADDRESS patterns like:
   - "14 Villa Ct" (even if it says "PeachHausGroup - Name - 14 Villa Ct")
   - "3708 Canadian Way" (even with any prefix)
   - Street number + street name combinations
4. Match addresses by extracting just the core street address (number + street name)
5. Examples of formats to catch:
   - "PeachHausGroup - Shaletha Colbert - 14 Villa Ct 1387 TYSONS COR"
   - "Shipped to: 3708 Canadian Way, Tucker, GA"
   - "14 Villa Ct SE, Smyrna, GA 30080"
6. If found, set propertyName AND deliveryAddress

**IF EITHER an owner name OR a property address is found, the email IS RELEVANT and should be processed**

   **CRITICAL INSTRUCTIONS FOR EXPENSE EXTRACTION:**
You MUST extract ALL details accurately. Missing fields cause problems.

**VALIDATION - REQUIRED FIELDS FOR EXPENSES:**
- orderNumber OR invoiceNumber is REQUIRED
- amount must be > 0
- vendor must be identified (e.g., "Amazon", "Home Depot", "Lowe's")
- description MUST NOT contain "multiple properties" or "multiple expenses logged"
- description MUST be specific to items purchased or service provided
- deliveryAddress should match ONE property only

**CRITICAL - BOOKING vs EXPENSE vs RETURN DISTINCTION:**
- Booking confirmations (Airbnb, VRBO, Booking.com, direct bookings) are INCOME, not expenses
- Set category to "booking" for reservation confirmations
- Set expenseDetected to FALSE for bookings/reservations/income
- **RETURN DETECTION - NEW CRITICAL FEATURE:**
  * Amazon return confirmations show "Return approved", "Refund issued", "Your refund"
  * Look for subject patterns: "Refund issued", "Return processed", "Your Amazon.com Refund"
  * Body contains: "refund", "return", "credit", "money back"
  * Set isReturn to TRUE and expenseDetected to TRUE for returns
  * Extract: originalOrderNumber, refundAmount, returnedItems (with prices), returnReason, returnDate
  * Common return reasons: "Damaged on arrival", "Wrong item received", "No longer needed", "Defective"
  * Returns are expenses with NEGATIVE amounts (we deduct from property costs)
- Only set expenseDetected to TRUE for actual expenses like:
  * Amazon orders for property supplies
  * Maintenance invoices
  * Utility bills
  * Insurance payments
  * Contractor services
  * Property improvements
  * **Returns/Refunds (new - these reduce expenses)**

Analyze the email comprehensively and extract:

1. **Relevance**: Is this email relevant to any property or owner? (yes/no)
2. **Property Match**: Which property is it related to? (match by address - extract street number + name)
3. **Owner Match**: Which owner is it related to? (match by email or name)
4. **Category**: maintenance, payment, booking, tenant_communication, legal, insurance, utilities, expense, order, or other
5. **Summary**: 2-3 sentence summary of the email content
6. **Sentiment**: Analyze the overall tone - positive, negative, neutral, urgent, or concerning
7. **Action Required**: Does this need follow-up? (yes/no)
8. **Suggested Actions**: List 1-3 specific actionable next steps
9. **Priority**: low, normal, high, urgent
10. **Due Date**: If action required, when is it due? (YYYY-MM-DD or null)

11. **EXPENSE DETECTION - READ EVERY WORD CAREFULLY**:
   
   **PHASE 2 ENHANCEMENT - FOR AMAZON EMAILS:**
   - Amazon emails have VERY specific patterns you MUST recognize
   - Look for "Order Confirmation" OR "Shipment Notification" OR "Your Amazon.com order" in subject
   - Subject patterns: "Your Amazon.com order of...", "Shipment notification", "Order Confirmation"
   - CRITICAL: Shipping addresses often have PREFIXES - extract the actual address!
     * Format: "CompanyName - OwnerName - StreetAddress City, State ZIP"
     * Example: "PeachHausGroup - Shaletha Colbert - 14 Villa Ct 1387 TYSONS COR MARIETTA, GA"
     * MUST extract: "14 Villa Ct" or full address "14 Villa Ct, Marietta, GA 30062"
   - Each order has:
     * Order number in format: ###-#######-####### (EXTRACT THIS - REQUIRED!)
     * Delivery estimate like "Tuesday, October 1" or "Monday, September 22" (CONVERT TO YYYY-MM-DD!)
     * Item list with individual prices in table format
     * Total price clearly stated
     * Delivery address (EXTRACT EVEN IF IT HAS PREFIX!)
   - REQUIRED for Amazon orders:
     * Must have order number (orderNumber field)
     * Must have vendor = "Amazon"
     * Must have deliveryAddress extracted
     * Must have lineItems array with item names and prices
   
   **STEP BY STEP EXTRACTION PROCESS:**
   
   Step 1: Find ALL order numbers
   - Search for patterns like "order #113-4868842-1944206"
   - Or in links: "amazon.com/your-orders/order-details?orderID=113-4868842-1944206"
   - Save the FIRST order number you find
   
   Step 2: Find delivery address - HANDLE PREFIXES!
   - Look for "Shipping address:" or "Deliver to:" or "Shipped to:"
   - Address may have company/owner prefix: "CompanyName - OwnerName - ActualAddress"
   - Extract the COMPLETE street address including:
     * Street number and name (e.g., "14 Villa Ct")
     * Full address with city, state, ZIP (e.g., "14 Villa Ct, Marietta, GA 30062")
   - Remove company/owner prefixes but keep the actual address
   - Format: "Street Address, City, State ZIP" (e.g., "14 Villa Ct, Marietta, GA 30062-2075")
   
    Step 3: Find ALL items and prices - EXTRACT STRUCTURED DATA
    - Look for item names followed by prices like "$339.99"
    - For EACH item, extract:
      * Item name (clean, no extra formatting)
      * Individual item price (numeric value)
    - Create a structured list of items with prices
    - Sum ALL prices across ALL orders in the email
    - CRITICAL: Return lineItems as array of objects: [{"name": "Item Name", "price": 12.99}]
   
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
    - orderNumber MUST be extracted if this is an Amazon order (REQUIRED)
    - deliveryAddress MUST be extracted if shipping address is mentioned (REQUIRED)
    - expenseAmount MUST be the SUM of all items (REQUIRED > 0)
    - orderDate MUST be in YYYY-MM-DD format (REQUIRED)
    - vendor MUST be identified (e.g., "Amazon", "Home Depot") (REQUIRED)
    - description MUST NOT contain "multiple properties" or vague summaries
    - description MUST be specific to items purchased
    
    **REJECT IF:**
    - Description mentions "Multiple expenses logged" or "multiple properties"
    - No order/invoice number can be extracted
    - Amount is 0 or negative (unless it's a return)
    - Vendor cannot be identified
    - Expense seems to aggregate data from multiple sources

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
  "deliveryAddress": string or null (REQUIRED if address in email),
  "lineItems": array of objects or null (e.g., [{"name": "Sugar In The Raw", "price": 5.99}, {"name": "Throw Pillows", "price": 15.99}])
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

    // Enhanced property and owner matching with full name checking
    let property: any = null;
    let owner: any = null;
    
    const emailContent = `${subject} ${body}`.toLowerCase();
    
    // STEP 1: Try to match owner by EXACT FULL NAME in email content
    for (const ownerData of owners) {
      const ownerNameLower = ownerData.name.toLowerCase();
      if (emailContent.includes(ownerNameLower)) {
        owner = ownerData;
        console.log(`Matched owner by full name in email: ${ownerData.name}`);
        break;
      }
    }
    
    // STEP 2: Try to match owner by email if not already matched
    if (!owner && analysis.ownerEmail) {
      owner = owners.find((o: any) => o.email.toLowerCase() === analysis.ownerEmail.toLowerCase());
      if (owner) {
        console.log(`Matched owner by email: ${owner.name}`);
      }
    }
    
    // STEP 3: Try to match property by delivery address (HIGHEST PRIORITY for properties)
    if (analysis.deliveryAddress) {
      // Extract core street address (number + street name) for flexible matching
      const extractStreetAddress = (addr: string) => {
        // Remove common prefixes like company/owner names
        const cleaned = addr.replace(/^[^0-9]*-\s*/g, '');
        // Extract street number and name (e.g., "14 Villa Ct" from "14 Villa Ct 1387 TYSONS COR")
        const match = cleaned.match(/^(\d+\s+[A-Za-z\s]+(?:St|Ave|Dr|Ct|Rd|Ln|Way|Blvd|Pl|Cir))/i);
        return match ? match[1].toLowerCase().trim() : cleaned.toLowerCase().replace(/[,.\s]+/g, '');
      };
      
      const deliveryStreet = extractStreetAddress(analysis.deliveryAddress);
      
      property = properties.find((p: any) => {
        const propStreet = extractStreetAddress(p.address);
        // Check if either contains the other (handles various formats)
        return deliveryStreet.includes(propStreet) || propStreet.includes(deliveryStreet);
      });
      
      if (property) {
        console.log(`Matched property by delivery address: ${property.name} (${property.address}) from "${analysis.deliveryAddress}"`);
      }
    }
    
    // STEP 4: Try to match property by name if not already matched
    if (!property && analysis.propertyName) {
      property = properties.find((p: any) => 
        p.name.toLowerCase() === analysis.propertyName.toLowerCase() ||
        p.address.toLowerCase().includes(analysis.propertyName.toLowerCase())
      );
      if (property) {
        console.log(`Matched property by name: ${property.name}`);
      }
    }
    
    // STEP 5: If we have an owner but no property, try to find their property
    if (owner && !property) {
      const ownerProperties = properties.filter((p: any) => p.owner_id === owner.id);
      if (ownerProperties.length === 1) {
        property = ownerProperties[0];
        console.log(`Matched single property from owner: ${property.name}`);
      } else if (ownerProperties.length > 1) {
        // Try to match by delivery address among owner's properties
        if (analysis.deliveryAddress) {
          property = ownerProperties.find((p: any) => {
            const deliveryLower = analysis.deliveryAddress.toLowerCase().replace(/[,.\s]/g, '');
            const propAddressLower = p.address.toLowerCase().replace(/[,.\s]/g, '');
            return deliveryLower.includes(propAddressLower) || propAddressLower.includes(deliveryLower);
          });
        }
        if (property) {
          console.log(`Matched property from owner's multiple properties: ${property.name}`);
        }
      }
    }
    
    // STEP 6: If we have a property but no owner, get the owner from the property
    if (property && !owner && property.owner_id) {
      owner = owners.find((o: any) => o.id === property.owner_id);
      if (owner) {
        console.log(`Matched owner from property: ${owner.name}`);
      }
    }

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
    // CRITICAL: Only create expenses for actual expense categories, NOT for bookings (which are income)
    const expenseCategories = ['expense', 'order', 'maintenance', 'utilities', 'insurance'];
    if (analysis.expenseDetected && 
        analysis.expenseAmount && 
        property?.id && 
        expenseCategories.includes(analysis.category)) {
      
      // NEW: Handle returns/refunds separately
      if (analysis.isReturn && analysis.originalOrderNumber && analysis.refundAmount) {
        console.log('Processing return/refund for order:', analysis.originalOrderNumber);
        
        // Find the original expense
        const { data: originalExpense, error: findError } = await supabase
          .from('expenses')
          .select('*')
          .eq('property_id', property.id)
          .eq('order_number', analysis.originalOrderNumber)
          .eq('is_return', false)
          .maybeSingle();
        
        if (!originalExpense) {
          console.log('Original expense not found for return, creating standalone return record');
        } else {
          console.log('Found original expense for return:', originalExpense.id);
        }
        
        const { data: userData } = await supabase
          .from('gmail_oauth_tokens')
          .select('user_id')
          .maybeSingle();
        
        // Save email content as HTML receipt
        let emailScreenshotPath = null;
        if (rawHtml || body) {
          try {
            const emailContent = rawHtml || `
              <html>
                <head>
                  <meta charset="utf-8">
                  <title>${subject}</title>
                  <style>
                    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                    .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                    .meta { color: #666; font-size: 14px; margin-bottom: 10px; }
                    .content { line-height: 1.6; }
                  </style>
                </head>
                <body>
                  <div class="header">
                    <h2>${subject}</h2>
                    <div class="meta">From: ${senderEmail}</div>
                    <div class="meta">Date: ${new Date(emailDate).toLocaleString()}</div>
                  </div>
                  <div class="content">
                    ${body.replace(/\n/g, '<br>')}
                  </div>
                </body>
              </html>
            `;
            
            const fileName = `return-receipt-${Date.now()}-${Math.random().toString(36).substring(7)}.html`;
            const filePath = `${property.id}/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
              .from('expense-documents')
              .upload(filePath, emailContent, {
                contentType: 'text/html',
                upsert: false
              });
            
            if (!uploadError) {
              emailScreenshotPath = filePath;
              console.log('Return receipt saved:', filePath);
            }
          } catch (uploadErr) {
            console.error('Error saving return receipt:', uploadErr);
          }
        }
        
        // Create return expense record with negative amount
        const returnLineItems = analysis.returnedItems && Array.isArray(analysis.returnedItems) && analysis.returnedItems.length > 0
          ? { items: analysis.returnedItems }
          : null;
        
        const { error: returnError } = await supabase
          .from('expenses')
          .insert({
            property_id: property.id,
            amount: -Math.abs(analysis.refundAmount), // Negative amount for return
            date: analysis.returnDate || new Date(emailDate).toISOString().split('T')[0],
            purpose: `Return/Refund: ${analysis.returnReason || 'Items returned'}`,
            category: 'return',
            order_number: analysis.originalOrderNumber,
            vendor: originalExpense?.vendor || analysis.vendor || 'Amazon',
            items_detail: analysis.returnReason || null,
            delivery_address: originalExpense?.delivery_address || analysis.deliveryAddress || null,
            line_items: returnLineItems,
            email_screenshot_path: emailScreenshotPath,
            email_insight_id: insertedInsight.id,
            user_id: userData?.user_id || null,
            is_return: true,
            parent_expense_id: originalExpense?.id || null,
            return_reason: analysis.returnReason || null,
            refund_amount: analysis.refundAmount,
          });
        
        if (returnError) {
          console.error('Failed to create return expense:', returnError);
        } else {
          await supabase
            .from('email_insights')
            .update({ expense_created: true })
            .eq('id', insertedInsight.id);
          
          console.log('Return expense created successfully');
        }
        
        return new Response(
          JSON.stringify({ shouldSave: true, analysis, isReturn: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Checking for duplicate expenses with order number:', analysis.orderNumber);
      
      // First check: If order_number exists, check if it's already logged
      if (analysis.orderNumber) {
        const { data: existingExpense } = await supabase
          .from('expenses')
          .select('id, order_number')
          .eq('property_id', property.id)
          .eq('order_number', analysis.orderNumber)
          .maybeSingle();

        if (existingExpense) {
          console.log('Duplicate order number found, skipping expense creation:', analysis.orderNumber);
          await supabase
            .from('email_insights')
            .update({ 
              expense_created: false,
              suggested_actions: (analysis.suggestedActions || '') + ` (Duplicate order ${analysis.orderNumber} - already logged)`
            })
            .eq('id', insertedInsight.id);
          
          return new Response(
            JSON.stringify({ shouldSave: true, analysis, duplicate: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      console.log('Creating expense record with full details...');
      
      const { data: userData } = await supabase
        .from('gmail_oauth_tokens')
        .select('user_id')
        .maybeSingle();

      // Save email content as HTML file for receipt viewing
      let emailScreenshotPath = null;
      if (rawHtml || body) {
        try {
          const emailContent = rawHtml || `
            <html>
              <head>
                <meta charset="utf-8">
                <title>${subject}</title>
                <style>
                  body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                  .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                  .meta { color: #666; font-size: 14px; margin-bottom: 10px; }
                  .content { line-height: 1.6; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h2>${subject}</h2>
                  <div class="meta">From: ${senderEmail}</div>
                  <div class="meta">Date: ${new Date(emailDate).toLocaleString()}</div>
                </div>
                <div class="content">
                  ${body.replace(/\n/g, '<br>')}
                </div>
              </body>
            </html>
          `;
          
          const fileName = `expense-receipt-${Date.now()}-${Math.random().toString(36).substring(7)}.html`;
          const filePath = `${property.id}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('expense-documents')
            .upload(filePath, emailContent, {
              contentType: 'text/html',
              upsert: false
            });
          
          if (!uploadError) {
            emailScreenshotPath = filePath;
            console.log('Email receipt saved:', filePath);
          } else {
            console.error('Failed to upload email receipt:', uploadError);
          }
        } catch (uploadErr) {
          console.error('Error saving email receipt:', uploadErr);
        }
      }

      // Prepare line items data
      const lineItemsData = analysis.lineItems && Array.isArray(analysis.lineItems) && analysis.lineItems.length > 0
        ? { items: analysis.lineItems }
        : null;

      // PHASE 6: SAFETY CONTROL - Validate expense before creating
      const hasSuspiciousDescription = analysis.expenseDescription && (
        analysis.expenseDescription.toLowerCase().includes('multiple expenses logged') ||
        analysis.expenseDescription.toLowerCase().includes('multiple properties') ||
        analysis.expenseDescription.toLowerCase().includes('logged for')
      );
      
      if (hasSuspiciousDescription) {
        console.log('REJECTED: Suspicious expense description detected:', analysis.expenseDescription);
        await supabase
          .from('email_insights')
          .update({ 
            expense_created: false,
            suggested_actions: (analysis.suggestedActions || '') + ' [REJECTED: Suspicious aggregated description]'
          })
          .eq('id', insertedInsight.id);
        
        return new Response(
          JSON.stringify({ 
            shouldSave: true, 
            analysis, 
            expenseRejected: true,
            reason: 'Suspicious aggregated description'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // PHASE 6: SAFETY CONTROL - All auto-created expenses start unverified
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
          line_items: lineItemsData,
          email_screenshot_path: emailScreenshotPath,
          email_insight_id: insertedInsight.id,
          user_id: userData?.user_id || null,
          exported: false, // PHASE 6: Start unverified/unexported for manual review
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
