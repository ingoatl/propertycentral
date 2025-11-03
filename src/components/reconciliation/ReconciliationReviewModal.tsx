import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Check, Home, DollarSign, Eye, RotateCcw, Package } from "lucide-react";
import { BillingCalculator } from "./BillingCalculator";
import { toast } from "sonner";
import { MonthlyEmailPreviewModal } from "./MonthlyEmailPreviewModal";

interface ReconciliationReviewModalProps {
  reconciliationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ReconciliationReviewModal = ({
  reconciliationId,
  open,
  onOpenChange,
  onSuccess,
}: ReconciliationReviewModalProps) => {
  const [notes, setNotes] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["reconciliation", reconciliationId],
    queryFn: async () => {
      const { data: rec, error: recError } = await supabase
        .from("monthly_reconciliations")
        .select(`
          *,
          properties(id, name, address, management_fee_percentage),
          property_owners(name, email)
        `)
        .eq("id", reconciliationId)
        .single();

      if (recError) throw recError;

      const { data: items, error: itemsError } = await supabase
        .from("reconciliation_line_items")
        .select("*")
        .eq("reconciliation_id", reconciliationId)
        .order("date", { ascending: false });

      if (itemsError) throw itemsError;

      // Fetch unbilled visits for this property (from ANY month)
      const { data: unbilledVisits, error: visitsError } = await supabase
        .from("visits")
        .select("*")
        .eq("property_id", rec.properties.id)
        .eq("billed", false)
        .order("date", { ascending: false });

      if (visitsError) throw visitsError;

      // Fetch unbilled expenses for this property (from ANY month)
      // Exclude expenses that are already in this reconciliation's line items
      const { data: unbilledExpenses, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("property_id", rec.properties.id)
        .eq("exported", false)
        .order("date", { ascending: false });

      if (expensesError) throw expensesError;

      // Filter out expenses that are already in line items
      const lineItemExpenseIds = items
        ?.filter((item: any) => item.item_type === 'expense')
        .map((item: any) => item.item_id) || [];
      
      const filteredUnbilledExpenses = (unbilledExpenses || []).filter(
        (expense: any) => !lineItemExpenseIds.includes(expense.id)
      );

      // Filter out visits that are already in line items
      const lineItemVisitIds = items
        ?.filter((item: any) => item.item_type === 'visit')
        .map((item: any) => item.item_id) || [];
      
      const filteredUnbilledVisits = (unbilledVisits || []).filter(
        (visit: any) => !lineItemVisitIds.includes(visit.id)
      );

      return { 
        reconciliation: rec, 
        lineItems: items, 
        unbilledVisits: filteredUnbilledVisits,
        unbilledExpenses: filteredUnbilledExpenses
      };
    },
    enabled: open,
  });

  const handleToggleVerified = async (itemId: string, currentValue: boolean) => {
    const { error } = await supabase
      .from("reconciliation_line_items")
      .update({ verified: !currentValue })
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to update verification status");
      return;
    }

