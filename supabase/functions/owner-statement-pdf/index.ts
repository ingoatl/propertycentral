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

    // Handle demo statements - generate a professional PDF matching real statements
    if (reconciliationId.startsWith("stmt-demo-")) {
      console.log("Demo statement requested, generating professional PDF");
      
      // Import pdf-lib for PDF generation
      const { PDFDocument, rgb, StandardFonts } = await import("https://esm.sh/pdf-lib@1.17.1");
      
      const demoMonth = reconciliationId === "stmt-demo-1" 
        ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        : reconciliationId === "stmt-demo-2"
        ? new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      const monthName = demoMonth.toLocaleDateString("en-US", { month: "long" });
      const yearNum = demoMonth.getFullYear();
      const monthStart = new Date(demoMonth.getFullYear(), demoMonth.getMonth(), 1);
      const monthEnd = new Date(demoMonth.getFullYear(), demoMonth.getMonth() + 1, 0);
      
      // Demo financial data
      const shortTermRevenue = 2350;
      const midTermRevenue = 2500;
      const grossRevenue = 4850;
      const managementFee = 970; // 20%
      const expenses = 256;
      const netOwnerEarnings = 3624;
      
      // Generate professional PDF matching real statement design
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Letter size
      
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      const { width, height } = page.getSize();
      const margin = 45;
      let y = height - margin;
      
      const black = rgb(0, 0, 0);
      const gray = rgb(0.45, 0.45, 0.45);
      const darkBg = rgb(0.07, 0.07, 0.07);
      
      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        }).format(amount);
      };
      
      // Company info
      const COMPANY = {
        name: "PeachHaus Group LLC",
        address: "1860 Sandy Plains Rd Ste 204 #4023, Marietta, GA 30066",
        phone: "(404) 800-5932",
        email: "info@peachhausgroup.com",
      };

      // === HEADER WITH COMPANY INFO ===
      page.drawText(COMPANY.name, { x: margin, y, size: 14, font: helveticaBold, color: black });
      y -= 12;
      page.drawText(COMPANY.address, { x: margin, y, size: 8, font: helvetica, color: gray });
      y -= 10;
      page.drawText(`${COMPANY.phone} | ${COMPANY.email}`, { x: margin, y, size: 8, font: helvetica, color: gray });
      
      // Statement title on right
      page.drawText("OWNER STATEMENT", { x: width - margin - 105, y: height - margin, size: 12, font: helveticaBold, color: black });
      page.drawText(`PH-${yearNum}${String(demoMonth.getMonth() + 1).padStart(2, "0")}-DEMO0001`, { x: width - margin - 105, y: height - margin - 12, size: 8, font: helvetica, color: gray });
      page.drawText(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, { x: width - margin - 105, y: height - margin - 22, size: 7, font: helvetica, color: gray });
      
      y -= 8;
      
      // Horizontal line
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1.5, color: black });
      y -= 18;
      
      // === PROPERTY & OWNER INFO ===
      page.drawText("PROPERTY", { x: margin, y, size: 8, font: helveticaBold, color: gray });
      page.drawText("PREPARED FOR", { x: width / 2 + 10, y, size: 8, font: helveticaBold, color: gray });
      y -= 12;
      page.drawText("3069 Rita Way Retreat", { x: margin, y, size: 10, font: helveticaBold, color: black });
      page.drawText("Sara & Michael Thompson", { x: width / 2 + 10, y, size: 10, font: helveticaBold, color: black });
      y -= 11;
      page.drawText("3069 Rita Way, Smyrna, GA 30080", { x: margin, y, size: 8, font: helvetica, color: gray });
      page.drawText("Account: OWN-A1B2C3", { x: width / 2 + 10, y, size: 8, font: helvetica, color: gray });
      y -= 11;
      page.drawText(`Period: ${monthStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${monthEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, { x: margin, y, size: 8, font: helvetica, color: gray });
      y -= 18;
      
      // === NET OWNER EARNINGS BOX ===
      const boxHeight = 42;
      page.drawRectangle({
        x: margin,
        y: y - boxHeight,
        width: width - 2 * margin,
        height: boxHeight,
        color: darkBg,
      });
      
      page.drawText("NET OWNER EARNINGS", { x: margin + 12, y: y - 16, size: 9, font: helveticaBold, color: rgb(1, 1, 1) });
      page.drawText(`Statement Period: ${monthName} ${yearNum}`, { x: margin + 12, y: y - 28, size: 7, font: helvetica, color: rgb(0.7, 0.7, 0.7) });
      
      const netAmountText = formatCurrency(netOwnerEarnings);
      page.drawText(netAmountText, { x: width - margin - 95, y: y - 24, size: 18, font: helveticaBold, color: rgb(1, 1, 1) });
      y -= boxHeight + 16;
      
      // === REVENUE BREAKDOWN ===
      page.drawText("REVENUE BREAKDOWN", { x: margin, y, size: 10, font: helveticaBold, color: black });
      y -= 4;
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: black });
      y -= 16;
      
      // Short-term revenue
      page.drawText("Short-Term Rental Revenue", { x: margin, y, size: 9, font: helvetica, color: black });
      page.drawText(formatCurrency(shortTermRevenue), { x: width - margin - 60, y, size: 9, font: helveticaBold, color: black });
      y -= 14;
      
      // Mid-term revenue
      page.drawText("Mid-Term Rental Revenue", { x: margin, y, size: 9, font: helvetica, color: black });
      page.drawText(formatCurrency(midTermRevenue), { x: width - margin - 60, y, size: 9, font: helveticaBold, color: black });
      y -= 18;
      
      // Total revenue
      page.drawLine({ start: { x: margin, y: y + 5 }, end: { x: width - margin, y: y + 5 }, thickness: 0.5, color: gray });
      page.drawText("GROSS REVENUE", { x: margin, y: y - 8, size: 9, font: helveticaBold, color: black });
      page.drawText(formatCurrency(grossRevenue), { x: width - margin - 60, y: y - 8, size: 9, font: helveticaBold, color: black });
      y -= 30;
      
      // === EXPENSES & DEDUCTIONS ===
      page.drawText("EXPENSES & DEDUCTIONS", { x: margin, y, size: 10, font: helveticaBold, color: black });
      y -= 4;
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: black });
      y -= 16;
      
      page.drawText("Management Fee (20%)", { x: margin, y, size: 9, font: helvetica, color: black });
      page.drawText(formatCurrency(managementFee), { x: width - margin - 60, y, size: 9, font: helvetica, color: black });
      y -= 14;
      
      page.drawText("Property Expenses", { x: margin, y, size: 9, font: helvetica, color: black });
      page.drawText(formatCurrency(expenses), { x: width - margin - 60, y, size: 9, font: helvetica, color: black });
      y -= 18;
      
      // Total expenses
      page.drawLine({ start: { x: margin, y: y + 5 }, end: { x: width - margin, y: y + 5 }, thickness: 0.5, color: gray });
      page.drawText("TOTAL DEDUCTIONS", { x: margin, y: y - 8, size: 9, font: helveticaBold, color: black });
      page.drawText(formatCurrency(managementFee + expenses), { x: width - margin - 60, y: y - 8, size: 9, font: helveticaBold, color: black });
      y -= 35;
      
      // === NET RESULT ===
      page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 2, color: black });
      page.drawText("NET OWNER EARNINGS", { x: margin, y: y - 8, size: 11, font: helveticaBold, color: black });
      page.drawText(formatCurrency(netOwnerEarnings), { x: width - margin - 65, y: y - 8, size: 11, font: helveticaBold, color: black });
      
      // === FOOTER ===
      y = 80;
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: gray });
      y -= 15;
      page.drawText("This statement reflects all revenue and expenses for the specified period.", { x: margin, y, size: 7, font: helvetica, color: gray });
      y -= 10;
      page.drawText("Questions? Contact us at info@peachhausgroup.com or (404) 800-5932", { x: margin, y, size: 7, font: helvetica, color: gray });
      y -= 15;
      page.drawText("PeachHaus Group LLC | www.peachhausgroup.com", { x: margin, y, size: 7, font: helveticaBold, color: gray });
      
      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
      
      return new Response(
        JSON.stringify({ 
          pdfBase64: pdfBase64,
          fileName: `Statement-${monthName}-${yearNum}-Demo.pdf`,
          month: `${demoMonth.toISOString().substring(0, 7)}-01`,
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
