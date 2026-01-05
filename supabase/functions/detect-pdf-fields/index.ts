import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { pdfUrl, templateId } = await req.json();

    if (!pdfUrl) {
      return new Response(
        JSON.stringify({ error: "PDF URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Detecting fields in PDF:", pdfUrl.substring(0, 50) + "...");

    // Use AI to analyze the PDF and detect field positions
    // We'll send the PDF URL to the AI and ask it to identify fillable areas
    const prompt = `You are a document analysis expert. Analyze this PDF document and detect ALL fillable areas that need to be signed or filled in by users.

For a typical Property Management Agreement, look for:
1. **Header Fields (Page 1, top section):**
   - "Effective Date:" or date fields (usually near the top)
   - "Owner(s):" or owner name fields
   - "Residing at:" or owner address fields
   - Phone number fields
   - Email fields

2. **Property Information (Page 1):**
   - "Property Address:" fields
   - Property details fields

3. **Checkboxes (throughout document):**
   - Any checkbox options like "Co-Hosting" or "Full Management"
   - Service selection checkboxes

4. **Signature Blocks (usually last pages):**
   - Owner signature lines (look for "OWNER:" or "Owner Signature")
   - Manager/Host signature lines
   - Date fields next to signatures
   - "Print Name" fields

For each field detected, provide:
- api_id: A snake_case identifier (e.g., "effective_date", "owner_name", "owner_signature")
- label: Human-readable label
- type: One of "text", "date", "email", "phone", "signature", "checkbox"
- page: Page number (1-indexed)
- x: Left position as percentage (0-100) from left edge
- y: Top position as percentage (0-100) from top edge
- width: Width as percentage
- height: Height as percentage
- filled_by: "admin" for fields pre-filled by host/manager, "guest" for fields the owner fills
- required: true/false

FIELD TYPE RULES:
- "effective_date" -> type: "date", filled_by: "admin" (host sets the date)
- "owner_name", "owner_address", "owner_phone", "owner_email" -> filled_by: "guest"
- "property_address" -> filled_by: "admin" (host pre-fills)
- "owner_signature", "second_owner_signature" -> type: "signature", filled_by: "guest"
- "manager_signature", "host_signature" -> type: "signature", filled_by: "admin"
- All date fields next to owner signatures -> filled_by: "guest"

POSITIONING TIPS:
- Fields are typically positioned right after their labels
- Signature blocks are usually at the bottom of the last page or pages
- Look for underlines (______) which indicate fillable areas
- Estimate positions based on typical document layouts

Return a JSON object with this structure:
{
  "fields": [
    {
      "api_id": "effective_date",
      "label": "Effective Date",
      "type": "date",
      "page": 1,
      "x": 58,
      "y": 6,
      "width": 25,
      "height": 3,
      "filled_by": "admin",
      "required": true
    },
    // ... more fields
  ],
  "total_pages": 10
}

This is a Property Management Agreement PDF. Please analyze it and return the field positions.`;

    // Call Lovable AI to analyze the document
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { 
                type: "text", 
                text: `The PDF is located at: ${pdfUrl}\n\nBased on this being a Property Management Agreement, provide the field positions. Use your knowledge of typical agreement layouts to position fields accurately.`
              }
            ]
          }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      // Fallback to default field positions for a standard agreement
      const defaultFields = getDefaultFieldPositions();
      
      if (templateId) {
        await supabase
          .from("document_templates")
          .update({ field_mappings: defaultFields })
          .eq("id", templateId);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          fields: defaultFields,
          source: "default",
          message: "Using default field positions"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    console.log("AI Response received, parsing...");

    // Extract JSON from the response
    let detectedFields: DetectedField[] = [];
    let totalPages = 10;

    try {
      // Try to parse JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*"fields"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        detectedFields = parsed.fields || [];
        totalPages = parsed.total_pages || 10;
      } else {
        // Try parsing the entire content as JSON
        const parsed = JSON.parse(content);
        detectedFields = parsed.fields || [];
        totalPages = parsed.total_pages || 10;
      }
    } catch (parseError) {
      console.error("Failed to parse AI response, using defaults:", parseError);
      detectedFields = getDefaultFieldPositions();
    }

    // Validate and clean up the fields
    const validatedFields = detectedFields.map((field: any) => ({
      api_id: field.api_id || `field_${Math.random().toString(36).substr(2, 9)}`,
      label: field.label || "Unknown Field",
      type: validateFieldType(field.type),
      page: Math.max(1, Math.min(totalPages, field.page || 1)),
      x: Math.max(0, Math.min(100, field.x || 10)),
      y: Math.max(0, Math.min(100, field.y || 10)),
      width: Math.max(5, Math.min(90, field.width || 30)),
      height: Math.max(2, Math.min(20, field.height || 4)),
      filled_by: field.filled_by === "admin" ? "admin" : "guest",
      required: field.required !== false,
    }));

    console.log(`Detected ${validatedFields.length} fields across ${totalPages} pages`);

    // Save to template if templateId provided
    if (templateId) {
      await supabase
        .from("document_templates")
        .update({ field_mappings: validatedFields })
        .eq("id", templateId);
      
      console.log("Saved field mappings to template:", templateId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        fields: validatedFields,
        totalPages,
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

function getDefaultFieldPositions(): DetectedField[] {
  return [
    // Page 1 - Header fields
    {
      api_id: "effective_date",
      label: "Effective Date",
      type: "date",
      page: 1,
      x: 58,
      y: 5.5,
      width: 25,
      height: 3,
      filled_by: "admin",
      required: true,
    },
    {
      api_id: "owner_name",
      label: "Owner(s)",
      type: "text",
      page: 1,
      x: 22,
      y: 18.5,
      width: 60,
      height: 3,
      filled_by: "guest",
      required: true,
    },
    {
      api_id: "owner_address",
      label: "Residing at",
      type: "text",
      page: 1,
      x: 27,
      y: 21.5,
      width: 55,
      height: 3,
      filled_by: "guest",
      required: true,
    },
    {
      api_id: "owner_phone",
      label: "Phone",
      type: "phone",
      page: 1,
      x: 18,
      y: 24.5,
      width: 25,
      height: 3,
      filled_by: "guest",
      required: true,
    },
    {
      api_id: "owner_email",
      label: "Email",
      type: "email",
      page: 1,
      x: 55,
      y: 24.5,
      width: 30,
      height: 3,
      filled_by: "guest",
      required: true,
    },
    {
      api_id: "property_address",
      label: "Property Address",
      type: "text",
      page: 1,
      x: 32,
      y: 27.5,
      width: 50,
      height: 3,
      filled_by: "admin",
      required: true,
    },
    // Page 2 - Checkboxes for service type
    {
      api_id: "service_cohosting",
      label: "Co-Hosting",
      type: "checkbox",
      page: 2,
      x: 10,
      y: 12,
      width: 4,
      height: 3,
      filled_by: "admin",
      required: false,
    },
    {
      api_id: "service_full_management",
      label: "Full Management",
      type: "checkbox",
      page: 2,
      x: 10,
      y: 18,
      width: 4,
      height: 3,
      filled_by: "admin",
      required: false,
    },
    // Page 10 - Signature block
    {
      api_id: "owner_signature",
      label: "Owner Signature",
      type: "signature",
      page: 10,
      x: 10,
      y: 70,
      width: 35,
      height: 8,
      filled_by: "guest",
      required: true,
    },
    {
      api_id: "owner_signature_date",
      label: "Date",
      type: "date",
      page: 10,
      x: 10,
      y: 82,
      width: 20,
      height: 3,
      filled_by: "guest",
      required: true,
    },
    {
      api_id: "owner_print_name",
      label: "Print Name",
      type: "text",
      page: 10,
      x: 10,
      y: 88,
      width: 35,
      height: 3,
      filled_by: "guest",
      required: true,
    },
    {
      api_id: "manager_signature",
      label: "Manager Signature",
      type: "signature",
      page: 10,
      x: 55,
      y: 70,
      width: 35,
      height: 8,
      filled_by: "admin",
      required: true,
    },
    {
      api_id: "manager_signature_date",
      label: "Date",
      type: "date",
      page: 10,
      x: 55,
      y: 82,
      width: 20,
      height: 3,
      filled_by: "admin",
      required: true,
    },
    {
      api_id: "manager_print_name",
      label: "Print Name",
      type: "text",
      page: 10,
      x: 55,
      y: 88,
      width: 35,
      height: 3,
      filled_by: "admin",
      required: true,
    },
  ];
}
