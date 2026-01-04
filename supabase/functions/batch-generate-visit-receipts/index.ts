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
  const propertyAddress = visit.properties?.address || "Property";
  const visitDate = new Date(visit.date);
  const formattedDate = visitDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  // Generate receipt number
  const receiptNumber = `VIS-${visitDate.getFullYear()}${String(visitDate.getMonth() + 1).padStart(2, '0')}-${visit.id.slice(0, 6).toUpperCase()}`;
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(visit.price || 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Service Receipt - ${receiptNumber}</title>
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
    
    /* Notes */
    .notes-section {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #E5E5E5;
    }
    
    .notes-content {
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
        <div class="receipt-type">Service Receipt</div>
      </div>
      <dl class="receipt-meta">
        <dt>Receipt No.</dt>
        <dd>${receiptNumber}</dd>
        <dt>Issue Date</dt>
        <dd>${generatedDate}</dd>
      </dl>
    </div>
    
    <div class="amount-section">
      <div class="amount-label">Service Fee</div>
      <div class="amount-value">${amount}</div>
      <div class="amount-status">Paid</div>
    </div>
    
    <div class="details">
      <div class="property-section">
        <div class="section-title">Property</div>
        <div class="property-address">${propertyAddress}</div>
      </div>
      
      <div class="section-title">Service Details</div>
      <div class="detail-grid">
        <div class="detail-row">
          <span class="detail-label">Service Date</span>
          <span class="detail-value">${formattedDate}</span>
        </div>
        ${visit.time ? `
        <div class="detail-row">
          <span class="detail-label">Time</span>
          <span class="detail-value">${visit.time}</span>
        </div>
        ` : ''}
        <div class="detail-row">
          <span class="detail-label">Service Type</span>
          <span class="detail-value">Property Visit</span>
        </div>
        ${visit.visited_by ? `
        <div class="detail-row">
          <span class="detail-label">Team Member</span>
          <span class="detail-value">${visit.visited_by}</span>
        </div>
        ` : ''}
        ${visit.hours ? `
        <div class="detail-row">
          <span class="detail-label">Duration</span>
          <span class="detail-value">${visit.hours} hour${visit.hours !== 1 ? 's' : ''}</span>
        </div>
        ` : ''}
      </div>
      
      ${visit.notes ? `
      <div class="notes-section">
        <div class="section-title">Service Notes</div>
        <div class="notes-content">${visit.notes}</div>
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
