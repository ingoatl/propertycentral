import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ForceDeleteExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string;
  expenseDescription: string;
  onDeleted: () => void;
}

export const ForceDeleteExpenseDialog = ({
  open,
  onOpenChange,
  expenseId,
  expenseDescription,
  onDeleted,
}: ForceDeleteExpenseDialogProps) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForceDelete = async () => {
    if (!reason.trim()) {
      toast.error("Please enter a reason for deleting this expense");
      return;
    }

    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get the reconciliation line items for this expense
      const { data: lineItems, error: lineItemsError } = await supabase
        .from("reconciliation_line_items")
        .select("id, reconciliation_id")
        .eq("item_type", "expense")
        .eq("item_id", expenseId);

      if (lineItemsError) throw lineItemsError;

      // Log the force deletion in reconciliation audit log for each affected reconciliation
      if (lineItems && lineItems.length > 0) {
        const uniqueReconIds = [...new Set(lineItems.map(li => li.reconciliation_id))];
        
        for (const reconId of uniqueReconIds) {
          await supabase.from("reconciliation_audit_log").insert({
            reconciliation_id: reconId,
            user_id: user.id,
            action: "force_delete_expense",
            item_id: expenseId,
            notes: `Force deleted expense from approved reconciliation. Reason: ${reason}`,
            previous_values: { expense_description: expenseDescription },
          });
        }

        // Delete from reconciliation line items
        const { error: deleteLineItemsError } = await supabase
          .from("reconciliation_line_items")
          .delete()
          .eq("item_type", "expense")
          .eq("item_id", expenseId);

        if (deleteLineItemsError) throw deleteLineItemsError;
      }

      // Delete the expense
      const { error: deleteError } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId);

      if (deleteError) throw deleteError;

      toast.success("Expense deleted with reason logged");
      setReason("");
      onOpenChange(false);
      onDeleted();
    } catch (error: any) {
      console.error("Error force deleting expense:", error);
      toast.error(error.message || "Failed to delete expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Force Delete Expense
          </DialogTitle>
          <DialogDescription>
            This expense is part of an approved reconciliation. Deleting it will affect financial records. Please provide a reason for this deletion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
              {expenseDescription}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deletion-reason">Reason for Deletion *</Label>
            <Textarea
              id="deletion-reason"
              placeholder="e.g., Duplicate entry, Incorrect property assignment, Refunded by vendor..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              This reason will be logged in the reconciliation audit trail.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleForceDelete}
            disabled={loading || !reason.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Expense"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
