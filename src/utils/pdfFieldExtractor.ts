import * as pdfjs from 'pdfjs-dist';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export interface ExtractedFormField {
  fieldName: string;
  fieldType: 'text' | 'checkbox' | 'radio' | 'signature' | 'date';
  page: number;
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
  rect?: number[]; // original PDF coordinates [x1, y1, x2, y2]
  value?: string;
  options?: string[]; // for radio/select fields
  groupName?: string; // for radio button groups
  isRequired?: boolean;
}

export interface TextPosition {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface PdfExtractionResult {
  formFields: ExtractedFormField[];
  textPositions: TextPosition[];
  totalPages: number;
  hasAcroForm: boolean;
}

/**
 * Extract form fields (AcroForm/Widget annotations) and text from a PDF
 * This is the primary method - it extracts actual fillable fields with exact positions
 */
export async function extractPdfFormFields(pdfUrl: string): Promise<PdfExtractionResult> {
  try {
    const loadingTask = pdfjs.getDocument({
      url: pdfUrl,
      useSystemFonts: true,
    });
    
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    
    const formFields: ExtractedFormField[] = [];
    const textPositions: TextPosition[] = [];
    let hasAcroForm = false;
    
    // Process each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const pageWidth = viewport.width;
      const pageHeight = viewport.height;
      
      // Extract annotations (form fields)
      const annotations = await page.getAnnotations();
      
      for (const annot of annotations) {
        // Widget annotations are form fields
        if (annot.subtype === 'Widget' && annot.rect) {
          hasAcroForm = true;
          
          const [x1, y1, x2, y2] = annot.rect;
          
          // Convert PDF coordinates to percentages
          // PDF coordinates have origin at bottom-left, we need top-left
          const xPercent = (x1 / pageWidth) * 100;
          const yPercent = ((pageHeight - y2) / pageHeight) * 100; // Flip Y axis
          const widthPercent = ((x2 - x1) / pageWidth) * 100;
          const heightPercent = ((y2 - y1) / pageHeight) * 100;
          
          // Determine field type from annotation
          let fieldType: ExtractedFormField['fieldType'] = 'text';
          let groupName: string | undefined;
          
          if (annot.fieldType === 'Sig') {
            fieldType = 'signature';
          } else if (annot.fieldType === 'Btn') {
            if (annot.checkBox) {
              fieldType = 'checkbox';
            } else if (annot.radioButton) {
              fieldType = 'radio';
              // Radio buttons with same fieldName are in the same group
              groupName = annot.fieldName;
            }
          } else if (annot.fieldType === 'Tx') {
            // Text field - check if it might be a date based on name
            const name = (annot.fieldName || '').toLowerCase();
            if (name.includes('date') || name.includes('dob')) {
              fieldType = 'date';
            }
          }
          
          formFields.push({
            fieldName: annot.fieldName || `field_${pageNum}_${formFields.length}`,
            fieldType,
            page: pageNum,
            x: Math.max(0, Math.min(xPercent, 100)),
            y: Math.max(0, Math.min(yPercent, 100)),
            width: Math.max(1, Math.min(widthPercent, 50)),
            height: Math.max(0.5, Math.min(heightPercent, 20)),
            rect: annot.rect,
            value: annot.fieldValue || undefined,
            groupName,
            isRequired: annot.required || false,
          });
        }
      }
      
      // Also extract text content for fallback detection
      const textContent = await page.getTextContent();
      
      for (const item of textContent.items) {
        if ('str' in item && item.str.trim()) {
          const tx = item.transform;
          const x = tx[4];
          const y = tx[5];
          const width = item.width || 50;
          const height = item.height || 12;
          
          // Convert to percentages
          const xPercent = (x / pageWidth) * 100;
          const yPercent = ((pageHeight - y - height) / pageHeight) * 100;
          const widthPercent = (width / pageWidth) * 100;
          const heightPercent = (height / pageHeight) * 100;
          
          textPositions.push({
            text: item.str,
            x: xPercent,
            y: yPercent,
            width: widthPercent,
            height: heightPercent,
            page: pageNum,
          });
        }
      }
    }
    
    console.log(`PDF extraction: ${formFields.length} form fields, ${textPositions.length} text items, hasAcroForm: ${hasAcroForm}`);
    
    return {
      formFields,
      textPositions,
      totalPages,
      hasAcroForm,
    };
  } catch (error) {
    console.error('Error extracting PDF form fields:', error);
    throw error;
  }
}

