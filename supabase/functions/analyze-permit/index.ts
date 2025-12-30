import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { documentId, propertyId, filePath, bucket = "task-attachments", originalFileName } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log(`Analyzing permit for document ${documentId}, property ${propertyId}`);
    console.log(`File path: ${filePath}, bucket: ${bucket}`);
    console.log(`Original filename: ${originalFileName || "not provided"}`);
    
    let extractedData: Record<string, string | null> = {
      permit_number: null,
      expiration_date: null,
      jurisdiction: null,
    };

    // First try to extract from the original filename if provided
    const filenameToAnalyze = originalFileName || filePath.split('/').pop() || '';
    console.log(`Analyzing filename: ${filenameToAnalyze}`);
    
    // PRIORITY 1: Check if filename STARTS with a year (e.g., "2026 - ...")
    // This pattern means "valid for year 2026" and expires Dec 31 of that year
    const leadingYearMatch = filenameToAnalyze.match(/^(20[2-9]\d)\s*[-–—]/);
    if (leadingYearMatch) {
      const year = leadingYearMatch[1];
      extractedData.expiration_date = `${year}-12-31`;
      console.log(`Found leading year in filename, permit valid until end of ${year}: ${extractedData.expiration_date}`);
    }
    
    // PRIORITY 2: If no leading year, try date extraction from filename
    // But skip this if we already have a leading year, as the date in filename might be issue date
    if (!extractedData.expiration_date) {
      const datePatterns = [
        { regex: /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/, format: 'MDY' },
        { regex: /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/, format: 'YMD' },
        { regex: /(\d{1,2})[-_](\d{1,2})[-_](\d{4})/, format: 'MDY' },
      ];
      
      for (const { regex, format } of datePatterns) {
        const match = filenameToAnalyze.match(regex);
        if (match) {
          let year, month, day;
          if (format === 'YMD') {
            [, year, month, day] = match;
          } else {
            [, month, day, year] = match;
          }
          extractedData.expiration_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          console.log(`Extracted date from filename: ${extractedData.expiration_date}`);
          break;
        }
      }
    }
    
    // PRIORITY 3: Check for year-only pattern anywhere in filename
    if (!extractedData.expiration_date) {
      const yearMatch = filenameToAnalyze.match(/\b(20[2-9]\d)\b/);
      if (yearMatch) {
        const year = yearMatch[1];
        extractedData.expiration_date = `${year}-12-31`;
        console.log(`Extracted year-only from filename, set to end of year: ${extractedData.expiration_date}`);
      }
    }
    
    // Extract permit number from filename
    const permitPatterns = [
      /STR[-_]?\d+/i,
      /PERMIT[-_]?\d+/i,
      /LICENSE[-_]?\d+/i,
      /\b[A-Z]{2,3}[-_]?\d{4,}/i,
    ];
    
    for (const pattern of permitPatterns) {
      const match = filenameToAnalyze.match(pattern);
      if (match) {
        extractedData.permit_number = match[0].replace(/[-_]/g, '');
        console.log(`Extracted permit number from filename: ${extractedData.permit_number}`);
        break;
      }
    }

    // If we still don't have an expiration date, try to read the PDF content with AI
    if (!extractedData.expiration_date && openaiKey) {
      console.log("No date found in filename, attempting to read PDF content with AI...");
      
      try {
        // Download the PDF file
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(bucket)
          .download(filePath);
        
        if (downloadError) {
          console.error("Failed to download file:", downloadError);
        } else if (fileData) {
          // Convert blob to base64 for GPT-4 Vision
          const arrayBuffer = await fileData.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          const fileType = filePath.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
          
          console.log("Sending document to GPT-4o for analysis...");
          
          // Use GPT-4o with vision capabilities to analyze the document
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
                  content: `You are a permit document analyzer. Extract the following information from this document:
1. Permit/License Number - Look for "Permit No.", "License #", "Registration Number", etc.
2. Expiration Date - Look for "Expires", "Valid Until", "Expiration Date", "Good Through", etc.
3. Jurisdiction - The city, county, or state that issued the permit

IMPORTANT DATE RULES:
- If you see a year alone (like "2026" or "Valid for 2026"), the permit expires December 31 of that year
- If you see "1 year from issue date", calculate the expiration
- Convert all dates to YYYY-MM-DD format

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{"permit_number": "string or null", "expiration_date": "YYYY-MM-DD or null", "jurisdiction": "string or null"}`
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: `Analyze this permit document and extract the permit number, expiration date, and jurisdiction. The original filename was: "${filenameToAnalyze}"`
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:${fileType};base64,${base64}`,
                        detail: "high"
                      }
                    }
                  ]
                }
              ],
              max_tokens: 500,
              temperature: 0,
            }),
          });
          
          if (response.ok) {
            const result = await response.json();
            const content = result.choices[0]?.message?.content || '';
            console.log("GPT-4o response:", content);
            
            // Parse JSON from response (handle potential markdown code blocks)
            let cleanContent = content.trim();
            if (cleanContent.startsWith('```')) {
              cleanContent = cleanContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }
            
            try {
              const parsed = JSON.parse(cleanContent);
              if (parsed.permit_number && !extractedData.permit_number) {
                extractedData.permit_number = parsed.permit_number;
                console.log(`AI extracted permit number: ${extractedData.permit_number}`);
              }
              if (parsed.expiration_date) {
                extractedData.expiration_date = parsed.expiration_date;
                console.log(`AI extracted expiration date: ${extractedData.expiration_date}`);
              }
              if (parsed.jurisdiction) {
                extractedData.jurisdiction = parsed.jurisdiction;
                console.log(`AI extracted jurisdiction: ${extractedData.jurisdiction}`);
              }
            } catch (parseError) {
              console.error("Failed to parse AI response:", parseError);
            }
          } else {
            const errorText = await response.text();
            console.error("GPT-4o request failed:", response.status, errorText);
          }
        }
      } catch (aiError) {
        console.error("AI analysis failed:", aiError);
      }
    }
    
    // If still no expiration date but we have a filename with valid-looking content, use GPT to analyze filename
    if (!extractedData.expiration_date && openaiKey && filenameToAnalyze.length > 10) {
      console.log("Using GPT-4o-mini for enhanced filename analysis as fallback");
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
                content: `Extract permit information from filename. Return ONLY valid JSON:
{"permit_number": "string or null", "expiration_date": "YYYY-MM-DD or null", "jurisdiction": "string or null"}

Rules:
- A year alone (e.g., "2026") means expires Dec 31 of that year -> "2026-12-31"
- STR000287 format is a permit number
- City/county names indicate jurisdiction`
              },
              {
                role: "user",
                content: `Filename: "${filenameToAnalyze}"`
              }
            ],
            max_tokens: 150,
            temperature: 0,
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          const content = result.choices[0]?.message?.content || '';
          console.log("GPT-4o-mini response:", content);
          
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.permit_number && !extractedData.permit_number) {
              extractedData.permit_number = parsed.permit_number;
            }
            if (parsed.expiration_date && !extractedData.expiration_date) {
              extractedData.expiration_date = parsed.expiration_date;
            }
            if (parsed.jurisdiction && !extractedData.jurisdiction) {
              extractedData.jurisdiction = parsed.jurisdiction;
            }
          }
        }
      } catch (e) {
        console.log("GPT-4o-mini analysis failed:", e);
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
          onConflict: "property_id,document_id",
          ignoreDuplicates: false 
        });
      
      if (reminderError) {
        console.error("Error creating reminder:", reminderError);
      } else {
        console.log("Permit reminder created/updated successfully");
      }
    }
    
    const message = extractedData.expiration_date 
      ? `Permit analyzed successfully. Expiration: ${extractedData.expiration_date}${extractedData.permit_number ? `, Permit #: ${extractedData.permit_number}` : ''}${extractedData.jurisdiction ? ` (${extractedData.jurisdiction})` : ''}`
      : "Could not detect expiration date. Please enter manually.";
    
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
