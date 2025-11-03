import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { DollarSign, Calendar, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Visit {
  id: string;
  date: string;
  price: number;
  visited_by?: string;
  notes?: string;
}

interface Expense {
  id: string;
  date: string;
  amount: number;
  purpose?: string;
  vendor?: string;
  category?: string;
}

interface BillingCalculatorProps {
  reconciliationId: string;
  propertyId: string;
  currentRevenue: number;
  currentVisitFees: number;
  currentExpenses: number;
  currentManagementFee: number;
  managementFeePercentage: number;
  unbilledVisits: Visit[];
  unbilledExpenses: Expense[];
  onRecalculate: () => void;
}

export const BillingCalculator = ({
  reconciliationId,
  currentRevenue,
  currentVisitFees,
  currentExpenses,
  currentManagementFee,
  unbilledVisits,
  unbilledExpenses,
  onRecalculate,
}: BillingCalculatorProps) => {
  const [selectedVisits, setSelectedVisits] = useState<string[]>([]);
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Only calculate totals for CHECKED items
  const additionalVisitFees = unbilledVisits
    .filter((v) => selectedVisits.includes(v.id))
    .reduce((sum, v) => sum + v.price, 0);

  const additionalExpenses = unbilledExpenses
    .filter((e) => selectedExpenses.includes(e.id))
    .reduce((sum, e) => sum + e.amount, 0);

  const newVisitFees = currentVisitFees + additionalVisitFees;
  const newExpenses = currentExpenses + additionalExpenses;
  const newDueFromOwner = currentManagementFee + newVisitFees + newExpenses;

  const handleIncludeItems = async () => {
    // Validate that at least one item is checked
    if (selectedVisits.length === 0 && selectedExpenses.length === 0) {
      toast.error("Please check at least one item to include");
      return;
    }

    setIsProcessing(true);
    try {
      const lineItems = [];

      // Create line items for selected visits
      for (const visitId of selectedVisits) {
        const visit = unbilledVisits.find((v) => v.id === visitId);
        if (visit) {
          lineItems.push({
            reconciliation_id: reconciliationId,
            item_type: "visit",
            item_id: visit.id,
            description: `Property visit${visit.visited_by ? ` - ${visit.visited_by}` : ""}`,
            amount: -Math.abs(visit.price),
            date: visit.date,
            category: "Visit Fee",
          });
        }
      }

      // Create line items for selected expenses
      for (const expenseId of selectedExpenses) {
        const expense = unbilledExpenses.find((e) => e.id === expenseId);
        if (expense) {
          lineItems.push({
            reconciliation_id: reconciliationId,
            item_type: "expense",
            item_id: expense.id,
            description: expense.purpose || "Expense",
            amount: -Math.abs(expense.amount),
            date: expense.date,
            category: expense.category || "Other",
          });
        }
      }

      // Insert line items
      if (lineItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("reconciliation_line_items")
          .insert(lineItems);

        if (itemsError) throw itemsError;
      }

      // Mark visits as billed
      if (selectedVisits.length > 0) {
        const { error: visitsError } = await supabase
          .from("visits")
          .update({ billed: true, reconciliation_id: reconciliationId })
          .in("id", selectedVisits);

        if (visitsError) throw visitsError;
      }

      // Mark expenses as exported
      if (selectedExpenses.length > 0) {
        const { error: expensesError } = await supabase
          .from("expenses")
          .update({ exported: true })
          .in("id", selectedExpenses);

        if (expensesError) throw expensesError;
      }

      // Update reconciliation totals
      const { error: recError } = await supabase
        .from("monthly_reconciliations")
        .update({
          visit_fees: newVisitFees,
          total_expenses: newExpenses,
          net_to_owner: newDueFromOwner,
        })
        .eq("id", reconciliationId);

      if (recError) throw recError;

      toast.success(`Added ${selectedVisits.length + selectedExpenses.length} items to reconciliation`);
      setSelectedVisits([]);
      setSelectedExpenses([]);
      onRecalculate();
    } catch (error) {
      console.error("Error including unbilled items:", error);
      toast.error("Failed to include items");
    } finally {
      setIsProcessing(false);
    }
  };

  // Only show comparison if items are actually checked
  const hasCheckedItems = selectedVisits.length > 0 || selectedExpenses.length > 0;

  return (
    <div className="space-y-4">
      {/* Current vs New Totals - ONLY show when items are checked */}
      {hasCheckedItems && (
        <Card className="p-4 bg-muted/50 border-primary">
          <div className="mb-3">
            <p className="text-sm font-semibold text-primary">
              Preview: Adding {selectedVisits.length + selectedExpenses.length} Checked Item(s)
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Current Reconciliation</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Booking Revenue:</span>
                  <span className="font-semibold">${currentRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Management Fee:</span>
                  <span className="font-semibold">${currentManagementFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Visit Fees:</span>
                  <span className="font-semibold">${currentVisitFees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Expenses:</span>
                  <span className="font-semibold">${currentExpenses.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">Due from Owner:</span>
                  <span className="font-bold">${(currentManagementFee + currentVisitFees + currentExpenses).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">After Adding Checked Items</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Booking Revenue:</span>
                  <span className="font-semibold">${currentRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Management Fee:</span>
                  <span className="font-semibold">${currentManagementFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Visit Fees:</span>
                  <span className={`font-semibold ${additionalVisitFees > 0 ? 'text-primary' : ''}`}>
                    ${newVisitFees.toFixed(2)}
                    {additionalVisitFees > 0 && <span className="text-xs ml-1">(+${additionalVisitFees.toFixed(2)})</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Expenses:</span>
                  <span className={`font-semibold ${additionalExpenses > 0 ? 'text-primary' : ''}`}>
                    ${newExpenses.toFixed(2)}
                    {additionalExpenses > 0 && <span className="text-xs ml-1">(+${additionalExpenses.toFixed(2)})</span>}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">Due from Owner:</span>
                  <span className="font-bold text-primary">
                    ${newDueFromOwner.toFixed(2)}
                    <span className="text-xs ml-1">(+${(additionalVisitFees + additionalExpenses).toFixed(2)})</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <Button
            onClick={handleIncludeItems}
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? "Processing..." : `Include ${selectedVisits.length + selectedExpenses.length} Checked Items`}
          </Button>
        </Card>
      )}

      {/* Unbilled Visits */}
      {unbilledVisits.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Unbilled Visits ({unbilledVisits.length})
          </h4>
          <div className="space-y-2">
            {unbilledVisits.map((visit) => (
              <Card key={visit.id} className="p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`visit-${visit.id}`}
                    checked={selectedVisits.includes(visit.id)}
                    onCheckedChange={(checked) => {
                      // Validate checked is a boolean
                      if (typeof checked !== 'boolean') {
                        console.error('Invalid checked state for visit:', visit.id);
                        return;
                      }
                      if (checked) {
                        setSelectedVisits([...selectedVisits, visit.id]);
                      } else {
                        setSelectedVisits(selectedVisits.filter((id) => id !== visit.id));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">
                          {visit.visited_by || "Property Visit"}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(visit.date), "MMM d, yyyy")}
                        </p>
                        {visit.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{visit.notes}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="ml-2">
                        ${visit.price.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Unbilled Expenses */}
      {unbilledExpenses.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Unbilled Expenses ({unbilledExpenses.length})
          </h4>
          <div className="space-y-2">
            {unbilledExpenses.map((expense) => (
              <Card key={expense.id} className="p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`expense-${expense.id}`}
                    checked={selectedExpenses.includes(expense.id)}
                    onCheckedChange={(checked) => {
                      // Validate checked is a boolean
                      if (typeof checked !== 'boolean') {
                        console.error('Invalid checked state for expense:', expense.id);
                        return;
                      }
                      if (checked) {
                        setSelectedExpenses([...selectedExpenses, expense.id]);
                      } else {
                        setSelectedExpenses(selectedExpenses.filter((id) => id !== expense.id));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">
                          {expense.purpose || "Expense"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(expense.date), "MMM d, yyyy")}
                          </p>
                          {expense.vendor && (
                            <Badge variant="secondary" className="text-xs">
                              {expense.vendor}
                            </Badge>
                          )}
                        </div>
                        {expense.category && (
                          <p className="text-xs text-muted-foreground mt-1">{expense.category}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="ml-2">
                        ${expense.amount.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {unbilledVisits.length === 0 && unbilledExpenses.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No unbilled items for this property
        </p>
      )}
    </div>
  );
};