    refetch();
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("monthly_reconciliations")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          notes,
        })
        .eq("id", reconciliationId);

      if (error) throw error;

      toast.success("Reconciliation approved!");
      await refetch();
      setNotes("");
      setShowEmailPreview(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to approve reconciliation");
    } finally {
      setIsApproving(false);
    }
  };


  if (!data) return null;

  const { reconciliation, lineItems, unbilledVisits, unbilledExpenses } = data;
  const bookings = lineItems.filter((i: any) => i.item_type === "booking" || i.item_type === "mid_term_booking");
  const expenses = lineItems.filter((i: any) => i.item_type === "expense");
  const visits = lineItems.filter((i: any) => i.item_type === "visit");
  const orderMinimums = lineItems.filter((i: any) => i.item_type === "order_minimum");
  
  // Ensure arrays are defined with fallbacks
  const safeUnbilledVisits = unbilledVisits || [];
  const safeUnbilledExpenses = unbilledExpenses || [];

  const getItemIcon = (type: string) => {
    if (type === "booking" || type === "mid_term_booking") return <Home className="w-4 h-4" />;
    if (type === "visit") return <Eye className="w-4 h-4" />;
    if (type === "expense") return <RotateCcw className="w-4 h-4" />;
    if (type === "order_minimum") return <DollarSign className="w-4 h-4 text-amber-500" />;
    return <DollarSign className="w-4 h-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              Review Reconciliation - {reconciliation.properties?.name}
            </span>
            <Badge>{format(new Date(reconciliation.reconciliation_month + 'T00:00:00'), "MMMM yyyy")}</Badge>
          </DialogTitle>
        </DialogHeader>


        <Card className="p-6 bg-muted/50">
          <h3 className="font-semibold mb-4">📊 Financial Summary</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Booking Revenue (Owner Keeps)</p>
              <p className="text-sm">Short-term: ${Number(reconciliation.short_term_revenue || 0).toFixed(2)}</p>
              <p className="text-sm">Mid-term: ${Number(reconciliation.mid_term_revenue || 0).toFixed(2)}</p>
              <p className="font-semibold mt-1 text-green-600">Total: ${Number(reconciliation.total_revenue || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Amount Due from Owner</p>
              <p className="text-sm">Management Fee ({reconciliation.properties?.management_fee_percentage || 15}%): ${Number(reconciliation.management_fee || 0).toFixed(2)}</p>
              <p className="text-sm">Visit Fees: ${Number(reconciliation.visit_fees || 0).toFixed(2)}</p>
              <p className="text-sm">Expenses: ${Number(reconciliation.total_expenses || 0).toFixed(2)}</p>
              <p className="font-semibold mt-2 pt-2 border-t text-primary text-lg">Total Due: ${Number(reconciliation.net_to_owner || 0).toFixed(2)}</p>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="all" className="mt-4">
          <TabsList>
            <TabsTrigger value="all">All ({lineItems.length})</TabsTrigger>
            <TabsTrigger value="bookings">Bookings ({bookings.length})</TabsTrigger>
            <TabsTrigger value="expenses">Expenses ({expenses.length})</TabsTrigger>
            <TabsTrigger value="visits">Visits ({visits.length})</TabsTrigger>
            <TabsTrigger value="unbilled">
              Unbilled Items ({safeUnbilledVisits.length + safeUnbilledExpenses.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-2">
            {lineItems.map((item: any) => (
              <LineItemRow key={item.id} item={item} onToggleVerified={handleToggleVerified} getIcon={getItemIcon} />
            ))}
          </TabsContent>

          <TabsContent value="bookings" className="space-y-2">
            {bookings.map((item: any) => (
              <LineItemRow key={item.id} item={item} onToggleVerified={handleToggleVerified} getIcon={getItemIcon} />
            ))}
          </TabsContent>

          <TabsContent value="expenses" className="space-y-2">
            {expenses.map((item: any) => (
              <LineItemRow key={item.id} item={item} onToggleVerified={handleToggleVerified} getIcon={getItemIcon} />
            ))}
          </TabsContent>

          <TabsContent value="visits" className="space-y-2">
            {visits.map((item: any) => (
              <LineItemRow key={item.id} item={item} onToggleVerified={handleToggleVerified} getIcon={getItemIcon} />
            ))}
          </TabsContent>

          <TabsContent value="unbilled">
            <BillingCalculator
              reconciliationId={reconciliationId}
              propertyId={reconciliation.properties.id}
              currentRevenue={Number(reconciliation.total_revenue || 0)}
              currentVisitFees={Number(reconciliation.visit_fees || 0)}
              currentExpenses={Number(reconciliation.total_expenses || 0)}
              currentManagementFee={Number(reconciliation.management_fee || 0)}
              managementFeePercentage={Number(reconciliation.properties?.management_fee_percentage || 15)}
              unbilledVisits={safeUnbilledVisits}
              unbilledExpenses={safeUnbilledExpenses}
              onRecalculate={refetch}
            />
          </TabsContent>
        </Tabs>

        <div className="space-y-2 mt-4">
          <label className="text-sm font-medium">Bookkeeper Notes</label>
          <Textarea
            placeholder="Add any notes about this reconciliation..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex justify-between pt-4 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex gap-2">
            {reconciliation.status === "draft" && (
              <Button onClick={handleApprove} disabled={isApproving}>
                <Check className="w-4 h-4 mr-2" />
                {isApproving ? "Approving..." : "Approve Reconciliation"}
              </Button>
            )}
            {reconciliation.status === "approved" && (
              <Button onClick={() => setShowEmailPreview(true)}>
                Preview & Send Email
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      <MonthlyEmailPreviewModal
        open={showEmailPreview}
        onOpenChange={setShowEmailPreview}
        reconciliation={reconciliation}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
};

const LineItemRow = ({ item, onToggleVerified, getIcon }: any) => {
  // Visits should always show as expenses (red) even though stored as positive amounts
  const isExpense = item.item_type === 'visit' || item.item_type === 'expense' || item.amount < 0;
  const displayAmount = item.item_type === 'visit' || item.item_type === 'expense' 
    ? Math.abs(item.amount) 
    : item.amount;
  
  return (
    <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50">
      <Checkbox
        checked={item.verified}
        onCheckedChange={() => onToggleVerified(item.id, item.verified)}
      />
      <div className="flex items-center gap-2 text-muted-foreground">
        {getIcon(item.item_type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium break-words">{item.description}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(item.date + 'T00:00:00'), "MMM dd, yyyy")} • {item.category}
        </p>
      </div>
      <p className={`font-semibold ${isExpense ? "text-red-600" : "text-green-600"}`}>
        {isExpense ? "-" : "+"}${displayAmount.toFixed(2)}
      </p>
    </div>
  );
};