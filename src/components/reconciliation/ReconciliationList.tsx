import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Check, CreditCard, Banknote, AlertTriangle, Archive, TrendingUp, TrendingDown, DollarSign, Home } from "lucide-react";
import { format } from "date-fns";
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
  
  // Email confirmation dialog state
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);
  const [emailConfirmType, setEmailConfirmType] = useState<"performance" | "statement">("performance");
  const [emailConfirmRec, setEmailConfirmRec] = useState<any>(null);

  // Generate last 6 months for filter - start from LAST month
  const monthOptions = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - 1 - i);
      return {
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`,
        label: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      };
    });
  }, []);

  // Default to last month
  useEffect(() => {
    if (monthOptions.length > 0 && selectedMonth === "all") {
      setSelectedMonth(monthOptions[0].value);
    }
  }, [monthOptions]);

  // Real-time subscription for line item changes
  useEffect(() => {
    const channel = supabase
      .channel('reconciliation-line-items-list-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reconciliation_line_items'
        },
        () => {
          // Refetch reconciliations when any line item changes
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const { data: reconciliations, isLoading, refetch } = useQuery({
    queryKey: ["reconciliations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_reconciliations")
        .select(`
          *,
          properties(id, name, address, management_fee_percentage, offboarded_at, offboarding_reason),
          property_owners(name, email, service_type, payment_method)
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

        return {
          ...rec,
          calculated_visit_fees: calculated.visitFees,
          calculated_total_expenses: calculated.totalExpenses,
          calculated_due_from_owner: calculated.dueFromOwner,
          calculated_payout_to_owner: calculated.payoutToOwner,
          service_type: serviceType,
          calculator_error: calculated.error
        };
      }));

      return reconciliationsWithCalculatedTotals;
    },
  });

  const getStatusBadge = (status: string, payoutStatus?: string, serviceType?: string) => {
    // For full-service, show payout status
    if (serviceType === 'full_service' && payoutStatus === 'completed') {
      return <Badge className="bg-green-600"><Check className="w-3 h-3 mr-1" />Paid Out</Badge>;
    }
    
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
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

  // Filter reconciliations based on offboarded status AND selected month
  const filteredReconciliations = reconciliations?.filter((rec: any) => {
    const isOffboarded = !!rec.properties?.offboarded_at;
    const offboardedMatch = showOffboarded ? isOffboarded : !isOffboarded;
    
    // Month filter
    const monthMatch = selectedMonth === "all" || rec.reconciliation_month === selectedMonth;
    
    return offboardedMatch && monthMatch;
  });

  // Get selected month label for display
  const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || "All Months";

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
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {monthOptions.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
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
      ) : filteredReconciliations && filteredReconciliations.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredReconciliations.map((rec: any) => {
            const isOffboarded = !!rec.properties?.offboarded_at;
            const isFullService = rec.service_type === 'full_service';
            
            return (
              <Card 
                key={rec.id} 
                className={`overflow-hidden transition-all duration-200 hover:shadow-md ${
                  isOffboarded 
                    ? 'opacity-75 border-dashed border-muted-foreground/30 bg-muted/20' 
                    : ''
                }`}
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
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Home className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <h3 className="font-semibold truncate">{rec.properties?.name}</h3>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      {/* Month Badge - prominent display */}
                      <Badge variant="outline" className="bg-background font-medium">
                        {format(new Date(rec.reconciliation_month + "T00:00:00"), "MMM yyyy").toUpperCase()}
                      </Badge>
                      {getServiceTypeBadge(rec.service_type)}
                      {getStatusBadge(rec.status, rec.payout_status, rec.service_type)}
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
      ) : (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">No reconciliations yet</p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Calendar className="w-4 h-4 mr-2" />
            Create Your First Reconciliation
          </Button>
        </Card>
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
