import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Company information
const COMPANY = {
  name: "PeachHaus Group LLC",
  address: "1860 Sandy Plains Rd Ste 204 #4023, Marietta, GA 30066",
  phone: "(404) 800-5932",
  email: "info@peachhausgroup.com",
  website: "www.peachhausgroup.com",
};

interface LineItem {
  description: string;
  amount: number;
  date?: string;
  category?: string;
  notes?: string;
  hours?: number;
}

interface MidTermProration {
  tenantName: string;
  dateRange: string;
  monthlyRent: number;
  occupiedDays: number;
  daysInMonth: number;
  proratedAmount: number;
  isFullMonth: boolean;
}

interface StatementData {
  statementId: string;
  statementDate: string;
  periodStartDate: string;
  periodEndDate: string;
  propertyName: string;
  propertyAddress: string;
  ownerName: string;
  secondOwnerName?: string;
  ownerAccountId: string;
  periodMonth: string;
  periodYear: string;
  shortTermRevenue: number;
  midTermRevenue: number;
  midTermProrationDetails: MidTermProration[];
  grossRevenue: number;
  managementFee: number;
  managementFeePercentage: number;
  orderMinimumFee: number;
  visits: LineItem[];
  expenses: LineItem[];
  cleaningFees: number;
  petFees: number;
  totalExpenses: number;
  netOwnerEarnings: number;
  serviceType: 'cohosting' | 'full_service';
  showYtd: boolean;
  ytdRevenue: number;
  ytdExpenses: number;
  ytdNetOwner: number;
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

    console.log(`Generating professional PDF for reconciliation: ${reconciliation_id}`);

    // Fetch reconciliation data
    const { data: reconciliation, error: recError } = await supabase
      .from("monthly_reconciliations")
      .select(`
        *,
        properties(*),
        property_owners(id, name, email, service_type, second_owner_name)
      `)
      .eq("id", reconciliation_id)
      .single();

    if (recError || !reconciliation) {
      throw new Error("Reconciliation not found");
    }

    // Calculate period dates
    const recMonth = new Date(reconciliation.reconciliation_month + "T00:00:00");
    const recMonthStart = new Date(recMonth.getFullYear(), recMonth.getMonth(), 1);
    const recMonthEnd = new Date(recMonth.getFullYear(), recMonth.getMonth() + 1, 0);
    const daysInMonth = recMonthEnd.getDate();
    
    // Calculate YTD totals - only show for statements from January 2026 onwards
    const ytdCutoffDate = new Date(2026, 0, 1); // January 1, 2026
    const showYtd = recMonth >= ytdCutoffDate;
    
    let ytdRevenue = 0;
    let ytdExpenses = 0;
    let ytdNetOwner = 0;
    
    if (showYtd) {
      const yearStart = new Date(recMonth.getFullYear(), 0, 1);
      const { data: ytdData } = await supabase
        .from("monthly_reconciliations")
        .select("total_revenue, total_expenses, net_to_owner")
        .eq("property_id", reconciliation.property_id)
        .gte("reconciliation_month", yearStart.toISOString().split('T')[0])
        .lte("reconciliation_month", reconciliation.reconciliation_month)
        .in("status", ["sent", "statement_sent", "completed"]);
      
      ytdRevenue = (ytdData || []).reduce((sum, r) => sum + Number(r.total_revenue || 0), 0);
      ytdExpenses = (ytdData || []).reduce((sum, r) => sum + Number(r.total_expenses || 0), 0);
      ytdNetOwner = (ytdData || []).reduce((sum, r) => sum + Number(r.net_to_owner || 0), 0);
    }
    
    // Calculate mid-term proration details
    const { data: mtBookings } = await supabase
      .from("mid_term_bookings")
      .select("tenant_name, start_date, end_date, monthly_rent, nightly_rate")
      .eq("property_id", reconciliation.properties?.id)
      .eq("status", "active")
      .gte("end_date", recMonthStart.toISOString().split('T')[0])
      .lte("start_date", recMonthEnd.toISOString().split('T')[0]);
    
    const midTermProrationDetails: MidTermProration[] = [];
    
    // Check if there's a revenue override - if so, use it instead of calculated proration
    const hasOverride = reconciliation.revenue_override !== null && reconciliation.revenue_override !== undefined && reconciliation.revenue_override > 0;
    
