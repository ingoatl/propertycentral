import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { expenseId, batchMode } = await req.json();

    // If batch mode, get all vendor expenses without receipts
    let expensesToProcess: ExpenseData[] = [];

    if (batchMode) {
      console.log("Batch mode: finding expenses without receipts (excluding email-sourced expenses)");
      // ONLY generate receipts for truly manual expenses:
      // - No existing file_path (uploaded receipt)
      // - No original_receipt_path (already generated)
      // - No email_screenshot_path (real email receipt)
      // - No email_insight_id (came from email extraction - should have email receipt)
      // - Only for PeachHaus services or manual vendor entries
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
      console.log(`Found ${expensesToProcess.length} truly manual expenses to process (excluded email-sourced)`);
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

        // Generate HTML receipt
        const html = generateProfessionalExpenseReceipt(expense, property);

        // Create file path
        const fileName = `vendor-receipt-${expense.id}.html`;
        const filePath = `receipts/vendor/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("expense-documents")
          .upload(filePath, html, {
            contentType: "text/html",
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
        console.log(`Generated receipt for expense ${expense.id}`);
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

function generateProfessionalExpenseReceipt(
  expense: ExpenseData, 
  property: { name: string; address: string } | null
): string {
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
  
  // Generate receipt number
  const receiptNumber = `EXP-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${expense.id.slice(0, 6).toUpperCase()}`;

  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(expense.amount);

  const description = expense.items_detail || expense.purpose || expense.category || "Service";
  const vendor = expense.vendor || "PeachHaus Property Management";
  const category = expense.category ? expense.category.charAt(0).toUpperCase() + expense.category.slice(1) : "General";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Expense Receipt - ${receiptNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #FAFAFA;
      color: #1A1A1A;
      font-size: 14px;
      line-height: 1.5;
      padding: 32px 16px;
      -webkit-font-smoothing: antialiased;
    }
    
    .receipt {
      max-width: 520px;
      margin: 0 auto;
      background: #FFFFFF;
      border: 1px solid #E5E5E5;
    }
    
    /* Header */
    .header {
      padding: 40px 40px 32px;
      border-bottom: 1px solid #E5E5E5;
    }
    
    .brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    
    .logo {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #1A1A1A;
    }
    
    .logo-accent {
      color: #E07A42;
    }
    
    .receipt-type {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #666666;
      background: #F5F5F5;
      padding: 6px 12px;
    }
    
    .receipt-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 24px;
      font-size: 12px;
      color: #666666;
    }
    
    .receipt-meta dt {
      font-weight: 400;
    }
    
    .receipt-meta dd {
      font-weight: 500;
      color: #1A1A1A;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      font-size: 11px;
    }
    
    /* Amount Section */
    .amount-section {
      padding: 32px 40px;
      background: #FAFAFA;
      border-bottom: 1px solid #E5E5E5;
      text-align: center;
    }
    
    .amount-label {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #666666;
      margin-bottom: 8px;
    }
    
    .amount-value {
      font-size: 42px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #1A1A1A;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      font-feature-settings: 'tnum' 1;
    }
    
    .amount-status {
      display: inline-block;
      margin-top: 12px;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #166534;
      background: #DCFCE7;
      padding: 4px 10px;
    }
    
    /* Details Section */
    .details {
      padding: 32px 40px;
    }
    
    .section-title {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #666666;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #E5E5E5;
    }
    
    .detail-grid {
      display: grid;
      gap: 16px;
    }
    
    .detail-row {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 16px;
    }
    
    .detail-label {
      font-size: 13px;
      color: #666666;
    }
    
    .detail-value {
      font-size: 13px;
      font-weight: 500;
      color: #1A1A1A;
      text-align: right;
    }
    
    .property-section {
      margin-bottom: 24px;
    }
    
    .property-address {
      font-size: 15px;
      font-weight: 500;
      color: #1A1A1A;
      line-height: 1.4;
    }
    
    /* Description */
    .description-section {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #E5E5E5;
    }
    
    .description-content {
      font-size: 13px;
      color: #4A4A4A;
      line-height: 1.6;
      background: #FAFAFA;
      padding: 16px;
      border-left: 2px solid #E07A42;
    }
    
    /* Footer */
    .footer {
      padding: 24px 40px;
      border-top: 1px solid #E5E5E5;
      background: #FAFAFA;
    }
    
    .company-info {
      font-size: 11px;
      color: #666666;
      text-align: center;
      line-height: 1.6;
    }
    
    .company-name {
      font-weight: 600;
      color: #1A1A1A;
      margin-bottom: 4px;
    }
    
    .legal-text {
      margin-top: 16px;
      font-size: 10px;
      color: #999999;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="brand">
        <div class="logo">Peach<span class="logo-accent">Haus</span></div>
        <div class="receipt-type">Expense Receipt</div>
      </div>
      <dl class="receipt-meta">
        <dt>Receipt No.</dt>
        <dd>${receiptNumber}</dd>
        <dt>Issue Date</dt>
        <dd>${generatedDate}</dd>
      </dl>
    </div>
    
    <div class="amount-section">
      <div class="amount-label">Amount</div>
      <div class="amount-value">${amount}</div>
      <div class="amount-status">Paid</div>
    </div>
    
    <div class="details">
      <div class="property-section">
        <div class="section-title">Property</div>
        <div class="property-address">${property?.address || "Property"}</div>
      </div>
      
      <div class="section-title">Transaction Details</div>
      <div class="detail-grid">
        <div class="detail-row">
          <span class="detail-label">Transaction Date</span>
          <span class="detail-value">${formattedDate}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Vendor</span>
          <span class="detail-value">${vendor}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Category</span>
          <span class="detail-value">${category}</span>
        </div>
      </div>
      
      ${description && description !== category ? `
      <div class="description-section">
        <div class="section-title">Description</div>
        <div class="description-content">${description}</div>
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <div class="company-info">
        <div class="company-name">PeachHaus Group LLC</div>
        info@peachhausgroup.com
      </div>
      <div class="legal-text">
        This receipt confirms payment for property management services rendered.
      </div>
    </div>
  </div>
</body>
</html>`;
}
