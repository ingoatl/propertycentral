import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface LineItem {
  description: string;
  amount: number;
  date?: string;
  category?: string;
  notes?: string;
  hours?: number;
}

interface StatementData {
  statementId: string;
  statementDate: string;
  propertyName: string;
  propertyAddress: string;
  ownerName: string;
  periodMonth: string;
  periodYear: string;
  
  // Revenue
  shortTermRevenue: number;
  midTermRevenue: number;
  grossRevenue: number;
  
  // Expenses
  managementFee: number;
  managementFeePercentage: number;
  orderMinimumFee: number;
  visits: LineItem[];
  expenses: LineItem[];
  cleaningFees: number;
  petFees: number;
  totalExpenses: number;
  
  // Net Result
  netOwnerEarnings: number;
  serviceType: 'cohosting' | 'full_service';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { reconciliation_id } = await req.json();

    if (!reconciliation_id) {
      throw new Error("reconciliation_id is required");
    }

    console.log(`Generating PDF for reconciliation: ${reconciliation_id}`);

    // Fetch reconciliation data
    const { data: reconciliation, error: recError } = await supabase
      .from("monthly_reconciliations")
      .select(`
        *,
        properties(*),
        property_owners(name, email)
      `)
      .eq("id", reconciliation_id)
      .single();

    if (recError || !reconciliation) {
      throw new Error("Reconciliation not found");
    }

    // Fetch line items
    const { data: lineItems, error: itemsError } = await supabase
      .from("reconciliation_line_items")
      .select("*")
      .eq("reconciliation_id", reconciliation_id)
      .eq("verified", true)
      .eq("excluded", false)
      .order("date", { ascending: false });

    if (itemsError) throw itemsError;

    // Deduplicate line items
    const seenIds = new Set<string>();
    const deduplicatedItems = (lineItems || []).filter((item: any) => {
      if (!item.item_id) return true;
      const key = `${item.item_type}:${item.item_id}`;
      if (seenIds.has(key)) return false;
      seenIds.add(key);
      return true;
    });

    // Fetch visit details
    const visitLineItems = deduplicatedItems.filter((item: any) => item.item_type === "visit");
    const visitIds = visitLineItems.map((v: any) => v.item_id);
    let visitDetails: any[] = [];
    
    if (visitIds.length > 0) {
      const { data: visits } = await supabase
        .from("visits")
        .select("id, notes, visited_by, hours, price")
        .in("id", visitIds);
      visitDetails = visits || [];
    }

    // Calculate totals
    const visits = visitLineItems.map((item: any) => {
      const detail = visitDetails.find((d: any) => d.id === item.item_id);
      return {
        description: item.description,
        amount: Math.abs(item.amount),
        date: item.date,
        notes: detail?.notes,
        hours: detail?.hours || 0,
      };
    });

    const expenses = deduplicatedItems
      .filter((item: any) => {
        if (item.item_type !== "expense") return false;
        const desc = (item.description || "").toLowerCase();
        return !desc.includes("visit fee") && !desc.includes("visit charge");
      })
      .map((item: any) => ({
        description: item.description,
        amount: Math.abs(item.amount),
        date: item.date,
        category: item.category,
      }));

    const visitTotal = visits.reduce((sum: number, v: any) => sum + v.amount, 0);
    const expenseTotal = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
    const cleaningFees = deduplicatedItems
      .filter((item: any) => item.fee_type === "cleaning_fee")
      .reduce((sum: number, item: any) => sum + Math.abs(item.amount), 0);
    const petFees = deduplicatedItems
      .filter((item: any) => item.fee_type === "pet_fee")
      .reduce((sum: number, item: any) => sum + Math.abs(item.amount), 0);

    // Check order minimum
    const orderMinLineItem = deduplicatedItems.find((item: any) => item.item_type === "order_minimum");
    const orderMinimumFee = orderMinLineItem ? Math.abs(orderMinLineItem.amount) : 0;

