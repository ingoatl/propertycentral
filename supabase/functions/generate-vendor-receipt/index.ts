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
      console.log("Batch mode: finding expenses without receipts");
      const { data: expenses, error } = await supabase
        .from("expenses")
        .select("id, date, amount, vendor, purpose, category, items_detail, property_id")
        .is("file_path", null)
        .is("original_receipt_path", null)
        .or("vendor.is.null,vendor.eq.PeachHaus,category.in.(cleaning,repairs,maintenance,visit)")
        .limit(100);

      if (error) {
        console.error("Error fetching expenses:", error);
        throw error;
      }
      expensesToProcess = expenses || [];
      console.log(`Found ${expensesToProcess.length} expenses to process`);
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
        const html = generateExpenseReceiptHtml(expense, property);

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

function generateExpenseReceiptHtml(
  expense: ExpenseData, 
  property: { name: string; address: string } | null
): string {
  const date = new Date(expense.date);
  const formattedDate = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(expense.amount);

  const description = expense.items_detail || expense.purpose || expense.category || "Service";
  const vendor = expense.vendor || "PeachHaus Property Management";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Expense Receipt - ${expense.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      color: #333;
    }
    .receipt {
      max-width: 500px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .logo {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 5px;
      letter-spacing: -0.5px;
    }
    .logo span { opacity: 0.9; font-weight: 400; }
    .tagline {
      font-size: 12px;
      opacity: 0.85;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      margin-top: 15px;
    }
    .content { padding: 30px; }
    .amount-box {
      text-align: center;
      padding: 25px;
      background: #f8f9fa;
      border-radius: 10px;
      margin-bottom: 25px;
    }
    .amount-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
    }
    .amount {
      font-size: 42px;
      font-weight: 700;
      color: #FF6B35;
    }
    .details { margin-bottom: 25px; }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #eee;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { 
      color: #666;
      font-size: 14px;
    }
    .detail-value { 
      font-weight: 500;
      text-align: right;
      max-width: 60%;
    }
    .property-box {
      background: #FFF5F0;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .property-title {
      font-size: 12px;
      color: #FF6B35;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .property-address {
      font-size: 16px;
      font-weight: 500;
    }
    .footer {
      text-align: center;
      padding: 20px 30px 30px;
      border-top: 1px solid #eee;
    }
    .receipt-id {
      font-size: 11px;
      color: #999;
      font-family: monospace;
    }
    .company-info {
      margin-top: 15px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="logo">Peach<span>Haus</span></div>
      <div class="tagline">Property Management</div>
      <div class="badge">Expense Receipt</div>
    </div>
    
    <div class="content">
      <div class="amount-box">
        <div class="amount-label">Amount</div>
        <div class="amount">${amount}</div>
      </div>
      
      <div class="property-box">
        <div class="property-title">Property</div>
        <div class="property-address">${property?.address || "Property"}</div>
      </div>
      
      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${formattedDate}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Vendor</span>
          <span class="detail-value">${vendor}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Category</span>
          <span class="detail-value">${expense.category || "General"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Description</span>
          <span class="detail-value">${description}</span>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <div class="receipt-id">Receipt ID: ${expense.id}</div>
      <div class="company-info">
        PeachHaus Property Management<br>
        info@peachhausgroup.com
      </div>
    </div>
  </div>
</body>
</html>`;
}
