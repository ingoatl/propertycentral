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
    if (receiptPath.startsWith("demo-receipts/")) {
      console.log("Demo receipt requested, returning sample receipt data");
      
      // Return a base64-encoded sample receipt HTML for demo purposes
      const sampleReceiptHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sample Receipt</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 20px; }
    .logo { font-size: 24px; font-weight: bold; color: #10b981; }
    .receipt-info { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .line-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .total { font-weight: bold; font-size: 18px; margin-top: 15px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
    .badge { background: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">PeachHaus Group</div>
    <p style="margin: 5px 0; color: #6b7280;">Property Management Services</p>
    <span class="badge">SAMPLE RECEIPT</span>
  </div>
  
  <div class="receipt-info">
    <p><strong>Property:</strong> 3069 Rita Way Retreat</p>
    <p><strong>Owner:</strong> Sarah & Michael Thompson</p>
    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
  </div>
  
  <div class="line-items">
    <div class="line-item">
      <span>Property Maintenance Supplies</span>
      <span>$45.99</span>
    </div>
    <div class="line-item">
      <span>Guest Amenities Package</span>
      <span>$28.50</span>
    </div>
    <div class="line-item">
      <span>Cleaning Products</span>
      <span>$15.25</span>
    </div>
    <div class="line-item total">
      <span>TOTAL</span>
      <span>$89.74</span>
    </div>
  </div>
  
  <div class="footer">
    <p>This is a sample receipt for demonstration purposes.</p>
    <p>Actual receipts are stored securely and linked to your expenses.</p>
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
