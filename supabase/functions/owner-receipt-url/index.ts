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

    // Check if this is a demo receipt path - return a sample receipt for demo
    if (receiptPath.startsWith("demo-receipts/") || receiptPath.startsWith("demo/") || expenseId?.startsWith("exp-demo-")) {
      console.log("Demo receipt requested, returning sample receipt data");
      
      // Determine receipt details based on path
      let receiptTitle = "Property Expense";
      let receiptAmount = "$89.99";
      let receiptVendor = "Local Vendor";
      let receiptItems = [
        { name: "Expense Item", price: "$89.99" }
      ];
      
      if (receiptPath?.includes("pool") || receiptPath?.includes("Pool")) {
        receiptTitle = "Pool Maintenance Supplies";
        receiptAmount = "$89.99";
        receiptVendor = "Leslie's Pool Supplies";
        receiptItems = [
          { name: "Chlorine Tablets (25lb)", price: "$54.99" },
          { name: "pH Balancer", price: "$24.00" },
          { name: "Pool Brush", price: "$11.00" }
        ];
      } else if (receiptPath?.includes("cleaning") || receiptPath?.includes("Cleaning")) {
        receiptTitle = "Professional Deep Cleaning";
        receiptAmount = "$156.50";
        receiptVendor = "CleanCo Pro";
        receiptItems = [
          { name: "Deep Clean Service (4BR)", price: "$125.00" },
          { name: "Carpet Spot Treatment", price: "$20.00" },
          { name: "Window Cleaning", price: "$11.50" }
        ];
      } else if (receiptPath?.includes("costco") || receiptPath?.includes("Costco")) {
        receiptTitle = "Guest Welcome Supplies";
        receiptAmount = "$45.00";
        receiptVendor = "Costco Wholesale";
        receiptItems = [
          { name: "Coffee Variety Pack", price: "$18.99" },
          { name: "Bottled Water (24pk)", price: "$5.99" },
          { name: "Snack Assortment", price: "$12.02" },
          { name: "Paper Products", price: "$8.00" }
        ];
      }
      
      const itemsHtml = receiptItems.map(item => 
        `<div class="line-item"><span>${item.name}</span><span>${item.price}</span></div>`
      ).join('\n');
      
      // Return a base64-encoded sample receipt HTML for demo purposes
      const sampleReceiptHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${receiptTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; background: #fff; }
    .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 20px; }
    .logo { font-size: 24px; font-weight: bold; color: #10b981; }
    .vendor-name { font-size: 18px; color: #374151; margin-top: 10px; }
    .receipt-info { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .line-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .total { font-weight: bold; font-size: 18px; margin-top: 15px; background: #10b981; color: white; padding: 12px; border-radius: 8px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
    .badge { background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .property-badge { background: #dcfce7; color: #166534; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">${receiptVendor}</div>
    <p style="margin: 5px 0; color: #6b7280;">Official Receipt</p>
    <span class="badge">VERIFIED EXPENSE</span>
  </div>
  
  <div class="receipt-info">
    <p><strong>Description:</strong> ${receiptTitle}</p>
    <p><strong>Property:</strong> <span class="badge property-badge">3069 Rita Way Retreat</span></p>
    <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    <p><strong>Transaction ID:</strong> #${Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
  </div>
  
  <div class="line-items">
    ${itemsHtml}
    <div class="line-item total">
      <span>TOTAL PAID</span>
      <span>${receiptAmount}</span>
    </div>
  </div>
  
  <div class="footer">
    <p style="color: #10b981; font-weight: 600;">✓ Receipt verified by PeachHaus Group</p>
    <p>This expense has been reviewed and billed to your property account.</p>
    <p style="margin-top: 15px;">PeachHaus Group LLC • info@peachhausgroup.com</p>
  </div>
</body>
</html>`;
      
      // Create a data URL for the HTML content
      const base64Html = btoa(unescape(encodeURIComponent(sampleReceiptHtml)));
      const dataUrl = `data:text/html;base64,${base64Html}`;
      
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
