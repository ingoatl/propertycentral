import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ AMAZON HTML PARSER - Direct extraction for validation ============

interface ParsedAmazonOrder {
  orderNumber: string | null;
  totalAmount: number | null;
  items: Array<{ name: string; price: number }>;
  deliveryAddress: string | null;
  orderDate: string | null;
  confidence: 'high' | 'medium' | 'low';
}

function parseAmazonEmailDirectly(subject: string, body: string, rawHtml: string | null): ParsedAmazonOrder | null {
  const content = rawHtml || body;
  
  // Check if this is an Amazon email
  const isAmazon = subject.toLowerCase().includes('amazon') || 
                   content.toLowerCase().includes('amazon.com');
  
  if (!isAmazon) return null;

  const result: ParsedAmazonOrder = {
    orderNumber: null,
    totalAmount: null,
    items: [],
    deliveryAddress: null,
    orderDate: null,
    confidence: 'low'
  };

  // Extract order number - multiple patterns
  const orderPatterns = [
    /order\s*#?\s*(\d{3}-\d{7}-\d{7})/gi,
    /orderID[=:]?\s*(\d{3}-\d{7}-\d{7})/gi,
    /(\d{3}-\d{7}-\d{7})/g,
  ];

  for (const pattern of orderPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      const numMatch = matches[0].match(/(\d{3}-\d{7}-\d{7})/);
      if (numMatch) {
        result.orderNumber = numMatch[1];
        break;
      }
    }
  }

  // Extract total amount - CRITICAL: look for Grand Total first
  const grandTotalMatch = content.match(/Grand\s*Total[:\s]*\$?\s*([\d,]+\.?\d*)/i);
  if (grandTotalMatch) {
    result.totalAmount = parseFloat(grandTotalMatch[1].replace(/,/g, ''));
  } else {
    // Fallback to other patterns
    const amountPatterns = [
      /Order\s*Total[:\s]*\$?([\d,]+\.?\d*)/gi,
      /Item.*Subtotal[:\s]*\$?([\d,]+\.?\d*)/gi,
    ];

    for (const pattern of amountPatterns) {
      const match = content.match(pattern);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (amount > 0 && amount < 10000) {
          result.totalAmount = amount;
          break;
        }
      }
    }
  }

  // Extract items with prices
  const itemMatches = [...content.matchAll(/(?:(\d+)\s*(?:of|x):?\s*)?([A-Za-z][^$\n]{5,100}?)\s*\$\s*([\d,]+\.?\d{2})/g)];
  for (const match of itemMatches) {
    const name = (match[2] || '').trim().replace(/\s+/g, ' ');
    const price = parseFloat((match[3] || '0').replace(/,/g, ''));
    
    if (price > 0 && price < 5000 && 
        !name.toLowerCase().includes('total') &&
        !name.toLowerCase().includes('shipping') &&
        !name.toLowerCase().includes('tax') &&
        !name.toLowerCase().includes('subtotal') &&
        !name.toLowerCase().includes('before')) {
      result.items.push({ name: name.substring(0, 100), price });
    }
  }

  // Calculate confidence
  let confidenceScore = 0;
  if (result.orderNumber) confidenceScore += 3;
  if (result.totalAmount) confidenceScore += 2;
  if (result.items.length > 0) confidenceScore += 1;

  if (confidenceScore >= 5) {
    result.confidence = 'high';
  } else if (confidenceScore >= 3) {
    result.confidence = 'medium';
  }

  console.log('Direct parse result:', JSON.stringify(result, null, 2));
  return result.orderNumber || result.totalAmount ? result : null;
}

