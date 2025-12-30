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
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

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

    // Determine file type
    const ext = filePath.split('.').pop()?.toLowerCase();
    const isPDF = ext === 'pdf';

    let extractedData: any = {};
    
    if (isPDF) {
      // For PDFs, use OpenAI with text-based analysis
      // First, we'll try to get a signed URL and use GPT-4 for text analysis
      const { data: signedUrl } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 3600);

      if (!signedUrl?.signedUrl) {
        throw new Error("Failed to create signed URL for document");
      }

      // Use GPT-4 to analyze the document content description
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are analyzing a short-term rental permit document. The user will provide information about the document. Based on the document file name and any context, try to extract or infer:
- permit_number: The permit/license number (often in filename)
- expiration_date: The expiration date in YYYY-MM-DD format
- issue_date: The issue date in YYYY-MM-DD format
- property_address: The property address
- permit_type: Type of permit
- jurisdiction: The issuing authority

Look for dates in the filename like "10-24-2025" which might indicate the expiration or issue date.
Return ONLY a valid JSON object with these fields. Set to null if unknown.`
            },
            {
              role: "user",
              content: `Please analyze this permit document:
File name: ${filePath.split('/').pop()}
Document type: STR Permit / Business License
Property ID: ${propertyId}

Based on the filename and context, extract any permit information you can identify. Focus especially on finding any dates that might indicate expiration.`
            }
          ],
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", errorText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const aiResult = await response.json();
      const content = aiResult.choices[0]?.message?.content;
      
      console.log("AI Analysis result:", content);

      try {
        const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extractedData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        
        // Try to extract date from filename manually
        const filename = filePath.split('/').pop() || '';
        const dateMatch = filename.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/);
        if (dateMatch) {
          const parts = dateMatch[1].split(/[-\/]/);
          if (parts.length === 3) {
            const [month, day, year] = parts;
            extractedData.expiration_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        }
        
        // Extract permit number from filename
        const permitMatch = filename.match(/STR\d+/i);
        if (permitMatch) {
          extractedData.permit_number = permitMatch[0];
        }
      }
    } else {
      // For images, use Vision API directly
      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64 = btoa(binaryString);

      let mimeType = 'image/jpeg';
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert at analyzing short-term rental permits. Extract information and return ONLY a valid JSON object with:
- permit_number, expiration_date (YYYY-MM-DD), issue_date, property_address, permit_type, jurisdiction
Set to null if not found.`
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract permit information from this image." },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
              ]
            }
          ],
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const aiResult = await response.json();
      const content = aiResult.choices[0]?.message?.content;
      
      try {
        const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extractedData = JSON.parse(jsonStr);
      } catch {
        extractedData = { raw_response: content };
      }
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
          ? `Permit analyzed. Expiration date: ${extractedData.expiration_date}. Reminder scheduled.`
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