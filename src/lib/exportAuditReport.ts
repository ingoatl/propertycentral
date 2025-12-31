/**
 * GREC (Georgia Real Estate Commission) Audit Export Utility
 * 
 * Generates audit-compliant documentation for property management records.
 * Required retention: 3 years for trust account records and property management records.
 * 
 * Exports include:
 * - Property Owner Ledger (all transactions with dates)
 * - Revenue receipts and expense disbursements
 * - Management fee calculations
 * - Visit fees with details
 * - Settlement amounts
 * - Audit trail of approvals
 */

import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface LineItem {
  id: string;
  item_type: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
  verified: boolean;
  excluded: boolean;
  approved_by?: string;
  approved_at?: string;
  exclusion_reason?: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  user_id?: string;
  notes?: string;
  created_at: string;
}

interface ReconciliationData {
  id: string;
  reconciliation_month: string;
  total_revenue: number;
  management_fee: number;
  order_minimum_fee: number;
  visit_fees: number;
  total_expenses: number;
  net_to_owner: number;
  due_from_owner: number;
  payout_to_owner: number;
  status: string;
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  properties: {
    name: string;
    address: string;
    management_fee_percentage?: number;
  };
  property_owners: {
    name: string;
    email: string;
    service_type: string;
  };
}

export async function generateAuditReport(reconciliationId: string): Promise<void> {
  try {
    // Fetch reconciliation data
    const { data: rec, error: recError } = await supabase
      .from("monthly_reconciliations")
      .select(`
        *,
        properties(name, address, management_fee_percentage),
        property_owners(name, email, service_type)
      `)
      .eq("id", reconciliationId)
      .single();

    if (recError) throw recError;

    // Fetch line items
    const { data: lineItems, error: itemsError } = await supabase
      .from("reconciliation_line_items")
      .select("*")
      .eq("reconciliation_id", reconciliationId)
      .order("date", { ascending: true });

    if (itemsError) throw itemsError;

    // Fetch audit log
    const { data: auditLog, error: auditError } = await supabase
      .from("reconciliation_audit_log")
      .select("*")
      .eq("reconciliation_id", reconciliationId)
      .order("created_at", { ascending: true });

    if (auditError) throw auditError;

    // Fetch user names for audit trail
    const userIds = [...new Set([
      ...(lineItems || []).map((item: any) => item.approved_by).filter(Boolean),
      ...(auditLog || []).map((log: any) => log.user_id).filter(Boolean),
      rec.approved_by,
      rec.reviewed_by
    ].filter(Boolean))];

    let userMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, email")
        .in("id", userIds);

      if (profiles) {
        userMap = profiles.reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.first_name || p.email || p.id;
          return acc;
        }, {});
      }
    }

    // Create workbook
    const wb = XLSX.utils.book_new();

    // --- Sheet 1: Summary ---
    const summaryData = [
      ["PROPERTY OWNER LEDGER"],
      ["Georgia Real Estate Commission Audit Report"],
      [""],
      ["Property Name", rec.properties?.name || "N/A"],
      ["Property Address", rec.properties?.address || "N/A"],
      ["Owner Name", rec.property_owners?.name || "N/A"],
      ["Owner Email", rec.property_owners?.email || "N/A"],
      ["Service Type", rec.property_owners?.service_type === "full_service" ? "Full-Service Management" : "Co-Hosting"],
      [""],
      ["Reconciliation Period", format(new Date(rec.reconciliation_month + "T00:00:00"), "MMMM yyyy")],
      ["Report Generated", format(new Date(), "MMMM dd, yyyy 'at' h:mm a")],
      ["Status", rec.status?.toUpperCase()],
      [""],
      ["FINANCIAL SUMMARY"],
      ["Total Revenue", formatCurrency(rec.total_revenue || 0)],
      ["Management Fee", formatCurrency(rec.management_fee || 0)],
      ["Order Minimum Fee", formatCurrency(rec.order_minimum_fee || 0)],
      ["Visit Fees", formatCurrency(rec.visit_fees || 0)],
      ["Total Expenses", formatCurrency(rec.total_expenses || 0)],
      [""],
      rec.property_owners?.service_type === "full_service" 
        ? ["Payout to Owner", formatCurrency(rec.payout_to_owner || 0)]
        : ["Due from Owner", formatCurrency(rec.due_from_owner || 0)],
      [""],
      ["APPROVAL INFORMATION"],
      ["Reviewed By", userMap[rec.reviewed_by] || rec.reviewed_by || "Not Yet Reviewed"],
      ["Reviewed At", rec.reviewed_at ? format(new Date(rec.reviewed_at), "MMMM dd, yyyy 'at' h:mm a") : "Not Yet Reviewed"],
      ["Approved By", userMap[rec.approved_by] || rec.approved_by || "Pending"],
      ["Approved At", rec.approved_at ? format(new Date(rec.approved_at), "MMMM dd, yyyy 'at' h:mm a") : "Pending"],
      [""],
      ["Notes", rec.notes || "None"],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 25 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // --- Sheet 2: Transaction Ledger ---
    const ledgerHeader = [
      "Date",
      "Type",
      "Description",
      "Category",
      "Debit (Expense)",
      "Credit (Revenue)",
      "Verified",
      "Verified By",
      "Verified At",
      "Excluded",
      "Exclusion Reason"
    ];

    let runningBalance = 0;
    const ledgerRows = (lineItems || []).map((item: any) => {
      const isRevenue = item.amount > 0;
      const amount = Math.abs(item.amount);
      runningBalance += item.verified && !item.excluded ? item.amount : 0;

      return [
        format(new Date(item.date + "T00:00:00"), "MM/dd/yyyy"),
        item.item_type,
        item.description,
        item.category || "",
        isRevenue ? "" : formatCurrency(amount),
        isRevenue ? formatCurrency(amount) : "",
        item.verified ? "Yes" : "No",
        userMap[item.approved_by] || item.approved_by || "",
        item.approved_at ? format(new Date(item.approved_at), "MM/dd/yyyy h:mm a") : "",
        item.excluded ? "Yes" : "No",
        item.exclusion_reason || ""
      ];
    });

    const wsLedger = XLSX.utils.aoa_to_sheet([ledgerHeader, ...ledgerRows]);
    wsLedger["!cols"] = [
      { wch: 12 }, { wch: 15 }, { wch: 40 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 20 },
      { wch: 20 }, { wch: 10 }, { wch: 25 }
    ];
    XLSX.utils.book_append_sheet(wb, wsLedger, "Transaction Ledger");

    // --- Sheet 3: Revenue Detail ---
    const revenueItems = (lineItems || []).filter((item: any) => 
      item.item_type === "booking" || item.item_type === "mid_term_booking" || item.amount > 0
    );
    
    const revenueHeader = ["Date", "Type", "Description", "Amount", "Status"];
    const revenueRows = revenueItems.map((item: any) => [
      format(new Date(item.date + "T00:00:00"), "MM/dd/yyyy"),
      item.item_type === "mid_term_booking" ? "Mid-Term Booking" : "Short-Term Booking",
      item.description,
      formatCurrency(Math.abs(item.amount)),
      item.excluded ? "Excluded" : item.verified ? "Verified" : "Pending"
    ]);

    const wsRevenue = XLSX.utils.aoa_to_sheet([revenueHeader, ...revenueRows]);
    wsRevenue["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 40 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsRevenue, "Revenue Receipts");

    // --- Sheet 4: Expense Detail ---
    const expenseItems = (lineItems || []).filter((item: any) => 
      item.item_type === "expense" && item.amount < 0
    );
    
    const expenseHeader = ["Date", "Category", "Description", "Amount", "Verified", "Verified By"];
    const expenseRows = expenseItems.map((item: any) => [
      format(new Date(item.date + "T00:00:00"), "MM/dd/yyyy"),
      item.category || "Uncategorized",
      item.description,
      formatCurrency(Math.abs(item.amount)),
      item.verified ? "Yes" : "No",
      userMap[item.approved_by] || item.approved_by || ""
    ]);

    const wsExpenses = XLSX.utils.aoa_to_sheet([expenseHeader, ...expenseRows]);
    wsExpenses["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 40 }, { wch: 15 }, { wch: 10 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsExpenses, "Expense Disbursements");

    // --- Sheet 5: Visit Fees ---
    const visitItems = (lineItems || []).filter((item: any) => item.item_type === "visit");
    
    const visitHeader = ["Date", "Description", "Amount", "Verified", "Verified By"];
    const visitRows = visitItems.map((item: any) => [
      format(new Date(item.date + "T00:00:00"), "MM/dd/yyyy"),
      item.description,
      formatCurrency(Math.abs(item.amount)),
      item.verified ? "Yes" : "No",
      userMap[item.approved_by] || item.approved_by || ""
    ]);

    const wsVisits = XLSX.utils.aoa_to_sheet([visitHeader, ...visitRows]);
    wsVisits["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 15 }, { wch: 10 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsVisits, "Visit Fees");

    // --- Sheet 6: Audit Trail ---
    const auditHeader = ["Timestamp", "Action", "Performed By", "Notes"];
    const auditRows = (auditLog || []).map((log: any) => [
      format(new Date(log.created_at), "MM/dd/yyyy h:mm:ss a"),
      formatActionName(log.action),
      userMap[log.user_id] || log.user_id || "System",
      log.notes || ""
    ]);

    const wsAudit = XLSX.utils.aoa_to_sheet([auditHeader, ...auditRows]);
    wsAudit["!cols"] = [{ wch: 22 }, { wch: 25 }, { wch: 25 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsAudit, "Audit Trail");

    // Generate filename
    const propertyName = (rec.properties?.name || "Property").replace(/[^a-zA-Z0-9]/g, "_");
    const monthStr = format(new Date(rec.reconciliation_month + "T00:00:00"), "yyyy-MM");
    const filename = `GREC_Audit_${propertyName}_${monthStr}.xlsx`;

    // Download the file
    XLSX.writeFile(wb, filename);

  } catch (error) {
    console.error("Error generating audit report:", error);
    throw error;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatActionName(action: string): string {
  const actionMap: Record<string, string> = {
    "created": "Reconciliation Created",
    "item_approved": "Line Item Approved",
    "item_rejected": "Line Item Unapproved",
    "items_added": "Items Added",
    "visits_added": "Visits Added",
    "approved": "Reconciliation Approved",
    "statement_sent": "Statement Sent to Owner",
    "charged": "Owner Charged",
    "payout_recorded": "Payout Recorded",
    "revenue_override_set": "Revenue Override Set",
    "revenue_override_cleared": "Revenue Override Cleared",
  };
  return actionMap[action] || action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}
