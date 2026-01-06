import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TextPosition {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  lineIndex?: number;
}

interface FormField {
  fieldName: string;
  fieldType: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  groupName?: string;
  isRequired?: boolean;
}

interface DetectedField {
  api_id: string;
  label: string;
  type: "text" | "date" | "email" | "phone" | "signature" | "checkbox" | "radio";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  filled_by: "admin" | "guest";
  required: boolean;
  group_name?: string;
  label_offset?: number; // X offset from label end to where value should start
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { textPositions, formFields, templateId, totalPages, existingContractType, mergeWithExisting, existingFields } = await req.json();

    console.log(`Processing - templateId: ${templateId}, mergeWithExisting: ${mergeWithExisting}, existingFields: ${existingFields?.length || 0}`);

    // If we have AcroForm fields from getAnnotations(), use them directly
    if (formFields && Array.isArray(formFields) && formFields.length > 0) {
      console.log(`Using ${formFields.length} pre-extracted AcroForm fields`);
      
      let detectedFields = await mapFormFieldsToSemanticFields(
        formFields as FormField[],
        textPositions as TextPosition[],
        lovableApiKey,
        totalPages
      );
      
      // Merge with existing fields if requested
      if (mergeWithExisting && existingFields && Array.isArray(existingFields)) {
        const existingApiIds = new Set(existingFields.map((f: any) => f.api_id));
        const newFields = detectedFields.filter(f => !existingApiIds.has(f.api_id));
        detectedFields = [...existingFields, ...newFields];
        console.log(`Merged: ${existingFields.length} existing + ${newFields.length} new = ${detectedFields.length} total`);
      }
      
      // Save to template
      if (templateId && detectedFields.length > 0) {
        const { error: updateError } = await supabase
          .from("document_templates")
          .update({ field_mappings: detectedFields })
          .eq("id", templateId);
        
        if (updateError) {
          console.error("Error saving fields:", updateError);
        } else {
          console.log("Saved field mappings to template:", templateId);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          fields: detectedFields,
          totalPages: totalPages || 1,
          source: "acroform"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback to AI-based detection from text positions
    if (!textPositions || !Array.isArray(textPositions)) {
      return new Response(
        JSON.stringify({ error: "Text positions or form fields are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fallback: Analyzing ${textPositions.length} text items across ${totalPages} pages`);

    // Group text by page and y-position to find lines
    const linesByPage: Record<number, TextPosition[]> = {};
    for (const item of textPositions as TextPosition[]) {
      if (!linesByPage[item.page]) {
        linesByPage[item.page] = [];
      }
      linesByPage[item.page].push(item);
    }

    // Sort each page by y position
    for (const page in linesByPage) {
      linesByPage[page].sort((a, b) => a.y - b.y);
    }

    // Build structured document with labeled lines - chunk for large documents
    const documentLines: string[] = [];
    const MAX_PAGES_PER_CHUNK = 5;
    
    for (const [pageStr, lines] of Object.entries(linesByPage)) {
      const page = parseInt(pageStr);
      documentLines.push(`\n=== PAGE ${page} ===`);
      
      for (const line of lines) {
        documentLines.push(`[y=${line.y.toFixed(1)}% x=${line.x.toFixed(1)}%-${(line.x + line.width).toFixed(1)}%] "${line.text}"`);
      }
    }

    const documentContent = documentLines.join('\n');
    
    // Process in chunks for large documents
    const allFields: DetectedField[] = [];
    const chunks: string[] = [];
    const chunkSize = 12000;
    
    for (let i = 0; i < documentContent.length; i += chunkSize) {
      chunks.push(documentContent.substring(i, i + chunkSize));
    }
    
    console.log(`Processing ${chunks.length} chunk(s) of document content`);

    // Use tool calling for reliable JSON output
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          const prompt = `Analyze this legal document section and detect FILLABLE FORM FIELDS. Each line shows its EXACT position as [y=Y% x=startX%-endX%].

DOCUMENT SECTION (Part ${chunkIndex + 1}/${chunks.length}):
${chunk}

SIGNING PARTIES:
- "Owner" or "guest" = property owner who signs the document
- "Admin" = property manager/host who signs the document

FIELD DETECTION RULES:

1. TEXT FIELDS:
   - "Owner(s):" or "Owner Name:" → api_id: "owner_name", filled_by: "guest"
   - "Address:" (owner's address) → api_id: "owner_address", filled_by: "guest"
   - "Phone:" → api_id: "owner_phone", type: "phone", filled_by: "guest"
   - "Email:" → api_id: "owner_email", type: "email", filled_by: "guest"
   - "Property Address" → api_id: "property_address", filled_by: "guest"

2. DATE FIELDS:
   - "Effective Date:" → api_id: "effective_date", filled_by: "admin"
   - "Date:" near Owner signature → api_id: "owner_signature_date", filled_by: "guest"
   - "Date:" near Manager signature → api_id: "manager_signature_date", filled_by: "admin"

3. PACKAGE SELECTION (RADIO BUTTONS):
   - Lines with ☐ or □ followed by percentage (15%, 18%, 20%, 25%) are RADIO buttons
   - type: "radio", group_name: "package_selection", filled_by: "guest"

4. SIGNATURES:
   - "Owner Signature" → api_id: "owner_signature", filled_by: "guest"
   - "Second Owner" or "OWNER 2" → api_id: "second_owner_signature", filled_by: "guest"
   - "Manager" signature → api_id: "manager_signature", filled_by: "admin"

CRITICAL POSITIONING RULES:
- x: The X% where the FILLABLE AREA STARTS (not where the label starts)
- For "Name:_____", x should be AFTER the colon where the blank line starts
- For "Signature:________", x should be where the signature line begins
- Signatures and values must NOT overlap with label text
- y: Use exact y% from the line position`;

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "user", content: prompt }
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "extract_fields",
                    description: "Extract all detected fillable fields from the document",
                    parameters: {
                      type: "object",
                      properties: {
                        fields: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              api_id: { type: "string" },
                              label: { type: "string" },
                              type: { type: "string", enum: ["text", "date", "email", "phone", "signature", "checkbox", "radio"] },
                              page: { type: "number" },
                              x: { type: "number", description: "X position where the fillable area STARTS (after any label text)" },
                              y: { type: "number" },
                              width: { type: "number" },
                              height: { type: "number" },
                              filled_by: { type: "string", enum: ["admin", "guest"] },
                              required: { type: "boolean" },
                              group_name: { type: "string" },
                              label_offset: { type: "number", description: "Offset in % from label start to where value should be written" }
                            },
                            required: ["api_id", "label", "type", "page", "x", "y", "filled_by"]
                          }
                        },
                        signing_parties: {
                          type: "array",
                          items: { type: "string" }
                        }
                      },
                      required: ["fields"]
                    }
                  }
                }
              ],
              tool_choice: { type: "function", function: { name: "extract_fields" } },
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("AI API error:", response.status, errorText);
            
