import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Eye, Send, Mail, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { CreateReconciliationDialog } from "./CreateReconciliationDialog";
import { ReconciliationReviewModal } from "./ReconciliationReviewModal";
import { toast } from "sonner";

export const ReconciliationList = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<string | null>(null);
  const [sendingPerformance, setSendingPerformance] = useState<string | null>(null);
  const [sendingStatement, setSendingStatement] = useState<string | null>(null);

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
          properties(name, address, management_fee_percentage),
          property_owners(name, email)
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
        const calculated = calculateDueFromOwnerFromLineItems(
          lineItems || [],
          rec.management_fee || 0,
          rec.order_minimum_fee || 0
        );

        return {
          ...rec,
          calculated_visit_fees: calculated.visitFees,
          calculated_total_expenses: calculated.totalExpenses,
          calculated_due_from_owner: calculated.dueFromOwner,
          calculator_error: calculated.error
        };
      }));

      return reconciliationsWithCalculatedTotals;
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      approved: { variant: "default", label: "Approved" },
      statement_sent: { variant: "outline", label: "Sent to Owner" },
      ready_to_charge: { variant: "default", label: "Ready to Charge" },
      charged: { variant: "default", label: "Charged" },
      disputed: { variant: "destructive", label: "Disputed" },
    };
    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Monthly Reconciliations</h2>
          <p className="text-sm text-muted-foreground">
            Review property performance before sending statements to owners
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Calendar className="w-4 h-4 mr-2" />
          Start Reconciliation
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-6">
          <p className="text-center text-muted-foreground">Loading reconciliations...</p>
        </Card>
      ) : reconciliations && reconciliations.length > 0 ? (
        <div className="grid gap-4">
          {reconciliations.map((rec: any) => (
            <Card key={rec.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">{rec.properties?.name}</h3>
                    {getStatusBadge(rec.status)}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Owner: {rec.property_owners?.name}</p>
                    <p>Month: {format(new Date(rec.reconciliation_month + "T00:00:00"), "MMMM yyyy")}</p>
                  </div>
                  <div className="grid grid-cols-6 gap-4 mt-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                      <p className="font-semibold text-green-600">
                        ${Number(rec.total_revenue || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Visit Fees</p>
                      <p className="font-semibold text-red-600">
                        ${Number(rec.calculated_visit_fees || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Expenses</p>
                      <p className="font-semibold text-red-600">
                        ${Number(rec.calculated_total_expenses || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Mgmt Fee</p>
                      <p className="font-semibold text-amber-600">
                        ${Number(rec.management_fee || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Order Min</p>
                      <p className="font-semibold text-amber-600">
                        ${Number(rec.order_minimum_fee || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Due from Owner (Live Calculator)</p>
                          {rec.calculator_error ? (
                            <p className="font-semibold text-destructive text-sm">
                              Error: {rec.calculator_error}
                            </p>
                          ) : (
                            <>
                              <p className="font-bold text-primary text-lg">
                                ${Number(rec.calculated_due_from_owner || 0).toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Only approved charges included
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedReconciliation(rec.id)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Review
                  </Button>
                  {(rec.status === "approved" || rec.status === "statement_sent") && (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleSendPerformanceEmail(rec)}
                        disabled={sendingPerformance === rec.id || sendingStatement === rec.id}
                      >
                        {sendingPerformance === rec.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4 mr-2" />
                            Send Performance Email
                          </>
                        )}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => handleSendOwnerStatement(rec.id)}
                        disabled={sendingPerformance === rec.id || sendingStatement === rec.id}
                      >
                        {sendingStatement === rec.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            {rec.status === "statement_sent" ? "Resend" : "Send"} Owner Statement
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
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
      />

      {selectedReconciliation && (
        <ReconciliationReviewModal
          reconciliationId={selectedReconciliation}
          open={!!selectedReconciliation}
          onOpenChange={(open) => !open && setSelectedReconciliation(null)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
};