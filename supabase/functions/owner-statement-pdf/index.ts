import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { reconciliationId, token } = await req.json();

    console.log("Statement PDF request:", { reconciliationId, hasToken: !!token });

    if (!reconciliationId) {
      return new Response(
        JSON.stringify({ error: "reconciliationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle demo statements - generate a demo PDF inline
    if (reconciliationId.startsWith("stmt-demo-")) {
      console.log("Demo statement requested, generating sample PDF");
      
      // Generate a demo statement PDF using the generate-statement-pdf endpoint logic
      // For demo, we'll create a simple base64 PDF response
      const demoMonth = reconciliationId === "stmt-demo-1" 
        ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 7)
        : reconciliationId === "stmt-demo-2"
        ? new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().substring(0, 7)
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().substring(0, 7);
      
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const [year, monthNum] = demoMonth.split("-");
      const monthName = monthNames[parseInt(monthNum) - 1];
      
      // Create a minimal valid PDF (this is a simple demo PDF)
      const demoPdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 580 >>
stream
BT
/F1 28 Tf
50 720 Td
(PeachHaus Group) Tj
0 -40 Td
/F1 18 Tf
(Owner Statement) Tj
0 -30 Td
/F1 14 Tf
(${monthName} ${year}) Tj
0 -50 Td
/F1 12 Tf
(Property: 3069 Rita Way Retreat) Tj
0 -20 Td
(Owner: Sara & Michael Thompson) Tj
0 -40 Td
/F1 14 Tf
(Revenue Summary) Tj
0 -25 Td
/F1 11 Tf
(Short-Term Revenue: $2,350.00) Tj
0 -18 Td
(Mid-Term Revenue: $2,500.00) Tj
0 -18 Td
(Total Revenue: $4,850.00) Tj
0 -35 Td
/F1 14 Tf
(Net Owner Earnings: $3,624.00) Tj
0 -50 Td
/F1 10 Tf
(This is a demo statement for demonstration purposes.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000898 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
977
%%EOF`;

      const pdfBase64 = btoa(demoPdfContent);
      
      return new Response(
        JSON.stringify({ 
          pdfBase64: pdfBase64,
          fileName: `Statement-${monthName}-${year}-Demo.pdf`,
          month: `${demoMonth}-01`,
          generated: true,
          isDemo: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate session if token provided
    let validatedPropertyId: string | null = null;
    if (token) {
      const { data: sessionData, error: sessionError } = await supabase
        .from("owner_portal_sessions")
        .select("owner_id, property_id, expires_at")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (sessionError || !sessionData) {
        console.error("Session validation failed:", sessionError);
        return new Response(
          JSON.stringify({ error: "Invalid or expired session" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      validatedPropertyId = sessionData.property_id;
      console.log("Session validated for property:", validatedPropertyId);
    }

    // Fetch reconciliation to verify ownership
    const { data: reconciliation, error: reconError } = await supabase
      .from("monthly_reconciliations")
      .select("id, property_id, reconciliation_month, status")
      .eq("id", reconciliationId)
      .single();

    if (reconError || !reconciliation) {
      console.error("Reconciliation fetch failed:", reconError);
      return new Response(
        JSON.stringify({ error: "Statement not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify property ownership if session validation was done
    if (validatedPropertyId && reconciliation.property_id !== validatedPropertyId) {
      console.error("Property mismatch:", { session: validatedPropertyId, recon: reconciliation.property_id });
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfPath = `${reconciliationId}.pdf`;

    // Try to get existing PDF first
    console.log("Checking for existing PDF at:", pdfPath);
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("statement-pdfs")
      .createSignedUrl(pdfPath, 600); // 10 minutes

    if (!signedUrlError && signedUrlData?.signedUrl) {
      console.log("Existing PDF found, returning signed URL");
      return new Response(
        JSON.stringify({ 
          signedUrl: signedUrlData.signedUrl,
          month: reconciliation.reconciliation_month
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PDF doesn't exist - try to generate it
    console.log("PDF not found, generating new PDF...");

    try {
      const generateResponse = await fetch(`${supabaseUrl}/functions/v1/generate-statement-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ reconciliation_id: reconciliationId }),
      });

      console.log("Generate PDF response status:", generateResponse.status);

      if (!generateResponse.ok) {
        const errorText = await generateResponse.text();
        console.error("PDF generation failed:", errorText);
        return new Response(
          JSON.stringify({ 
            error: "Failed to generate statement PDF",
            details: errorText,
            month: reconciliation.reconciliation_month
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const generateData = await generateResponse.json();
      console.log("PDF generation response received:", { 
        hasPdfBase64: !!generateData.pdfBase64,
        fileName: generateData.fileName 
      });
      
      if (!generateData.pdfBase64) {
        console.error("No PDF data in response");
        return new Response(
          JSON.stringify({ 
            error: "PDF generation returned no data",
            month: reconciliation.reconciliation_month
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Decode and upload the generated PDF
      const pdfBytes = Uint8Array.from(atob(generateData.pdfBase64), c => c.charCodeAt(0));
      console.log("PDF decoded, size:", pdfBytes.length, "bytes");
      
      const { error: uploadError } = await supabase.storage
        .from("statement-pdfs")
        .upload(pdfPath, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        console.error("Failed to upload generated PDF:", uploadError);
        // Return the PDF directly even if upload failed
        return new Response(
          JSON.stringify({ 
            pdfBase64: generateData.pdfBase64,
            fileName: generateData.fileName,
            month: reconciliation.reconciliation_month,
            generated: true,
            uploadFailed: true
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("PDF generated and uploaded successfully");
      
      // Get signed URL for the newly uploaded PDF
      const { data: newSignedUrl, error: newSignedError } = await supabase.storage
        .from("statement-pdfs")
        .createSignedUrl(pdfPath, 600);

      if (newSignedError || !newSignedUrl?.signedUrl) {
        console.error("Failed to get signed URL for new PDF:", newSignedError);
        return new Response(
          JSON.stringify({ 
            pdfBase64: generateData.pdfBase64,
            fileName: generateData.fileName,
            month: reconciliation.reconciliation_month,
            generated: true
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          signedUrl: newSignedUrl.signedUrl,
          month: reconciliation.reconciliation_month,
          generated: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (genError) {
      console.error("Error generating PDF:", genError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to generate statement PDF",
          details: genError instanceof Error ? genError.message : "Unknown error",
          month: reconciliation.reconciliation_month
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: unknown) {
    console.error("Owner statement PDF error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
