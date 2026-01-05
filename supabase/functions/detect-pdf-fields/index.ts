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
  lineIndex: number;
}

interface DetectedField {
  api_id: string;
  label: string;
  type: "text" | "date" | "email" | "phone" | "signature" | "checkbox";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  filled_by: "admin" | "guest";
  required: boolean;
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
    const { textPositions, templateId, totalPages } = await req.json();

    if (!textPositions || !Array.isArray(textPositions)) {
      return new Response(
        JSON.stringify({ error: "Text positions are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing ${textPositions.length} text items across ${totalPages} pages`);

    // Format text lines with clear structure - group by page and sort by y
    const linesByPage: Record<number, TextPosition[]> = {};
    
    for (const item of textPositions as TextPosition[]) {
      if (!linesByPage[item.page]) {
        linesByPage[item.page] = [];
      }
      linesByPage[item.page].push(item);
    }

    // Create structured document view for AI - one line per entry with clear coordinates
    const documentLines: string[] = [];
    
    for (const [pageStr, lines] of Object.entries(linesByPage)) {
      const page = parseInt(pageStr);
      const sortedLines = lines.sort((a, b) => a.y - b.y);
      
      documentLines.push(`\n=== PAGE ${page} ===`);
      
      for (const line of sortedLines) {
        // Include the text and its EXACT y position
        documentLines.push(`LINE y=${line.y.toFixed(1)}% x=${line.x.toFixed(1)}%: "${line.text}"`);
      }
    }

    const documentContent = documentLines.join('\n');

    const prompt = `You are analyzing a legal document to detect where form fields should be placed. 

DOCUMENT CONTENT (each line shows its y% position from top):
${documentContent}

TASK: Find FILLABLE FIELDS where users need to enter information.

FIELD DETECTION RULES:
1. Look for labels followed by underlines/blanks: "Owner(s): ___", "Address: ___", "Phone: ___"
2. Look for signature blocks: lines with "OWNER:", "MANAGER:", "HOST:" 
3. Each label is on its OWN LINE with a UNIQUE y position

CRITICAL POSITIONING RULES:
- Use the EXACT y% value from the LINE where the label appears
- x position: Start the input AFTER the label. If label is short (like "Phone:"), start at x=20%. If label is long, start further right.
- Each field must have a DIFFERENT y position matching its source line
- Don't stack multiple fields at the same y position

FIELD TYPES:
- "text": Name, address, general text
- "email": Email fields
- "phone": Phone fields  
- "date": Date fields
- "signature": Signature areas (place below the label, height=6%)
- "checkbox": Checkbox items

FILLED_BY:
- "guest": Owner/Tenant fills these (owner_name, owner_address, owner_phone, owner_email, OWNER signature)
- "admin": Manager fills these (effective_date, property_address, MANAGER/HOST signature)

Respond with ONLY this JSON structure:
{
  "fields": [
    {
      "api_id": "owner_name",
      "label": "Owner(s)",
      "type": "text",
      "page": 1,
      "x": 22,
      "y": 32.5,
      "width": 55,
      "height": 2.5,
      "filled_by": "guest",
      "required": true
    },
    {
      "api_id": "owner_address",
      "label": "Address",
      "type": "text", 
      "page": 1,
      "x": 22,
      "y": 35.8,
      "width": 55,
      "height": 2.5,
      "filled_by": "guest",
      "required": true
    }
  ]
}

IMPORTANT: Each field's y value must match its label's LINE y value from the document. Do NOT use the same y for multiple fields.`;

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
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      throw new Error("AI analysis failed");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    console.log("AI response:", content.substring(0, 800));

    let detectedFields: DetectedField[] = [];

    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*"fields"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        detectedFields = parsed.fields || [];
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
    }

    // Validate and clean fields - ensure unique y positions
    const usedYPositions = new Map<string, number>(); // page-y -> count
    
    const validatedFields = detectedFields
      .filter((f: any) => f.api_id && f.page && typeof f.x === 'number' && typeof f.y === 'number')
      .map((field: any) => {
        const key = `${field.page}-${Math.round(field.y)}`;
        const count = usedYPositions.get(key) || 0;
        usedYPositions.set(key, count + 1);
        
        // If this y position is already used, offset slightly
        const yOffset = count * 3.5;
        
        return {
          api_id: String(field.api_id).replace(/[^a-z0-9_]/gi, '_').toLowerCase(),
          label: String(field.label || field.api_id),
          type: validateFieldType(field.type),
          page: Math.max(1, Math.min(totalPages || 20, Number(field.page))),
          x: Math.max(0, Math.min(95, Number(field.x))),
          y: Math.max(0, Math.min(95, Number(field.y) + yOffset)),
          width: Math.max(10, Math.min(70, Number(field.width) || 40)),
          height: field.type === 'signature' ? 6 : Math.max(2, Math.min(8, Number(field.height) || 2.5)),
          filled_by: field.filled_by === "admin" ? "admin" : "guest",
          required: field.required !== false,
        };
      });

    console.log(`Detected ${validatedFields.length} fields`);

    // Save to template if templateId provided
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

function validateFieldType(type: string): DetectedField["type"] {
  const validTypes = ["text", "date", "email", "phone", "signature", "checkbox"];
  return validTypes.includes(type) ? type as DetectedField["type"] : "text";
}