function validateAndReconcile(
  aiAnalysis: any, 
  parsedData: ParsedAmazonOrder | null
): { amount: number | null; orderNumber: string | null; discrepancy: string | null; shouldFlag: boolean } {
  
  if (!parsedData) {
    return { 
      amount: aiAnalysis.expenseAmount, 
      orderNumber: aiAnalysis.orderNumber,
      discrepancy: null,
      shouldFlag: false
    };
  }

  let discrepancy: string | null = null;
  let shouldFlag = false;

  // Validate amount
  let finalAmount = aiAnalysis.expenseAmount;
  if (parsedData.totalAmount && aiAnalysis.expenseAmount) {
    const diff = Math.abs(parsedData.totalAmount - aiAnalysis.expenseAmount);
    const percentDiff = diff / Math.max(parsedData.totalAmount, aiAnalysis.expenseAmount);
    
    if (percentDiff > 0.05) { // More than 5% difference
      discrepancy = `Amount mismatch: AI=$${aiAnalysis.expenseAmount?.toFixed(2)}, Parsed=$${parsedData.totalAmount.toFixed(2)}`;
      finalAmount = parsedData.totalAmount; // Trust parsed data
      shouldFlag = true;
      console.warn('WATCHDOG: Amount discrepancy detected!', discrepancy);
    }
  } else if (parsedData.totalAmount && !aiAnalysis.expenseAmount) {
    finalAmount = parsedData.totalAmount;
    discrepancy = 'AI missed amount, using parsed';
    shouldFlag = true;
  }

  // Validate order number
  let finalOrderNumber = aiAnalysis.orderNumber;
  if (parsedData.orderNumber && !aiAnalysis.orderNumber) {
    finalOrderNumber = parsedData.orderNumber;
    discrepancy = (discrepancy ? discrepancy + '; ' : '') + 'AI missed order number';
    shouldFlag = true;
  } else if (parsedData.orderNumber && aiAnalysis.orderNumber) {
    const normalizedParsed = parsedData.orderNumber.replace(/\D/g, '');
    const normalizedAI = aiAnalysis.orderNumber.replace(/\D/g, '');
    
    if (normalizedParsed !== normalizedAI) {
      discrepancy = (discrepancy ? discrepancy + '; ' : '') + 
        `Order # mismatch: AI=${aiAnalysis.orderNumber}, Parsed=${parsedData.orderNumber}`;
      finalOrderNumber = parsedData.orderNumber; // Trust parsed
      shouldFlag = true;
    }
  }

  return { amount: finalAmount, orderNumber: finalOrderNumber, discrepancy, shouldFlag };
}

