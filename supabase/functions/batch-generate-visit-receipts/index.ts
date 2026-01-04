import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all visits without receipts
    const { data: visits, error: visitsError } = await supabase
      .from("visits")
      .select(`
        id,
        date,
        time,
        price,
        notes,
        hours,
        visited_by,
        property_id,
        properties(name, address)
      `)
      .is("receipt_path", null)
      .order("date", { ascending: false });

    if (visitsError) throw visitsError;

    console.log(`Found ${visits?.length || 0} visits without receipts`);

    let generated = 0;
    let failed = 0;

    for (const visit of visits || []) {
      try {
        // Generate HTML receipt
        const receiptHtml = generateVisitReceiptHtml(visit);
        const fileName = `visit-receipts/${visit.id}.html`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("expense-documents")
          .upload(fileName, new Blob([receiptHtml], { type: "text/html" }), {
            contentType: "text/html",
            upsert: true,
          });

        if (uploadError) {
          console.error(`Failed to upload receipt for visit ${visit.id}:`, uploadError);
          failed++;
          continue;
        }

        // Update visit with receipt path
        await supabase
          .from("visits")
          .update({ receipt_path: fileName })
          .eq("id", visit.id);

        generated++;
      } catch (err) {
        console.error(`Error generating receipt for visit ${visit.id}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: visits?.length || 0,
        generated,
        failed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Batch generate error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateVisitReceiptHtml(visit: any): string {
  const propertyName = visit.properties?.name || "Property";
  const propertyAddress = visit.properties?.address || "";
  const visitDate = new Date(visit.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const visitTime = visit.time || "";
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(visit.price || 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visit Receipt - ${propertyAddress}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8f9fa;
      padding: 20px;
      min-height: 100vh;
    }
    .receipt {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 5px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .content { padding: 30px; }
    .section { margin-bottom: 25px; }
    .section-title { 
      font-size: 11px; 
      text-transform: uppercase; 
      letter-spacing: 1px; 
      color: #6b7280; 
      margin-bottom: 8px; 
    }
    .section-value { font-size: 16px; color: #111827; font-weight: 500; }
    .amount-section {
      background: #f9fafb;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 25px 0;
    }
    .amount { font-size: 36px; font-weight: 700; color: #111827; }
    .notes {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      border-radius: 0 8px 8px 0;
      margin-top: 20px;
    }
    .notes-title { font-weight: 600; color: #92400e; margin-bottom: 8px; }
    .notes-content { color: #78350f; font-size: 14px; line-height: 1.6; }
    .footer {
      border-top: 1px solid #e5e7eb;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
    .badge {
      display: inline-block;
      background: #dcfce7;
      color: #166534;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>PeachHaus Group LLC</h1>
      <p>Property Visit Receipt</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">Property</div>
        <div class="section-value">${propertyAddress || propertyName}</div>
      </div>
      <div class="section">
        <div class="section-title">Visit Date</div>
        <div class="section-value">${visitDate}${visitTime ? ` at ${visitTime}` : ""}</div>
      </div>
      ${visit.visited_by ? `
      <div class="section">
        <div class="section-title">Visited By</div>
        <div class="section-value">${visit.visited_by}</div>
      </div>
      ` : ""}
      ${visit.hours ? `
      <div class="section">
        <div class="section-title">Duration</div>
        <div class="section-value">${visit.hours} hour${visit.hours !== 1 ? "s" : ""}</div>
      </div>
      ` : ""}
      <div class="amount-section">
        <div class="section-title">Visit Fee</div>
        <div class="amount">${amount}</div>
        <div class="badge">✓ Paid</div>
      </div>
      ${visit.notes ? `
      <div class="notes">
        <div class="notes-title">Service Notes</div>
        <div class="notes-content">${visit.notes}</div>
      </div>
      ` : ""}
    </div>
    <div class="footer">
      Receipt ID: ${visit.id}<br>
      Generated by PeachHaus Property Management System
    </div>
  </div>
</body>
</html>`;
}