    const managementFee = Number(reconciliation.management_fee || 0);
    const totalExpenses = managementFee + orderMinimumFee + visitTotal + expenseTotal + cleaningFees + petFees;
    const grossRevenue = Number(reconciliation.total_revenue || 0);
    const netOwnerEarnings = grossRevenue - totalExpenses;

    const monthDate = new Date(reconciliation.reconciliation_month + "T00:00:00");
    const periodMonth = monthDate.toLocaleDateString("en-US", { month: "long" });
    const periodYear = monthDate.getFullYear().toString();

    // Generate statement ID
    const statementId = `PH-${periodYear}${String(monthDate.getMonth() + 1).padStart(2, "0")}-${reconciliation.id.slice(0, 8).toUpperCase()}`;

    const statementData: StatementData = {
      statementId,
      statementDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      propertyName: reconciliation.properties?.name || "Property",
      propertyAddress: reconciliation.properties?.address || "",
      ownerName: reconciliation.property_owners?.name || "Property Owner",
      periodMonth,
      periodYear,
      shortTermRevenue: Number(reconciliation.short_term_revenue || 0),
      midTermRevenue: Number(reconciliation.mid_term_revenue || 0),
      grossRevenue,
      managementFee,
      managementFeePercentage: reconciliation.properties?.management_fee_percentage || 15,
      orderMinimumFee,
      visits,
      expenses,
      cleaningFees,
      petFees,
      totalExpenses,
      netOwnerEarnings,
      serviceType: "cohosting",
    };

    // Generate PDF HTML
    const pdfHtml = generatePdfHtml(statementData);

