import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExpenseData {
  id: string;
  date: string;
  amount: number;
  vendor: string | null;
  purpose: string | null;
  category: string | null;
  items_detail: string | null;
  property_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { expenseId, batchMode, regenerateHtml } = await req.json();

    // If batch mode, get all vendor expenses without receipts
    let expensesToProcess: ExpenseData[] = [];

    if (regenerateHtml) {
      // Find expenses with HTML receipts and convert them to PDF
      console.log("Regenerate mode: finding expenses with HTML receipts to convert to PDF");
      const { data: expenses, error } = await supabase
        .from("expenses")
        .select("id, date, amount, vendor, purpose, category, items_detail, property_id")
        .like("original_receipt_path", "%.html")
        .limit(200);

      if (error) {
        console.error("Error fetching HTML expenses:", error);
        throw error;
      }
      expensesToProcess = expenses || [];
      console.log(`Found ${expensesToProcess.length} HTML receipts to convert to PDF`);
    } else if (batchMode) {
      console.log("Batch mode: finding expenses without receipts (excluding email-sourced expenses)");
      const { data: expenses, error } = await supabase
        .from("expenses")
        .select("id, date, amount, vendor, purpose, category, items_detail, property_id, email_insight_id, email_screenshot_path")
        .is("file_path", null)
        .is("original_receipt_path", null)
        .is("email_screenshot_path", null)
        .is("email_insight_id", null)
        .or("vendor.is.null,vendor.eq.PeachHaus,category.in.(cleaning,repairs,maintenance,visit)")
        .limit(100);

      if (error) {
        console.error("Error fetching expenses:", error);
        throw error;
      }
      expensesToProcess = expenses || [];
      console.log(`Found ${expensesToProcess.length} truly manual expenses to process`);
    } else if (expenseId) {
      const { data: expense, error } = await supabase
        .from("expenses")
        .select("id, date, amount, vendor, purpose, category, items_detail, property_id")
        .eq("id", expenseId)
        .single();

      if (error) throw error;
      if (expense) expensesToProcess = [expense];
    }

    let generated = 0;
    let failed = 0;

    for (const expense of expensesToProcess) {
      try {
        // Get property info
        const { data: property } = await supabase
          .from("properties")
          .select("name, address")
          .eq("id", expense.property_id)
          .single();

        // Generate PDF receipt
        const pdfBytes = await generatePdfReceipt(expense, property);

        // Create file path - now as PDF
        const fileName = `vendor-receipt-${expense.id}.pdf`;
        const filePath = `receipts/vendor/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("expense-documents")
          .upload(filePath, pdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for ${expense.id}:`, uploadError);
          failed++;
          continue;
        }

        // Update expense with receipt path
        const { error: updateError } = await supabase
          .from("expenses")
          .update({ original_receipt_path: filePath })
          .eq("id", expense.id);

        if (updateError) {
          console.error(`Update error for ${expense.id}:`, updateError);
          failed++;
          continue;
        }

        generated++;
        console.log(`Generated PDF receipt for expense ${expense.id}`);
      } catch (err: unknown) {
        console.error(`Error processing expense ${expense.id}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated,
        failed,
        total: expensesToProcess.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in generate-vendor-receipt:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function generatePdfReceipt(
  expense: ExpenseData, 
  property: { name: string; address: string } | null
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Colors
  const darkGray = rgb(0.1, 0.1, 0.1);
  const mediumGray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.6, 0.6, 0.6);
  const accentColor = rgb(0.878, 0.478, 0.259); // PeachHaus orange #E07A42
  const greenColor = rgb(0.086, 0.396, 0.204);
  
  const { width, height } = page.getSize();
  let y = height - 60;
  
  // Format data
  const date = new Date(expense.date);
  const formattedDate = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  const receiptNumber = `EXP-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${expense.id.slice(0, 6).toUpperCase()}`;
  
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(expense.amount);

  const description = expense.items_detail || expense.purpose || expense.category || "Service";
  const vendor = expense.vendor || "PeachHaus Property Management";
  const category = expense.category ? expense.category.charAt(0).toUpperCase() + expense.category.slice(1) : "General";

  // ======== HEADER ========
  // Logo text
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
  
  // Receipt type badge
  page.drawText("EXPENSE RECEIPT", {
    x: width - 50 - helveticaBold.widthOfTextAtSize("EXPENSE RECEIPT", 10),
    y: y + 4,
    size: 10,
    font: helveticaBold,
    color: mediumGray,
  });
  
  y -= 35;
  
  // Receipt meta
  page.drawText(`Receipt No: ${receiptNumber}`, {
    x: 50,
    y: y,
    size: 10,
    font: helvetica,
    color: lightGray,
  });
  
  page.drawText(`Issue Date: ${generatedDate}`, {
    x: width - 50 - helvetica.widthOfTextAtSize(`Issue Date: ${generatedDate}`, 10),
    y: y,
    size: 10,
    font: helvetica,
    color: lightGray,
  });
  
  y -= 10;
  
  // Divider line
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
  
  page.drawText(amount, {
    x: width / 2 - helveticaBold.widthOfTextAtSize(amount, 42) / 2,
    y: y,
    size: 42,
    font: helveticaBold,
    color: darkGray,
  });
  
  y -= 25;
  
  // Paid status
  page.drawText("PAID", {
    x: width / 2 - helveticaBold.widthOfTextAtSize("PAID", 11) / 2,
    y: y,
    size: 11,
    font: helveticaBold,
    color: greenColor,
  });
  
  y -= 30;
  
  // Divider line
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
  
  page.drawText(property?.address || property?.name || "Property", {
    x: 50,
    y: y,
    size: 14,
    font: helveticaBold,
    color: darkGray,
  });
  
  y -= 30;
  
  // Divider line
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
  
  // Transaction Date
  page.drawText("Transaction Date", {
    x: 50,
    y: y,
    size: 12,
    font: helvetica,
    color: mediumGray,
  });
  page.drawText(formattedDate, {
    x: width - 50 - helveticaBold.widthOfTextAtSize(formattedDate, 12),
    y: y,
    size: 12,
    font: helveticaBold,
    color: darkGray,
  });
  
  y -= 25;
  
  // Vendor
  page.drawText("Vendor", {
    x: 50,
    y: y,
    size: 12,
    font: helvetica,
    color: mediumGray,
  });
  page.drawText(vendor, {
    x: width - 50 - helveticaBold.widthOfTextAtSize(vendor, 12),
    y: y,
    size: 12,
    font: helveticaBold,
    color: darkGray,
  });
  
  y -= 25;
  
  // Category
  page.drawText("Category", {
    x: 50,
    y: y,
    size: 12,
    font: helvetica,
    color: mediumGray,
  });
  page.drawText(category, {
    x: width - 50 - helveticaBold.widthOfTextAtSize(category, 12),
    y: y,
    size: 12,
    font: helveticaBold,
    color: darkGray,
  });
  
  // ======== DESCRIPTION ========
  if (description && description !== category) {
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
    
    // Draw accent line
    page.drawLine({
      start: { x: 50, y: y + 30 },
      end: { x: 50, y: y - 10 },
      thickness: 3,
      color: accentColor,
    });
    
    // Wrap and draw description text
    const descLines = wrapText(description, 70);
    for (const line of descLines) {
      page.drawText(line, {
        x: 60,
        y: y,
        size: 11,
        font: helvetica,
        color: mediumGray,
      });
      y -= 16;
    }
  }
  
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
  
  return await pdfDoc.save();
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxChars) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines;
}