/**
 * Detect underline patterns in text that indicate fillable areas
 * This is used as a fallback when no AcroForm fields are found
 */
export function detectUnderlinePatterns(textPositions: TextPosition[]): ExtractedFormField[] {
  const fields: ExtractedFormField[] = [];
  
  // Look for patterns like:
  // - Text followed by "______" or "___________"
  // - "☐" or "□" checkboxes
  // - Labels like "Name:", "Date:", "Signature:" near empty space
  
  const labelPatterns = [
    { pattern: /owner.*name/i, type: 'text' as const, apiId: 'owner_name' },
    { pattern: /owner.*signature/i, type: 'signature' as const, apiId: 'owner_signature' },
    { pattern: /second.*owner.*name/i, type: 'text' as const, apiId: 'second_owner_name' },
    { pattern: /second.*owner.*signature/i, type: 'signature' as const, apiId: 'second_owner_signature' },
    { pattern: /property.*address/i, type: 'text' as const, apiId: 'property_address' },
    { pattern: /owner.*address/i, type: 'text' as const, apiId: 'owner_address' },
    { pattern: /date/i, type: 'date' as const, apiId: 'date' },
    { pattern: /email/i, type: 'text' as const, apiId: 'owner_email' },
    { pattern: /phone/i, type: 'text' as const, apiId: 'owner_phone' },
  ];
  
  // Group text by page
  const byPage = new Map<number, TextPosition[]>();
  for (const tp of textPositions) {
    if (!byPage.has(tp.page)) byPage.set(tp.page, []);
    byPage.get(tp.page)!.push(tp);
  }
  
  // Look for checkbox patterns (☐, □, ◯)
  const checkboxPattern = /[☐□◯○]/;
  const packagePatterns = [
    /18\s*%/i,
    /20\s*%/i,
    /25\s*%/i,
    /tier\s*1/i,
    /tier\s*2/i,
    /tier\s*3/i,
    /basic/i,
    /standard/i,
    /premium/i,
  ];
  
  for (const [page, items] of byPage) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Check for checkbox markers
      if (checkboxPattern.test(item.text)) {
        // Look for nearby text to determine what this checkbox is for
        const nearbyText = items
          .filter(t => 
            Math.abs(t.y - item.y) < 3 && // Same line roughly
            t.x > item.x && t.x < item.x + 40 // To the right
          )
          .map(t => t.text)
          .join(' ');
        
        // Check if this is a package selection checkbox
        const isPackage = packagePatterns.some(p => p.test(nearbyText));
        
        fields.push({
          fieldName: isPackage ? `package_${fields.length}` : `checkbox_${fields.length}`,
          fieldType: isPackage ? 'radio' : 'checkbox',
          page,
          x: item.x,
          y: item.y,
          width: 3,
          height: 3,
          groupName: isPackage ? 'package_selection' : undefined,
        });
      }
      
      // Check for label patterns
      for (const { pattern, type, apiId } of labelPatterns) {
        if (pattern.test(item.text)) {
          // Look for underline or empty space after this label
          const underlineItem = items.find(t => 
            t.page === page &&
            Math.abs(t.y - item.y) < 2 &&
            t.x > item.x + item.width &&
            /_{3,}/.test(t.text)
          );
          
          if (underlineItem) {
            fields.push({
              fieldName: apiId,
              fieldType: type,
              page,
              x: underlineItem.x,
              y: underlineItem.y,
              width: underlineItem.width,
              height: type === 'signature' ? 8 : 4,
            });
          }
        }
      }
    }
  }
  
  return fields;
}