    if (hasOverride && mtBookings && mtBookings.length > 0) {
      // Use override amount - show as full month with manual adjustment
      const booking = mtBookings[0];
      midTermProrationDetails.push({
        tenantName: booking.tenant_name,
        dateRange: `${recMonth.toLocaleDateString('en-US', { month: 'short' })} (Manual Adjustment)`,
        monthlyRent: Number(reconciliation.revenue_override),
        occupiedDays: daysInMonth,
        daysInMonth: daysInMonth,
        proratedAmount: Number(reconciliation.revenue_override),
        isFullMonth: true
      });
    } else if (mtBookings && mtBookings.length > 0) {
      mtBookings.forEach((booking: any) => {
        const bookingStart = new Date(booking.start_date + "T00:00:00");
        const bookingEnd = new Date(booking.end_date + "T00:00:00");
        
        const effectiveStart = bookingStart > recMonthStart ? bookingStart : recMonthStart;
        const effectiveEnd = bookingEnd < recMonthEnd ? bookingEnd : recMonthEnd;
        
        const occupiedDays = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const monthlyRent = Number(booking.monthly_rent || 0);
        const proratedAmount = (monthlyRent / daysInMonth) * occupiedDays;
        
        const startDay = effectiveStart.getDate();
        const endDay = effectiveEnd.getDate();
        const monthName = recMonth.toLocaleDateString('en-US', { month: 'short' });
        
        midTermProrationDetails.push({
          tenantName: booking.tenant_name,
          dateRange: `${monthName} ${startDay} - ${monthName} ${endDay}`,
          monthlyRent: monthlyRent,
          occupiedDays: occupiedDays,
          daysInMonth: daysInMonth,
          proratedAmount: proratedAmount,
          isFullMonth: occupiedDays >= daysInMonth - 1
        });
      });
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

    const orderMinLineItem = deduplicatedItems.find((item: any) => item.item_type === "order_minimum");
    const orderMinimumFee = orderMinLineItem ? Math.abs(orderMinLineItem.amount) : 0;

    const managementFee = Number(reconciliation.management_fee || 0);
    const totalExpenses = managementFee + orderMinimumFee + visitTotal + expenseTotal + cleaningFees + petFees;
    const grossRevenue = Number(reconciliation.total_revenue || 0);
    const netOwnerEarnings = grossRevenue - totalExpenses;

    const monthDate = new Date(reconciliation.reconciliation_month + "T00:00:00");
    const periodMonth = monthDate.toLocaleDateString("en-US", { month: "long" });
    const periodYear = monthDate.getFullYear().toString();

    const statementId = `PH-${periodYear}${String(monthDate.getMonth() + 1).padStart(2, "0")}-${reconciliation.id.slice(0, 8).toUpperCase()}`;
    const ownerAccountId = `OWN-${reconciliation.property_owners?.id?.slice(0, 6).toUpperCase() || 'XXXXX'}`;
    
    // Check for revenue_override - if set, use it as the mid-term revenue
    const hasRevenueOverride = reconciliation.revenue_override !== null && reconciliation.revenue_override !== undefined && reconciliation.revenue_override > 0;
    const displayMidTermRevenue = hasRevenueOverride ? Number(reconciliation.revenue_override) : Number(reconciliation.mid_term_revenue || 0);

    const statementData: StatementData = {
      statementId,
      statementDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      periodStartDate: recMonthStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      periodEndDate: recMonthEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      propertyName: reconciliation.properties?.name || "Property",
      propertyAddress: reconciliation.properties?.address || "",
      ownerName: reconciliation.property_owners?.name || "Property Owner",
      secondOwnerName: reconciliation.property_owners?.second_owner_name || undefined,
      ownerAccountId,
      periodMonth,
      periodYear,
      shortTermRevenue: Number(reconciliation.short_term_revenue || 0),
      midTermRevenue: displayMidTermRevenue,
      midTermProrationDetails,
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
      serviceType: reconciliation.property_owners?.service_type || "cohosting",
      showYtd,
      ytdRevenue,
      ytdExpenses,
      ytdNetOwner,
    };

    // Generate actual PDF using pdf-lib
    const pdfBytes = await generatePdf(statementData);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
    
    const fileName = `PeachHaus-Statement-${statementData.propertyName.replace(/[^a-zA-Z0-9]/g, '-')}-${statementData.periodMonth}-${statementData.periodYear}.pdf`;

    console.log(`PDF generated successfully: ${fileName}, size: ${pdfBytes.length} bytes`);

    return new Response(
      JSON.stringify({
        success: true,
        pdfBase64,
        fileName,
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

// Helper to wrap long text
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxChars) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word.length > maxChars ? word.substring(0, maxChars - 3) + '...' : word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

async function generatePdf(data: StatementData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const { width, height } = page.getSize();
  const margin = 45;
  let y = height - margin;
  
  const black = rgb(0, 0, 0);
  const gray = rgb(0.45, 0.45, 0.45);
  const lightGray = rgb(0.9, 0.9, 0.9);
  const darkBg = rgb(0.07, 0.07, 0.07);
  // No colors - monochrome professional style to match email
  
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

  // === HEADER WITH COMPANY INFO ===
  page.drawText(COMPANY.name, { x: margin, y, size: 14, font: helveticaBold, color: black });
  y -= 12;
  page.drawText(COMPANY.address, { x: margin, y, size: 8, font: helvetica, color: gray });
  y -= 10;
  page.drawText(`${COMPANY.phone} | ${COMPANY.email}`, { x: margin, y, size: 8, font: helvetica, color: gray });
  
  // Statement title on right
  page.drawText("OWNER STATEMENT", { x: width - margin - 105, y: height - margin, size: 12, font: helveticaBold, color: black });
  page.drawText(data.statementId, { x: width - margin - 105, y: height - margin - 12, size: 8, font: helvetica, color: gray });
  page.drawText(`Generated: ${data.statementDate}`, { x: width - margin - 105, y: height - margin - 22, size: 7, font: helvetica, color: gray });
  
  y -= 8;
  
  // Horizontal line
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1.5, color: black });
  y -= 18;
  
  // === PROPERTY & OWNER INFO ===
  page.drawText("PROPERTY", { x: margin, y, size: 8, font: helveticaBold, color: gray });
  page.drawText("PREPARED FOR", { x: width / 2 + 10, y, size: 8, font: helveticaBold, color: gray });
  y -= 12;
  page.drawText(data.propertyName, { x: margin, y, size: 10, font: helveticaBold, color: black });
  // Show both owner names if second owner exists
  const ownerDisplayName = data.secondOwnerName 
    ? `${data.ownerName} & ${data.secondOwnerName}` 
    : data.ownerName;
  page.drawText(ownerDisplayName, { x: width / 2 + 10, y, size: 10, font: helveticaBold, color: black });
  y -= 11;
  page.drawText(data.propertyAddress, { x: margin, y, size: 8, font: helvetica, color: gray });
  page.drawText(`Account: ${data.ownerAccountId}`, { x: width / 2 + 10, y, size: 8, font: helvetica, color: gray });
  y -= 11;
  page.drawText(`Period: ${data.periodStartDate} - ${data.periodEndDate}`, { x: margin, y, size: 8, font: helvetica, color: gray });
  y -= 18;
  
  // === NET OWNER EARNINGS BOX ===
  const boxHeight = 42;
  page.drawRectangle({
    x: margin,
    y: y - boxHeight,
    width: width - 2 * margin,
    height: boxHeight,
    color: darkBg,
  });
  
  const isPositiveNet = data.netOwnerEarnings >= 0;
  const netLabel = data.serviceType === "cohosting" 
    ? (isPositiveNet ? "NET OWNER EARNINGS" : "BALANCE DUE FROM OWNER")
    : "NET OWNER PAYOUT";
  
  page.drawText(netLabel, { x: margin + 12, y: y - 16, size: 9, font: helveticaBold, color: rgb(1, 1, 1) });
  page.drawText(`Statement Period: ${data.periodMonth} ${data.periodYear}`, { x: margin + 12, y: y - 28, size: 7, font: helvetica, color: rgb(0.7, 0.7, 0.7) });
  
  const netAmountText = formatCurrency(Math.abs(data.netOwnerEarnings));
  page.drawText(netAmountText, { x: width - margin - 95, y: y - 24, size: 18, font: helveticaBold, color: rgb(1, 1, 1) });
  y -= boxHeight + 16;
  
  // === REVENUE BREAKDOWN SECTION ===
  page.drawText("REVENUE BREAKDOWN", { x: margin, y, size: 10, font: helveticaBold, color: black });
  y -= 4;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: black });
  y -= 14;
  
