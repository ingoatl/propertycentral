import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Check, CreditCard, Banknote, AlertTriangle, Archive, TrendingUp, TrendingDown, DollarSign, Home, Plus, Eye, Clock, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, isAfter, isSameMonth } from "date-fns";
import { CreateReconciliationDialog } from "./CreateReconciliationDialog";
import { ReconciliationReviewModal } from "./ReconciliationReviewModal";
import { ReconciliationCardActions } from "./ReconciliationCardActions";
import { EmailConfirmationDialog } from "./EmailConfirmationDialog";
import { OffboardPropertyDialog } from "@/components/properties/OffboardPropertyDialog";
import { toast } from "sonner";
import { ServiceType, formatCurrency } from "@/lib/reconciliationCalculations";

export const ReconciliationList = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<string | null>(null);
  const [sendingPerformance, setSendingPerformance] = useState<string | null>(null);
  const [sendingStatement, setSendingStatement] = useState<string | null>(null);
  const [showOffboarded, setShowOffboarded] = useState(false);
  const [offboardDialogOpen, setOffboardDialogOpen] = useState(false);
  const [propertyToOffboard, setPropertyToOffboard] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [creatingPreviewFor, setCreatingPreviewFor] = useState<string | null>(null);
  
  // Email confirmation dialog state
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);
  const [emailConfirmType, setEmailConfirmType] = useState<"performance" | "statement">("performance");
  const [emailConfirmRec, setEmailConfirmRec] = useState<any>(null);

  // Generate months: current month (preview) + last 6 months
  const monthOptions = useMemo(() => {
    const options = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      date.setDate(1);
      return {
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`,
        label: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        isCurrent: i === 0, // First item is current month
      };
    });
    return options;
  }, []);

  // Helper to check if a month is current
  const isCurrentMonth = (monthValue: string) => {
    const monthDate = new Date(monthValue + "T00:00:00");
    return isSameMonth(monthDate, new Date());
  };

  // Default to current month (index 0)
  useEffect(() => {
    if (monthOptions.length > 0 && selectedMonth === "all") {
      setSelectedMonth(monthOptions[0].value);
    }
  }, [monthOptions]);

  const { data: reconciliations, isLoading, refetch } = useQuery({
    queryKey: ["reconciliations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_reconciliations")
        .select(`
          *,
          properties(id, name, address, management_fee_percentage, offboarded_at, offboarding_reason, owner_id),
          property_owners(id, name, email, service_type, payment_method)
        `)
        .order("reconciliation_month", { ascending: false });

      if (error) throw error;

      // For each reconciliation, calculate totals from APPROVED line items only
      const reconciliationsWithCalculatedTotals = await Promise.all((data || []).map(async (rec: any) => {
        const { data: lineItems, error: lineItemsError } = await supabase
          .from("reconciliation_line_items")
          .select("*")
          .eq("reconciliation_id", rec.id);

        if (lineItemsError) {
          console.error("Error fetching line items:", lineItemsError);
          return {
            ...rec,
            calculated_visit_fees: 0,
            calculated_total_expenses: 0,
            calculator_error: "Failed to load items"
          };
        }

        // Use shared calculation utility - only approved items
        const { calculateDueFromOwnerFromLineItems } = await import("@/lib/reconciliationCalculations");
        const serviceType: ServiceType = rec.property_owners?.service_type || 'cohosting';
        const calculated = calculateDueFromOwnerFromLineItems(
          lineItems || [],
          rec.management_fee || 0,
          rec.total_revenue,
          serviceType
        );

        // Count pending (unverified, not excluded) items
        const pendingItems = (lineItems || []).filter(
          (item: any) => !item.verified && !item.excluded
        );

        return {
          ...rec,
          calculated_visit_fees: calculated.visitFees,
          calculated_total_expenses: calculated.totalExpenses,
          calculated_due_from_owner: calculated.dueFromOwner,
          calculated_payout_to_owner: calculated.payoutToOwner,
          service_type: serviceType,
          calculator_error: calculated.error,
          pending_items_count: pendingItems.length,
          total_items_count: lineItems?.length || 0,
        };
      }));

      return reconciliationsWithCalculatedTotals;
    },
  });

  // Real-time subscription for line items, visits, and expenses
  useEffect(() => {
    const channel = supabase
      .channel('reconciliation-realtime-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reconciliation_line_items' },
        () => refetch()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'visits' },
        () => refetch()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'expenses' },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Fetch Client-Managed properties that have ACTIVE LISTINGS OR unbilled charges
  const { data: activeProperties } = useQuery({
    queryKey: ["managed-properties-with-listings-for-reconciliation", selectedMonth],
    queryFn: async () => {
      const monthDate = new Date(selectedMonth + "T00:00:00");
      const startDate = format(startOfMonth(monthDate), "yyyy-MM-dd");
      const endDate = format(endOfMonth(monthDate), "yyyy-MM-dd");
      
      // Get all Client-Managed properties
      const { data: properties, error } = await supabase
        .from("properties")
        .select(`
          id,
          name,
          address,
          owner_id,
          billing_status,
          property_type,
          property_owners(name, email, service_type)
        `)
        .eq("property_type", "Client-Managed")
        .is("offboarded_at", null);

      if (error) throw error;
      if (!properties || properties.length === 0) return [];

      // Get properties with OwnerRez bookings
      const { data: ownerrezProperties } = await supabase
        .from("ownerrez_bookings")
        .select("property_id")
        .not("property_id", "is", null);
      
      const ownerrezPropertyIds = new Set((ownerrezProperties || []).map((b: any) => b.property_id));

      // Get properties with active mid-term bookings
      const { data: midtermProperties } = await supabase
        .from("mid_term_bookings")
        .select("property_id")
        .eq("status", "active");
      
      const midtermPropertyIds = new Set((midtermProperties || []).map((b: any) => b.property_id));

      // Get properties with unbilled expenses in the selected month
      const { data: expenseProperties } = await supabase
        .from("expenses")
        .select("property_id")
        .eq("exported", false)
        .gte("date", startDate)
        .lte("date", endDate);
      
      const expensePropertyIds = new Set((expenseProperties || []).map((e: any) => e.property_id));

      // Get properties with unbilled visits in the selected month
      const { data: visitProperties } = await supabase
        .from("visits")
        .select("property_id")
        .eq("billed", false)
        .gte("date", startDate)
        .lte("date", endDate);
      
      const visitPropertyIds = new Set((visitProperties || []).map((v: any) => v.property_id));

      // Include properties that have:
      // 1. OwnerRez bookings, OR
      // 2. Mid-term bookings, OR
      // 3. Unbilled expenses for the month, OR
      // 4. Unbilled visits for the month
      return properties.filter((p: any) => 
        ownerrezPropertyIds.has(p.id) || 
        midtermPropertyIds.has(p.id) ||
        expensePropertyIds.has(p.id) ||
        visitPropertyIds.has(p.id)
      ).map((p: any) => ({
        ...p,
        hasBookings: ownerrezPropertyIds.has(p.id) || midtermPropertyIds.has(p.id),
        hasExpensesOnly: !ownerrezPropertyIds.has(p.id) && !midtermPropertyIds.has(p.id) && 
                         (expensePropertyIds.has(p.id) || visitPropertyIds.has(p.id))
      }));
    },
  });

  // Fetch current month revenue from OwnerRez bookings and detect payments from emails
  const { data: currentMonthRevenue } = useQuery({
    queryKey: ["current-month-revenue", selectedMonth],
    queryFn: async () => {
      if (!isCurrentMonth(selectedMonth)) return {};
      
      const monthDate = new Date(selectedMonth + "T00:00:00");
      const startDate = format(startOfMonth(monthDate), "yyyy-MM-dd");
      const endDate = format(endOfMonth(monthDate), "yyyy-MM-dd");
      const today = format(new Date(), "yyyy-MM-dd");
      
      // Get OwnerRez bookings for current month (check_out within month and before today)
      const { data: ownerrezData, error: ownerrezError } = await supabase
        .from("ownerrez_bookings")
        .select("property_id, total_amount, accommodation_revenue, check_in, check_out")
        .gte("check_out", startDate)
        .lte("check_in", today)
        .eq("booking_status", "active");
      
      if (ownerrezError) console.error("Error fetching OwnerRez revenue:", ownerrezError);
      
      // Get mid-term bookings active during current month (for expected rent reference)
      const { data: midtermData, error: midtermError } = await supabase
        .from("mid_term_bookings")
        .select("id, property_id, monthly_rent, start_date, end_date, tenant_name")
        .lte("start_date", endDate)
        .gte("end_date", startDate)
        .eq("status", "active");
      
      if (midtermError) console.error("Error fetching mid-term revenue:", midtermError);

      // Get ACTUAL tenant payments for the month (this is what was actually received!)
      const { data: tenantPayments, error: paymentsError } = await supabase
        .from("tenant_payments")
        .select("property_id, amount, payment_date")
        .gte("payment_date", startDate)
        .lte("payment_date", endDate);
      
      if (paymentsError) console.error("Error fetching tenant payments:", paymentsError);

      // INTELLIGENT PAYMENT DETECTION from email_insights
      // Look for payment confirmation emails (Zelle, Venmo, ACH, etc.)
      const { data: paymentEmails, error: emailError } = await supabase
        .from("email_insights")
        .select("property_id, summary, subject, email_date, category")
        .gte("email_date", startDate)
        .lte("email_date", endDate)
        .or("category.eq.payment,subject.ilike.%payment%,subject.ilike.%zelle%,subject.ilike.%venmo%,subject.ilike.%ACH%,summary.ilike.%payment received%,summary.ilike.%confirmed receipt%");
      
      if (emailError) console.error("Error fetching payment emails:", emailError);
      
      // Parse payment amounts from email summaries using regex patterns
      const extractPaymentFromEmail = (summary: string): number | null => {
        // Match patterns like "$6,800", "$6800", "totaling $6,800", "$7,515.00"
        const patterns = [
          /\$([0-9,]+(?:\.[0-9]{2})?)/g,  // Standard dollar amounts
          /totaling \$([0-9,]+(?:\.[0-9]{2})?)/i,
          /payment of \$([0-9,]+(?:\.[0-9]{2})?)/i,
          /received.*\$([0-9,]+(?:\.[0-9]{2})?)/i,
          /confirmed.*\$([0-9,]+(?:\.[0-9]{2})?)/i,
        ];
        
        let maxAmount = 0;
        for (const pattern of patterns) {
          const matches = summary.match(pattern);
          if (matches) {
            for (const match of matches) {
              const numStr = match.replace(/[$,]/g, '');
              const num = parseFloat(numStr);
              if (!isNaN(num) && num > maxAmount && num < 50000) { // Sanity check
                maxAmount = num;
              }
            }
          }
        }
        return maxAmount > 0 ? maxAmount : null;
      };
      
      // Calculate revenue per property
      const revenueByProperty: Record<string, { 
        ownerrez: number; 
        midtermExpected: number; 
        midtermReceived: number;
        emailDetected: number;
        total: number;
        hasDiscrepancy: boolean;
        paymentSource: string;
      }> = {};
      
      // Add OwnerRez revenue (for properties that have property_id set)
      (ownerrezData || []).forEach((booking: any) => {
        if (booking.property_id) {
          if (!revenueByProperty[booking.property_id]) {
            revenueByProperty[booking.property_id] = { 
              ownerrez: 0, midtermExpected: 0, midtermReceived: 0, emailDetected: 0, total: 0, hasDiscrepancy: false, paymentSource: ''
            };
          }
          const amount = booking.accommodation_revenue || booking.total_amount || 0;
          revenueByProperty[booking.property_id].ownerrez += amount;
        }
      });
      
      // Add mid-term expected rent
      (midtermData || []).forEach((booking: any) => {
        if (booking.property_id) {
          if (!revenueByProperty[booking.property_id]) {
            revenueByProperty[booking.property_id] = { 
              ownerrez: 0, midtermExpected: 0, midtermReceived: 0, emailDetected: 0, total: 0, hasDiscrepancy: false, paymentSource: ''
            };
          }
          revenueByProperty[booking.property_id].midtermExpected += booking.monthly_rent || 0;
        }
      });

      // Add actual tenant payments received from tenant_payments table
      (tenantPayments || []).forEach((payment: any) => {
        if (payment.property_id) {
          if (!revenueByProperty[payment.property_id]) {
            revenueByProperty[payment.property_id] = { 
              ownerrez: 0, midtermExpected: 0, midtermReceived: 0, emailDetected: 0, total: 0, hasDiscrepancy: false, paymentSource: ''
            };
          }
          revenueByProperty[payment.property_id].midtermReceived += payment.amount || 0;
          revenueByProperty[payment.property_id].paymentSource = 'recorded';
        }
      });

      // Detect payments from email insights (intelligent fallback)
      (paymentEmails || []).forEach((email: any) => {
        if (email.property_id && email.summary) {
          if (!revenueByProperty[email.property_id]) {
            revenueByProperty[email.property_id] = { 
              ownerrez: 0, midtermExpected: 0, midtermReceived: 0, emailDetected: 0, total: 0, hasDiscrepancy: false, paymentSource: ''
            };
          }
          
          const prop = revenueByProperty[email.property_id];
          // Only use email detection if no recorded payment exists
          if (prop.midtermReceived === 0 && prop.midtermExpected > 0) {
            const detected = extractPaymentFromEmail(email.summary);
            if (detected && detected > prop.emailDetected) {
              prop.emailDetected = detected;
              prop.paymentSource = 'email';
            }
          }
        }
      });

      // Calculate total and discrepancy for each property
      Object.keys(revenueByProperty).forEach((propId) => {
        const prop = revenueByProperty[propId];
        // Use recorded payments first, fall back to email-detected
        const receivedAmount = prop.midtermReceived > 0 ? prop.midtermReceived : prop.emailDetected;
        prop.total = prop.ownerrez + receivedAmount;
        
        // Update midtermReceived to include email-detected for display
        if (prop.midtermReceived === 0 && prop.emailDetected > 0) {
          prop.midtermReceived = prop.emailDetected;
        }
        
        prop.hasDiscrepancy = prop.midtermExpected > 0 && 
          Math.abs(prop.midtermExpected - prop.midtermReceived) > 1; // $1 tolerance
      });
      
      return revenueByProperty;
    },
    enabled: isCurrentMonth(selectedMonth),
  });

  // Fetch pending expenses count for current month preview
  const { data: pendingExpensesCount } = useQuery({
    queryKey: ["pending-expenses-current-month", selectedMonth],
    queryFn: async () => {
      if (!isCurrentMonth(selectedMonth)) return {};
      
      const monthDate = new Date(selectedMonth + "T00:00:00");
      const startDate = format(startOfMonth(monthDate), "yyyy-MM-dd");
      const endDate = format(endOfMonth(monthDate), "yyyy-MM-dd");
      
      // Get pending expenses per property
      const { data, error } = await supabase
        .from("expenses")
        .select("property_id")
        .eq("exported", false)
        .gte("date", startDate)
        .lte("date", endDate);
      
      if (error) throw error;
      
      // Count by property
      const counts: Record<string, number> = {};
      (data || []).forEach((exp: any) => {
        counts[exp.property_id] = (counts[exp.property_id] || 0) + 1;
      });
      
      return counts;
    },
    enabled: isCurrentMonth(selectedMonth),
  });

  const getStatusBadge = (status: string, payoutStatus?: string, serviceType?: string, isPreview?: boolean) => {
    // For preview reconciliations
    if (isPreview) {
      return (
        <Badge className="bg-indigo-600 hover:bg-indigo-700">
          <Eye className="w-3 h-3 mr-1" />
          PREVIEW
        </Badge>
      );
    }
    
    // For full-service, show payout status
    if (serviceType === 'full_service' && payoutStatus === 'completed') {
      return <Badge className="bg-green-600"><Check className="w-3 h-3 mr-1" />Paid Out</Badge>;
    }
    
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      preview: { variant: "secondary", label: "Preview" },
      approved: { variant: "default", label: "Approved" },
      statement_sent: { variant: "outline", label: "Sent to Owner" },
      ready_to_charge: { variant: "default", label: "Ready to Charge" },
      charged: { variant: "default", label: serviceType === 'full_service' ? "Paid Out" : "Charged" },
      disputed: { variant: "destructive", label: "Disputed" },
    };
    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getServiceTypeBadge = (serviceType: string) => {
    if (serviceType === 'full_service') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
          <Banknote className="w-3 h-3 mr-1" />
          Full-Service
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
        <CreditCard className="w-3 h-3 mr-1" />
        Co-Hosting
      </Badge>
    );
  };

  // Open confirmation dialog for performance email
  const handlePerformanceEmailClick = (rec: any) => {
    setEmailConfirmRec(rec);
    setEmailConfirmType("performance");
    setEmailConfirmOpen(true);
  };

  // Open confirmation dialog for statement email
  const handleStatementEmailClick = (rec: any) => {
    setEmailConfirmRec(rec);
    setEmailConfirmType("statement");
    setEmailConfirmOpen(true);
  };

  // Actually send the email after confirmation
  const handleConfirmSendEmail = async () => {
    if (!emailConfirmRec) return;
    
    if (emailConfirmType === "performance") {
      await handleSendPerformanceEmail(emailConfirmRec);
    } else {
      await handleSendOwnerStatement(emailConfirmRec.id);
    }
    
    setEmailConfirmOpen(false);
    setEmailConfirmRec(null);
  };

  const handleSendPerformanceEmail = async (rec: any) => {
    try {
      setSendingPerformance(rec.id);
      
      // Get the property_id from the reconciliation
      const { error } = await supabase.functions.invoke('send-monthly-report', {
        body: { 
          isManualSend: true,
          propertyId: rec.property_id,
          emailType: 'performance',
          sendToOwner: true,
          sendCopyToInfo: true
        }
      });

      if (error) throw error;
      toast.success("Performance email sent to owner and info@peachhausgroup.com");
    } catch (error: any) {
      console.error('Error sending performance email:', error);
      toast.error(error.message || "Failed to send performance email");
    } finally {
      setSendingPerformance(null);
    }
  };

  const handleSendOwnerStatement = async (reconciliationId: string) => {
    try {
      setSendingStatement(reconciliationId);
      const { error } = await supabase.functions.invoke('send-monthly-report', {
        body: { 
          reconciliation_id: reconciliationId
        }
      });

      if (error) throw error;
      toast.success("Owner statement sent successfully!");
      await refetch();
    } catch (error: any) {
      console.error('Error sending owner statement:', error);
      toast.error(error.message || "Failed to send owner statement");
    } finally {
      setSendingStatement(null);
    }
  };

  // Create preview reconciliation for current month and auto-open modal
  const handleCreatePreview = async (propertyId: string) => {
    try {
      setCreatingPreviewFor(propertyId);
      
      const response = await supabase.functions.invoke("create-reconciliation", {
        body: {
          property_id: propertyId,
          month: selectedMonth,
          is_preview: true,
        },
      });

      if (response.data?.success) {
        await refetch();
        // Auto-open the review modal for the newly created reconciliation
        if (response.data.reconciliation?.id) {
          setSelectedReconciliation(response.data.reconciliation.id);
        }
      } else {
        throw new Error(response.data?.error || "Failed to create preview");
      }
    } catch (error: any) {
      console.error("Error creating preview:", error);
      toast.error(error.message || "Failed to create preview reconciliation");
    } finally {
      setCreatingPreviewFor(null);
    }
  };

  // Filter reconciliations: only managed properties (billing_status = 'active')
  const filteredReconciliations = useMemo(() => {
    return reconciliations?.filter((rec: any) => {
      // Only show properties with billing_status = 'active' (managed properties)
      // We need to check via the properties table - join isn't available so we filter by offboarded_at
      const isOffboarded = !!rec.properties?.offboarded_at;
      const offboardedMatch = showOffboarded ? isOffboarded : !isOffboarded;
      
      // Month filter
      const monthMatch = selectedMonth === "all" || rec.reconciliation_month === selectedMonth;
      
      return offboardedMatch && monthMatch;
    }) || [];
  }, [reconciliations, showOffboarded, selectedMonth]);

  // Get reconciliations for managed (active) properties
  // For preview/draft reconciliations: only show if property is in activeProperties (has unbilled items)
  // For completed reconciliations (approved, statement_sent, paid): always show regardless of activeProperties
  const managedReconciliations = useMemo(() => {
    const managedPropertyIds = new Set(activeProperties?.map((p: any) => p.id) || []);
    return filteredReconciliations.filter((rec: any) => {
      // Completed reconciliations (non-preview/draft) should always show
      if (rec.status !== 'preview' && rec.status !== 'draft') {
        return true;
      }
      // Preview/draft reconciliations only show if property has unbilled items
      return managedPropertyIds.has(rec.property_id);
    });
  }, [filteredReconciliations, activeProperties]);

  // Get properties missing reconciliations for the selected month
  const propertiesMissingReconciliation = useMemo(() => {
    if (selectedMonth === "all" || !activeProperties) return [];
    
    const existingPropertyIds = new Set(
      reconciliations
        ?.filter((rec: any) => rec.reconciliation_month === selectedMonth)
        .map((rec: any) => rec.property_id) || []
    );
    
    return activeProperties.filter((prop: any) => !existingPropertyIds.has(prop.id));
  }, [selectedMonth, activeProperties, reconciliations]);

  // Count past month previews that need finalization
  const pastMonthPreviews = useMemo(() => {
    const currentMonthStr = monthOptions[0]?.value;
    if (!currentMonthStr) return [];
    
    return reconciliations?.filter((rec: any) => 
      rec.status === 'preview' && rec.reconciliation_month < currentMonthStr
    ) || [];
  }, [reconciliations, monthOptions]);

  // Get selected month label for display
  const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || "All Months";
  const isSelectedMonthCurrent = isCurrentMonth(selectedMonth);

  // Count stats for the selected month - only managed properties
  const managedCount = activeProperties?.length || 0;
  const reconciledCount = managedReconciliations.length;
  const previewCount = managedReconciliations.filter((r: any) => r.status === 'preview' || r.status === 'draft').length;
  const pendingCount = propertiesMissingReconciliation.length;

  const handleOffboardClick = (rec: any) => {
    setPropertyToOffboard({
      id: rec.properties?.id || rec.property_id,
      name: rec.properties?.name,
      address: rec.properties?.address
    });
    setOffboardDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Monthly Reconciliations</h2>
          <p className="text-sm text-muted-foreground">
            Review property performance before sending statements to owners
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {/* Month Filter */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {monthOptions.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  <div className="flex items-center gap-2">
                    {month.label}
                    {month.isCurrent && (
                      <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300">
                        Preview
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch
              id="show-offboarded"
              checked={showOffboarded}
              onCheckedChange={setShowOffboarded}
            />
            <Label htmlFor="show-offboarded" className="text-sm text-muted-foreground">
              Show archived
            </Label>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Calendar className="w-4 h-4 mr-2" />
            Start Reconciliation
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-6">
          <p className="text-center text-muted-foreground">Loading reconciliations...</p>
        </Card>
      ) : (
        <>
          {/* Progress indicator for the selected month */}
          {selectedMonth !== "all" && (
            <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
              isSelectedMonthCurrent 
                ? "bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800" 
                : "bg-muted/50"
            }`}>
              <div className="flex items-center gap-2">
                {isSelectedMonthCurrent && (
                  <Badge className="bg-indigo-600">
                    <Clock className="w-3 h-3 mr-1" />
                    CURRENT MONTH
                  </Badge>
                )}
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedMonthLabel}</span>
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  {managedCount} properties with live listings
                </span>
                <span className="text-muted-foreground">•</span>
                {isSelectedMonthCurrent ? (
                  <>
                    {previewCount > 0 && (
                      <>
                        <span className="text-indigo-600 font-medium">
                          {previewCount} in progress
                        </span>
                        <span className="text-muted-foreground">•</span>
                      </>
                    )}
                    {pendingCount > 0 ? (
                      <span className="text-amber-600 font-medium">
                        {pendingCount} not started
                      </span>
                    ) : (
                      <span className="text-green-600 font-medium">
                        All started
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-green-600 font-medium">
                      {reconciledCount} completed
                    </span>
                    {pendingCount > 0 && (
                      <span className="text-amber-600 font-medium">
                        {pendingCount} pending
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* Current month info banner */}
          {isSelectedMonthCurrent && selectedMonth !== "all" && (
            <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Eye className="w-5 h-5 text-indigo-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-indigo-900 dark:text-indigo-100">Preview Mode</h4>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    Start approving expenses now. Revenue will be finalized on the 1st of next month when all bookings are complete.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Banner for past month previews that need finalization */}
          {pastMonthPreviews.length > 0 && (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-900 dark:text-amber-100">Past Month Previews Need Finalization</h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      {pastMonthPreviews.length} preview{pastMonthPreviews.length !== 1 ? 's' : ''} from previous months should be finalized. 
                      These will auto-finalize on the 1st of each month.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* SECTION 1: Preview/Draft Cards (Active Work) - show drafts from ANY month on top */}
          {(() => {
            // Show preview/draft reconciliations for the selected month OR current month previews
            const previewAndDraftRecs = managedReconciliations.filter(
              (rec: any) => rec.status === 'preview' || rec.status === 'draft'
            );
            const missingPropertiesForSection = isSelectedMonthCurrent ? propertiesMissingReconciliation : [];
            
            if (previewAndDraftRecs.length > 0 || missingPropertiesForSection.length > 0) {
              return (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-px flex-1 bg-indigo-200 dark:bg-indigo-800" />
                    <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 px-3 flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Active Work - Needs Attention
                    </h3>
                    <div className="h-px flex-1 bg-indigo-200 dark:bg-indigo-800" />
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {/* Preview/Draft reconciliation cards */}
                    {previewAndDraftRecs.map((rec: any) => {
                      const isOffboarded = !!rec.properties?.offboarded_at;
                      const isFullService = rec.service_type === 'full_service';
                      const isPreview = isCurrentMonth(rec.reconciliation_month) || rec.status === 'preview';
                      const propertyRevenue = currentMonthRevenue?.[rec.property_id];
                      const currentRevenue = propertyRevenue?.total || 0;
                      const hasDiscrepancy = propertyRevenue?.hasDiscrepancy || false;
                      const expectedRent = propertyRevenue?.midtermExpected || 0;
                      const receivedRent = propertyRevenue?.midtermReceived || 0;
                      
                      return (
                        <Card 
                          key={rec.id} 
                          className={`overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer ${
                            isOffboarded 
                              ? 'opacity-75 border-dashed border-muted-foreground/30 bg-muted/20' 
                              : isPreview
                                ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-950/10'
                                : 'border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/10'
                          }`}
                          onClick={() => setSelectedReconciliation(rec.id)}
                        >
                          
                          {/* Archived Banner */}
                          {isOffboarded && (
                            <div className="bg-muted/50 border-b border-dashed px-4 py-2 flex items-center gap-2">
                              <Archive className="w-4 h-4 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground font-medium">
                                Archived {rec.properties?.offboarded_at && format(new Date(rec.properties.offboarded_at), "MMM dd, yyyy")}
                              </span>
                            </div>
                          )}
                          
                          {/* Header Section */}
                          <div className={`p-4 border-b ${isPreview ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : 'bg-amber-50/50 dark:bg-amber-950/20'}`}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <Home className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                <h3 className="font-semibold text-sm leading-tight">{rec.properties?.name}</h3>
                              </div>
                              <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                <Badge variant="outline" className={`font-medium ${isPreview ? 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900 dark:text-indigo-300' : 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300'}`}>
                                  {format(new Date(rec.reconciliation_month + "T00:00:00"), "MMM yyyy").toUpperCase()}
                                  {isPreview ? " - PREVIEW" : " - DRAFT"}
                                </Badge>
                                {getServiceTypeBadge(rec.service_type)}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-0.5">
                              <p className="truncate">{rec.properties?.address}</p>
                              <p className="flex items-center gap-1">
                                <span className="font-medium">Owner:</span> {rec.property_owners?.name}
                              </p>
                              {rec.property_owners?.payment_method && (
                                <p className="flex items-center gap-1 text-xs">
                                  <span className="font-medium">Payment:</span> 
                                  <span className={rec.property_owners?.stripe_customer_id ? "text-green-600" : "text-amber-600"}>
                                    {rec.property_owners?.stripe_customer_id ? "✓ Stripe Connected" : rec.property_owners.payment_method}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Financial Metrics */}
                          <div className="p-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg p-3 text-center bg-green-50 dark:bg-green-950/30">
                                  <p className="text-xs text-muted-foreground font-medium mb-1">
                                    {expectedRent > 0 ? 'Rent Received' : 'Revenue'} {isPreview && "(MTD)"}
                                  </p>
                                  <p className="font-bold text-sm text-green-600">
                                    {isPreview ? formatCurrency(currentRevenue) : formatCurrency(rec.total_revenue || 0)}
                                  </p>
                                  {isPreview && expectedRent > 0 && (
                                    <p className="text-xs mt-0.5 text-muted-foreground">
                                      of {formatCurrency(expectedRent)} expected
                                    </p>
                                  )}
                                  {isPreview && propertyRevenue?.paymentSource === 'email' && (
                                    <p className="text-xs text-indigo-600 mt-0.5">
                                      detected from email
                                    </p>
                                  )}
                                </div>
                                <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-3 text-center ring-1 ring-primary/20">
                                  <p className="text-xs text-muted-foreground font-medium mb-1">
                                    Total Due
                                  </p>
                                  <p className="font-bold text-primary text-sm">
                                    {formatCurrency(
                                      (rec.management_fee || 0) + 
                                      (rec.calculated_total_expenses || 0) + 
                                      (rec.calculated_visit_fees || 0)
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    to charge owner
                                  </p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 text-center">
                                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Mgmt Fee</p>
                                  <p className="font-bold text-amber-600 text-xs">
                                    {formatCurrency(rec.management_fee || 0)}
                                  </p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-2 text-center">
                                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Expenses</p>
                                  <p className="font-bold text-red-600 text-xs">
                                    {formatCurrency(rec.calculated_total_expenses || 0)}
                                  </p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-2 text-center">
                                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Visits</p>
                                  <p className="font-bold text-red-600 text-xs">
                                    {formatCurrency(rec.calculated_visit_fees || 0)}
                                  </p>
                                </div>
                              </div>

                              {rec.pending_items_count > 0 && (
                                <div className="flex items-center justify-center gap-2 p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg border border-amber-300 dark:border-amber-700">
                                  <Clock className="w-4 h-4 text-amber-600" />
                                  <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                                    {rec.pending_items_count} item{rec.pending_items_count !== 1 ? 's' : ''} pending approval
                                  </span>
                                </div>
                              )}

                              <Button 
                                className="w-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedReconciliation(rec.id);
                                }}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Review & Approve Expenses
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                    
                    {/* Placeholder cards for properties missing preview (current month only) */}
                    {missingPropertiesForSection.map((prop: any) => {
                      const expenseCount = pendingExpensesCount?.[prop.id] || 0;
                      const propertyRevenue = currentMonthRevenue?.[prop.id];
                      const currentRevenue = propertyRevenue?.total || 0;
                      
                      return (
                        <Card 
                          key={`missing-${prop.id}`}
                          className="overflow-hidden border-indigo-300 dark:border-indigo-700 bg-indigo-50/20 dark:bg-indigo-950/10 cursor-pointer hover:shadow-md transition-all duration-200"
                          onClick={() => !creatingPreviewFor && handleCreatePreview(prop.id)}
                        >
                          <div className="p-4 border-b border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <Home className="w-4 h-4 flex-shrink-0 text-indigo-600 mt-0.5" />
                                <h3 className="font-semibold text-sm leading-tight text-indigo-800 dark:text-indigo-200">
                                  {prop.name}
                                </h3>
                              </div>
                              <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-700">
                                START PREVIEW
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-0.5">
                              <p className="truncate">{prop.address}</p>
                              <p className="flex items-center gap-1">
                                <span className="font-medium">Owner:</span> {prop.property_owners?.name || "No owner assigned"}
                              </p>
                            </div>
                          </div>

                          <div className="p-4">
                            {/* Show current revenue if available */}
                            {currentRevenue > 0 && (
                              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center mb-4">
                                <p className="text-xs text-muted-foreground font-medium mb-1">Revenue (MTD)</p>
                                <p className="font-bold text-green-600 text-sm">
                                  {formatCurrency(currentRevenue)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">as of today</p>
                              </div>
                            )}
                            
                            <div className="flex flex-col items-center justify-center text-center">
                              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-indigo-100 dark:bg-indigo-900/50">
                                <Eye className="w-6 h-6 text-indigo-600" />
                              </div>
                              
                              {expenseCount > 0 && (
                                <p className="text-sm text-indigo-600 font-medium mb-2">
                                  {expenseCount} expense{expenseCount !== 1 ? 's' : ''} pending approval
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground mb-4">
                                Start approving expenses for <span className="font-medium">{selectedMonthLabel}</span>
                              </p>
                              <Button 
                                className="bg-indigo-600 hover:bg-indigo-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreatePreview(prop.id);
                                }}
                                disabled={creatingPreviewFor === prop.id}
                              >
                                {creatingPreviewFor === prop.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Start Preview
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* SECTION 2: Completed Reconciliations (grouped by month if viewing "all") */}
          {(() => {
            const completedRecs = managedReconciliations.filter(
              (rec: any) => rec.status !== 'preview' && rec.status !== 'draft'
            );
            
            // Also include missing properties for past months
            const missingForPastMonths = !isSelectedMonthCurrent ? propertiesMissingReconciliation : [];
            
            if (completedRecs.length === 0 && missingForPastMonths.length === 0) return null;
            
            // Group by month if viewing "all"
            const groupedByMonth = selectedMonth === "all" 
              ? completedRecs.reduce((acc: Record<string, any[]>, rec: any) => {
                  const month = rec.reconciliation_month;
                  if (!acc[month]) acc[month] = [];
                  acc[month].push(rec);
                  return acc;
                }, {})
              : { [selectedMonth]: completedRecs };
            
            const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => 
              new Date(b).getTime() - new Date(a).getTime()
            );
            
            return (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-green-200 dark:bg-green-800" />
                  <h3 className="text-sm font-semibold text-green-600 dark:text-green-400 px-3 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Completed Reconciliations
                  </h3>
                  <div className="h-px flex-1 bg-green-200 dark:bg-green-800" />
                </div>
                
                {sortedMonths.map((month) => (
                  <div key={month} className="mb-6">
                    {selectedMonth === "all" && (
                      <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(month + "T00:00:00"), "MMMM yyyy")}
                        <Badge variant="outline" className="text-xs">{groupedByMonth[month].length} properties</Badge>
                      </h4>
                    )}
                    
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {groupedByMonth[month].map((rec: any) => {
                        const isOffboarded = !!rec.properties?.offboarded_at;
                        const isFullService = rec.service_type === 'full_service';
                        const isStatementSent = !!rec.statement_sent_at || rec.status === 'statement_sent';
                        
                        return (
                          <Card 
                            key={rec.id} 
                            className={`overflow-hidden transition-all duration-200 hover:shadow-md ${
                              isOffboarded 
                                ? 'opacity-75 border-dashed border-muted-foreground/30 bg-muted/20' 
                                : isStatementSent
                                  ? 'ring-2 ring-green-500 dark:ring-green-400 bg-green-50/30 dark:bg-green-950/20'
                                  : ''
                            }`}
                          >
                            {/* Statement Sent Banner */}
                            {isStatementSent && !isOffboarded && (
                              <div className="bg-green-100 dark:bg-green-950/50 border-b border-green-200 dark:border-green-800 px-4 py-2 flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                                  Statement Sent {rec.statement_sent_at && format(new Date(rec.statement_sent_at), "MMM dd, yyyy")}
                                </span>
                              </div>
                            )}
                            {/* Archived Banner */}
                            {isOffboarded && (
                              <div className="bg-muted/50 border-b border-dashed px-4 py-2 flex items-center gap-2">
                                <Archive className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground font-medium">
                                  Archived {rec.properties?.offboarded_at && format(new Date(rec.properties.offboarded_at), "MMM dd, yyyy")}
                                </span>
                              </div>
                            )}
                            
                            {/* Header Section */}
                            <div className="p-4 border-b bg-muted/30">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                  <Home className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                  <h3 className="font-semibold text-sm leading-tight">{rec.properties?.name}</h3>
                                </div>
                                <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                  <Badge variant="outline" className="font-medium bg-background">
                                    {format(new Date(rec.reconciliation_month + "T00:00:00"), "MMM yyyy").toUpperCase()}
                                  </Badge>
                                  {getServiceTypeBadge(rec.service_type)}
                                  {getStatusBadge(rec.status, rec.payout_status, rec.service_type, false)}
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground space-y-0.5">
                                <p className="truncate">{rec.properties?.address}</p>
                                <p className="flex items-center gap-1">
                                  <span className="font-medium">Owner:</span> {rec.property_owners?.name}
                                </p>
                              </div>
                            </div>

                            {/* Financial Metrics Grid */}
                            <div className="p-4">
                              <div className="grid grid-cols-3 gap-3 mb-4">
                                {/* Revenue */}
                                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                                  <div className="flex items-center justify-center gap-1 mb-1">
                                    <TrendingUp className="w-3 h-3 text-green-600" />
                                    <p className="text-xs text-muted-foreground font-medium">Revenue</p>
                                  </div>
                                  <p className="font-bold text-green-600 text-sm">
                                    {formatCurrency(rec.total_revenue || 0)}
                                  </p>
                                </div>
                                
                                {/* Visit Fees */}
                                <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
                                  <div className="flex items-center justify-center gap-1 mb-1">
                                    <TrendingDown className="w-3 h-3 text-red-600" />
                                    <p className="text-xs text-muted-foreground font-medium">Visits</p>
                                  </div>
                                  <p className="font-bold text-red-600 text-sm">
                                    {formatCurrency(rec.calculated_visit_fees || 0)}
                                  </p>
                                </div>
                                
                                {/* Expenses */}
                                <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
                                  <div className="flex items-center justify-center gap-1 mb-1">
                                    <TrendingDown className="w-3 h-3 text-red-600" />
                                    <p className="text-xs text-muted-foreground font-medium">Expenses</p>
                                  </div>
                                  <p className="font-bold text-red-600 text-sm">
                                    {formatCurrency(rec.calculated_total_expenses || 0)}
                                  </p>
                                </div>
                                
                                {/* Mgmt Fee */}
                                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
                                  <div className="flex items-center justify-center gap-1 mb-1">
                                    <DollarSign className="w-3 h-3 text-amber-600" />
                                    <p className="text-xs text-muted-foreground font-medium">Mgmt Fee</p>
                                  </div>
                                  <p className="font-bold text-amber-600 text-sm">
                                    {formatCurrency(rec.management_fee || 0)}
                                  </p>
                                </div>
                                
                                {/* Order Min */}
                                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
                                  <div className="flex items-center justify-center gap-1 mb-1">
                                    <DollarSign className="w-3 h-3 text-amber-600" />
                                    <p className="text-xs text-muted-foreground font-medium">Order Min</p>
                                  </div>
                                  <p className="font-bold text-amber-600 text-sm">
                                    {formatCurrency(rec.order_minimum_fee || 0)}
                                  </p>
                                </div>
                                
                                {/* Settlement Amount */}
                                <div className={`rounded-lg p-3 text-center ${
                                  isFullService 
                                    ? 'bg-green-100 dark:bg-green-950/50 ring-1 ring-green-200 dark:ring-green-800' 
                                    : 'bg-primary/10 ring-1 ring-primary/20'
                                }`}>
                                  <p className="text-xs text-muted-foreground font-medium mb-1">
                                    {isFullService ? 'Payout' : 'Due'}
                                  </p>
                                  {rec.calculator_error ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-destructive" />
                                      <p className="text-xs text-destructive">Error</p>
                                    </div>
                                  ) : (
                                    <p className={`font-bold text-sm ${isFullService ? 'text-green-600' : 'text-primary'}`}>
                                      {formatCurrency(isFullService 
                                        ? (rec.calculated_payout_to_owner || 0) 
                                        : (rec.calculated_due_from_owner || 0)
                                      )}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              <p className="text-xs text-muted-foreground text-center mb-4 italic">
                                Only approved items included in calculations
                              </p>

                              {/* Actions */}
                              <ReconciliationCardActions
                                reconciliation={rec}
                                isOffboarded={isOffboarded}
                                onReview={() => setSelectedReconciliation(rec.id)}
                                onOffboard={() => handleOffboardClick(rec)}
                                onSendPerformanceEmail={() => handlePerformanceEmailClick(rec)}
                                onSendOwnerStatement={() => handleStatementEmailClick(rec)}
                                sendingPerformance={sendingPerformance === rec.id}
                                sendingStatement={sendingStatement === rec.id}
                              />
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
                
                {/* Missing properties for past months */}
                {missingForPastMonths.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-px flex-1 bg-amber-200 dark:bg-amber-800" />
                      <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 px-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Not Yet Reconciled
                      </h3>
                      <div className="h-px flex-1 bg-amber-200 dark:bg-amber-800" />
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {missingForPastMonths.map((prop: any) => (
                        <Card 
                          key={`missing-${prop.id}`}
                          className="overflow-hidden border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/10"
                        >
                          <div className="p-4 border-b border-dashed border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <Home className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
                                <h3 className="font-semibold text-sm leading-tight text-amber-800 dark:text-amber-200">
                                  {prop.name}
                                </h3>
                              </div>
                              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700">
                                NOT STARTED
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-0.5">
                              <p className="truncate">{prop.address}</p>
                              <p className="flex items-center gap-1">
                                <span className="font-medium">Owner:</span> {prop.property_owners?.name || "No owner assigned"}
                              </p>
                            </div>
                          </div>

                          <div className="p-6 flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-amber-100 dark:bg-amber-900/50">
                              <Calendar className="w-6 h-6 text-amber-600" />
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                              No reconciliation for <span className="font-medium">{selectedMonthLabel}</span>
                            </p>
                            <Button 
                              variant="outline" 
                              className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
                              onClick={() => setShowCreateDialog(true)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Create Reconciliation
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          
          {/* Empty state when no reconciliations AND no missing properties */}
          {(!filteredReconciliations || filteredReconciliations.length === 0) && propertiesMissingReconciliation.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No reconciliations yet</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Calendar className="w-4 h-4 mr-2" />
                Create Your First Reconciliation
              </Button>
            </Card>
          )}
        </>
      )}

      <CreateReconciliationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={refetch}
        defaultMonth={selectedMonth !== "all" ? selectedMonth : undefined}
      />

      {selectedReconciliation && (
        <ReconciliationReviewModal
          reconciliationId={selectedReconciliation}
          open={!!selectedReconciliation}
          onOpenChange={(open) => !open && setSelectedReconciliation(null)}
          onSuccess={refetch}
        />
      )}

      {propertyToOffboard && (
        <OffboardPropertyDialog
          open={offboardDialogOpen}
          onOpenChange={setOffboardDialogOpen}
          property={propertyToOffboard}
          onSuccess={() => {
            refetch();
            setPropertyToOffboard(null);
          }}
        />
      )}

      {/* Email Confirmation Dialog */}
      {emailConfirmRec && (
        <EmailConfirmationDialog
          open={emailConfirmOpen}
          onOpenChange={(open) => {
            setEmailConfirmOpen(open);
            if (!open) setEmailConfirmRec(null);
          }}
          onConfirm={handleConfirmSendEmail}
          isLoading={sendingPerformance === emailConfirmRec?.id || sendingStatement === emailConfirmRec?.id}
          emailType={emailConfirmType}
          propertyName={emailConfirmRec?.properties?.name || "Unknown Property"}
          ownerName={emailConfirmRec?.property_owners?.name || "Unknown Owner"}
          ownerEmail={emailConfirmRec?.property_owners?.email || "No email"}
          month={emailConfirmRec?.reconciliation_month 
            ? format(new Date(emailConfirmRec.reconciliation_month + "T00:00:00"), "MMMM yyyy")
            : "Unknown"
          }
        />
      )}
    </div>
  );
};
