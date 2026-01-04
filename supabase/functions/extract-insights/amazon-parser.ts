// Amazon HTML Email Parser - Direct extraction without AI dependency
// This provides a fallback/verification for AI-extracted data

export interface ParsedAmazonOrder {
  orderNumber: string | null;
  totalAmount: number | null;
  items: Array<{ name: string; price: number; quantity: number }>;
  deliveryAddress: string | null;
  orderDate: string | null;
  deliveryDate: string | null;
  vendor: string;
  confidence: 'high' | 'medium' | 'low';
}

export function parseAmazonEmail(subject: string, body: string, rawHtml: string | null): ParsedAmazonOrder | null {
  const content = rawHtml || body;
  const subjectLower = subject.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Check if this is an Amazon email
  const isAmazon = subjectLower.includes('amazon') || 
                   contentLower.includes('amazon.com') ||
                   contentLower.includes('your order');
  
  if (!isAmazon) return null;

  // Skip shipping confirmations and delivery notifications (they don't have prices)
  const isShippingConfirmation = 
    subjectLower.includes('shipped') ||
    subjectLower.includes('shipping') ||
    subjectLower.includes('on the way') ||
    subjectLower.includes('out for delivery') ||
    subjectLower.includes('delivered') ||
    subjectLower.includes('arriving') ||
    subjectLower.includes('track your package') ||
    (contentLower.includes('your package') && !contentLower.includes('order total'));
  
  if (isShippingConfirmation) {
    console.log('Skipping shipping confirmation email:', subject);
    return null;
  }

  const result: ParsedAmazonOrder = {
    orderNumber: null,
    totalAmount: null,
    items: [],
    deliveryAddress: null,
    orderDate: null,
    deliveryDate: null,
    vendor: 'Amazon',
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
      // Extract just the number part
      const numMatch = matches[0].match(/(\d{3}-\d{7}-\d{7})/);
      if (numMatch) {
        result.orderNumber = numMatch[1];
        break;
      }
    }
  }

  // Extract total amount - look for Grand Total, Order Total, Total
  const amountPatterns = [
    /Grand\s*Total[:\s]*\$?([\d,]+\.?\d*)/gi,
    /Order\s*Total[:\s]*\$?([\d,]+\.?\d*)/gi,
    /Total[:\s]*\$?([\d,]+\.?\d*)/gi,
    /\$\s*([\d,]+\.\d{2})\s*(?:USD)?/g,
  ];

  const foundAmounts: number[] = [];
  for (const pattern of amountPatterns) {
    const matches = [...content.matchAll(pattern)];
    for (const match of matches) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0 && amount < 10000) { // Reasonable expense range
        foundAmounts.push(amount);
      }
    }
  }

  // Use the highest amount (likely the grand total)
  if (foundAmounts.length > 0) {
    result.totalAmount = Math.max(...foundAmounts);
  }

  // Extract individual items with prices
  const itemPatterns = [
    /(?:^|\n)([^$\n]{10,100})\s*\$\s*([\d,]+\.?\d*)/gm,
    /(\d+)\s*(?:of|x):\s*([^$\n]{10,100})\s*\$\s*([\d,]+\.?\d*)/gi,
  ];

  // Simple item extraction from common patterns
  const itemMatches = content.matchAll(/([A-Za-z][^$\n]{5,80}?)\s*\$\s*([\d,]+\.?\d{2})/g);
  for (const match of itemMatches) {
    const name = match[1].trim().replace(/\s+/g, ' ');
    const price = parseFloat(match[2].replace(/,/g, ''));
    
    // Filter out non-item matches
    if (price > 0 && price < 5000 && 
        !name.toLowerCase().includes('total') &&
        !name.toLowerCase().includes('shipping') &&
        !name.toLowerCase().includes('tax') &&
        !name.toLowerCase().includes('subtotal')) {
      result.items.push({ name, price, quantity: 1 });
    }
  }

  // Extract delivery address
  const addressPatterns = [
    /(?:Ship(?:ping)?\s*(?:to|address)|Deliver(?:y)?\s*(?:to|address))[:\s]*([^<\n]{20,150})/gi,
    /(\d+\s+[A-Za-z\s]+(?:St|Ave|Dr|Ct|Rd|Ln|Way|Blvd|Pl|Cir)[^<\n]{0,100})/gi,
  ];

  for (const pattern of addressPatterns) {
    const match = content.match(pattern);
    if (match) {
      // Clean up the address
      let address = match[1] || match[0];
      address = address.replace(/^[^0-9]*-\s*/g, ''); // Remove prefixes
      address = address.replace(/<[^>]*>/g, ''); // Remove HTML tags
      address = address.replace(/\s+/g, ' ').trim();
      
      if (address.length > 10 && address.length < 200) {
        result.deliveryAddress = address;
        break;
      }
    }
  }

  // Extract order date
  const datePatterns = [
    /Order\s*(?:placed|date)[:\s]*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/gi,
    /([A-Za-z]+\s+\d{1,2},?\s*\d{4})/g,
  ];

  for (const pattern of datePatterns) {
    const match = content.match(pattern);
    if (match) {
      try {
        const dateStr = match[1] || match[0];
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          result.orderDate = parsedDate.toISOString().split('T')[0];
          break;
        }
      } catch (e) {
        // Continue to next pattern
      }
    }
  }

  // Calculate confidence based on what we found
  let confidenceScore = 0;
  if (result.orderNumber) confidenceScore += 3;
  if (result.totalAmount) confidenceScore += 2;
  if (result.items.length > 0) confidenceScore += 1;
  if (result.deliveryAddress) confidenceScore += 1;
  if (result.orderDate) confidenceScore += 1;

  if (confidenceScore >= 6) {
    result.confidence = 'high';
  } else if (confidenceScore >= 4) {
    result.confidence = 'medium';
  }

  return result.orderNumber || result.totalAmount ? result : null;
}