  // Short-term revenue FIRST (if any)
  if (data.shortTermRevenue > 0) {
    page.drawText("Short-term Booking Income", { x: margin, y, size: 9, font: helveticaBold, color: black });
    page.drawText(formatCurrency(data.shortTermRevenue), { x: width - margin - 65, y, size: 9, font: helveticaBold, color: black });
    y -= 13;
  }
  
  // Mid-term revenue with clear proration breakdown
  if (data.midTermRevenue > 0) {
    page.drawText("Mid-term Rental Income", { x: margin, y, size: 9, font: helveticaBold, color: black });
    page.drawText(formatCurrency(data.midTermRevenue), { x: width - margin - 65, y, size: 9, font: helveticaBold, color: black });
    y -= 12;
    
    // Show proration details indented
    if (data.midTermProrationDetails.length > 0) {
      for (const detail of data.midTermProrationDetails) {
        // Tenant name and date range
        const tenantLine = `> ${detail.tenantName} (${detail.dateRange})`;
        page.drawText(tenantLine.substring(0, 65), { x: margin + 10, y, size: 8, font: helvetica, color: gray });
        y -= 10;
        
        // Proration calculation (only if not full month)
        if (!detail.isFullMonth) {
          const prorationLine = `   ${formatCurrency(detail.monthlyRent)}/mo prorated: ${detail.occupiedDays} of ${detail.daysInMonth} days`;
          page.drawText(prorationLine, { x: margin + 10, y, size: 7, font: helvetica, color: gray });
          y -= 10;
        }
      }
    }
    y -= 3;
  }
  
