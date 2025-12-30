import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PermitAnalysisRequest {
  documentId: string;
  propertyId: string;
  filePath: string;
  bucket?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { documentId, propertyId, filePath, bucket = "onboarding-documents" }: PermitAnalysisRequest = await req.json();

    console.log(`Analyzing permit for document ${documentId}, property ${propertyId}, bucket: ${bucket}`);

    // Download the permit file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError) {
      console.error("Error downloading file:", downloadError);
      throw new Error(`Failed to download permit file: ${downloadError.message}`);
    }

    // Convert file to base64 for Gemini
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binaryString);

    // Determine MIME type
    const ext = filePath.split('.').pop()?.toLowerCase();
    let mimeType = 'application/pdf';
    if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
    else if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'webp') mimeType = 'image/webp';

    // Use Lovable AI (Gemini) which supports PDFs natively
    const response = await fetch("https://ai.lovable.dev/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert at analyzing short-term rental permits and licenses. Extract all relevant information from the permit document. Return your response as a valid JSON object ONLY (no markdown, no explanation) with these fields:
- permit_number: The permit/license number
- expiration_date: The expiration date in YYYY-MM-DD format (CRITICAL: find this date)
- issue_date: The issue date in YYYY-MM-DD format if visible
- property_address: The property address on the permit
- permit_type: Type of permit (STR, vacation rental, etc.)
- jurisdiction: The issuing authority/city/county
- conditions: Any special conditions or requirements noted
- max_occupancy: Maximum occupancy if listed
- owner_name: Property owner name if listed

If you cannot find a field, set it to null. The expiration_date is the most important field to extract.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this short-term rental permit and extract all relevant information, especially the expiration date. Return ONLY a JSON object, no other text."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI API error:", errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices[0]?.message?.content;
    
    console.log("AI Analysis result:", content);

    // Parse the JSON response
    let extractedData;
    try {
      // Remove markdown code blocks if present
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      extractedData = { raw_response: content };
    }

    // Update the document with extracted data
    const updateData: Record<string, unknown> = {
      ai_extracted_data: extractedData,
      updated_at: new Date().toISOString(),
    };

    if (extractedData.expiration_date) {
      updateData.permit_expiration_date = extractedData.expiration_date;
    }

    const { error: updateError } = await supabase
      .from("property_documents")
      .update(updateData)
      .eq("id", documentId);

    if (updateError) {
      console.error("Error updating document:", updateError);
      throw updateError;
    }

    // If we have an expiration date, create a permit reminder
    if (extractedData.expiration_date) {
      const { data: property } = await supabase
        .from("properties")
        .select("name, address")
        .eq("id", propertyId)
        .single();

      const { error: reminderError } = await supabase
        .from("permit_reminders")
        .upsert({
          property_id: propertyId,
          document_id: documentId,
          permit_number: extractedData.permit_number,
          permit_expiration_date: extractedData.expiration_date,
          reminder_email_to: "info@peachhausgroup.com",
          status: "pending",
        }, {
          onConflict: "document_id",
        });

      if (reminderError) {
        console.error("Error creating reminder:", reminderError);
      }

      console.log(`Permit reminder set for ${extractedData.expiration_date} for property ${property?.name || propertyId}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        extractedData,
        message: extractedData.expiration_date 
          ? `Permit analyzed. Expiration date: ${extractedData.expiration_date}. Reminder will be sent 30 days before.`
          : "Permit analyzed but no expiration date found. Please enter manually.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in analyze-permit:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