export function validateExtractedAmount(
  aiAmount: number | null,
  parsedAmount: number | null,
  tolerance: number = 0.05 // 5% tolerance
): { isValid: boolean; recommendedAmount: number | null; discrepancy: string | null } {
  if (!aiAmount && !parsedAmount) {
    return { isValid: false, recommendedAmount: null, discrepancy: 'No amount found' };
  }
  
  if (!aiAmount && parsedAmount) {
    return { isValid: true, recommendedAmount: parsedAmount, discrepancy: 'AI missed amount, using parsed' };
  }
  
  if (aiAmount && !parsedAmount) {
    return { isValid: true, recommendedAmount: aiAmount, discrepancy: null };
  }
  
  // Both exist - compare them
  const difference = Math.abs(aiAmount! - parsedAmount!);
  const percentDiff = difference / Math.max(aiAmount!, parsedAmount!);
  
  if (percentDiff <= tolerance) {
    return { isValid: true, recommendedAmount: parsedAmount, discrepancy: null };
  }
  
  // Significant discrepancy - prefer parsed (direct from email)
  return { 
    isValid: false, 
    recommendedAmount: parsedAmount,
    discrepancy: `AI: $${aiAmount?.toFixed(2)}, Parsed: $${parsedAmount?.toFixed(2)} (${(percentDiff * 100).toFixed(1)}% diff)`
  };
}

export function validateOrderNumber(
  aiOrderNumber: string | null,
  parsedOrderNumber: string | null
): { isValid: boolean; recommendedOrderNumber: string | null; discrepancy: string | null } {
  if (!aiOrderNumber && !parsedOrderNumber) {
    return { isValid: false, recommendedOrderNumber: null, discrepancy: 'No order number found' };
  }
  
  if (!aiOrderNumber && parsedOrderNumber) {
    return { isValid: true, recommendedOrderNumber: parsedOrderNumber, discrepancy: 'AI missed order number' };
  }
  
  if (aiOrderNumber && !parsedOrderNumber) {
    return { isValid: true, recommendedOrderNumber: aiOrderNumber, discrepancy: null };
  }
  
  // Both exist - compare them (normalize first)
  const normalizedAI = aiOrderNumber!.replace(/\D/g, '');
  const normalizedParsed = parsedOrderNumber!.replace(/\D/g, '');
  
  if (normalizedAI === normalizedParsed) {
    return { isValid: true, recommendedOrderNumber: parsedOrderNumber, discrepancy: null };
  }
  
  // Different order numbers - flag for review
  return { 
    isValid: false, 
    recommendedOrderNumber: parsedOrderNumber,
    discrepancy: `AI: ${aiOrderNumber}, Parsed: ${parsedOrderNumber}`
  };
}