// ============ END PARSER ============

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
      properties = [],
      owners = [],
      rawHtml,
    } = await req.json();

    // Validate required fields
    const safeSenderEmail = senderEmail || '';
    const safeSubject = subject || '';
    const safeBody = body || '';

    // PHASE 1: EMAIL FILTERING - Reject internal PeachHaus emails immediately
    const internalSenders = [
      'admin@peachhausgroup.com',
      'ingo@peachhausgroup.com',
      'anja@peachhausgroup.com',
    ];
    
    const isInternalSender = safeSenderEmail && internalSenders.some(sender => 
      safeSenderEmail.toLowerCase().includes(sender.toLowerCase())
    ) || safeSenderEmail.toLowerCase().includes('@peachhausgroup.com');
    
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
    
    const shouldSkipSubject = safeSubject && skipSubjects.some(skip => 
      safeSubject.toLowerCase().includes(skip)
    );
    
    if (shouldSkipSubject) {
      console.log('Skipping system email with subject:', safeSubject);
      return new Response(
        JSON.stringify({ 
          shouldSave: false, 
          reason: 'System email filtered',
          subject: safeSubject 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 1.5: PROMOTIONAL/NEWSLETTER DETECTION - Classify but don't skip
    const promotionalKeywords = [
      'unsubscribe', 'newsletter', 'promotional', 'marketing',
      'special offer', 'discount', 'limited time', 'sale ends',
      'click here to unsubscribe', 'email preferences', 'opt out',
      'weekly update', 'monthly digest', 'bulletin', 'digest',
      'deals', 'exclusive offer', 'free shipping', 'promo code',
      'don\'t miss out', 'act now', 'save now', 'shop now',
    ];
    
    const automatedKeywords = [
      'no-reply', 'noreply', 'do-not-reply', 'donotreply',
      'automated message', 'auto-generated', 'system notification',
      'this is an automated', 'please do not reply to this email',
    ];
    
    const emailContentLower = `${safeSubject} ${safeBody}`.toLowerCase();
    const senderLower = safeSenderEmail.toLowerCase();
    
    const isPromotional = promotionalKeywords.some(kw => emailContentLower.includes(kw));
    const isAutomated = automatedKeywords.some(kw => emailContentLower.includes(kw) || senderLower.includes(kw));
    const isNewsletter = emailContentLower.includes('newsletter') || 
                         emailContentLower.includes('weekly update') ||
                         emailContentLower.includes('monthly digest');

    // Pre-detect promotional status to inform AI
    let preDetectedCategory = null;
    let preDetectedPriority = null;
    
    if (isPromotional || isNewsletter) {
      preDetectedCategory = isNewsletter ? 'newsletter' : 'promotional';
      preDetectedPriority = 'low';
      console.log(`Pre-detected ${preDetectedCategory} email:`, subject);
    } else if (isAutomated) {
      preDetectedCategory = 'automated';
      preDetectedPriority = 'low';
      console.log('Pre-detected automated email:', subject);
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    // Create context for AI - ensure arrays are safe
    const safeProperties = Array.isArray(properties) ? properties : [];
    const safeOwners = Array.isArray(owners) ? owners : [];
    
    const propertyList = safeProperties
      .map((p: any) => `${p.name} (${p.address})`)
      .join(', ') || 'None provided';
    const ownerList = safeOwners
      .map((o: any) => `${o.name} (${o.email})`)
      .join(', ') || 'None provided';

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
  "expenseDescription": string or null (CRITICAL: Must contain FULL ITEM NAMES - NEVER say "1 item from Amazon" - instead say "Clorox Toilet Plunger with Hideaway Holder" or "Ring Video Doorbell Wired" - list ALL items purchased with their full product names),
  "orderNumber": string or null (REQUIRED for Amazon),
  "orderDate": string or null (YYYY-MM-DD),
  "trackingNumber": string or null,
  "vendor": string or null,
  "deliveryAddress": string or null (REQUIRED if address in email),
  "lineItems": array of objects or null (e.g., [{"name": "Ring Video Doorbell Wired (newest model)", "price": 59.99}, {"name": "BOTHSTAR Keypad Door Knob with Key (2 Pack)", "price": 93.26}])
}`;

    const userPrompt = `Email from: ${senderEmail}
Subject: ${subject}
Body: ${body}

ANALYZE CAREFULLY - Extract ALL order details including order number and delivery address.`;

    console.log('Calling OpenAI API for email analysis...');

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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
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

    // Initialize Supabase client for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for duplicate email insight
    if (gmailMessageId) {
      const { data: existingInsight } = await supabase
        .from('email_insights')
        .select('id')
        .eq('gmail_message_id', gmailMessageId)
        .single();
      
      if (existingInsight) {
        console.log('Email insight already exists for gmail_message_id:', gmailMessageId);
        return new Response(
          JSON.stringify({ shouldSave: false, reason: 'Duplicate email' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== WATCHDOG: Direct HTML parsing for validation ==========
    const parsedData = parseAmazonEmailDirectly(subject, body, rawHtml);
    const validation = validateAndReconcile(analysis, parsedData);
    
    console.log('Watchdog validation result:', JSON.stringify(validation, null, 2));
    
    // Use validated/corrected values
    const validatedAmount = validation.amount || analysis.expenseAmount;
    const validatedOrderNumber = validation.orderNumber || analysis.orderNumber;
    
    // Create expense if detected and validated
    let expenseCreated = false;
    let expenseId = null;
    let watchdogFlagged = validation.shouldFlag;
    
    // Check for return/refund
    const isReturn = analysis.isReturn === true || 
      subject.toLowerCase().includes('refund') || 
      subject.toLowerCase().includes('return');
    
    if (analysis.expenseDetected && property) {
      // Validate expense data - don't create without order number for Amazon
      const isAmazon = analysis.vendor?.toLowerCase().includes('amazon');
      const hasValidOrderNumber = validatedOrderNumber && validatedOrderNumber.length > 5;
      const hasValidAmount = validatedAmount && validatedAmount > 0;
      const hasValidDescription = analysis.expenseDescription && 
        !analysis.expenseDescription.toLowerCase().includes('multiple properties') &&
        !analysis.expenseDescription.toLowerCase().includes('multiple expenses logged');
      
      // For returns, amount can be negative
      const isValidReturn = isReturn && validatedAmount;
      
      if ((isAmazon && !hasValidOrderNumber) || (!hasValidAmount && !isValidReturn) || !hasValidDescription) {
        console.log('Invalid expense data, skipping expense creation:', {
          isAmazon,
          hasValidOrderNumber,
          hasValidAmount,
          hasValidDescription,
          isReturn
        });
        watchdogFlagged = true; // Flag for manual review
      } else {
        // Check for duplicate expense by order number
        const orderToCheck = validatedOrderNumber;
        if (orderToCheck) {
          const { data: existingExpense } = await supabase
            .from('expenses')
            .select('id, amount')
            .eq('order_number', orderToCheck)
            .eq('property_id', property.id)
            .maybeSingle();
          
          if (existingExpense) {
            console.log('Expense already exists for order:', orderToCheck);
            
            // WATCHDOG: Check if existing expense has wrong amount
            if (validatedAmount && Math.abs(existingExpense.amount - validatedAmount) > 0.01) {
              console.warn('WATCHDOG: Existing expense has different amount!', 
                `Existing: ${existingExpense.amount}, Should be: ${validatedAmount}`);
              watchdogFlagged = true;
              
              // Create verification record
              await supabase
                .from('expense_verifications')
                .insert({
                  expense_id: existingExpense.id,
                  property_id: property.id,
                  order_number: orderToCheck,
                  extracted_amount: validatedAmount,
                  verified_amount: existingExpense.amount,
                  verification_status: 'flagged',
                  discrepancy_reason: validation.discrepancy || `Amount mismatch: expected $${validatedAmount}, found $${existingExpense.amount}`,
                  raw_email_data: { subject, parsedData, aiAnalysis: analysis }
                });
            }
          } else {
            // Build items_detail from lineItems for full item names
            const itemsDetailFromLineItems = analysis.lineItems 
              ? analysis.lineItems.map((item: any) => item.name).join(', ')
              : (parsedData?.items?.map(i => i.name).join(', ') || null);
            
            // Use items_detail as purpose for full item descriptions, fallback to AI description
            const expensePurpose = itemsDetailFromLineItems || analysis.expenseDescription;
            
            // Create the expense with VALIDATED values
            const expenseData: any = {
              property_id: property.id,
              amount: isReturn ? -Math.abs(validatedAmount) : validatedAmount,
              purpose: expensePurpose,
              date: analysis.orderDate || emailDate.split('T')[0],
              vendor: analysis.vendor,
              order_number: validatedOrderNumber,
              order_date: analysis.orderDate,
              tracking_number: analysis.trackingNumber,
              delivery_address: analysis.deliveryAddress,
              is_return: isReturn,
              line_items: analysis.lineItems || (parsedData?.items ? { items: parsedData.items } : null),
              items_detail: itemsDetailFromLineItems,
            };
            
            const { data: newExpense, error: expenseError } = await supabase
              .from('expenses')
              .insert(expenseData)
              .select()
              .single();
            
            if (expenseError) {
              console.error('Error creating expense:', expenseError);
              watchdogFlagged = true;
            } else {
              expenseCreated = true;
              expenseId = newExpense.id;
              console.log('Created expense:', newExpense.id, 'Amount:', expenseData.amount);
              
              // If watchdog found discrepancy, create verification record
              if (validation.shouldFlag && validation.discrepancy) {
                await supabase
                  .from('expense_verifications')
                  .insert({
                    expense_id: newExpense.id,
                    property_id: property.id,
                    order_number: validatedOrderNumber,
                    extracted_amount: validatedAmount,
                    verification_status: 'flagged',
                    discrepancy_reason: validation.discrepancy,
                    raw_email_data: { subject, parsedData, aiAnalysis: analysis }
                  });
              }
            }
          }
        } else {
          // No order number - still try to create but flag it
          console.warn('WATCHDOG: Creating expense without order number - flagging for review');
          watchdogFlagged = true;
          
          const expenseData: any = {
            property_id: property.id,
            amount: isReturn ? -Math.abs(validatedAmount) : validatedAmount,
            purpose: analysis.expenseDescription,
            date: analysis.orderDate || emailDate.split('T')[0],
            vendor: analysis.vendor,
            order_number: null,
            order_date: analysis.orderDate,
            is_return: isReturn,
          };
          
          const { data: newExpense, error: expenseError } = await supabase
            .from('expenses')
            .insert(expenseData)
            .select()
            .single();
          
          if (!expenseError && newExpense) {
            expenseCreated = true;
            expenseId = newExpense.id;
            
            // Flag for verification
            await supabase
              .from('expense_verifications')
              .insert({
                expense_id: newExpense.id,
                property_id: property.id,
                extracted_amount: validatedAmount,
                verification_status: 'pending',
                discrepancy_reason: 'No order number - needs manual verification',
                raw_email_data: { subject, parsedData, aiAnalysis: analysis }
              });
          }
        }
      }
    }

    // Apply promotional/newsletter override from pre-detection
    const finalCategory = preDetectedCategory || analysis.category;
    const finalPriority = preDetectedPriority || analysis.priority;
    
    // Log if we overrode the AI's classification
    if (preDetectedCategory && preDetectedCategory !== analysis.category) {
      console.log(`Overrode AI category from "${analysis.category}" to "${finalCategory}" (promotional detection)`);
    }
    if (preDetectedPriority && preDetectedPriority !== analysis.priority) {
      console.log(`Overrode AI priority from "${analysis.priority}" to "${finalPriority}" (promotional detection)`);
    }

    // Save email insight
    const insightData = {
      subject,
      sender_email: senderEmail,
      email_date: emailDate,
      gmail_message_id: gmailMessageId,
      property_id: property?.id || null,
      owner_id: owner?.id || null,
      category: finalCategory,
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      action_required: preDetectedCategory ? false : analysis.actionRequired, // No action for promotional
      suggested_actions: analysis.suggestedActions,
      priority: finalPriority,
      due_date: analysis.dueDate,
      status: 'new',
      expense_detected: analysis.expenseDetected,
      expense_amount: analysis.expenseAmount,
      expense_description: analysis.expenseDescription,
      expense_created: expenseCreated,
    };

    const { data: insight, error: insightError } = await supabase
      .from('email_insights')
      .insert(insightData)
      .select()
      .single();

    if (insightError) {
      console.error('Error saving email insight:', insightError);
      throw insightError;
    }

    // Update expense with email_insight_id if created
    if (expenseCreated && expenseId && insight) {
      await supabase
        .from('expenses')
        .update({ email_insight_id: insight.id })
        .eq('id', expenseId);
      
      // Trigger attachment extraction for original receipts (in background)
      if (gmailMessageId && property) {
        try {
          console.log('Triggering attachment extraction for expense:', expenseId);
          fetch(
            `${supabaseUrl}/functions/v1/extract-email-attachments`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                gmailMessageId,
                expenseId,
                propertyId: property.id
              })
            }
          ).catch(err => console.error('Background attachment extraction error:', err));
        } catch (attachErr) {
          console.error('Failed to trigger attachment extraction:', attachErr);
        }
      }
    }

    console.log('Saved email insight:', insight.id);

    // ========== OWNER EMAIL AUTO-ANALYSIS ==========
    // If this email is from a property owner and contains instructions/tasks,
    // automatically create an owner_conversation and analyze it for action items
    let ownerConversationCreated = false;
    let ownerConversationId = null;
    
    if (owner && property) {
      // Check if this email appears to contain owner instructions (not just an expense/receipt)
      const emailTextLower = `${subject} ${body}`.toLowerCase();
      const instructionIndicators = [
        'please', 'make sure', 'ensure', 'need to', 'should', 'must', 'dont forget',
        "don't forget", 'remember to', 'check', 'verify', 'set up', 'configure',
        'code is', 'password is', 'wifi', 'key is', 'lock', 'trash', 'garbage',
        'access', 'instructions', 'important', 'note that', 'fyi', 'heads up'
      ];
      
      const hasInstructions = instructionIndicators.some(ind => emailTextLower.includes(ind));
      const isJustReceipt = analysis.category === 'expense' && !hasInstructions;
      
      // Create owner conversation if this appears to have owner instructions
      if (hasInstructions && !isJustReceipt) {
        console.log('Owner email with instructions detected, creating owner_conversation...');
        
        // Check for existing conversation with same gmail_message_id
        const { data: existingConv } = await supabase
          .from('owner_conversations')
          .select('id')
          .eq('property_id', property.id)
          .eq('transcript', body.substring(0, 100)) // Check first 100 chars to avoid exact duplicates
          .maybeSingle();
        
        if (!existingConv) {
          // Get onboarding project for this property
          const { data: project } = await supabase
            .from('onboarding_projects')
            .select('id')
            .eq('property_id', property.id)
            .maybeSingle();
          
          // Create owner conversation record
          const { data: newConversation, error: convError } = await supabase
            .from('owner_conversations')
            .insert({
              property_id: property.id,
              project_id: project?.id || null,
              source: 'email',
              transcript: `From: ${senderEmail}\nSubject: ${subject}\n\n${body}`,
              status: 'pending',
              created_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (!convError && newConversation) {
            ownerConversationCreated = true;
            ownerConversationId = newConversation.id;
            console.log('Created owner_conversation:', newConversation.id);
            
            // Invoke analyze-owner-conversation to extract action items
            try {
              const analyzeResponse = await fetch(
                `${supabaseUrl}/functions/v1/analyze-owner-conversation`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({
                    conversationId: newConversation.id,
                    transcript: `From: ${senderEmail}\nSubject: ${subject}\n\n${body}`,
                    propertyContext: {
                      id: property.id,
                      name: property.name,
                      address: property.address
                    }
                  })
                }
              );
              
              if (analyzeResponse.ok) {
                const analyzeResult = await analyzeResponse.json();
                console.log('Owner conversation analyzed:', analyzeResult);
              } else {
                console.error('Failed to analyze owner conversation:', await analyzeResponse.text());
              }
            } catch (analyzeError) {
              console.error('Error invoking analyze-owner-conversation:', analyzeError);
            }
          } else {
            console.error('Failed to create owner_conversation:', convError);
          }
        } else {
          console.log('Owner conversation already exists for this email content');
        }
      }
    }

    // ========== AUTOMATIC TASK EXTRACTION ==========
    // Extract actionable tasks from email and create pending confirmations
    // Run in background using EdgeRuntime.waitUntil
    if (property && insight && analysis.isRelevant) {
      const extractTasksInBackground = async () => {
        try {
          console.log('Starting background task extraction for email insight:', insight.id);
          
          const taskResponse = await fetch(
            `${supabaseUrl}/functions/v1/extract-tasks-from-email`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                emailInsightId: insight.id,
                propertyId: property.id,
                ownerId: owner?.id || null,
                subject,
                summary: analysis.summary,
                body,
                suggestedActions: analysis.suggestedActions,
                senderEmail
              })
            }
          );
          
          if (taskResponse.ok) {
            const taskResult = await taskResponse.json();
            console.log('Task extraction completed:', taskResult);
          } else {
            console.error('Task extraction failed:', await taskResponse.text());
          }
        } catch (taskError) {
          console.error('Error in background task extraction:', taskError);
        }
      };
      
      // Use EdgeRuntime.waitUntil for background processing
      // @ts-ignore - EdgeRuntime is available in Deno edge functions
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(extractTasksInBackground());
      } else {
        // Fallback: fire and forget
        extractTasksInBackground();
      }
    }

    return new Response(
      JSON.stringify({ 
        shouldSave: true, 
        insight,
        expenseCreated,
        expenseId,
        ownerConversationCreated,
        ownerConversationId,
        analysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in extract-insights:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
