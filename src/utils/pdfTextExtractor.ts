import * as pdfjs from 'pdfjs-dist';

// Set up worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

interface PageDimensions {
  width: number;
  height: number;
}

interface DetectedField {
  api_id: string;
  label: string;
  type: 'text' | 'date' | 'email' | 'phone' | 'signature' | 'checkbox';
  page: number;
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
  filled_by: 'admin' | 'guest';
  required: boolean;
}

// Field patterns to detect - these patterns indicate fillable areas
const FIELD_PATTERNS = [
  // Pattern: "Label: _____" or "Label _____" (underlines indicate blank to fill)
  { regex: /^(Owner\s*\(?s?\)?)\s*:?\s*_+/i, api_id: 'owner_name', type: 'text' as const, filled_by: 'guest' as const, label: 'Owner(s)' },
  { regex: /^(Residing\s+at|Address)\s*:?\s*_+/i, api_id: 'owner_address', type: 'text' as const, filled_by: 'guest' as const, label: 'Address' },
  { regex: /^Phone\s*:?\s*_+/i, api_id: 'owner_phone', type: 'phone' as const, filled_by: 'guest' as const, label: 'Phone' },
  { regex: /^Email\s*:?\s*_+/i, api_id: 'owner_email', type: 'email' as const, filled_by: 'guest' as const, label: 'Email' },
  { regex: /^(Property\s+Address)\s*:?\s*_+/i, api_id: 'property_address', type: 'text' as const, filled_by: 'admin' as const, label: 'Property Address' },
  { regex: /^(Effective\s+Date)\s*:?\s*_+/i, api_id: 'effective_date', type: 'date' as const, filled_by: 'admin' as const, label: 'Effective Date' },
  { regex: /^Date\s*:?\s*_+/i, api_id: 'date', type: 'date' as const, filled_by: 'guest' as const, label: 'Date' },
];

// Signature patterns
const SIGNATURE_PATTERNS = [
  { regex: /^(OWNER|Owner)\s*:?\s*$/i, api_id: 'owner_signature', filled_by: 'guest' as const, label: 'Owner Signature' },
  { regex: /^(MANAGER|Manager|HOST|Host)\s*:?\s*$/i, api_id: 'manager_signature', filled_by: 'admin' as const, label: 'Manager Signature' },
  { regex: /^(Signature|Sign\s+Here)\s*:?\s*$/i, api_id: 'signature', filled_by: 'guest' as const, label: 'Signature' },
];

// Labels that typically have blank lines after them
const FILLABLE_LABELS = [
  { label: 'Owner(s)', api_id: 'owner_name', type: 'text' as const, filled_by: 'guest' as const },
  { label: 'Address', api_id: 'owner_address', type: 'text' as const, filled_by: 'guest' as const },
  { label: 'Phone', api_id: 'owner_phone', type: 'phone' as const, filled_by: 'guest' as const },
  { label: 'Email', api_id: 'owner_email', type: 'email' as const, filled_by: 'guest' as const },
  { label: 'Property Address', api_id: 'property_address', type: 'text' as const, filled_by: 'admin' as const },
  { label: 'Effective Date', api_id: 'effective_date', type: 'date' as const, filled_by: 'admin' as const },
  { label: 'Print Name', api_id: 'print_name', type: 'text' as const, filled_by: 'guest' as const },
];

export interface TextPositionForAI {
  text: string;
  x: number; // percentage
  y: number; // percentage
  width: number;
  height: number;
  page: number;
  lineIndex: number;
}