  // Visual separator before total
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: lightGray });
  y -= 11;
  
  // Gross revenue total with emphasis
  page.drawText("TOTAL GROSS REVENUE", { x: margin, y, size: 9, font: helveticaBold, color: black });
  page.drawText(formatCurrency(data.grossRevenue), { x: width - margin - 65, y, size: 9, font: helveticaBold, color: black });
  y -= 20;
  
  // === EXPENSES SECTION ===
  page.drawText("EXPENSES", { x: margin, y, size: 10, font: helveticaBold, color: black });
  y -= 4;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: lightGray });
  y -= 14;
  
  // Management fee
  page.drawText(`Management Fee (${data.managementFeePercentage}% of revenue)`, { x: margin, y, size: 9, font: helvetica, color: black });
  page.drawText(formatCurrency(data.managementFee), { x: width - margin - 65, y, size: 9, font: helvetica, color: black });
  y -= 13;
  
  // Order minimum fee
  if (data.orderMinimumFee > 0) {
    page.drawText("Order Minimum Fee", { x: margin, y, size: 9, font: helvetica, color: black });
    page.drawText(formatCurrency(data.orderMinimumFee), { x: width - margin - 65, y, size: 9, font: helvetica, color: black });
    y -= 13;
  }
  
  // Visits - with better text handling
  for (const visit of data.visits) {
    if (y < 140) break;
    
    const visitDate = visit.date ? ` - ${formatDate(visit.date)}` : '';
    let visitDesc = visit.description || 'Property Visit';
    // Truncate at 60 chars for better fit
    if (visitDesc.length > 60) {
      visitDesc = visitDesc.substring(0, 57) + '...';
    }
    page.drawText(`${visitDesc}${visitDate}`, { x: margin, y, size: 9, font: helvetica, color: black });
    page.drawText(formatCurrency(visit.amount), { x: width - margin - 65, y, size: 9, font: helvetica, color: black });
    y -= 13;
  }
  
  // Expenses - show full details with line items
  for (const expense of data.expenses) {
    if (y < 100) break;
    
    const expDate = expense.date ? ` - ${formatDate(expense.date)}` : '';
    let expDesc = expense.description || expense.category || 'Expense';
    
    // Check if description contains multiple items (from Amazon line_items)
    // Show first 120 chars of description without truncation if possible
    if (expDesc.length > 120) {
      // Wrap text for very long descriptions
      const lines = wrapText(expDesc, 85);
      for (let i = 0; i < Math.min(lines.length, 3); i++) {
        if (y < 100) break;
        const lineText = i === 0 ? `${lines[i]}${expDate}` : `  ${lines[i]}`;
        page.drawText(lineText, { x: margin, y, size: 8, font: helvetica, color: i === 0 ? black : gray });
        if (i === 0) {
          page.drawText(formatCurrency(expense.amount), { x: width - margin - 65, y, size: 9, font: helvetica, color: black });
        }
        y -= 11;
      }
      if (lines.length > 3) {
        page.drawText(`  ...and ${lines.length - 3} more items`, { x: margin, y, size: 7, font: helvetica, color: gray });
        y -= 10;
      }
    } else {
      // Short description - display normally
      page.drawText(`${expDesc}${expDate}`, { x: margin, y, size: 9, font: helvetica, color: black });
      page.drawText(formatCurrency(expense.amount), { x: width - margin - 65, y, size: 9, font: helvetica, color: black });
      y -= 13;
    }
  }
  
  // Cleaning fees
  if (data.cleaningFees > 0) {
    page.drawText("Cleaning Fees", { x: margin, y, size: 9, font: helvetica, color: black });
    page.drawText(formatCurrency(data.cleaningFees), { x: width - margin - 65, y, size: 9, font: helvetica, color: black });
    y -= 13;
  }
  
  // Pet fees
  if (data.petFees > 0) {
    page.drawText("Pet Fees", { x: margin, y, size: 9, font: helvetica, color: black });
    page.drawText(formatCurrency(data.petFees), { x: width - margin - 65, y, size: 9, font: helvetica, color: black });
    y -= 13;
  }
  
  // Total expenses - all black, no colors
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: lightGray });
  y -= 11;
  page.drawText("TOTAL EXPENSES", { x: margin, y, size: 9, font: helveticaBold, color: black });
  page.drawText(`(${formatCurrency(data.totalExpenses)})`, { x: width - margin - 75, y, size: 9, font: helveticaBold, color: black });
  y -= 18;
  
  // === NET RESULT LINE ===
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1.2, color: black });
  y -= 14;
  page.drawText(netLabel, { x: margin, y, size: 11, font: helveticaBold, color: black });
  page.drawText(formatCurrency(data.netOwnerEarnings), { x: width - margin - 75, y, size: 11, font: helveticaBold, color: black });
  y -= 22;
  
  // === YTD SUMMARY BOX (only for Jan 2026+) ===
  if (data.showYtd && y > 120) {
    page.drawRectangle({
      x: margin,
      y: y - 35,
      width: width - 2 * margin,
      height: 35,
      color: rgb(0.97, 0.97, 0.97),
      borderColor: lightGray,
      borderWidth: 0.5,
    });
    
    page.drawText(`YEAR-TO-DATE SUMMARY (${data.periodYear})`, { x: margin + 10, y: y - 12, size: 8, font: helveticaBold, color: black });
    
    const colWidth = (width - 2 * margin - 20) / 3;
    page.drawText(`Revenue: ${formatCurrency(data.ytdRevenue)}`, { x: margin + 10, y: y - 26, size: 8, font: helvetica, color: gray });
    page.drawText(`Expenses: ${formatCurrency(data.ytdExpenses)}`, { x: margin + 10 + colWidth, y: y - 26, size: 8, font: helvetica, color: gray });
    page.drawText(`Net to Owner: ${formatCurrency(data.ytdNetOwner)}`, { x: margin + 10 + colWidth * 2, y: y - 26, size: 8, font: helveticaBold, color: black });
    
    y -= 45;
  }
  
  // === FOOTER ===
  const footerY = 50;
  page.drawLine({ start: { x: margin, y: footerY + 15 }, end: { x: width - margin, y: footerY + 15 }, thickness: 0.5, color: lightGray });
  
  page.drawText("All funds held in GREC-registered trust account.", { x: margin, y: footerY, size: 7, font: helvetica, color: gray });
  page.drawText(`${COMPANY.name} | ${COMPANY.phone} | ${COMPANY.email}`, { x: margin, y: footerY - 10, size: 7, font: helvetica, color: gray });
  page.drawText("Questions? Contact us within 30 days of statement date. Retain for 3+ years per GREC guidelines.", { x: margin, y: footerY - 20, size: 7, font: helvetica, color: gray });
  
  return await pdfDoc.save();
}

serve(handler);
