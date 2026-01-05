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
  type: "text" | "date" | "email" | "phone" | "signature" | "checkbox" | "radio";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  filled_by: "admin" | "guest";
  required: boolean;
  group_name?: string;
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

    // Pre-process: find field labels and their exact positions
    const fieldLabels: Array<{
      label: string;
      page: number;
      labelX: number;
      labelY: number;
      labelWidth: number;
      lineText: string;
    }> = [];

    // Common field patterns to detect
    const fieldPatterns = [
      { pattern: /effective\s*date/i, type: "date", api_id: "effective_date", filled_by: "admin" },
      { pattern: /owner\(?s?\)?:/i, type: "text", api_id: "owner_name", filled_by: "guest" },
      { pattern: /^address:/i, type: "text", api_id: "owner_address", filled_by: "guest" },
      { pattern: /residing\s*at/i, type: "text", api_id: "owner_address", filled_by: "guest" },
      { pattern: /phone:/i, type: "phone", api_id: "owner_phone", filled_by: "guest" },
      { pattern: /email:/i, type: "email", api_id: "owner_email", filled_by: "guest" },
      { pattern: /property\s*address/i, type: "text", api_id: "property_address", filled_by: "admin" },
      { pattern: /☐.*15%|15%.*package|hybrid.*15%/i, type: "radio", api_id: "package_15", filled_by: "guest", group: "package_selection" },
      { pattern: /☐.*20%|20%.*package|full.*service.*20%/i, type: "radio", api_id: "package_20", filled_by: "guest", group: "package_selection" },
      { pattern: /☐.*25%|25%.*package|premium.*25%/i, type: "radio", api_id: "package_25", filled_by: "guest", group: "package_selection" },
      { pattern: /management\s*fee.*%/i, type: "radio", api_id: "management_fee", filled_by: "guest", group: "package_selection" },
    ];

    // Find signature blocks
    const signaturePatterns = [
      { pattern: /owner\s*signature|signature.*owner/i, api_id: "owner_signature", filled_by: "guest" },
      { pattern: /manager\s*signature|signature.*manager|host\s*signature/i, api_id: "manager_signature", filled_by: "admin" },
      { pattern: /second\s*owner|co-?owner/i, api_id: "second_owner_signature", filled_by: "guest" },
    ];

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

    // Build structured document with labeled lines
    const documentLines: string[] = [];
    const linePositions: Array<{page: number; y: number; text: string; x: number; endX: number}> = [];
    
    for (const [pageStr, lines] of Object.entries(linesByPage)) {
      const page = parseInt(pageStr);
      documentLines.push(`\n=== PAGE ${page} ===`);
      
      for (const line of lines) {
        const entry = {
          page,
          y: line.y,
          text: line.text,
          x: line.x,
          endX: line.x + line.width,
        };
        linePositions.push(entry);
        documentLines.push(`[y=${line.y.toFixed(1)}% x=${line.x.toFixed(1)}%-${(line.x + line.width).toFixed(1)}%] "${line.text}"`);
      }
    }

    const documentContent = documentLines.join('\n');

    // Use AI to analyze document and detect fields with precise positioning
    const prompt = `Analyze this legal document and detect FILLABLE FORM FIELDS. Each line shows its EXACT position as [y=Y% x=startX%-endX%].

DOCUMENT:
${documentContent}

RULES FOR FIELD DETECTION:
1. Find labels like "Owner(s):", "Address:", "Phone:", "Email:", "Effective Date:", "Property Address:"
2. For each label, the INPUT FIELD goes AFTER the label on the SAME LINE
3. The field's Y position must MATCH the label's y% value exactly
4. The field's X position starts AFTER where the label text ends (use endX% + 2%)
5. Field width should fill remaining space (usually 40-60%)

RADIO/CHECKBOX RULES:
- Lines with ☐ or □ followed by percentage (15%, 20%, 25%) are RADIO buttons for package selection
- All package options should have group_name: "package_selection"
- They are mutually exclusive (only one can be selected)

SIGNATURE RULES:
- "Owner Signature" or similar = signature field for guest
- "Manager Signature" or "Host Signature" = signature field for admin
- Signature fields should be BELOW the label text (y + 4%)
- Signature height should be 5-6%

FILLED_BY RULES:
- "guest": Owner fills these (owner name, address, phone, email, OWNER signature, package selection)
- "admin": Manager/Host fills these (effective_date, property_address, MANAGER signature)

REQUIRED:
- All text/date/email/phone fields with underlines are required
- Package selection (radio group) is required
- Signatures are required

Return ONLY valid JSON:
{
  "fields": [
    {
      "api_id": "owner_name",
      "label": "Owner(s)",
      "type": "text",
      "page": 1,
      "x": 25,
      "y": 18.5,
      "width": 50,
      "height": 2.5,
      "filled_by": "guest",
      "required": true
    },
    {
      "api_id": "package_15",
      "label": "Hybrid Package 15%",
      "type": "radio",
      "page": 1,
      "x": 10,
      "y": 45.2,
      "width": 5,
      "height": 2.5,
      "filled_by": "guest",
      "required": true,
      "group_name": "package_selection"
    }
  ]
}

KEY: Use the EXACT y% values from the document. Each field must have a UNIQUE y position matching where it appears in the document.`;

    console.log("Sending to AI for analysis...");

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
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("AI analysis failed");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    console.log("AI response received, parsing...");
    console.log("AI content preview:", content.substring(0, 500));

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
      .map((field: any) => {
        return {
          api_id: String(field.api_id).replace(/[^a-z0-9_]/gi, '_').toLowerCase(),
          label: String(field.label || field.api_id),
          type: validateFieldType(field.type),
          page: Math.max(1, Math.min(totalPages || 20, Number(field.page))),
          x: Math.max(0, Math.min(95, Number(field.x))),
          y: Math.max(0, Math.min(95, Number(field.y))),
          width: Math.max(5, Math.min(70, Number(field.width) || 40)),
          height: field.type === 'signature' ? 5 : Math.max(2, Math.min(8, Number(field.height) || 2.5)),
          filled_by: field.filled_by === "admin" ? "admin" : "guest",
          required: field.required !== false,
          ...(field.group_name && { group_name: String(field.group_name) }),
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
  const validTypes = ["text", "date", "email", "phone", "signature", "checkbox", "radio"];
  return validTypes.includes(type) ? type as DetectedField["type"] : "text";
}
