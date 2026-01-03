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
      year: "numeric",
    });
  };

  // Generate visit rows
  const visitRows = data.visits.map((visit) => {
    const hourlyRate = 50;
    const hourlyCharge = (visit.hours || 0) * hourlyRate;
    const baseVisitFee = visit.amount - hourlyCharge;
    
    let detailLine = "";
    if (visit.hours && visit.hours > 0) {
      detailLine = `<div style="font-size: 10px; color: #6b7280; margin-top: 2px; padding-left: 12px;">↳ Base: ${formatCurrency(baseVisitFee)} + ${visit.hours} hr${visit.hours > 1 ? "s" : ""} @ $${hourlyRate}/hr = ${formatCurrency(hourlyCharge)}</div>`;
    }
    if (visit.notes) {
      detailLine += `<div style="font-size: 10px; color: #6b7280; margin-top: 2px; padding-left: 12px; font-style: italic;">📝 ${visit.notes}</div>`;
    }

    return `
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
          <div style="font-size: 12px; color: #374151;">${visit.description}</div>
          <div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">${visit.date ? formatDate(visit.date) : ""}</div>
          ${detailLine}
        </td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f3f4f6; text-align: right; font-family: 'Courier New', monospace; font-size: 12px; color: #374151; vertical-align: top;">
          ${formatCurrency(visit.amount)}
        </td>
      </tr>
    `;
  }).join("");

  // Generate expense rows
  const expenseRows = data.expenses.map((expense) => `
    <tr>
      <td style="padding: 10px 16px; border-bottom: 1px solid #f3f4f6;">
        <div style="font-size: 12px; color: #374151;">${expense.description}</div>
        <div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">${expense.date ? formatDate(expense.date) : ""}${expense.category ? ` • ${expense.category}` : ""}</div>
      </td>
      <td style="padding: 10px 16px; border-bottom: 1px solid #f3f4f6; text-align: right; font-family: 'Courier New', monospace; font-size: 12px; color: #374151;">
        ${formatCurrency(expense.amount)}
      </td>
    </tr>
  `).join("");

  const isPositiveNet = data.netOwnerEarnings >= 0;
  const netLabel = data.serviceType === "cohosting" 
    ? (isPositiveNet ? "Net Owner Earnings" : "Balance Due from Owner")
    : "Net Owner Payout";
  const netColor = isPositiveNet ? "#059669" : "#dc2626";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Owner Statement - ${data.periodMonth} ${data.periodYear}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #ffffff;
      color: #1f2937;
      line-height: 1.5;
      font-size: 12px;
    }
    
    .page {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      background: white;
    }
    
    @media print {
      .page { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="page">
    
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid #FF7F00;">
      <div>
        <div style="font-size: 28px; font-weight: 700; color: #FF7F00; letter-spacing: -0.5px;">PeachHaus</div>
        <div style="font-size: 11px; color: #6b7280; margin-top: 4px; letter-spacing: 0.5px;">PROPERTY MANAGEMENT</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">OWNER STATEMENT</div>
        <div style="font-size: 11px; color: #6b7280;">
          <div>Statement ID: <span style="font-family: 'Courier New', monospace; font-weight: 500;">${data.statementId}</span></div>
          <div style="margin-top: 2px;">Issue Date: ${data.statementDate}</div>
        </div>
      </div>
    </div>

    <!-- Property & Owner Info -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 32px; gap: 24px;">
      <div style="flex: 1; background: #f9fafb; border-radius: 8px; padding: 20px; border-left: 4px solid #FF7F00;">
        <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Property</div>
        <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">${data.propertyName}</div>
        <div style="font-size: 11px; color: #6b7280;">${data.propertyAddress}</div>
      </div>
      <div style="flex: 1; background: #f9fafb; border-radius: 8px; padding: 20px;">
        <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Statement Period</div>
        <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">${data.periodMonth} ${data.periodYear}</div>
        <div style="font-size: 11px; color: #6b7280;">Prepared for: ${data.ownerName}</div>
      </div>
    </div>

    <!-- Financial Summary Box -->
    <div style="background: linear-gradient(135deg, ${isPositiveNet ? "#ecfdf5" : "#fef2f2"} 0%, ${isPositiveNet ? "#d1fae5" : "#fee2e2"} 100%); border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid ${isPositiveNet ? "#a7f3d0" : "#fecaca"};">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${netLabel}</div>
          <div style="font-size: 32px; font-weight: 700; color: ${netColor}; font-family: 'Courier New', monospace;">
            ${formatCurrency(Math.abs(data.netOwnerEarnings))}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; color: #6b7280;">Gross Revenue</div>
          <div style="font-size: 18px; font-weight: 600; color: #059669; font-family: 'Courier New', monospace;">${formatCurrency(data.grossRevenue)}</div>
          <div style="font-size: 11px; color: #6b7280; margin-top: 8px;">Total Expenses</div>
          <div style="font-size: 18px; font-weight: 600; color: #dc2626; font-family: 'Courier New', monospace;">${formatCurrency(data.totalExpenses)}</div>
        </div>
      </div>
    </div>

    <!-- Revenue Section -->
    <div style="margin-bottom: 24px;">
      <div style="font-size: 13px; font-weight: 600; color: #1f2937; padding: 12px 16px; background: #f3f4f6; border-radius: 8px 8px 0 0; border-bottom: 2px solid #059669;">
        REVENUE
      </div>
      <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; border-top: none;">
        ${data.shortTermRevenue > 0 ? `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #374151;">Short-term Booking Revenue</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; text-align: right; font-family: 'Courier New', monospace; font-size: 12px; color: #059669; font-weight: 500;">${formatCurrency(data.shortTermRevenue)}</td>
        </tr>` : ""}
        ${data.midTermRevenue > 0 ? `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #374151;">Mid-term Rental Revenue</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; text-align: right; font-family: 'Courier New', monospace; font-size: 12px; color: #059669; font-weight: 500;">${formatCurrency(data.midTermRevenue)}</td>
        </tr>` : ""}
        <tr style="background: #ecfdf5;">
          <td style="padding: 14px 16px; font-size: 12px; font-weight: 600; color: #065f46;">TOTAL GROSS REVENUE</td>
          <td style="padding: 14px 16px; text-align: right; font-family: 'Courier New', monospace; font-size: 14px; color: #065f46; font-weight: 700;">${formatCurrency(data.grossRevenue)}</td>
        </tr>
      </table>
    </div>

    <!-- Expenses Section -->
    <div style="margin-bottom: 24px;">
      <div style="font-size: 13px; font-weight: 600; color: #1f2937; padding: 12px 16px; background: #f3f4f6; border-radius: 8px 8px 0 0; border-bottom: 2px solid #dc2626;">
        EXPENSES & FEES
      </div>
      <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; border-top: none;">
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #374151;">Management Fee (${data.managementFeePercentage}% of revenue)</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; text-align: right; font-family: 'Courier New', monospace; font-size: 12px; color: #374151;">${formatCurrency(data.managementFee)}</td>
        </tr>
        ${data.orderMinimumFee > 0 ? `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #374151;">Operational Minimum Fee</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; text-align: right; font-family: 'Courier New', monospace; font-size: 12px; color: #374151;">${formatCurrency(data.orderMinimumFee)}</td>
        </tr>` : ""}
        ${visitRows}
        ${expenseRows}
        ${data.cleaningFees > 0 ? `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #374151;">
            <div>Cleaning Fees (pass-through)</div>
            <div style="font-size: 10px; color: #9ca3af;">Collected from guests, paid to service providers</div>
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; text-align: right; font-family: 'Courier New', monospace; font-size: 12px; color: #374151;">${formatCurrency(data.cleaningFees)}</td>
        </tr>` : ""}
        ${data.petFees > 0 ? `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #374151;">
            <div>Pet Fees (pass-through)</div>
            <div style="font-size: 10px; color: #9ca3af;">Collected from guests, paid to service providers</div>
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; text-align: right; font-family: 'Courier New', monospace; font-size: 12px; color: #374151;">${formatCurrency(data.petFees)}</td>
        </tr>` : ""}
        <tr style="background: #fef2f2;">
          <td style="padding: 14px 16px; font-size: 12px; font-weight: 600; color: #991b1b;">TOTAL EXPENSES</td>
          <td style="padding: 14px 16px; text-align: right; font-family: 'Courier New', monospace; font-size: 14px; color: #991b1b; font-weight: 700;">${formatCurrency(data.totalExpenses)}</td>
        </tr>
      </table>
    </div>

    <!-- Net Result -->
    <div style="background: #1f2937; border-radius: 12px; padding: 24px; margin-bottom: 40px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="color: white;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7; margin-bottom: 4px;">${netLabel}</div>
          <div style="font-size: 10px; opacity: 0.5;">For period ${data.periodMonth} ${data.periodYear}</div>
        </div>
        <div style="font-size: 36px; font-weight: 700; color: ${isPositiveNet ? "#34d399" : "#f87171"}; font-family: 'Courier New', monospace;">
          ${isPositiveNet ? "" : "-"}${formatCurrency(Math.abs(data.netOwnerEarnings))}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; text-align: center;">
      <div style="font-size: 11px; color: #6b7280; margin-bottom: 8px;">
        This is an official financial statement from PeachHaus Property Management.
      </div>
      <div style="font-size: 11px; color: #9ca3af;">
        Questions? Contact us at <span style="color: #FF7F00;">info@peachhausgroup.com</span>
      </div>
      <div style="font-size: 10px; color: #d1d5db; margin-top: 16px;">
        Statement ID: ${data.statementId} • Generated: ${data.statementDate}
      </div>
    </div>

  </div>
</body>
</html>
  `;
}

serve(handler);