            if (response.status === 429) {
              console.log("Rate limited, waiting before retry...");
              await new Promise(resolve => setTimeout(resolve, 2000 * (retries + 1)));
              retries++;
              continue;
            }
            throw new Error("AI analysis failed");
          }

          const aiResponse = await response.json();
          
          // Extract from tool call
          const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall && toolCall.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            if (parsed.fields && Array.isArray(parsed.fields)) {
              for (const field of parsed.fields) {
                allFields.push({
                  api_id: String(field.api_id).replace(/[^a-z0-9_]/gi, '_').toLowerCase(),
                  label: String(field.label || field.api_id),
                  type: validateFieldType(field.type),
                  page: Math.max(1, Math.min(totalPages || 20, Number(field.page))),
                  x: Math.max(0, Math.min(95, Number(field.x))),
                  y: Math.max(0, Math.min(95, Number(field.y))),
                  width: Math.max(5, Math.min(60, Number(field.width) || 35)),
                  height: field.type === 'signature' 
                    ? Math.min(4, Number(field.height) || 4)
                    : Math.min(2.5, Number(field.height) || 2.5),
                  filled_by: field.filled_by === "admin" ? "admin" : "guest",
                  required: field.required !== false,
                  ...(field.group_name && { group_name: String(field.group_name) }),
                  ...(field.label_offset && { label_offset: Number(field.label_offset) }),
                });
              }
              console.log(`Extracted ${parsed.fields.length} fields from chunk ${chunkIndex + 1}`);
            }
          } else {
            // Fallback: try to parse content as JSON
            const content = aiResponse.choices?.[0]?.message?.content || "";
            try {
              const jsonMatch = content.match(/\{[\s\S]*"fields"[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                for (const field of (parsed.fields || [])) {
                  allFields.push({
                    api_id: String(field.api_id).replace(/[^a-z0-9_]/gi, '_').toLowerCase(),
                    label: String(field.label || field.api_id),
                    type: validateFieldType(field.type),
                    page: Math.max(1, Math.min(totalPages || 20, Number(field.page))),
                    x: Math.max(0, Math.min(95, Number(field.x))),
                    y: Math.max(0, Math.min(95, Number(field.y))),
                    width: Math.max(5, Math.min(60, Number(field.width) || 35)),
                    height: field.type === 'signature' 
                      ? Math.min(4, Number(field.height) || 4)
                      : Math.min(2.5, Number(field.height) || 2.5),
                    filled_by: field.filled_by === "admin" ? "admin" : "guest",
                    required: field.required !== false,
                    ...(field.group_name && { group_name: String(field.group_name) }),
                  });
                }
              }
            } catch (parseError) {
              console.error("Failed to parse AI response:", parseError);
            }
          }
          
          break; // Success, exit retry loop
        } catch (error) {
          console.error(`Error in chunk ${chunkIndex + 1}, attempt ${retries + 1}:`, error);
          retries++;
          if (retries >= maxRetries) {
            console.log("Max retries reached for chunk, continuing with next");
          }
        }
      }
    }

    // Deduplicate by api_id
    const uniqueFields = new Map<string, DetectedField>();
    for (const field of allFields) {
      if (!uniqueFields.has(field.api_id)) {
        uniqueFields.set(field.api_id, field);
      }
    }
    let validatedFields = Array.from(uniqueFields.values());

    // Merge with existing fields if requested
    if (mergeWithExisting && existingFields && Array.isArray(existingFields)) {
      const existingApiIds = new Set(existingFields.map((f: any) => f.api_id));
      const newFields = validatedFields.filter(f => !existingApiIds.has(f.api_id));
      validatedFields = [...existingFields, ...newFields];
      console.log(`Merged: ${existingFields.length} existing + ${newFields.length} new = ${validatedFields.length} total`);
    }

    console.log(`Final ${validatedFields.length} unique fields via AI`);

    // Save to template
    if (templateId && validatedFields.length > 0) {
      const { error: updateError } = await supabase
        .from("document_templates")
        .update({ field_mappings: validatedFields })
        .eq("id", templateId);
      
      if (updateError) {
        console.error("Error saving fields:", updateError);
      } else {
        console.log("Saved field mappings to template:", templateId);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        fields: validatedFields,
        totalPages: totalPages || 1,
        source: "ai"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error detecting PDF fields:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Map pre-extracted AcroForm fields to semantic field types using AI
 */
async function mapFormFieldsToSemanticFields(
  formFields: FormField[],
  textPositions: TextPosition[],
  apiKey: string,
  totalPages: number
): Promise<DetectedField[]> {
  // Build context about what text is near each field
  const fieldsWithContext = formFields.map(field => {
    // Find text items near this field
    const nearbyText = textPositions
      .filter(t => 
        t.page === field.page &&
        Math.abs(t.y - field.y) < 5 // Within 5% vertically
      )
      .sort((a, b) => {
        // Prefer text to the left of the field
        const aLeft = a.x < field.x;
        const bLeft = b.x < field.x;
        if (aLeft && !bLeft) return -1;
        if (!aLeft && bLeft) return 1;
        return Math.abs(a.y - field.y) - Math.abs(b.y - field.y);
      })
      .slice(0, 3)
      .map(t => t.text)
      .join(' ');

    return {
      ...field,
      nearbyText: nearbyText || 'unknown',
    };
  });

  const prompt = `Map these PDF form fields to semantic field types. Each field has its exact position and nearby text.

FIELDS:
${JSON.stringify(fieldsWithContext, null, 2)}

MAP EACH FIELD TO:
- api_id: semantic identifier (owner_name, owner_address, property_address, owner_phone, owner_email, effective_date, owner_signature, manager_signature, second_owner_signature, package_15, package_18, package_20, package_25)
- label: human readable label
- type: text, date, email, phone, signature, checkbox, or radio
- filled_by: "guest" (owner) or "admin" (manager)
- group_name: for radio buttons, use "package_selection"
- required: true/false

RULES:
- Property address is filled by "guest" (owner provides this)
- Package percentage options are radio buttons with group_name "package_selection"
- Use exact x, y, width, height from the input

Return JSON:
{
  "fields": [
    { "api_id": "...", "label": "...", "type": "...", "page": 1, "x": 10, "y": 20, "width": 40, "height": 3, "filled_by": "guest", "required": true }
  ]
}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    console.error("AI mapping failed, using direct conversion");
    // Fallback: directly convert fields without semantic mapping
    return formFields.map((f, i) => ({
      api_id: f.fieldName || `field_${i}`,
      label: f.fieldName || `Field ${i + 1}`,
      type: validateFieldType(f.fieldType),
      page: f.page,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      filled_by: "guest" as const,
      required: f.isRequired || false,
      ...(f.groupName && { group_name: f.groupName }),
    }));
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*"fields"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.fields || []).map((field: any) => ({
        api_id: String(field.api_id || 'unknown').replace(/[^a-z0-9_]/gi, '_').toLowerCase(),
        label: String(field.label || field.api_id),
        type: validateFieldType(field.type),
        page: Math.max(1, Math.min(totalPages, Number(field.page))),
        x: Number(field.x),
        y: Number(field.y),
        width: Number(field.width),
        height: Number(field.height),
        filled_by: field.filled_by === "admin" ? "admin" : "guest",
        required: field.required !== false,
        ...(field.group_name && { group_name: String(field.group_name) }),
      }));
    }
  } catch (e) {
    console.error("Failed to parse AI mapping:", e);
  }

  // Fallback
  return formFields.map((f, i) => ({
    api_id: f.fieldName || `field_${i}`,
    label: f.fieldName || `Field ${i + 1}`,
    type: validateFieldType(f.fieldType),
    page: f.page,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    filled_by: "guest" as const,
    required: f.isRequired || false,
    ...(f.groupName && { group_name: f.groupName }),
  }));
}

function validateFieldType(type: string): DetectedField["type"] {
  const validTypes = ["text", "date", "email", "phone", "signature", "checkbox", "radio"];
  return validTypes.includes(type) ? type as DetectedField["type"] : "text";
}
