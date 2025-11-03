import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Eye, Send } from "lucide-react";
import { format } from "date-fns";
import { CreateReconciliationDialog } from "./CreateReconciliationDialog";
import { ReconciliationReviewModal } from "./ReconciliationReviewModal";

export const ReconciliationList = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<string | null>(null);

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
      return data;
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
                        ${Number(rec.visit_fees || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Expenses</p>
                      <p className="font-semibold text-red-600">
                        ${Number(rec.total_expenses || 0).toFixed(2)}
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
                      <p className="text-xs text-muted-foreground">Due from Owner</p>
                      <p className="font-bold text-primary text-lg">
                        ${(Number(rec.management_fee || 0) + Number(rec.visit_fees || 0) + Number(rec.total_expenses || 0) + Number(rec.order_minimum_fee || 0)).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Mgmt Fee + Order Min + Visits + Expenses
                      </p>
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
                  {rec.status === "approved" && (
                    <Button size="sm" variant="default">
                      <Send className="w-4 h-4 mr-2" />
                      Send Statement
                    </Button>
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