export async function extractPdfTextWithPositions(pdfUrl: string): Promise<{
  textPositions: TextPositionForAI[];
  totalPages: number;
}> {
  const loadingTask = pdfjs.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;
  
  const textPositions: TextPositionForAI[] = [];
  let lineIndex = 0;
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    
    // Group items by y position to form lines
    const itemsByY: Map<number, any[]> = new Map();
    
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        const transform = item.transform;
        // Round y to nearest 5 to group items on same line
        const y = Math.round((viewport.height - transform[5]) / 5) * 5;
        
        if (!itemsByY.has(y)) {
          itemsByY.set(y, []);
        }
        itemsByY.get(y)!.push({
          text: item.str,
          x: transform[4],
          rawY: viewport.height - transform[5],
          width: item.width || 50,
          height: Math.sqrt(transform[2] * transform[2] + transform[3] * transform[3]) || 12,
        });
      }
    }
    
    // Sort lines by y position and create text positions
    const sortedYs = Array.from(itemsByY.keys()).sort((a, b) => a - b);
    
    for (const y of sortedYs) {
      const items = itemsByY.get(y)!.sort((a, b) => a.x - b.x);
      const lineText = items.map(it => it.text).join(' ');
      
      if (lineText.trim()) {
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        
        textPositions.push({
          text: lineText,
          x: (firstItem.x / viewport.width) * 100,
          y: (firstItem.rawY / viewport.height) * 100,
          width: ((lastItem.x + lastItem.width - firstItem.x) / viewport.width) * 100,
          height: (firstItem.height / viewport.height) * 100,
          page: pageNum,
          lineIndex: lineIndex++,
        });
      }
    }
  }
  
  return {
    textPositions,
    totalPages: pdf.numPages,
  };
}

export async function extractPdfTextPositions(pdfUrl: string): Promise<{
  textItems: TextItem[];
  pageDimensions: PageDimensions[];
  totalPages: number;
}> {
  const loadingTask = pdfjs.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;
  
  const textItems: TextItem[] = [];
  const pageDimensions: PageDimensions[] = [];
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    
    pageDimensions.push({
      width: viewport.width,
      height: viewport.height,
    });
    
    const textContent = await page.getTextContent();
    
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        // Transform contains: [scaleX, skewX, skewY, scaleY, translateX, translateY]
        const transform = item.transform;
        const x = transform[4];
        const y = viewport.height - transform[5]; // PDF coords are from bottom
        const height = Math.sqrt(transform[2] * transform[2] + transform[3] * transform[3]) || 12;
        
        textItems.push({
          text: item.str,
          x,
          y,
          width: item.width || 100,
          height,
          page: pageNum,
        });
      }
    }
  }
  
  return {
    textItems,
    pageDimensions,
    totalPages: pdf.numPages,
  };
}

