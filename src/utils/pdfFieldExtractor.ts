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
 * Using viewport.convertToViewportRectangle for accurate coordinate conversion
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
      const viewportWidth = viewport.width;
      const viewportHeight = viewport.height;
      
      // Extract annotations (form fields)
      const annotations = await page.getAnnotations();
      
      for (const annot of annotations) {
        // Widget annotations are form fields
        if (annot.subtype === 'Widget' && annot.rect) {
          hasAcroForm = true;
          
          // Use viewport.convertToViewportRectangle for accurate conversion
          // This handles the PDF coordinate system (origin bottom-left) to screen (origin top-left)
          const viewportRect = viewport.convertToViewportRectangle(annot.rect);
          
          // viewportRect returns [x1, y1, x2, y2] in viewport coordinates
          const screenX1 = Math.min(viewportRect[0], viewportRect[2]);
          const screenY1 = Math.min(viewportRect[1], viewportRect[3]);
          const screenX2 = Math.max(viewportRect[0], viewportRect[2]);
          const screenY2 = Math.max(viewportRect[1], viewportRect[3]);
          
          // Convert to percentages
          const xPercent = (screenX1 / viewportWidth) * 100;
          const yPercent = (screenY1 / viewportHeight) * 100;
          const widthPercent = ((screenX2 - screenX1) / viewportWidth) * 100;
          const heightPercent = ((screenY2 - screenY1) / viewportHeight) * 100;
          
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
            width: Math.max(1, Math.min(widthPercent, 80)),
            height: Math.max(0.5, Math.min(heightPercent, 20)),
            rect: annot.rect,
            value: annot.fieldValue || undefined,
            groupName,
            isRequired: annot.required || false,
          });
        }
      }
      
      // Also extract text content for fallback detection and context
      const textContent = await page.getTextContent();
      
      for (const item of textContent.items) {
        if ('str' in item && item.str.trim()) {
          const tx = item.transform;
          // Transform gives us [scaleX, skewY, skewX, scaleY, translateX, translateY]
          const pdfX = tx[4];
          const pdfY = tx[5];
          const itemWidth = item.width || 50;
          const itemHeight = item.height || 12;
          
          // Convert text position using viewport
          // Text y is at baseline, so adjust for height
          const textRect = [pdfX, pdfY, pdfX + itemWidth, pdfY + itemHeight];
          const viewportRect = viewport.convertToViewportRectangle(textRect);
          
          const screenX = Math.min(viewportRect[0], viewportRect[2]);
          const screenY = Math.min(viewportRect[1], viewportRect[3]);
          const screenWidth = Math.abs(viewportRect[2] - viewportRect[0]);
          const screenHeight = Math.abs(viewportRect[3] - viewportRect[1]);
          
          textPositions.push({
            text: item.str,
            x: (screenX / viewportWidth) * 100,
            y: (screenY / viewportHeight) * 100,
            width: (screenWidth / viewportWidth) * 100,
            height: (screenHeight / viewportHeight) * 100,
            page: pageNum,
          });
        }
      }
    }
    
    // If no AcroForm fields, use pattern detection
    if (!hasAcroForm && textPositions.length > 0) {
      const patternFields = detectFieldsFromPatterns(textPositions);
      formFields.push(...patternFields);
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
 * Detect fields from text patterns when no AcroForm exists
 * Looks for: underlines (___), checkboxes (☐□), labels with colons
 */
function detectFieldsFromPatterns(textPositions: TextPosition[]): ExtractedFormField[] {
  const fields: ExtractedFormField[] = [];
  
  // Group text by page
  const byPage = new Map<number, TextPosition[]>();
  for (const tp of textPositions) {
    if (!byPage.has(tp.page)) byPage.set(tp.page, []);
    byPage.get(tp.page)!.push(tp);
  }
  
  // Field label patterns
  const fieldPatterns = [
    { pattern: /owner\(?s?\)?:?\s*$/i, type: 'text' as const, apiId: 'owner_name' },
    { pattern: /owner.*name/i, type: 'text' as const, apiId: 'owner_name' },
    { pattern: /owner.*signature/i, type: 'signature' as const, apiId: 'owner_signature' },
    { pattern: /second.*owner.*name/i, type: 'text' as const, apiId: 'second_owner_name' },
    { pattern: /second.*owner.*signature/i, type: 'signature' as const, apiId: 'second_owner_signature' },
    { pattern: /property.*address/i, type: 'text' as const, apiId: 'property_address' },
    { pattern: /^address:?\s*$/i, type: 'text' as const, apiId: 'owner_address' },
    { pattern: /owner.*address/i, type: 'text' as const, apiId: 'owner_address' },
    { pattern: /effective.*date/i, type: 'date' as const, apiId: 'effective_date' },
    { pattern: /^date:?\s*$/i, type: 'date' as const, apiId: 'signature_date' },
    { pattern: /email:?\s*$/i, type: 'text' as const, apiId: 'owner_email' },
    { pattern: /phone:?\s*$/i, type: 'text' as const, apiId: 'owner_phone' },
  ];
  
  // Package selection patterns (percentages)
  const packagePatterns = [
    { pattern: /15\s*%/, apiId: 'package_15' },
    { pattern: /18\s*%/, apiId: 'package_18' },
    { pattern: /20\s*%/, apiId: 'package_20' },
    { pattern: /25\s*%/, apiId: 'package_25' },
  ];
  
  // Checkbox/radio markers
  const checkboxMarkers = /[☐□◯○◻▢]/;
  
  for (const [page, items] of byPage) {
    // Sort by Y then X for line grouping
    items.sort((a, b) => {
      const yDiff = a.y - b.y;
      return Math.abs(yDiff) < 1.5 ? a.x - b.x : yDiff;
    });
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Check for checkbox/radio markers
      if (checkboxMarkers.test(item.text)) {
        // Look for text to the right on the same line
        const nearbyText = items
          .filter(t => 
            Math.abs(t.y - item.y) < 2 && // Same line (within 2%)
            t.x > item.x && t.x < item.x + 60 // To the right, within 60%
          )
          .map(t => t.text)
          .join(' ');
        
        // Check if this is a package selection
        const packageMatch = packagePatterns.find(p => p.pattern.test(nearbyText));
        
        if (packageMatch) {
          fields.push({
            fieldName: packageMatch.apiId,
            fieldType: 'radio',
            page,
            x: item.x,
            y: item.y,
            width: 4,
            height: 3,
            groupName: 'package_selection',
            isRequired: true,
          });
        } else {
          fields.push({
            fieldName: `checkbox_${page}_${fields.length}`,
            fieldType: 'checkbox',
            page,
            x: item.x,
            y: item.y,
            width: 4,
            height: 3,
          });
        }
        continue;
      }
      
      // Check for underline patterns (field input areas)
      if (/_{4,}/.test(item.text)) {
        // This is an underline - look for label to the left
        const labelCandidate = items
          .filter(t => 
            Math.abs(t.y - item.y) < 2 && // Same line
            t.x < item.x && // To the left
            t.x > item.x - 30 // Within reasonable distance
          )
          .sort((a, b) => b.x - a.x)[0]; // Closest to underline
        
        if (labelCandidate) {
          const matchedPattern = fieldPatterns.find(p => p.pattern.test(labelCandidate.text));
          if (matchedPattern) {
            fields.push({
              fieldName: matchedPattern.apiId,
              fieldType: matchedPattern.type,
              page,
              x: item.x,
              y: item.y - 0.5, // Slightly above the underline
              width: item.width,
              height: matchedPattern.type === 'signature' ? 6 : 3,
            });
          }
        }
        continue;
      }
      
      // Check for label patterns (colon at end suggests input follows)
      const matchedPattern = fieldPatterns.find(p => p.pattern.test(item.text));
      if (matchedPattern) {
        // Look for underline or empty space after this label
        const underlineAfter = items.find(t => 
          Math.abs(t.y - item.y) < 2 &&
          t.x > item.x + item.width - 2 &&
          t.x < item.x + item.width + 50 &&
          /_{3,}/.test(t.text)
        );
        
        // Calculate field position (after the label)
        const fieldX = underlineAfter ? underlineAfter.x : item.x + item.width + 2;
        const fieldWidth = underlineAfter ? underlineAfter.width : 40;
        
        fields.push({
          fieldName: matchedPattern.apiId,
          fieldType: matchedPattern.type,
          page,
          x: Math.min(fieldX, 90),
          y: item.y,
          width: Math.min(fieldWidth, 50),
          height: matchedPattern.type === 'signature' ? 6 : 3,
        });
      }
    }
  }
  
  // Remove duplicates by api_id (keep first occurrence)
  const seen = new Set<string>();
  return fields.filter(f => {
    if (seen.has(f.fieldName)) return false;
    seen.add(f.fieldName);
    return true;
  });
}

/**
 * Detect underline patterns in text that indicate fillable areas
 * This is used as a fallback when no AcroForm fields are found
 */
export function detectUnderlinePatterns(textPositions: TextPosition[]): ExtractedFormField[] {
  return detectFieldsFromPatterns(textPositions);
}
