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
    const { expenseId, token, filePath } = await req.json();

    console.log("Receipt URL request:", { expenseId, filePath, hasToken: !!token });

    // Validate session if token provided
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
      console.log("Session validated for owner:", sessionData.owner_id);
    }

    // Use provided filePath or fetch from expense
    let receiptPath = filePath;
    
    if (!receiptPath && expenseId) {
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .select("email_screenshot_path, file_path, original_receipt_path")
        .eq("id", expenseId)
        .single();

      if (expenseError || !expense) {
        console.error("Expense fetch failed:", expenseError);
        return new Response(
          JSON.stringify({ error: "Expense not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Priority: email_screenshot_path > file_path > original_receipt_path
      receiptPath = expense.email_screenshot_path || expense.file_path || expense.original_receipt_path;
    }

    if (!receiptPath) {
      return new Response(
        JSON.stringify({ error: "No receipt file available" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this is a demo receipt path - return a sample receipt PDF for demo
    if (receiptPath.startsWith("demo-receipts/") || receiptPath.startsWith("demo/") || expenseId?.startsWith("exp-demo-")) {
      console.log("Demo receipt requested, generating professional PDF receipt");
      
      // Import pdf-lib for PDF generation
      const { PDFDocument, rgb, StandardFonts } = await import("https://esm.sh/pdf-lib@1.17.1");
      
      // Determine receipt details based on path
      let receiptTitle = "Property Expense";
      let receiptAmount = 89.99;
      let receiptVendor = "Local Vendor";
      let receiptCategory = "General";
      let receiptDescription = "Property maintenance expense";
      
      if (receiptPath?.includes("pool") || receiptPath?.includes("Pool")) {
        receiptTitle = "Pool Maintenance Supplies";
        receiptAmount = 89.99;
        receiptVendor = "Leslie's Pool Supplies";
        receiptCategory = "Maintenance";
        receiptDescription = "Chlorine Tablets (25lb), pH Balancer, Pool Brush";
      } else if (receiptPath?.includes("cleaning") || receiptPath?.includes("Cleaning")) {
        receiptTitle = "Professional Deep Cleaning";
        receiptAmount = 156.50;
        receiptVendor = "CleanCo Pro";
        receiptCategory = "Cleaning";
        receiptDescription = "Deep Clean Service (4BR), Carpet Spot Treatment, Window Cleaning";
      } else if (receiptPath?.includes("costco") || receiptPath?.includes("Costco")) {
        receiptTitle = "Guest Welcome Supplies";
        receiptAmount = 45.00;
        receiptVendor = "Costco Wholesale";
        receiptCategory = "Guest Amenities";
        receiptDescription = "Coffee Variety Pack, Bottled Water (24pk), Snack Assortment, Paper Products";
      }
      
      // Generate professional PDF matching real vendor receipts
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Letter size
      
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Colors matching generate-vendor-receipt
      const darkGray = rgb(0.1, 0.1, 0.1);
      const mediumGray = rgb(0.4, 0.4, 0.4);
      const lightGray = rgb(0.6, 0.6, 0.6);
      const accentColor = rgb(0.878, 0.478, 0.259); // PeachHaus orange #E07A42
      const greenColor = rgb(0.086, 0.396, 0.204);
      
      const { width, height } = page.getSize();
      let y = height - 60;
      
      const formattedDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long", 
        day: "numeric",
      });
      
      const receiptNumber = `EXP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${expenseId?.slice(0, 6).toUpperCase() || 'DEMO01'}`;
      
      const amountFormatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(receiptAmount);

      // ======== HEADER ========
      page.drawText("Peach", {
        x: 50,
        y: y,
        size: 24,
        font: helveticaBold,
        color: darkGray,
      });
      page.drawText("Haus", {
        x: 50 + helveticaBold.widthOfTextAtSize("Peach", 24),
        y: y,
        size: 24,
        font: helveticaBold,
        color: accentColor,
      });
      
      page.drawText("EXPENSE RECEIPT", {
        x: width - 50 - helveticaBold.widthOfTextAtSize("EXPENSE RECEIPT", 10),
        y: y + 4,
        size: 10,
        font: helveticaBold,
        color: mediumGray,
      });
      
      y -= 35;
      
      page.drawText(`Receipt No: ${receiptNumber}`, {
        x: 50,
        y: y,
        size: 10,
        font: helvetica,
        color: lightGray,
      });
      
      page.drawText(`Issue Date: ${formattedDate}`, {
        x: width - 50 - helvetica.widthOfTextAtSize(`Issue Date: ${formattedDate}`, 10),
        y: y,
        size: 10,
        font: helvetica,
        color: lightGray,
      });
      
      y -= 10;
      
      page.drawLine({
        start: { x: 50, y: y },
        end: { x: width - 50, y: y },
        thickness: 1,
        color: rgb(0.9, 0.9, 0.9),
      });
      
      // ======== AMOUNT SECTION ========
      y -= 50;
      
      page.drawText("AMOUNT", {
        x: width / 2 - helveticaBold.widthOfTextAtSize("AMOUNT", 10) / 2,
        y: y,
        size: 10,
        font: helveticaBold,
        color: lightGray,
      });
      
      y -= 45;
      
      page.drawText(amountFormatted, {
        x: width / 2 - helveticaBold.widthOfTextAtSize(amountFormatted, 42) / 2,
        y: y,
        size: 42,
        font: helveticaBold,
        color: darkGray,
      });
      
      y -= 25;
      
      page.drawText("PAID", {
        x: width / 2 - helveticaBold.widthOfTextAtSize("PAID", 11) / 2,
        y: y,
        size: 11,
        font: helveticaBold,
        color: greenColor,
      });
      
      y -= 30;
      
      page.drawLine({
        start: { x: 50, y: y },
        end: { x: width - 50, y: y },
        thickness: 1,
        color: rgb(0.9, 0.9, 0.9),
      });
      
      // ======== PROPERTY SECTION ========
      y -= 35;
      
      page.drawText("PROPERTY", {
        x: 50,
        y: y,
        size: 10,
        font: helveticaBold,
        color: lightGray,
      });
      
      y -= 20;
      
      page.drawText("3069 Rita Way, Smyrna, GA 30080", {
        x: 50,
        y: y,
        size: 14,
        font: helveticaBold,
        color: darkGray,
      });
      
      y -= 30;
      
      page.drawLine({
        start: { x: 50, y: y },
        end: { x: width - 50, y: y },
        thickness: 1,
        color: rgb(0.9, 0.9, 0.9),
      });
      
      // ======== TRANSACTION DETAILS ========
      y -= 35;
      
      page.drawText("TRANSACTION DETAILS", {
        x: 50,
        y: y,
        size: 10,
        font: helveticaBold,
        color: lightGray,
      });
      
      y -= 30;
      
      page.drawText("Transaction Date", { x: 50, y: y, size: 12, font: helvetica, color: mediumGray });
      page.drawText(formattedDate, { x: width - 50 - helveticaBold.widthOfTextAtSize(formattedDate, 12), y: y, size: 12, font: helveticaBold, color: darkGray });
      
      y -= 25;
      
      page.drawText("Vendor", { x: 50, y: y, size: 12, font: helvetica, color: mediumGray });
      page.drawText(receiptVendor, { x: width - 50 - helveticaBold.widthOfTextAtSize(receiptVendor, 12), y: y, size: 12, font: helveticaBold, color: darkGray });
      
      y -= 25;
      
      page.drawText("Category", { x: 50, y: y, size: 12, font: helvetica, color: mediumGray });
      page.drawText(receiptCategory, { x: width - 50 - helveticaBold.widthOfTextAtSize(receiptCategory, 12), y: y, size: 12, font: helveticaBold, color: darkGray });
      
      // ======== DESCRIPTION ========
      y -= 40;
      
      page.drawLine({
        start: { x: 50, y: y + 10 },
        end: { x: width - 50, y: y + 10 },
        thickness: 1,
        color: rgb(0.9, 0.9, 0.9),
      });
      
      y -= 20;
      
      page.drawText("DESCRIPTION", {
        x: 50,
        y: y,
        size: 10,
        font: helveticaBold,
        color: lightGray,
      });
      
      y -= 25;
      
      page.drawLine({
        start: { x: 50, y: y + 30 },
        end: { x: 50, y: y - 10 },
        thickness: 3,
        color: accentColor,
      });
      
      page.drawText(receiptDescription, {
        x: 60,
        y: y,
        size: 11,
        font: helvetica,
        color: mediumGray,
      });
      
      // ======== FOOTER ========
      y = 100;
      
      page.drawLine({
        start: { x: 50, y: y },
        end: { x: width - 50, y: y },
        thickness: 1,
        color: rgb(0.9, 0.9, 0.9),
      });
      
      y -= 30;
      
      page.drawText("PeachHaus Group LLC", {
        x: width / 2 - helveticaBold.widthOfTextAtSize("PeachHaus Group LLC", 11) / 2,
        y: y,
        size: 11,
        font: helveticaBold,
        color: darkGray,
      });
      
      y -= 18;
      
      page.drawText("info@peachhausgroup.com", {
        x: width / 2 - helvetica.widthOfTextAtSize("info@peachhausgroup.com", 10) / 2,
        y: y,
        size: 10,
        font: helvetica,
        color: lightGray,
      });
      
      y -= 25;
      
      page.drawText("This receipt confirms payment for property management services rendered.", {
        x: width / 2 - helvetica.widthOfTextAtSize("This receipt confirms payment for property management services rendered.", 8) / 2,
        y: y,
        size: 8,
        font: helvetica,
        color: lightGray,
      });
      
      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
      const dataUrl = `data:application/pdf;base64,${pdfBase64}`;
      
      return new Response(
        JSON.stringify({ 
          signedUrl: dataUrl,
          path: receiptPath,
          isDemo: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate signed URL using service role key (bypasses RLS)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("expense-documents")
      .createSignedUrl(receiptPath, 600); // 10 minutes

    if (signedUrlError) {
      console.error("Failed to create signed URL:", signedUrlError);
      return new Response(
        JSON.stringify({ error: "Failed to generate receipt URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Signed URL generated successfully for:", receiptPath);

    return new Response(
      JSON.stringify({ 
        signedUrl: signedUrlData.signedUrl,
        path: receiptPath
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Owner receipt URL error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
