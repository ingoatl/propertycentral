import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VisitData {
  id: string;
  date: string;
  time: string;
  price: number;
  hours: number | null;
  notes: string | null;
  visited_by: string | null;
  property_id: string;
  property_address: string;
  property_name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { visitId } = await req.json();
    
    if (!visitId) {
      throw new Error("visitId is required");
    }

    console.log(`Generating receipt for visit: ${visitId}`);

    // Fetch visit with property info
    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .select(`
        id,
        date,
        time,
        price,
        hours,
        notes,
        visited_by,
        property_id,
        receipt_path,
        properties!inner (
          name,
          address
        )
      `)
      .eq("id", visitId)
      .single();

    if (visitError || !visit) {
      console.error("Visit fetch error:", visitError);
      throw new Error(`Visit not found: ${visitError?.message || 'Unknown error'}`);
    }

    // If receipt already exists, return it
    if (visit.receipt_path) {
      console.log(`Receipt already exists at: ${visit.receipt_path}`);
      const { data: signedData } = await supabase.storage
        .from("expense-documents")
        .createSignedUrl(visit.receipt_path, 3600);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          receiptPath: visit.receipt_path,
          signedUrl: signedData?.signedUrl 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const property = (visit.properties as unknown) as { name: string; address: string };

    // Format date nicely
    const visitDate = new Date(visit.date);
    const formattedDate = visitDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Generate HTML receipt
    const receiptHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Property Visit Receipt</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .receipt {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #f97316, #ea580c);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .header p {
      font-size: 14px;
      opacity: 0.9;
    }
    .badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 12px;
      margin-top: 10px;
    }
    .content {
      padding: 30px;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .section-content {
      font-size: 16px;
      color: #1f2937;
    }
    .property-address {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .divider {
      height: 1px;
      background: #e5e7eb;
      margin: 25px 0;
    }
    .total-section {
      background: #fef3c7;
      padding: 20px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total-label {
      font-size: 14px;
      color: #92400e;
      font-weight: 500;
    }
    .total-amount {
      font-size: 28px;
      font-weight: 700;
      color: #92400e;
    }
    .notes-section {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .notes-title {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .notes-content {
      font-size: 14px;
      color: #4b5563;
      line-height: 1.5;
    }
    .footer {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      font-size: 12px;
      color: #6b7280;
    }
    .receipt-number {
      font-size: 12px;
      color: #9ca3af;
      text-align: center;
      margin-top: 15px;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>PeachHaus Group LLC</h1>
      <p>Property Management Services</p>
      <div class="badge">PROPERTY VISIT RECEIPT</div>
    </div>
    
    <div class="content">
      <div class="section">
        <div class="section-title">Property</div>
        <div class="property-address">${property.address}</div>
      </div>
      
      <div class="details-grid">
        <div class="section">
          <div class="section-title">Visit Date</div>
          <div class="section-content">${formattedDate}</div>
        </div>
        <div class="section">
          <div class="section-title">Time</div>
          <div class="section-content">${visit.time || 'Not specified'}</div>
        </div>
        <div class="section">
          <div class="section-title">Team Member</div>
          <div class="section-content">${visit.visited_by || 'PeachHaus Team'}</div>
        </div>
        <div class="section">
          <div class="section-title">Duration</div>
          <div class="section-content">${visit.hours ? `${visit.hours} hour${visit.hours !== 1 ? 's' : ''}` : 'Standard visit'}</div>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <div class="total-section">
        <div class="total-label">Visit Fee</div>
        <div class="total-amount">$${visit.price.toFixed(2)}</div>
      </div>
      
      ${visit.notes ? `
      <div class="notes-section">
        <div class="notes-title">Visit Notes</div>
        <div class="notes-content">${visit.notes}</div>
      </div>
      ` : ''}
      
      <div class="receipt-number">Receipt #VIS-${visit.id.slice(0, 8).toUpperCase()}</div>
    </div>
    
    <div class="footer">
      <p>Thank you for trusting PeachHaus Group LLC with your property.</p>
      <p style="margin-top: 5px;">Questions? Contact us at info@peachhausgroup.com</p>
    </div>
  </div>
</body>
</html>
    `;

    // Store the receipt as HTML file
    const receiptPath = `visit-receipts/${visit.property_id}/${visit.id}.html`;
    const encoder = new TextEncoder();
    const receiptBytes = encoder.encode(receiptHtml);

    const { error: uploadError } = await supabase.storage
      .from("expense-documents")
      .upload(receiptPath, receiptBytes, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error(`Failed to upload receipt: ${uploadError.message}`);
    }

    // Update visit with receipt path
    const { error: updateError } = await supabase
      .from("visits")
      .update({ receipt_path: receiptPath })
      .eq("id", visitId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(`Failed to update visit: ${updateError.message}`);
    }

    console.log(`Receipt generated successfully: ${receiptPath}`);

    // Generate signed URL for immediate viewing
    const { data: signedData } = await supabase.storage
      .from("expense-documents")
      .createSignedUrl(receiptPath, 3600);

    return new Response(
      JSON.stringify({ 
        success: true, 
        receiptPath,
        signedUrl: signedData?.signedUrl 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error generating visit receipt:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
