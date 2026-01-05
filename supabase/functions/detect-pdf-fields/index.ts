import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TextPosition {
  text: string;
  x: number; // percentage
  y: number; // percentage
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

    // Format text items for AI analysis - group by lines
    const linesByPage: Record<number, { text: string; x: number; y: number; lineText: string }[]> = {};
    
    for (const item of textPositions as TextPosition[]) {
      if (!linesByPage[item.page]) {
        linesByPage[item.page] = [];
      }
      linesByPage[item.page].push({
        text: item.text,
        x: item.x,
        y: item.y,
        lineText: item.text,
      });
    }

    // Create a summary of the document structure for AI
    const documentSummary = Object.entries(linesByPage)
      .map(([page, lines]) => {
        const sortedLines = lines.sort((a, b) => a.y - b.y);
        return `--- Page ${page} ---\n${sortedLines.map(l => 
          `[y:${l.y.toFixed(1)}%, x:${l.x.toFixed(1)}%] "${l.text}"`
        ).join('\n')}`;
      })
      .join('\n\n');

    const prompt = `Analyze this document to detect fillable fields. Text content with positions (x,y as % from top-left):

${documentSummary}

DETECT these field types:
1. Text fields: Labels like "Owner(s):", "Name:", "Address:" followed by underlines/blanks
2. Signature blocks: "OWNER:", "MANAGER:", "Signature:" labels
3. Date fields: "Date:" labels or near signatures
4. Email/Phone: Clearly labeled email or phone fields

POSITIONING RULES (CRITICAL):
- y position: Use the EXACT y% from the label's position  
- x position: Position the INPUT AREA after the label. If label is at x:5% and is ~15% wide, start field at x:20%
- width: Make text fields 40-50% wide, signatures 35% wide, dates 20% wide
- height: Text fields 3%, signatures 8%

FILLED_BY RULES:
- "guest": Owner/Tenant fields (owner_name, owner_address, owner_phone, owner_email, OWNER signatures)
- "admin": Manager/Company fields (effective_date, property_address, MANAGER/HOST signatures)

Return ONLY valid JSON:
{
  "fields": [
    {
      "api_id": "owner_name",
      "label": "Owner(s)",
      "type": "text",
      "page": 1,
      "x": 25,
      "y": 35.2,
      "width": 45,
      "height": 3,
      "filled_by": "guest",
      "required": true
    }
  ]
}

Use EXACT y values from the text. The x should be offset from label to show the input area.`;

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
    
    console.log("AI response:", content.substring(0, 500));

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

    // Validate and clean fields
    const validatedFields = detectedFields
      .filter((f: any) => f.api_id && f.page && typeof f.x === 'number' && typeof f.y === 'number')
      .map((field: any) => ({
        api_id: String(field.api_id).replace(/[^a-z0-9_]/gi, '_').toLowerCase(),
        label: String(field.label || field.api_id),
        type: validateFieldType(field.type),
        page: Math.max(1, Math.min(totalPages || 20, Number(field.page))),
        x: Math.max(0, Math.min(100, Number(field.x))),
        y: Math.max(0, Math.min(100, Number(field.y))),
        width: Math.max(5, Math.min(80, Number(field.width) || 30)),
        height: Math.max(2, Math.min(15, Number(field.height) || 3)),
        filled_by: field.filled_by === "admin" ? "admin" : "guest",
        required: field.required !== false,
      }));

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
