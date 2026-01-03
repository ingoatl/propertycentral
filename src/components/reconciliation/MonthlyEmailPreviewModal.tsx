import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, Send, TestTube, Eye, DollarSign, RotateCcw, CheckCircle2, AlertTriangle, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface MonthlyEmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reconciliation: any;
  onSuccess: () => void;
}

interface ApprovedLineItem {
  id: string;
  item_id: string;
  item_type: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
  verified: boolean;
  excluded: boolean;
  notes?: string;
  hours?: number;
  actualPrice?: number;
}

interface DuplicateWarning {
  type: 'visit' | 'expense';
  item_id: string;
  count: number;
}

export const MonthlyEmailPreviewModal = ({
  open,
  onOpenChange,
  reconciliation,
  onSuccess,
}: MonthlyEmailPreviewModalProps) => {
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingOwner, setIsSendingOwner] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [ownerName, setOwnerName] = useState("Property Owner");
  const [visitTotal, setVisitTotal] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [dueFromOwner, setDueFromOwner] = useState(0);
  const [shortTermRevenue, setShortTermRevenue] = useState(0);
  const [midTermRevenue, setMidTermRevenue] = useState(0);
  const [approvedVisits, setApprovedVisits] = useState<ApprovedLineItem[]>([]);
  const [approvedExpenses, setApprovedExpenses] = useState<ApprovedLineItem[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarning[]>([]);

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    const toastId = toast.loading("Generating PDF statement...");
    try {
      const { data, error } = await supabase.functions.invoke("generate-statement-pdf", {
        body: { reconciliation_id: reconciliation.id },
      });

      if (error) throw error;
      
      // Create a Blob from the HTML and open print dialog
      const htmlContent = data.html;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      
      toast.success("PDF ready for download", { id: toastId });
    } catch (error: any) {
      toast.error(error.message || "Failed to generate PDF", { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  useEffect(() => {
    const fetchOwnerAndLineItems = async () => {
      if (!reconciliation?.owner_id || !reconciliation?.id) return;

      // Fetch owner name
      try {
        const { data: ownerData, error: ownerError } = await supabase
          .from("property_owners")
          .select("name, second_owner_name")
          .eq("id", reconciliation.owner_id)
          .maybeSingle();

        if (!ownerError && ownerData) {
          const primaryName = ownerData.name;
          let firstNames: string[] = [];
          
          // Extract first names from primary owner
          if (primaryName.includes('&')) {
            firstNames = primaryName.split('&').map((name: string) => name.trim().split(' ')[0]);
          } else if (primaryName.toLowerCase().includes(' and ')) {
            firstNames = primaryName.split(/\sand\s/i).map((name: string) => name.trim().split(' ')[0]);
          } else {
            firstNames.push(primaryName.split(' ')[0]);
          }
          
          // Add second owner's first name if exists
          if (ownerData.second_owner_name) {
            const secondName = ownerData.second_owner_name.trim().split(' ')[0];
            firstNames.push(secondName);
          }
          
          setOwnerName(firstNames.join(' & '));
        }
      } catch (error) {
        console.error("Error fetching owner name:", error);
      }

      // Fetch line items to calculate category totals (APPROVED ONLY)
      try {
        const { data: lineItems, error: itemsError } = await supabase
          .from("reconciliation_line_items")
          .select("*")
          .eq("reconciliation_id", reconciliation.id)
          .order("date", { ascending: false });

        if (!itemsError && lineItems) {
          // Filter approved items for display
          const approved = lineItems.filter((item: any) => item.verified && !item.excluded);
          
          // WATCHDOG: Detect duplicate item_ids (same source item added multiple times)
          const itemIdCounts = new Map<string, number>();
          approved.forEach((item: any) => {
            const key = `${item.item_type}:${item.item_id}`;
            itemIdCounts.set(key, (itemIdCounts.get(key) || 0) + 1);
          });
          
          const duplicates: DuplicateWarning[] = [];
          itemIdCounts.forEach((count, key) => {
            if (count > 1) {
              const [type, item_id] = key.split(':');
              duplicates.push({ 
                type: type as 'visit' | 'expense', 
                item_id, 
                count 
              });
              console.warn(`⚠️ WATCHDOG: Duplicate line item detected - ${type} ${item_id} appears ${count} times`);
            }
          });
          setDuplicateWarnings(duplicates);
          
          // Deduplicate by item_id for display (keep first occurrence only)
          const seenItemIds = new Set<string>();
          const deduplicatedApproved = approved.filter((item: any) => {
            const key = `${item.item_type}:${item.item_id}`;
            if (seenItemIds.has(key)) {
              return false;
            }
            seenItemIds.add(key);
            return true;
          });
          
          const visits = deduplicatedApproved
            .filter((item: any) => item.item_type === 'visit')
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          // Fetch visit notes and hours from the visits table for better display
          if (visits.length > 0) {
            const visitIds = visits.map((v: any) => v.item_id);
            const { data: visitDetails } = await supabase
              .from("visits")
              .select("id, notes, visited_by, hours, price")
              .in("id", visitIds);
            
            if (visitDetails) {
              visits.forEach((v: any) => {
                const detail = visitDetails.find((d: any) => d.id === v.item_id);
                if (detail?.notes) {
                  v.notes = detail.notes;
                }
                if (detail?.hours) {
                  v.hours = detail.hours;
                }
                if (detail?.price) {
                  v.actualPrice = detail.price;
                }
              });
            }
          }
          
          const expenses = deduplicatedApproved
            .filter((item: any) => {
              if (item.item_type !== 'expense') return false;
              const desc = (item.description || '').toLowerCase();
              return !desc.includes('visit fee') && 
                     !desc.includes('visit charge') &&
                     !desc.includes('hourly charge') &&
                     !desc.includes('property visit');
            })
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          setApprovedVisits(visits);
          setApprovedExpenses(expenses);
          
          // ========== CALCULATION WATCHDOG ==========
          // Calculate totals FROM THE DISPLAYED ITEMS to ensure preview matches what will be sent
          const displayedVisitTotal = visits.reduce((sum: number, v: any) => sum + Math.abs(v.amount), 0);
          const displayedExpenseTotal = expenses.reduce((sum: number, e: any) => sum + Math.abs(e.amount), 0);
          const mgmtFee = reconciliation.management_fee || 0;
          const calculatedDueFromOwner = mgmtFee + displayedVisitTotal + displayedExpenseTotal;
          
          setVisitTotal(displayedVisitTotal);
          setExpenseTotal(displayedExpenseTotal);
          setDueFromOwner(calculatedDueFromOwner);
          
          // Calculation watchdog logs (dev only)
          if (import.meta.env.DEV) {
            console.log("=== PREVIEW CALCULATION WATCHDOG ===");
            console.log(`Management Fee: $${mgmtFee.toFixed(2)}, Visits: $${displayedVisitTotal.toFixed(2)}, Expenses: $${displayedExpenseTotal.toFixed(2)}, Total: $${calculatedDueFromOwner.toFixed(2)}`);
          }
        }
        
        // Set revenue split
        setShortTermRevenue(reconciliation.short_term_revenue || 0);
        setMidTermRevenue(reconciliation.mid_term_revenue || 0);
      } catch (error) {
        console.error("Error fetching line items:", error);
      }
    };

    fetchOwnerAndLineItems();
  }, [reconciliation?.owner_id, reconciliation?.id, reconciliation?.management_fee]);

  const handleSendTestEmail = async () => {
    setIsSendingTest(true);
    const toastId = toast.loading("Sending test email...");
    try {
      const { error } = await supabase.functions.invoke("send-monthly-report", {
        body: { 
          reconciliation_id: reconciliation.id,
          test_email: "info@peachhausgroup.com"
        },
      });

      if (error) throw error;
      toast.success("Test email sent successfully to info@peachhausgroup.com", { id: toastId });
    } catch (error: any) {
      toast.error(error.message || "Failed to send test email", { id: toastId });
    } finally {
      setIsSendingTest(false);
    }
  };


  const handleSendOwnerEmail = async () => {
    if (!reconciliation.property_owners?.email) {
      toast.error("Owner email not found");
      return;
    }

    const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5);
    const deadlineDate = nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    const confirmed = window.confirm(
      `This will send the monthly statement to:\n\n` +
      `Owner: ${reconciliation.property_owners?.name}\n` +
      `Email: ${reconciliation.property_owners?.email}\n\n` +
      `Review Deadline: ${deadlineDate}\n` +
      `Amount Due: $${dueFromOwner.toFixed(2)}\n\n` +
      `The owner will be charged automatically on ${deadlineDate} unless they respond.\n\n` +
      `Send statement now?`
    );

    if (!confirmed) return;

    setIsSendingOwner(true);
    try {
      const { error } = await supabase.functions.invoke("send-monthly-report", {
        body: { reconciliation_id: reconciliation.id },
      });

      if (error) throw error;

      toast.success(`Monthly statement sent to ${reconciliation.property_owners?.email}`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to send owner email");
    } finally {
      setIsSendingOwner(false);
    }
  };

  const monthLabel = format(new Date(reconciliation.reconciliation_month + 'T00:00:00'), "MMMM yyyy");
  const managementFee = Number(reconciliation.management_fee || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Monthly Owner Statement Preview
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Watchdog Warning for Duplicates */}
          {duplicateWarnings.length > 0 && (
            <Card className="p-4 bg-destructive/10 border-destructive/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                <div>
                  <h4 className="font-semibold text-destructive mb-1">⚠️ Duplicate Line Items Detected</h4>
                  <p className="text-sm text-destructive/80 mb-2">
                    The following items appear multiple times in the reconciliation. They have been deduplicated for this preview, 
                    but you should clean up the database to avoid billing errors.
                  </p>
                  <ul className="text-xs space-y-1">
                    {duplicateWarnings.map((dup, i) => (
                      <li key={i} className="font-mono">
                        • {dup.type}: {dup.item_id} (appears {dup.count}x)
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {/* Net Owner Result - THE MOST IMPORTANT NUMBER */}
          <div className={`p-6 rounded-xl border ${
            (Number(reconciliation.total_revenue || 0) - dueFromOwner) >= 0 
              ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200' 
              : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
          }`}>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  {(Number(reconciliation.total_revenue || 0) - dueFromOwner) >= 0 
                    ? 'Net Owner Earnings' 
                    : 'Balance Due from Owner'}
                </div>
                <div className="text-sm text-muted-foreground">
                  For period {monthLabel}
                </div>
              </div>
              <div className={`text-4xl font-bold font-mono ${
                (Number(reconciliation.total_revenue || 0) - dueFromOwner) >= 0 
                  ? 'text-emerald-600' 
                  : 'text-red-600'
              }`}>
                ${Math.abs(Number(reconciliation.total_revenue || 0) - dueFromOwner).toFixed(2)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-current/10">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Gross Revenue</div>
                <div className="text-lg font-semibold font-mono text-emerald-600">
                  ${Number(reconciliation.total_revenue || 0).toFixed(2)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Total Expenses</div>
                <div className="text-lg font-semibold font-mono text-red-600">
                  ${dueFromOwner.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Line Items Preview */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Approved Line Items Included in Statement
            </h3>
            
            {/* Visits */}
            {approvedVisits.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                  <Eye className="w-4 h-4" />
                  Visits ({approvedVisits.length})
                </div>
                <div className="space-y-2">
                  {approvedVisits.map((visit) => {
                    const visitHours = Number(visit.hours || 0);
                    const actualPrice = Math.abs(visit.amount);
                    const hourlyRate = 50;
                    const hourlyCharge = visitHours * hourlyRate;
                    const baseVisitFee = actualPrice - hourlyCharge;
                    
                    return (
                      <div key={visit.id} className="p-2 bg-muted/30 rounded border-l-2 border-orange-400">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{visit.description}</span>
                          <span className="font-medium text-orange-600">${actualPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>{format(new Date(visit.date + 'T00:00:00'), 'MMM dd, yyyy')}</span>
                        </div>
                        {visitHours > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ↳ Base: ${baseVisitFee.toFixed(0)} + {visitHours} hr{visitHours > 1 ? 's' : ''} @ ${hourlyRate}/hr = ${hourlyCharge.toFixed(0)}
                          </p>
                        )}
                        {visit.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">📝 {visit.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Expenses */}
            {approvedExpenses.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                  <RotateCcw className="w-4 h-4" />
                  Expenses ({approvedExpenses.length})
                </div>
                <div className="space-y-2">
                  {approvedExpenses.map((expense) => (
                    <div key={expense.id} className="p-2 bg-muted/30 rounded border-l-2 border-blue-400">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium flex-1 mr-2">{expense.description}</span>
                        <span className="font-medium text-orange-600">${Math.abs(expense.amount).toFixed(2)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(expense.date + 'T00:00:00'), 'MMM dd, yyyy')}
                        {expense.category && <span className="ml-2">• {expense.category}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {approvedVisits.length === 0 && approvedExpenses.length === 0 && (
              <p className="text-sm text-muted-foreground">No visits or expenses in this statement</p>
            )}
          </Card>

          {/* Official Owner Statement */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">Email Preview</h3>
            <Card className="p-4 bg-muted/30">
              <div className="space-y-1 text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-muted-foreground min-w-16">To:</span>
                  <span>{reconciliation.property_owners?.email}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-muted-foreground min-w-16">Subject:</span>
                  <span>Monthly Owner Statement - {reconciliation.properties?.name} - {monthLabel}</span>
                </div>
              </div>
            </Card>

          {/* Email Preview - Fortune 500 Professional Design */}
          <div className="border rounded-xl overflow-hidden shadow-lg bg-white dark:bg-gray-900">
            {/* Logo Header */}
            <div className="bg-white dark:bg-gray-900 border-b-[3px] border-[#FF7F00] p-8 text-center">
              <img 
                src="/peachhaus-logo.png" 
                alt="PeachHaus Property Management" 
                className="max-w-[280px] h-auto mx-auto"
              />
            </div>

            {/* Title Header */}
            <div className="bg-[#FF7F00] px-10 py-6 text-white">
              <h1 className="text-2xl font-bold tracking-wide text-center">
                OWNER STATEMENT
              </h1>
              <p className="text-center text-sm opacity-90 mt-2">
                {reconciliation.properties?.name} • {monthLabel}
              </p>
            </div>

            {/* Statement ID Bar */}
            <div className="bg-gray-50 dark:bg-gray-800 px-10 py-3 border-b flex justify-between text-xs text-muted-foreground font-mono">
              <span>Statement ID: PH-{new Date(reconciliation.reconciliation_month).getFullYear()}{String(new Date(reconciliation.reconciliation_month).getMonth() + 1).padStart(2, '0')}-{reconciliation.id?.slice(0, 8).toUpperCase()}</span>
              <span>Issue Date: {format(new Date(), 'MMMM d, yyyy')}</span>
            </div>

            {/* Main Content */}
            <div className="p-10 bg-white dark:bg-gray-900">
              
              {/* Property & Owner Info */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5 border-l-4 border-[#FF7F00]">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Property</div>
                  <div className="font-semibold text-gray-900 dark:text-white">{reconciliation.properties?.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">{reconciliation.properties?.address}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Statement Period</div>
                  <div className="font-semibold text-gray-900 dark:text-white">{monthLabel}</div>
                  <div className="text-sm text-muted-foreground mt-1">Prepared for: {ownerName}</div>
                </div>
              </div>

              {/* NET RESULT BOX - Most Important Number */}
              <div className={`rounded-xl p-6 mb-8 border ${
                (Number(reconciliation.total_revenue || 0) - dueFromOwner) >= 0 
                  ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700' 
                  : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700'
              }`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">
                      {(Number(reconciliation.total_revenue || 0) - dueFromOwner) >= 0 ? 'Net Owner Earnings' : 'Balance Due from Owner'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">For period {monthLabel}</div>
                  </div>
                  <div className={`text-4xl font-bold font-mono ${
                    (Number(reconciliation.total_revenue || 0) - dueFromOwner) >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    ${Math.abs(Number(reconciliation.total_revenue || 0) - dueFromOwner).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* REVENUE Section */}
              <div className="mb-6">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-t-lg border-b-2 border-emerald-500">
                  Revenue
                </div>
                <div className="border border-t-0 rounded-b-lg overflow-hidden">
                  {shortTermRevenue > 0 && (
                    <div className="flex justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Short-term Booking Revenue</span>
                      <span className="text-sm font-medium font-mono text-emerald-600">${shortTermRevenue.toFixed(2)}</span>
                    </div>
                  )}
                  {midTermRevenue > 0 && (
                    <div className="flex justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Mid-term Rental Revenue</span>
                      <span className="text-sm font-medium font-mono text-emerald-600">${midTermRevenue.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-4 py-4 bg-emerald-50 dark:bg-emerald-900/20">
                    <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">TOTAL GROSS REVENUE</span>
                    <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400">${Number(reconciliation.total_revenue || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* EXPENSES Section */}
              <div className="mb-6">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-t-lg border-b-2 border-red-500">
                  Expenses & Fees
                </div>
                <div className="border border-t-0 rounded-b-lg overflow-hidden">
                  <div className="flex justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Management Fee ({reconciliation.properties?.management_fee_percentage || 15}% of revenue)
                    </span>
                    <span className="text-sm font-medium font-mono text-gray-700 dark:text-gray-300">${managementFee.toFixed(2)}</span>
                  </div>
                  
                  {/* Visit Line Items */}
                  {approvedVisits.map((visit) => {
                    const visitHours = Number(visit.hours || 0);
                    const actualPrice = Math.abs(visit.amount);
                    const hourlyRate = 50;
                    const hourlyCharge = visitHours * hourlyRate;
                    const baseVisitFee = actualPrice - hourlyCharge;
                    
                    return (
                      <div key={visit.id} className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {visit.description} ({format(new Date(visit.date + 'T00:00:00'), 'MMM d')})
                          </span>
                          <span className="text-sm font-medium font-mono text-gray-700 dark:text-gray-300">${actualPrice.toFixed(2)}</span>
                        </div>
                        {visitHours > 0 && (
                          <div className="text-xs text-muted-foreground mt-1 pl-4">
                            ↳ Base: ${baseVisitFee.toFixed(0)} + {visitHours} hr{visitHours > 1 ? 's' : ''} @ ${hourlyRate}/hr
                          </div>
                        )}
                        {visit.notes && (
                          <div className="text-xs text-muted-foreground mt-1 pl-4 italic">📝 {visit.notes}</div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Expense Line Items */}
                  {approvedExpenses.map((expense) => (
                    <div key={expense.id} className="flex justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex-1">
                        <span className="text-sm text-gray-700 dark:text-gray-300 block truncate">{expense.description}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(expense.date + 'T00:00:00'), 'MMM d, yyyy')}
                          {expense.category && ` • ${expense.category}`}
                        </span>
                      </div>
                      <span className="text-sm font-medium font-mono text-gray-700 dark:text-gray-300 ml-4">${Math.abs(expense.amount).toFixed(2)}</span>
                    </div>
                  ))}
                  
                  <div className="flex justify-between px-4 py-4 bg-red-50 dark:bg-red-900/20">
                    <span className="text-sm font-semibold text-red-800 dark:text-red-300">TOTAL EXPENSES</span>
                    <span className="text-base font-bold font-mono text-red-700 dark:text-red-400">${dueFromOwner.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* NET RESULT FINAL BOX */}
              <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-6">
                <div className="flex justify-between items-center">
                  <div className="text-white">
                    <div className="text-xs uppercase tracking-wide opacity-70">
                      {(Number(reconciliation.total_revenue || 0) - dueFromOwner) >= 0 ? 'Net Owner Earnings' : 'Balance Due from Owner'}
                    </div>
                    <div className="text-xs opacity-50 mt-1">For period {monthLabel}</div>
                  </div>
                  <div className={`text-3xl font-bold font-mono ${
                    (Number(reconciliation.total_revenue || 0) - dueFromOwner) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    ${Math.abs(Number(reconciliation.total_revenue || 0) - dueFromOwner).toFixed(2)}
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="bg-[#1f2937] text-white p-8 text-center border-t-[3px] border-[#FF7F00]">
              <p className="font-semibold text-base tracking-wide mb-2">
                PeachHaus Property Management
              </p>
              <p className="text-sm text-gray-400">
                Questions? Contact us at{' '}
                <a href="mailto:info@peachhausgroup.com" className="text-[#FF7F00] font-medium">
                  info@peachhausgroup.com
                </a>
              </p>
              <p className="text-xs text-gray-500 mt-4">
                This is an official financial statement. Please retain for your records.
              </p>
            </div>
          </div>
          </div>

          <div className="flex justify-between pt-4 border-t gap-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
              >
                <FileDown className="w-4 h-4 mr-2" />
                {isGeneratingPdf ? "Generating..." : "Download PDF"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleSendTestEmail}
                disabled={isSendingTest || isSendingOwner}
              >
                <TestTube className="w-4 h-4 mr-2" />
                {isSendingTest ? "Sending..." : "Test Owner Statement"}
              </Button>
              <Button
                onClick={handleSendOwnerEmail}
                disabled={isSendingTest || isSendingOwner}
              >
                <Send className="w-4 h-4 mr-2" />
                {isSendingOwner ? "Sending..." : "Send Owner Statement"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
