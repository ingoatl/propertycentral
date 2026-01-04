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
