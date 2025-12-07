import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Check, Home, DollarSign, Eye, RotateCcw, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { MonthlyEmailPreviewModal } from "./MonthlyEmailPreviewModal";
import { calculateDueFromOwnerFromLineItems } from "@/lib/reconciliationCalculations";
import { VisitValidationPreview } from "./VisitValidationPreview";

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
  const queryClient = useQueryClient();

  // Set up real-time subscriptions for line item changes
  useEffect(() => {
    if (!open || !reconciliationId) return;

    const lineItemsChannel = supabase
      .channel(`reconciliation-line-items-${reconciliationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reconciliation_line_items',
          filter: `reconciliation_id=eq.${reconciliationId}`
        },
        (payload) => {
          console.log('Line item changed:', payload);
          // Refetch data when line items are updated
          refetch();
        }
      )
      .subscribe();

    // Cleanup subscription on unmount or when modal closes
    return () => {
      supabase.removeChannel(lineItemsChannel);
    };
  }, [open, reconciliationId]);

  const [calculatorError, setCalculatorError] = useState<string | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["reconciliation", reconciliationId],
    queryFn: async () => {
      const { data: rec, error: recError } = await supabase
        .from("monthly_reconciliations")
        .select(`
          *,
          properties(id, name, address, management_fee_percentage, order_minimum_fee),
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

      // Check for orphaned expense line items (where source expense was deleted)
      const expenseLineItems = items?.filter((item: any) => item.item_type === 'expense') || [];
      const expenseIds = expenseLineItems.map((item: any) => item.item_id);
      
      if (expenseIds.length > 0) {
        const { data: existingExpenses } = await supabase
          .from("expenses")
          .select("id")
          .in("id", expenseIds);
        
        const existingIds = new Set(existingExpenses?.map((e: any) => e.id) || []);
        
        // Mark orphaned items as excluded
        const orphanedItems = expenseLineItems.filter((item: any) => !existingIds.has(item.item_id));
        
        if (orphanedItems.length > 0) {
          console.log("Found orphaned expense line items:", orphanedItems.length);
          
          for (const orphan of orphanedItems) {
            await supabase
              .from("reconciliation_line_items")
              .update({ 
                verified: false,
                excluded: true,
                exclusion_reason: "Source expense was deleted"
              })
              .eq("id", orphan.id);
          }
          
          // Refetch to get updated data
          const { data: updatedItems } = await supabase
            .from("reconciliation_line_items")
            .select("*")
            .eq("reconciliation_id", reconciliationId)
            .order("date", { ascending: false });
          
          items.splice(0, items.length, ...(updatedItems || []));
        }
      }

      // Automatically detect and add new expenses within the reconciliation period
      const reconciliationDate = new Date(rec.reconciliation_month + 'T00:00:00');
      const startDate = new Date(reconciliationDate.getFullYear(), reconciliationDate.getMonth(), 1);
      const endDate = new Date(reconciliationDate.getFullYear(), reconciliationDate.getMonth() + 1, 0);
      
      // Format dates as YYYY-MM-DD for comparison
      const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
      const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      
      console.log(`Checking for expenses between ${startDateStr} and ${endDateStr} for property ${rec.property_id}`);
      
      const { data: allExpensesInPeriod, error: autoAddExpensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('property_id', rec.property_id)
        .gte('date', startDateStr)
        .lte('date', endDateStr);
      
      if (autoAddExpensesError) {
        console.error('Error fetching expenses:', autoAddExpensesError);
      } else {
        console.log(`Found ${allExpensesInPeriod?.length || 0} total expenses in period`);
      }
      
      const existingExpenseLineItemIds = new Set(
        items?.filter((item: any) => item.item_type === 'expense').map((item: any) => item.item_id) || []
      );
      
      console.log(`Already have ${existingExpenseLineItemIds.size} expense line items`);
      
      const newExpenses = (allExpensesInPeriod || []).filter(
        (expense: any) => !existingExpenseLineItemIds.has(expense.id)
      );
      
      if (newExpenses.length > 0) {
        console.log(`Auto-adding ${newExpenses.length} new expense(s):`, newExpenses.map(e => ({ id: e.id, amount: e.amount, date: e.date })));
        
        const { data: { user } } = await supabase.auth.getUser();
        
      const newLineItems = newExpenses
        .filter((expense: any) => {
          // Filter out visit-related expenses to avoid double counting
          const description = (expense.purpose || "").toLowerCase();
          const isVisitRelated = 
            description.includes('visit fee') ||
            description.includes('visit charge') ||
            description.includes('hourly charge') ||
            description.includes('property visit');
          
          if (isVisitRelated) {
            console.log(`Skipping visit-related expense during auto-add: ${expense.purpose} ($${expense.amount})`);
          }
          
          return !isVisitRelated;
        })
        .map((expense: any) => {
          // Prefer items_detail for full item names, fallback to purpose
          let description = expense.items_detail || expense.purpose || expense.category || 'Expense';
          
          // If it's a generic description like "1 item from Amazon", try to get more detail
          if (description.match(/^\d+\s*items?\s*(from|on)\s*amazon/i) && expense.items_detail) {
            description = expense.items_detail;
          }
          
          return {
            reconciliation_id: reconciliationId,
            item_type: 'expense',
            item_id: expense.id,
            description,
            amount: -(expense.amount || 0),
            date: expense.date,
            category: expense.category || 'Other',
            verified: false,
            excluded: false
          };
        });
        
        const { error: insertError } = await supabase
          .from('reconciliation_line_items')
          .insert(newLineItems);
        
        if (insertError) {
          console.error('Error inserting new line items:', insertError);
        } else {
          console.log('Successfully inserted new line items');
          
          // Log in audit trail
          await supabase.from("reconciliation_audit_log").insert({
            reconciliation_id: reconciliationId,
            action: 'items_added',
            user_id: user?.id,
            notes: `Auto-added ${newExpenses.length} new expense(s) on modal open`
          });
          
          // Refetch to include new items
          const { data: updatedItems } = await supabase
            .from("reconciliation_line_items")
            .select("*")
            .eq("reconciliation_id", reconciliationId)
            .order("date", { ascending: false });
          
          if (updatedItems) {
            items.splice(0, items.length, ...updatedItems);
          }
        }
      } else {
        console.log('No new expenses to add');
      }

      // AUTO-ADD VISITS within the reconciliation period (same as expenses)
      console.log(`Checking for visits between ${startDateStr} and ${endDateStr} for property ${rec.property_id}`);
      
      const { data: allVisitsInPeriod, error: autoAddVisitsError } = await supabase
        .from('visits')
        .select('*')
        .eq('property_id', rec.property_id)
        .gte('date', startDateStr)
        .lte('date', endDateStr);
      
      if (autoAddVisitsError) {
        console.error('Error fetching visits:', autoAddVisitsError);
      } else {
        console.log(`Found ${allVisitsInPeriod?.length || 0} total visits in period`);
      }
      
      const existingVisitLineItemIds = new Set(
        items?.filter((item: any) => item.item_type === 'visit').map((item: any) => item.item_id) || []
      );
      
      console.log(`Already have ${existingVisitLineItemIds.size} visit line items`);
      
      const newVisits = (allVisitsInPeriod || []).filter(
        (visit: any) => !existingVisitLineItemIds.has(visit.id) && !visit.billed
      );
      
      if (newVisits.length > 0) {
        console.log(`Auto-adding ${newVisits.length} new visit(s):`, newVisits.map(v => ({ id: v.id, price: v.price, date: v.date, visited_by: v.visited_by })));
        
        const { data: { user } } = await supabase.auth.getUser();
        
        const newVisitLineItems = newVisits.map((visit: any) => ({
          reconciliation_id: reconciliationId,
          item_type: 'visit',
          item_id: visit.id,
          description: `Property visit${visit.visited_by ? ` - ${visit.visited_by}` : ''}`,
          amount: -(visit.price || 0),
          date: visit.date,
          category: 'Visit Fee',
          verified: false,
          excluded: false,
          source: 'auto_generated',
          added_by: user?.id
        }));
        
        const { error: insertVisitsError } = await supabase
          .from('reconciliation_line_items')
          .insert(newVisitLineItems);
        
        if (insertVisitsError) {
          console.error('Error inserting new visit line items:', insertVisitsError);
        } else {
          console.log('Successfully inserted new visit line items');
          
          // Update the visit_fees total on the reconciliation
          const totalNewVisitFees = newVisits.reduce((sum: number, v: any) => sum + (v.price || 0), 0);
          const currentVisitFees = rec.visit_fees || 0;
          
          await supabase
            .from('monthly_reconciliations')
            .update({ visit_fees: currentVisitFees + totalNewVisitFees, updated_at: new Date().toISOString() })
            .eq('id', reconciliationId);
          
          // Log in audit trail
          await supabase.from("reconciliation_audit_log").insert({
            reconciliation_id: reconciliationId,
            action: 'visits_added',
            user_id: user?.id,
            notes: `Auto-added ${newVisits.length} new visit(s) on modal open`
          });
          
          // Refetch to include new items
          const { data: updatedItems } = await supabase
            .from("reconciliation_line_items")
            .select("*")
            .eq("reconciliation_id", reconciliationId)
            .order("date", { ascending: false });
          
          if (updatedItems) {
            items.splice(0, items.length, ...updatedItems);
          }
        }
      } else {
        console.log('No new visits to add');
      }

      // Fetch unbilled visits for this property (for display purposes)
      const { data: unbilledVisits, error: visitsError } = await supabase
        .from("visits")
        .select("*")
        .eq("property_id", rec.properties.id)
        .eq("billed", false)
        .order("date", { ascending: false });

      if (visitsError) throw visitsError;

      // Fetch unbilled expenses for this property
      const { data: unbilledExpenses, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("property_id", rec.properties.id)
        .eq("exported", false)
        .order("date", { ascending: false });

      if (expensesError) throw expensesError;

      // Filter out already included items
      const lineItemExpenseIds = items
        ?.filter((item: any) => item.item_type === 'expense')
        .map((item: any) => item.item_id) || [];
      
      const filteredUnbilledExpenses = (unbilledExpenses || []).filter(
        (expense: any) => !lineItemExpenseIds.includes(expense.id)
      );

      const lineItemVisitIds = items
        ?.filter((item: any) => item.item_type === 'visit')
        .map((item: any) => item.item_id) || [];
      
      const filteredUnbilledVisits = (unbilledVisits || []).filter(
        (visit: any) => !lineItemVisitIds.includes(visit.id)
      );

      // Fetch full visit details for visit line items
      let visitDetailsMap: Record<string, any> = {};
      if (lineItemVisitIds.length > 0) {
        const { data: visitDetails } = await supabase
          .from("visits")
          .select("*")
          .in("id", lineItemVisitIds);
        
        if (visitDetails) {
          visitDetailsMap = visitDetails.reduce((acc: Record<string, any>, visit: any) => {
            acc[visit.id] = visit;
            return acc;
          }, {});
        }
      }

      return { 
        reconciliation: rec, 
        lineItems: items, 
        unbilledVisits: filteredUnbilledVisits,
        unbilledExpenses: filteredUnbilledExpenses,
        visitDetailsMap
      };
    },
    enabled: open,
  });

  const toggleVerifiedMutation = useMutation({
    mutationFn: async ({ itemId, currentValue }: { itemId: string; currentValue: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updates: any = { verified: !currentValue };
      
      // Record approval metadata when checking an item
      if (!currentValue) {
        updates.approved_by = user?.id;
        updates.approved_at = new Date().toISOString();
      } else {
        // Clear approval when unchecking
        updates.approved_by = null;
        updates.approved_at = null;
      }

      const { error } = await supabase
        .from("reconciliation_line_items")
        .update(updates)
        .eq("id", itemId);

      if (error) throw error;

      // Log the action in audit trail
      await supabase.from("reconciliation_audit_log").insert({
        reconciliation_id: reconciliationId,
        action: !currentValue ? 'item_approved' : 'item_rejected',
        user_id: user?.id,
        item_id: itemId,
        notes: `Item ${!currentValue ? 'approved' : 'unapproved'} by user`
      });

      return { itemId, newValue: !currentValue };
    },
    onSuccess: async () => {
      // Invalidate and refetch to ensure calculator updates immediately
      await queryClient.invalidateQueries({ queryKey: ["reconciliation", reconciliationId] });
      await refetch();
      toast.success("Item status updated");
    },
    onError: () => {
      toast.error("Failed to update verification status");
    }
  });

  const cleanupOrphanedItemsMutation = useMutation({
    mutationFn: async () => {
      if (!data?.lineItems) {
        throw new Error("No line items to check");
      }

      // Check for orphaned expense line items
      const expenseLineItems = data.lineItems.filter((item: any) => item.item_type === 'expense');
      const expenseIds = expenseLineItems.map((item: any) => item.item_id);
      
      if (expenseIds.length === 0) {
        return { orphanedCount: 0 };
      }

      const { data: existingExpenses } = await supabase
        .from("expenses")
        .select("id")
        .in("id", expenseIds);
      
      const existingIds = new Set(existingExpenses?.map((e: any) => e.id) || []);
      const orphanedItems = expenseLineItems.filter((item: any) => !existingIds.has(item.item_id));
      
      if (orphanedItems.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        
        for (const orphan of orphanedItems) {
          await supabase
            .from("reconciliation_line_items")
            .update({ 
              verified: false,
              excluded: true,
              exclusion_reason: "Source expense was deleted"
            })
            .eq("id", orphan.id);
          
          // Log in audit trail
          await supabase.from("reconciliation_audit_log").insert({
            reconciliation_id: reconciliationId,
            action: 'item_excluded',
            user_id: user?.id,
            item_id: orphan.id,
            notes: 'Automatically excluded orphaned expense (source deleted)'
          });
        }
      }
      
      return { orphanedCount: orphanedItems.length };
    },
    onSuccess: (result) => {
      refetch();
      if (result.orphanedCount > 0) {
        toast.success(`Removed ${result.orphanedCount} deleted expense(s) from reconciliation`);
      } else {
        toast.info("No deleted expenses found");
      }
    },
    onError: () => {
      toast.error("Failed to cleanup orphaned items");
    }
  });


  // Removed fix totals mutation - no longer needed with live calculation system

  const handleApprove = async () => {
    if (!data?.lineItems) return;

    // Validation: Check if any items are approved
    const approvedItems = data.lineItems.filter((item: any) => item.verified && !item.excluded);
    const approvedVisits = approvedItems.filter((item: any) => item.item_type === 'visit');
    const approvedExpenses = approvedItems.filter((item: any) => item.item_type === 'expense');
    
    if (approvedItems.length === 0) {
      toast.error("You haven't approved any items. Please check at least one item before approving.");
      return;
    }

    // Show confirmation with counts
    const confirmMessage = `You are about to approve this reconciliation with:\n\n` +
      `• ${approvedVisits.length} visit(s) (will be marked as billed)\n` +
      `• ${approvedExpenses.length} expense(s) (will be marked as exported)\n\n` +
      `These items will be included in the owner statement. Continue?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsApproving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get all VERIFIED line items that should be marked as billed
      const verifiedItems = data.lineItems.filter((item: any) => 
        item.verified && !item.excluded
      );
      
      // Separate by type
      const visitItems = verifiedItems.filter((i: any) => i.item_type === 'visit');
      const expenseItems = verifiedItems.filter((i: any) => i.item_type === 'expense');
      
      // Mark visits as billed
      if (visitItems.length > 0) {
        const visitIds = visitItems.map((i: any) => i.item_id);
        const { error: visitError } = await supabase
          .from('visits')
          .update({ 
            billed: true,
            reconciliation_id: reconciliationId 
          })
          .in('id', visitIds);
        
        if (visitError) throw visitError;
      }
      
      // Mark expenses as exported (billed)
      if (expenseItems.length > 0) {
        const expenseIds = expenseItems.map((i: any) => i.item_id);
        const { error: expenseError } = await supabase
          .from('expenses')
          .update({ exported: true })
          .in('id', expenseIds);
        
        if (expenseError) throw expenseError;
      }

      // Update reconciliation status
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

      // Log in audit trail
      await supabase.from("reconciliation_audit_log").insert({
        reconciliation_id: reconciliationId,
        action: 'reconciliation_approved',
        user_id: user?.id,
        notes: `Approved with ${visitItems.length} visits and ${expenseItems.length} expenses marked as billed`
      });

      toast.success(`Reconciliation approved! ${visitItems.length} visits and ${expenseItems.length} expenses marked as billed.`);
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
  
  // Calculate actual totals from verified line items
  // Note: management_fee already includes minimum fee if applicable, don't add order_minimum_fee separately
  const calculated = calculateDueFromOwnerFromLineItems(
    lineItems,
    reconciliation.management_fee
  );

  // Check for discrepancies
  const hasDiscrepancy = 
    Math.abs(reconciliation.visit_fees - calculated.visitFees) > 0.01 ||
    Math.abs(reconciliation.total_expenses - calculated.totalExpenses) > 0.01;

  // Split items by verification status - only show expenses and visits in "Needs Approval" (not booking income)
  const unverifiedItems = lineItems.filter((i: any) => !i.verified && i.item_type !== "booking" && i.item_type !== "mid_term_booking");
  
  // Type-specific tabs show ALL items of that type (both verified and unverified)
  const allBookings = lineItems.filter((i: any) => i.item_type === "booking" || i.item_type === "mid_term_booking");
  const allExpenses = lineItems.filter((i: any) => i.item_type === "expense");
  const allVisits = lineItems.filter((i: any) => i.item_type === "visit");
  
  // Count verified items for display
  const verifiedCount = lineItems.filter((i: any) => i.verified && !i.excluded).length;
  
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

        {hasDiscrepancy && (
          <Card className="p-4 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">Totals Mismatch Detected</h4>
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                  Stored totals don't match line items. Click "Fix Totals" to recalculate from verified items.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <p className="text-amber-700 dark:text-amber-300">Stored: ${reconciliation.visit_fees.toFixed(2)} visits, ${reconciliation.total_expenses.toFixed(2)} expenses</p>
                  </div>
                  <div>
                    <p className="text-amber-700 dark:text-amber-300">Calculated: ${calculated.visitFees.toFixed(2)} visits, ${calculated.totalExpenses.toFixed(2)} expenses</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => cleanupOrphanedItemsMutation.mutate()}
                    disabled={cleanupOrphanedItemsMutation.isPending}
                    variant="outline"
                    className="bg-white dark:bg-gray-900"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {cleanupOrphanedItemsMutation.isPending ? "Checking..." : "Remove Deleted Items"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            📊 Live Financial Calculator
          </h3>
          {calculated.error ? (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive font-medium">
                ⚠️ {calculated.error}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Booking Revenue (Owner Keeps)</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Short-term:</span>
                      <span className="font-medium">${Number(reconciliation.short_term_revenue || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Mid-term:</span>
                      <span className="font-medium">${Number(reconciliation.mid_term_revenue || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t text-green-600">
                    <span>Total:</span>
                    <span>${Number(reconciliation.total_revenue || 0).toFixed(2)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Amount Due from Owner</p>
                  <div className="space-y-1">
                    {(() => {
                      const percentage = reconciliation.properties?.management_fee_percentage || 15;
                      const minimumFee = reconciliation.properties?.order_minimum_fee || 0;
                      const calculatedFee = (reconciliation.total_revenue || 0) * (percentage / 100);
                      const actualFee = Number(reconciliation.management_fee || 0);
                      const usedMinimum = minimumFee > 0 && actualFee >= minimumFee && calculatedFee < minimumFee;
                      
                      return (
                        <div className="flex justify-between text-sm">
                          <span>
                            Management Fee ({percentage}%)
                            {usedMinimum && <span className="text-amber-600 ml-1">(min $250)</span>}:
                          </span>
                          <span className="font-medium">${actualFee.toFixed(2)}</span>
                        </div>
                      );
                    })()}
                    <div className="flex justify-between text-sm">
                      <span>Visit Fees (approved):</span>
                      <span className="font-medium text-orange-600">${calculated.visitFees.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Expenses (approved):</span>
                      <span className="font-medium text-orange-600">${calculated.totalExpenses.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t text-primary text-lg">
                    <span>Total Due:</span>
                    <span>${calculated.dueFromOwner.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="w-3 h-3" />
                  <span>Updates automatically when items are approved/unapproved</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  ✓ Only approved charges included
                </div>
              </div>
            </>
          )}
        </Card>

        <Tabs defaultValue="unapproved" className="mt-4">
          <TabsList>
            <TabsTrigger value="unapproved" className="relative">
              Needs Approval ({unverifiedItems.length})
              {unverifiedItems.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger value="bookings">Bookings ({allBookings.length})</TabsTrigger>
            <TabsTrigger value="expenses">Expenses ({allExpenses.length})</TabsTrigger>
            <TabsTrigger value="visits">Visits ({allVisits.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="unapproved" className="space-y-2">
            {unverifiedItems.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>All items have been approved ({verifiedCount} verified)</p>
              </Card>
            ) : (
              unverifiedItems.map((item: any) => (
                <LineItemRow 
                  key={item.id} 
                  item={item} 
                  onToggleVerified={(id, val) => toggleVerifiedMutation.mutate({ itemId: id, currentValue: val })} 
                  getIcon={getItemIcon}
                  showWarnings
                  visitDetails={data?.visitDetailsMap?.[item.item_id]}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="bookings" className="space-y-2">
            {allBookings.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                <p>No bookings found</p>
              </Card>
            ) : (
              allBookings.map((item: any) => (
                <LineItemRow 
                  key={item.id} 
                  item={item} 
                  onToggleVerified={(id, val) => toggleVerifiedMutation.mutate({ itemId: id, currentValue: val })} 
                  getIcon={getItemIcon} 
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="expenses" className="space-y-2">
            {allExpenses.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                <p>No expenses found</p>
              </Card>
            ) : (
              allExpenses.map((item: any) => (
                <LineItemRow 
                  key={item.id} 
                  item={item} 
                  onToggleVerified={(id, val) => toggleVerifiedMutation.mutate({ itemId: id, currentValue: val })} 
                  getIcon={getItemIcon} 
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="visits" className="space-y-2">
            <VisitValidationPreview visits={safeUnbilledVisits} className="mb-4" />
            {allVisits.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                <p>No visits found</p>
              </Card>
            ) : (
              allVisits.map((item: any) => (
                <LineItemRow 
                  key={item.id} 
                  item={item} 
                  onToggleVerified={(id, val) => toggleVerifiedMutation.mutate({ itemId: id, currentValue: val })} 
                  getIcon={getItemIcon}
                  visitDetails={data?.visitDetailsMap?.[item.item_id]}
                />
              ))
            )}
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

        {unverifiedItems.length > 0 && reconciliation.status === "draft" && (
          <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  {unverifiedItems.length} Unchecked Items
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  These items will NOT be included in the statement or marked as billed. They will remain available for future reconciliations.
                </p>
              </div>
            </div>
          </Card>
        )}

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
            {(reconciliation.status === "approved" || reconciliation.status === "statement_sent") && (
              <Button onClick={() => setShowEmailPreview(true)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Recreate Email Preview
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

const LineItemRow = ({ item, onToggleVerified, getIcon, showWarnings = false, visitDetails }: any) => {
  const isExpense = item.item_type === 'visit' || item.item_type === 'expense' || item.amount < 0;
  const displayAmount = item.item_type === 'visit' || item.item_type === 'expense' 
    ? Math.abs(item.amount) 
    : item.amount;
  
  // Check if this is a visit-related expense that should be excluded
  const description = (item.description || '').toLowerCase();
  const isVisitRelatedExpense = item.item_type === 'expense' && (
    description.includes('visit fee') ||
    description.includes('visit charge') ||
    description.includes('hourly charge') ||
    description.includes('property visit')
  );
  
  // Extract visitor name from visit line items
  let visitorName = '';
  if (item.item_type === 'visit') {
    const match = item.description?.match(/Property visit - (.+)/i);
    if (match) {
      visitorName = match[1];
    }
  }
  
  const missingSource = !item.source;
  const missingAddedBy = !item.added_by;
  const hasWarning = showWarnings && (missingSource || missingAddedBy || isVisitRelatedExpense);
  
  // Format visit time if available
  const formatVisitTime = (time: string) => {
    if (!time) return null;
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch {
      return time;
    }
  };
  
  return (
    <div className={`flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 ${
      isVisitRelatedExpense ? 'border-red-300 bg-red-50/50 dark:bg-red-950/20' : 
      hasWarning ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : ''
    } ${item.excluded ? 'opacity-50' : ''}`}>
      <Checkbox
        checked={item.verified}
        onCheckedChange={() => onToggleVerified(item.id, item.verified)}
        disabled={item.excluded}
      />
      <div className="flex items-center gap-2 text-muted-foreground">
        {getIcon(item.item_type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium break-words">
            {item.description}
            {visitorName && <span className="text-muted-foreground ml-1">({visitorName})</span>}
          </p>
          {isVisitRelatedExpense && (
            <Badge variant="destructive" className="text-xs">⚠️ Visit Double-Count</Badge>
          )}
          {item.excluded && (
            <Badge variant="outline" className="text-xs">Excluded</Badge>
          )}
          {hasWarning && !isVisitRelatedExpense && (
            <span title="Missing source or added_by metadata">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            </span>
          )}
        </div>
        
        {/* Visit details section - only for visit items with full details */}
        {item.item_type === 'visit' && visitDetails && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-1 bg-muted/30 rounded px-2 py-1">
            {visitDetails.time && (
              <span className="flex items-center gap-1">
                <span className="font-medium">Time:</span> {formatVisitTime(visitDetails.time)}
              </span>
            )}
            {visitDetails.hours !== undefined && visitDetails.hours !== null && (
              <span className="flex items-center gap-1">
                <span className="font-medium">Hours:</span> {visitDetails.hours}h
              </span>
            )}
            {visitDetails.notes && (
              <span className="flex items-center gap-1 flex-1">
                <span className="font-medium">Notes:</span> 
                <span className="truncate" title={visitDetails.notes}>{visitDetails.notes}</span>
              </span>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span>{format(new Date(item.date + 'T00:00:00'), "MMM dd, yyyy")}</span>
          {item.category && <span>• {item.category}</span>}
          {item.source && <span>• Source: {item.source}</span>}
          {item.exclusion_reason && (
            <span className="text-red-600 dark:text-red-400">• {item.exclusion_reason}</span>
          )}
          {isVisitRelatedExpense && !item.excluded && (
            <span className="text-red-600 dark:text-red-400 font-medium">• Should be excluded (counted in visits)</span>
          )}
          {showWarnings && missingSource && !isVisitRelatedExpense && (
            <Badge variant="destructive" className="text-xs">Missing Source</Badge>
          )}
          {showWarnings && missingAddedBy && (
            <Badge variant="destructive" className="text-xs">Missing Added By</Badge>
          )}
        </div>
      </div>
      <p className={`font-semibold ${isExpense ? "text-red-600" : "text-green-600"}`}>
        {isExpense ? "-" : "+"}${displayAmount.toFixed(2)}
      </p>
    </div>
  );
};