export function detectFieldsFromText(
  textItems: TextItem[],
  pageDimensions: PageDimensions[]
): DetectedField[] {
  const fields: DetectedField[] = [];
  const usedApiIds = new Set<string>();
  
  // Sort text items by page, then by y position (top to bottom), then x (left to right)
  const sortedItems = [...textItems].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 5) return a.y - b.y;
    return a.x - b.x;
  });
  
  // Group items by line (items within 5px y distance)
  const lines: { items: TextItem[]; page: number; y: number }[] = [];
  let currentLine: TextItem[] = [];
  let currentY = -1;
  let currentPage = -1;
  
  for (const item of sortedItems) {
    if (currentPage !== item.page || Math.abs(item.y - currentY) > 5) {
      if (currentLine.length > 0) {
        lines.push({ items: currentLine, page: currentPage, y: currentY });
      }
      currentLine = [item];
      currentY = item.y;
      currentPage = item.page;
    } else {
      currentLine.push(item);
    }
  }
  if (currentLine.length > 0) {
    lines.push({ items: currentLine, page: currentPage, y: currentY });
  }
  
  // Process each line to find fillable fields
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineText = line.items.map(it => it.text).join(' ');
    const pageDim = pageDimensions[line.page - 1];
    
    if (!pageDim) continue;
    
    // Check for underline patterns (blank fields)
    const underlineMatch = lineText.match(/([A-Za-z\s()]+?)\s*:?\s*(_+)/);
    if (underlineMatch) {
      const label = underlineMatch[1].trim();
      const underlines = underlineMatch[2];
      
      // Find the label in our known patterns
      const pattern = FILLABLE_LABELS.find(p => 
        label.toLowerCase().includes(p.label.toLowerCase().split(' ')[0])
      );
      
      if (pattern && !usedApiIds.has(pattern.api_id)) {
        // Find position of the underlines (after the label)
        const lastItem = line.items[line.items.length - 1];
        const firstItem = line.items[0];
        
        // Calculate field position after the label
        const labelEndX = firstItem.x + (label.length / lineText.length) * (lastItem.x + lastItem.width - firstItem.x);
        
        const field: DetectedField = {
          api_id: pattern.api_id,
          label: pattern.label,
          type: pattern.type,
          page: line.page,
          x: (labelEndX / pageDim.width) * 100 + 2, // Start after label with padding
          y: (line.y / pageDim.height) * 100 - 0.5,
          width: Math.min(50, ((lastItem.x + lastItem.width - labelEndX) / pageDim.width) * 100 + 5),
          height: 3,
          filled_by: pattern.filled_by,
          required: true,
        };
        
        fields.push(field);
        usedApiIds.add(pattern.api_id);
      }
    }
    
    // Check for signature lines (usually just "OWNER:" or "MANAGER:" followed by blank line)
    for (const sigPattern of SIGNATURE_PATTERNS) {
      if (sigPattern.regex.test(lineText.trim()) && !usedApiIds.has(sigPattern.api_id)) {
        // Signature area - look for a long line below
        const field: DetectedField = {
          api_id: sigPattern.api_id,
          label: sigPattern.label,
          type: 'signature',
          page: line.page,
          x: (line.items[0].x / pageDim.width) * 100,
          y: (line.y / pageDim.height) * 100 + 3,
          width: 35,
          height: 8,
          filled_by: sigPattern.filled_by,
          required: true,
        };
        
        fields.push(field);
        usedApiIds.add(sigPattern.api_id);
        
        // Also add date and print name fields if this is a signature block
        if (!usedApiIds.has(`${sigPattern.api_id}_date`)) {
          fields.push({
            api_id: `${sigPattern.api_id}_date`,
            label: 'Date',
            type: 'date',
            page: line.page,
            x: (line.items[0].x / pageDim.width) * 100,
            y: (line.y / pageDim.height) * 100 + 14,
            width: 20,
            height: 3,
            filled_by: sigPattern.filled_by,
            required: true,
          });
          usedApiIds.add(`${sigPattern.api_id}_date`);
        }
      }
    }
    
    // Check for checkbox patterns (☐, □, or [ ])
    if (lineText.includes('☐') || lineText.includes('□') || /\[\s*\]/.test(lineText)) {
      const checkboxText = lineText.replace(/[☐□\[\]]/g, '').trim();
      const apiId = checkboxText.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30);
      
      if (apiId && !usedApiIds.has(apiId)) {
        fields.push({
          api_id: `checkbox_${apiId}`,
          label: checkboxText.substring(0, 50),
          type: 'checkbox',
          page: line.page,
          x: (line.items[0].x / pageDim.width) * 100,
          y: (line.y / pageDim.height) * 100 - 0.5,
          width: 4,
          height: 3,
          filled_by: 'admin',
          required: false,
        });
        usedApiIds.add(apiId);
      }
    }
  }
  
  return fields;
}

export async function extractFieldsFromPdf(pdfUrl: string): Promise<{
  fields: DetectedField[];
  totalPages: number;
}> {
  try {
    const { textItems, pageDimensions, totalPages } = await extractPdfTextPositions(pdfUrl);
    const fields = detectFieldsFromText(textItems, pageDimensions);
    
    return {
      fields,
      totalPages,
    };
  } catch (error) {
    console.error('Error extracting fields from PDF:', error);
    throw error;
  }
}