    return new Response(
      JSON.stringify({
        success: true,
        html: pdfHtml,
        statementData,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function generatePdfHtml(data: StatementData): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Generate visit rows - compact format
  const visitRows = data.visits.map((visit) => {
    const hourlyRate = 50;
    const hourlyCharge = (visit.hours || 0) * hourlyRate;
    const baseVisitFee = visit.amount - hourlyCharge;
    
    let detail = visit.date ? formatDate(visit.date) : "";
    if (visit.hours && visit.hours > 0) {
      detail += ` • Base ${formatCurrency(baseVisitFee)} + ${visit.hours}h`;
    }

    return `
      <tr>
        <td style="padding: 6px 0; font-size: 11px; color: #111111; border-bottom: 1px solid #e5e5e5;">
          ${visit.description}
          <span style="color: #666666; font-size: 10px; margin-left: 8px;">${detail}</span>
        </td>
        <td style="padding: 6px 0; font-size: 11px; color: #111111; text-align: right; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">
          ${formatCurrency(visit.amount)}
        </td>
      </tr>
    `;
  }).join("");

  // Generate expense rows - compact format
  const expenseRows = data.expenses.map((expense) => `
    <tr>
      <td style="padding: 6px 0; font-size: 11px; color: #111111; border-bottom: 1px solid #e5e5e5;">
        ${expense.description}
        <span style="color: #666666; font-size: 10px; margin-left: 8px;">${expense.date ? formatDate(expense.date) : ""}</span>
      </td>
      <td style="padding: 6px 0; font-size: 11px; color: #111111; text-align: right; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">
        ${formatCurrency(expense.amount)}
      </td>
    </tr>
  `).join("");

  const isPositiveNet = data.netOwnerEarnings >= 0;
  const netLabel = data.serviceType === "cohosting" 
    ? (isPositiveNet ? "NET OWNER EARNINGS" : "BALANCE DUE FROM OWNER")
    : "NET OWNER PAYOUT";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Owner Statement - ${data.periodMonth} ${data.periodYear}</title>
  <style>
    @page {
      size: letter;
      margin: 0.5in;
    }
    
    * { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0; 
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
      background: #ffffff;
      color: #111111;
      line-height: 1.4;
      font-size: 11px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .page {
      max-width: 7.5in;
      margin: 0 auto;
      padding: 0;
      background: white;
    }
    
    @media print {
      body { background: white; }
      .page { 
        padding: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    
    <!-- Header - Corporate Minimal -->
    <table style="width: 100%; border-bottom: 2px solid #111111; padding-bottom: 12px; margin-bottom: 16px;">
      <tr>
        <td style="vertical-align: bottom;">
          <div style="font-size: 18px; font-weight: 700; color: #111111; letter-spacing: -0.3px;">PeachHaus</div>
          <div style="font-size: 9px; color: #666666; margin-top: 2px; letter-spacing: 1px; text-transform: uppercase;">Property Management</div>
        </td>
        <td style="text-align: right; vertical-align: bottom;">
          <div style="font-size: 14px; font-weight: 600; color: #111111; margin-bottom: 4px;">OWNER STATEMENT</div>
          <div style="font-size: 9px; color: #666666; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace;">
            ${data.statementId}
          </div>
        </td>
      </tr>
    </table>

    <!-- Property & Period Info - Compact -->
    <table style="width: 100%; margin-bottom: 16px; border: 1px solid #e5e5e5;">
      <tr>
        <td style="padding: 10px 12px; background: #f9f9f9; width: 50%; vertical-align: top; border-right: 1px solid #e5e5e5;">
          <div style="font-size: 9px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Property</div>
          <div style="font-size: 12px; font-weight: 600; color: #111111;">${data.propertyName}</div>
          <div style="font-size: 10px; color: #666666; margin-top: 2px;">${data.propertyAddress}</div>
        </td>
        <td style="padding: 10px 12px; background: #f9f9f9; width: 50%; vertical-align: top;">
          <div style="font-size: 9px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Statement Period</div>
          <div style="font-size: 12px; font-weight: 600; color: #111111;">${data.periodMonth} ${data.periodYear}</div>
          <div style="font-size: 10px; color: #666666; margin-top: 2px;">Prepared for: ${data.ownerName}</div>
        </td>
      </tr>
    </table>

    <!-- Financial Summary - The Key Numbers -->
    <table style="width: 100%; margin-bottom: 16px; border: 1px solid #111111;">
      <tr>
        <td style="padding: 12px 16px; background: #111111; color: #ffffff;">
          <table style="width: 100%;">
            <tr>
              <td style="vertical-align: middle;">
                <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; margin-bottom: 2px;">${netLabel}</div>
                <div style="font-size: 10px; opacity: 0.6;">For period ${data.periodMonth} ${data.periodYear}</div>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <div style="font-size: 24px; font-weight: 700; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace; color: #ffffff;">
                  ${isPositiveNet ? "" : "-"}${formatCurrency(Math.abs(data.netOwnerEarnings))}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; background: #f9f9f9; border-top: 1px solid #e5e5e5;">
          <table style="width: 100%;">
            <tr>
              <td style="font-size: 10px; color: #666666;">Gross Revenue</td>
              <td style="font-size: 12px; font-weight: 600; color: #111111; text-align: right; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace;">${formatCurrency(data.grossRevenue)}</td>
              <td style="width: 40px;"></td>
              <td style="font-size: 10px; color: #666666;">Total Expenses</td>
              <td style="font-size: 12px; font-weight: 600; color: #111111; text-align: right; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace;">(${formatCurrency(data.totalExpenses)})</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Revenue Section -->
    <div style="margin-bottom: 12px;">
      <div style="font-size: 10px; font-weight: 600; color: #111111; padding: 6px 0; border-bottom: 1px solid #111111; text-transform: uppercase; letter-spacing: 0.5px;">
        Revenue
      </div>
      <table style="width: 100%;">
        ${data.shortTermRevenue > 0 ? `
        <tr>
          <td style="padding: 6px 0; font-size: 11px; color: #111111; border-bottom: 1px solid #e5e5e5;">Short-term Booking Revenue</td>
          <td style="padding: 6px 0; font-size: 11px; color: #111111; text-align: right; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">${formatCurrency(data.shortTermRevenue)}</td>
        </tr>` : ""}
        ${data.midTermRevenue > 0 ? `
        <tr>
          <td style="padding: 6px 0; font-size: 11px; color: #111111; border-bottom: 1px solid #e5e5e5;">Mid-term Rental Revenue</td>
          <td style="padding: 6px 0; font-size: 11px; color: #111111; text-align: right; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">${formatCurrency(data.midTermRevenue)}</td>
        </tr>` : ""}
        <tr style="background: #f9f9f9;">
          <td style="padding: 8px 0; font-size: 11px; font-weight: 600; color: #111111;">TOTAL GROSS REVENUE</td>
          <td style="padding: 8px 0; font-size: 12px; color: #111111; text-align: right; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace; font-weight: 700;">${formatCurrency(data.grossRevenue)}</td>
        </tr>
      </table>
    </div>

    <!-- Expenses Section -->
    <div style="margin-bottom: 12px;">
      <div style="font-size: 10px; font-weight: 600; color: #111111; padding: 6px 0; border-bottom: 1px solid #111111; text-transform: uppercase; letter-spacing: 0.5px;">
        Expenses & Fees
      </div>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 6px 0; font-size: 11px; color: #111111; border-bottom: 1px solid #e5e5e5;">Management Fee (${data.managementFeePercentage}%)</td>
          <td style="padding: 6px 0; font-size: 11px; color: #111111; text-align: right; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">${formatCurrency(data.managementFee)}</td>
        </tr>
        ${data.orderMinimumFee > 0 ? `
        <tr>
          <td style="padding: 6px 0; font-size: 11px; color: #111111; border-bottom: 1px solid #e5e5e5;">Operational Minimum Fee</td>
          <td style="padding: 6px 0; font-size: 11px; color: #111111; text-align: right; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">${formatCurrency(data.orderMinimumFee)}</td>
        </tr>` : ""}
        ${visitRows}
        ${expenseRows}
        ${data.cleaningFees > 0 ? `
        <tr>
          <td style="padding: 6px 0; font-size: 11px; color: #111111; border-bottom: 1px solid #e5e5e5;">
            Cleaning Fees <span style="color: #666666; font-size: 10px;">(pass-through)</span>
          </td>
          <td style="padding: 6px 0; font-size: 11px; color: #111111; text-align: right; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">${formatCurrency(data.cleaningFees)}</td>
        </tr>` : ""}
        ${data.petFees > 0 ? `
        <tr>
          <td style="padding: 6px 0; font-size: 11px; color: #111111; border-bottom: 1px solid #e5e5e5;">
            Pet Fees <span style="color: #666666; font-size: 10px;">(pass-through)</span>
          </td>
          <td style="padding: 6px 0; font-size: 11px; color: #111111; text-align: right; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">${formatCurrency(data.petFees)}</td>
        </tr>` : ""}
        <tr style="background: #f9f9f9;">
          <td style="padding: 8px 0; font-size: 11px; font-weight: 600; color: #111111;">TOTAL EXPENSES</td>
          <td style="padding: 8px 0; font-size: 12px; color: #111111; text-align: right; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace; font-weight: 700;">(${formatCurrency(data.totalExpenses)})</td>
        </tr>
      </table>
    </div>

    <!-- Net Result - Final -->
    <table style="width: 100%; margin-bottom: 20px; border: 2px solid #111111;">
      <tr>
        <td style="padding: 12px 16px; background: #111111;">
          <table style="width: 100%;">
            <tr>
              <td style="font-size: 11px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">${netLabel}</td>
              <td style="font-size: 18px; font-weight: 700; color: #ffffff; text-align: right; font-family: 'SF Mono', 'Menlo', 'Courier New', monospace;">
                ${isPositiveNet ? "" : "-"}${formatCurrency(Math.abs(data.netOwnerEarnings))}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <div style="border-top: 1px solid #e5e5e5; padding-top: 12px;">
      <table style="width: 100%;">
        <tr>
          <td style="font-size: 9px; color: #666666;">
            This is an official financial statement from PeachHaus Property Management.<br>
            Please retain for your records.
          </td>
          <td style="text-align: right; font-size: 9px; color: #666666;">
            Questions? Contact info@peachhausgroup.com<br>
            <span style="font-family: 'SF Mono', 'Menlo', 'Courier New', monospace;">${data.statementId}</span> • ${data.statementDate}
          </td>
        </tr>
      </table>
    </div>

  </div>
</body>
</html>
  `;
}

serve(handler);
