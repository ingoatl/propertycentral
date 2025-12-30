import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, propertyId, filePath, bucket = "onboarding-documents" } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log(`Analyzing permit for document ${documentId}, file: ${filePath}`);
    
    // Extract information from filename
    const filename = filePath.split('/').pop() || '';
    let extractedData: Record<string, string | null> = {
      permit_number: null,
      expiration_date: null,
      jurisdiction: null,
    };
    
    // Try multiple date formats from filename
    const datePatterns = [
      { regex: /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/, format: 'MDY' },  // MM-DD-YYYY or MM/DD/YYYY
      { regex: /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/, format: 'YMD' },  // YYYY-MM-DD
      { regex: /(\d{1,2})[-_](\d{1,2})[-_](\d{4})/, format: 'MDY' },    // MM_DD_YYYY
    ];
    
    for (const { regex, format } of datePatterns) {
      const match = filename.match(regex);
      if (match) {
        let year, month, day;
        if (format === 'YMD') {
          [, year, month, day] = match;
        } else {
          [, month, day, year] = match;
        }
        extractedData.expiration_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        console.log(`Extracted full date from filename: ${extractedData.expiration_date}`);
        break;
      }
    }
    
    // If no full date found, check for year-only pattern (e.g., "2026" in filename)
    // A standalone year means the permit expires at the end of that year
    if (!extractedData.expiration_date) {
      const yearOnlyMatch = filename.match(/\b(20[2-9]\d)\b/);
      if (yearOnlyMatch) {
        const year = yearOnlyMatch[1];
        // If only a year is specified, assume it expires at the end of that year
        extractedData.expiration_date = `${year}-12-31`;
        console.log(`Extracted year-only from filename, assuming end of year: ${extractedData.expiration_date}`);
      }
    }
    
    // Extract permit number patterns from filename
    const permitPatterns = [
      /STR[-_]?\d+/i,
      /PERMIT[-_]?\d+/i,
      /LICENSE[-_]?\d+/i,
      /\b[A-Z]{2,3}[-_]?\d{4,}/i,
      /STR\d+/i,
    ];
    
    for (const pattern of permitPatterns) {
      const match = filename.match(pattern);
      if (match) {
        extractedData.permit_number = match[0].replace(/[-_]/g, '');
        console.log(`Extracted permit number from filename: ${extractedData.permit_number}`);
        break;
      }
    }
    
    // If we have OpenAI key and missing data, try GPT for smarter filename analysis
    if (openaiKey && (!extractedData.expiration_date || !extractedData.permit_number)) {
      console.log("Using GPT-4o-mini for enhanced filename analysis");
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are a permit document analyzer. Extract permit information from the filename. 
Return ONLY valid JSON with this exact structure:
{"permit_number": "string or null", "expiration_date": "YYYY-MM-DD or null", "jurisdiction": "string or null"}

Rules:
- Dates like "10-24-2025" or "10_24_2025" mean October 24, 2025 -> "2025-10-24"
- If ONLY a year is mentioned (e.g., "2026" in the filename), the permit expires at the END of that year -> "2026-12-31"
- STR000287 is a permit number
- Look for city/county names for jurisdiction
- Return null for any field you can't determine`
              },
              {
                role: "user",
                content: `Analyze this permit filename: "${filename}"`
              }
            ],
            max_tokens: 150,
            temperature: 0,
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          const content = result.choices[0]?.message?.content || '';
          console.log("GPT response:", content);
          
          // Parse JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            // Only update if we got better data
            if (parsed.permit_number && !extractedData.permit_number) {
              extractedData.permit_number = parsed.permit_number;
            }
            if (parsed.expiration_date && !extractedData.expiration_date) {
              extractedData.expiration_date = parsed.expiration_date;
            }
            if (parsed.jurisdiction) {
              extractedData.jurisdiction = parsed.jurisdiction;
            }
          }
        } else {
          console.log("GPT request failed:", await response.text());
        }
      } catch (e) {
        console.log("GPT analysis failed, using regex extraction only:", e);
      }
    }
    
    console.log("Final extracted data:", extractedData);
    
    // Update document with extracted data
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
    
    // Create or update permit reminder if expiration date found
    if (extractedData.expiration_date && propertyId) {
      const { error: reminderError } = await supabase
        .from("permit_reminders")
        .upsert({
          property_id: propertyId,
          document_id: documentId,
          permit_number: extractedData.permit_number,
          permit_expiration_date: extractedData.expiration_date,
          reminder_email_to: "info@peachhausgroup.com",
          status: "pending",
          updated_at: new Date().toISOString(),
        }, { 
          onConflict: "document_id",
          ignoreDuplicates: false 
        });
      
      if (reminderError) {
        console.error("Error creating reminder:", reminderError);
      } else {
        console.log("Permit reminder created/updated");
      }
    }
    
    const message = extractedData.expiration_date 
      ? `Permit analyzed successfully. Expiration: ${extractedData.expiration_date}${extractedData.permit_number ? `, Permit #: ${extractedData.permit_number}` : ''}`
      : "Could not auto-detect expiration date from filename. Please enter manually.";
    
    return new Response(JSON.stringify({
      success: true,
      extractedData,
      message,
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error analyzing permit:", errorMessage);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage,
      message: "Analysis failed. Please enter permit details manually."
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
