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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DELETION_REASONS = [
  { value: "duplicate", label: "Duplicate expense", description: "This expense was logged twice" },
  { value: "wrong_property", label: "Wrong property", description: "Expense was assigned to the wrong property" },
  { value: "incorrect_scan", label: "Incorrectly scanned", description: "Email scan picked up wrong data" },
  { value: "part_of_another", label: "Part of another expense", description: "This is included in a different expense entry" },
  { value: "refunded", label: "Refunded by vendor", description: "The vendor issued a full refund" },
  { value: "test_entry", label: "Test entry", description: "This was entered for testing purposes" },
  { value: "other", label: "Other reason", description: "Provide details below" },
];

interface DeleteExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string;
  expenseDescription: string;
  expenseAmount?: number;
  reconciliationId?: string | null;
  onDeleted: () => void;
}

export const DeleteExpenseDialog = ({
  open,
  onOpenChange,
  expenseId,
  expenseDescription,
  expenseAmount,
  reconciliationId,
  onDeleted,
}: DeleteExpenseDialogProps) => {
  const [selectedReason, setSelectedReason] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!selectedReason) {
      toast.error("Please select a reason for deleting this expense");
      return;
    }

    if (selectedReason === "other" && !additionalNotes.trim()) {
      toast.error("Please provide details for 'Other reason'");
      return;
    }

    if (!expenseId) {
      toast.error("No expense ID provided");
      return;
    }

    setLoading(true);
    console.log("Starting expense deletion for:", expenseId);
    
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error("Auth error:", userError);
        throw new Error("Authentication error: " + userError.message);
      }
      if (!user) throw new Error("Not authenticated");

      // Get user profile for name
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.warn("Profile fetch warning:", profileError);
      }

      const userName = profile?.first_name || profile?.email || user.email || "Unknown user";
      const reasonLabel = DELETION_REASONS.find(r => r.value === selectedReason)?.label || selectedReason;
      const fullReason = `${reasonLabel}${additionalNotes ? `: ${additionalNotes}` : ""}`;

      console.log("Deleting expense with reason:", fullReason, "by user:", userName);

      // Get the reconciliation line items for this expense
      const { data: lineItems, error: lineItemsError } = await supabase
        .from("reconciliation_line_items")
        .select("id, reconciliation_id")
        .eq("item_type", "expense")
        .eq("item_id", expenseId);

      if (lineItemsError) {
        console.error("Error fetching line items:", lineItemsError);
        throw lineItemsError;
      }

      console.log("Found line items to delete:", lineItems?.length || 0);

      // Log the deletion in reconciliation audit log for each affected reconciliation
      if (lineItems && lineItems.length > 0) {
        const uniqueReconIds = [...new Set(lineItems.map(li => li.reconciliation_id))];
        
        for (const reconId of uniqueReconIds) {
          const { error: auditError } = await supabase.from("reconciliation_audit_log").insert({
            reconciliation_id: reconId,
            user_id: user.id,
            action: "expense_deleted",
            item_id: expenseId,
            notes: `Expense deleted by ${userName}. Reason: ${fullReason}`,
            previous_values: { 
              expense_description: expenseDescription,
              expense_amount: expenseAmount,
              deleted_by: userName,
              deleted_at: new Date().toISOString(),
              deletion_reason: selectedReason,
              deletion_notes: additionalNotes,
            },
          });
          
          if (auditError) {
            console.warn("Audit log error (non-fatal):", auditError);
          }
        }

        // Delete from reconciliation line items first
        const { error: deleteLineItemsError } = await supabase
          .from("reconciliation_line_items")
          .delete()
          .eq("item_type", "expense")
          .eq("item_id", expenseId);

        if (deleteLineItemsError) {
          console.error("Error deleting line items:", deleteLineItemsError);
          throw new Error("Failed to remove expense from reconciliation: " + deleteLineItemsError.message);
        }
        
        console.log("Deleted line items successfully");
      }

      // If there's a specific reconciliation context and it wasn't in lineItems, log there too
      if (reconciliationId && !lineItems?.some(li => li.reconciliation_id === reconciliationId)) {
        await supabase.from("reconciliation_audit_log").insert({
          reconciliation_id: reconciliationId,
          user_id: user.id,
          action: "expense_deleted",
          item_id: expenseId,
          notes: `Expense deleted by ${userName}. Reason: ${fullReason}`,
          previous_values: { 
            expense_description: expenseDescription,
            expense_amount: expenseAmount,
            deleted_by: userName,
            deleted_at: new Date().toISOString(),
            deletion_reason: selectedReason,
            deletion_notes: additionalNotes,
          },
        });
      }

      // Delete the expense from the expenses table
      const { error: deleteError } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId);

      if (deleteError) {
        console.error("Error deleting expense:", deleteError);
        throw new Error("Failed to delete expense: " + deleteError.message);
      }

      console.log("Expense deleted successfully:", expenseId);

      toast.success("Expense deleted successfully", {
        description: `Deleted by ${userName} - ${reasonLabel}`,
      });
      
      // Reset state and close dialog
      setSelectedReason("");
      setAdditionalNotes("");
      onOpenChange(false);
      
      // Trigger the callback to refresh data
      onDeleted();
    } catch (error: any) {
      console.error("Error in expense deletion:", error);
      toast.error(error.message || "Failed to delete expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Expense
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. The expense will be removed from all reconciliations and dashboards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Expense being deleted */}
          <div className="p-3 bg-muted border rounded-lg">
            <p className="text-sm font-medium">{expenseDescription}</p>
            {expenseAmount !== undefined && (
              <p className="text-sm text-muted-foreground mt-1">
                Amount: ${expenseAmount.toFixed(2)}
              </p>
            )}
          </div>

          {/* Reason selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Why are you deleting this expense? *</Label>
            <RadioGroup
              value={selectedReason}
              onValueChange={setSelectedReason}
              className="space-y-2"
            >
              {DELETION_REASONS.map((reason) => (
                <div
                  key={reason.value}
                  className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedReason === reason.value 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedReason(reason.value)}
                >
                  <RadioGroupItem value={reason.value} id={reason.value} className="mt-0.5" />
                  <div className="flex-1">
                    <label htmlFor={reason.value} className="text-sm font-medium cursor-pointer">
                      {reason.label}
                    </label>
                    <p className="text-xs text-muted-foreground">{reason.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Additional notes */}
          <div className="space-y-2">
            <Label htmlFor="deletion-notes">
              Additional notes {selectedReason === "other" && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="deletion-notes"
              placeholder="Add any additional context..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              This will be logged in the audit trail for accountability.
            </p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">This deletion will be permanently logged</p>
              <p className="text-xs mt-1">Your name, the reason, and timestamp will be recorded for audit purposes.</p>
            </div>
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
            onClick={handleDelete}
            disabled={loading || !selectedReason || (selectedReason === "other" && !additionalNotes.trim())}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Expense
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
