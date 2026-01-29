import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Check, Home, DollarSign, Eye, RotateCcw, AlertTriangle, RefreshCw, CreditCard, Loader2, Banknote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MonthlyEmailPreviewModal } from "./MonthlyEmailPreviewModal";
import { calculateDueFromOwnerFromLineItems, ServiceType, getSettlementAmount, getSettlementLabel, formatCurrency, calculateProcessingFee, getProcessingFeeLabel } from "@/lib/reconciliationCalculations";
import { VisitValidationPreview } from "./VisitValidationPreview";
import { TenantPaymentReview } from "./TenantPaymentReview";
import { DeleteExpenseDialog } from "@/components/expenses/DeleteExpenseDialog";
import { ServiceTypeToggle } from "@/components/owners/ServiceTypeToggle";

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
  const [isCharging, setIsCharging] = useState(false);
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);
  const [payoutReference, setPayoutReference] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [revenueOverride, setRevenueOverride] = useState<string>("");
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [deleteExpense, setDeleteExpense] = useState<{ id: string; description: string; amount: number } | null>(null);
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
          property_owners(id, name, email, stripe_customer_id, payment_method, service_type)
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
      
      // WATCHDOG: Additional filter to ensure no billed visits slip through
      const trulyNewVisits = newVisits.filter((visit: any) => {
        if (visit.billed === true) {
          console.warn(`⚠️ WATCHDOG: Blocked already-billed visit from being added: ${visit.id} (${visit.visited_by}, ${visit.date})`);
          return false;
        }
        if (visit.reconciliation_id) {
          console.warn(`⚠️ WATCHDOG: Blocked visit already assigned to reconciliation: ${visit.id} → ${visit.reconciliation_id}`);
          return false;
        }
        return true;
      });

      if (trulyNewVisits.length > 0) {
        console.log(`Auto-adding ${trulyNewVisits.length} new visit(s):`, trulyNewVisits.map((v: any) => ({ id: v.id, price: v.price, date: v.date, visited_by: v.visited_by })));
        
        const { data: { user } } = await supabase.auth.getUser();
        
        const newVisitLineItems = trulyNewVisits.map((visit: any) => ({
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
          const totalNewVisitFees = trulyNewVisits.reduce((sum: number, v: any) => sum + (v.price || 0), 0);
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
            notes: `Auto-added ${trulyNewVisits.length} new visit(s) on modal open`
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
        console.log('No new visits to add (all filtered by watchdog or already included)');
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

      // Fetch active mid-term bookings for this property and month
      const monthDate = new Date(rec.reconciliation_month + 'T00:00:00');
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      const { data: midTermBookings } = await supabase
        .from("mid_term_bookings")
        .select("*")
        .eq("property_id", rec.property_id)
        .lte("start_date", format(monthEnd, "yyyy-MM-dd"))
        .gte("end_date", format(monthStart, "yyyy-MM-dd"))
        .in("status", ["active", "completed"]);

      return { 
        reconciliation: rec, 
        lineItems: items, 
        unbilledVisits: filteredUnbilledVisits,
        unbilledExpenses: filteredUnbilledExpenses,
        visitDetailsMap,
        midTermBookings: midTermBookings || []
      };
    },
    enabled: open,
  });

  // Subscribe to visits and expenses changes for this property (after data is available)
  useEffect(() => {
    if (!open || !data?.reconciliation?.property_id) return;

    const propertyId = data.reconciliation.property_id;
    
    const visitsChannel = supabase
      .channel(`reconciliation-visits-${propertyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visits',
          filter: `property_id=eq.${propertyId}`
        },
        (payload) => {
          console.log('Visit changed, refetching reconciliation data:', payload);
          refetch();
        }
      )
      .subscribe();

    const expensesChannel = supabase
      .channel(`reconciliation-expenses-${propertyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `property_id=eq.${propertyId}`
        },
        (payload) => {
          console.log('Expense changed, refetching reconciliation data:', payload);
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(visitsChannel);
      supabase.removeChannel(expensesChannel);
    };
  }, [open, data?.reconciliation?.property_id, refetch]);

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


  // Mutation to save revenue override
  const saveRevenueOverrideMutation = useMutation({
    mutationFn: async (overrideValue: number | null) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Calculate new management fee based on override
      const property = data?.reconciliation?.properties;
      const percentage = property?.management_fee_percentage || 15;
      const minimumFee = property?.order_minimum_fee || 0;
      
      let newManagementFee = 0;
      if (overrideValue !== null) {
        // If override is 0 or very low, just use minimum fee
        const calculatedFee = overrideValue * (percentage / 100);
        newManagementFee = Math.max(calculatedFee, minimumFee);
      }
      
      const { error } = await supabase
        .from("monthly_reconciliations")
        .update({ 
          revenue_override: overrideValue,
          total_revenue: overrideValue ?? data?.reconciliation?.total_revenue ?? 0,
          management_fee: overrideValue !== null ? newManagementFee : data?.reconciliation?.management_fee ?? 0,
          updated_at: new Date().toISOString()
        })
        .eq("id", reconciliationId);
      
      if (error) throw error;
      
      // Log in audit trail
      await supabase.from("reconciliation_audit_log").insert({
        reconciliation_id: reconciliationId,
        action: 'revenue_override_set',
        user_id: user?.id,
        notes: overrideValue !== null 
          ? `Manual revenue override set to $${overrideValue.toFixed(2)} (tenant non-payment)`
          : 'Revenue override cleared'
      });
      
      return { overrideValue };
    },
    onSuccess: (result) => {
      refetch();
      if (result.overrideValue !== null) {
        toast.success(`Revenue override saved: $${result.overrideValue.toFixed(2)}`);
      } else {
        toast.success("Revenue override cleared");
      }
      setShowOverrideInput(false);
    },
    onError: () => {
      toast.error("Failed to save revenue override");
    }
  });

  // Removed fix totals mutation - no longer needed with live calculation system

  const handleApprove = async () => {
    if (!data?.lineItems) return;

    // Validation: Check if any items are approved
    const approvedItems = data.lineItems.filter((item: any) => item.verified && !item.excluded);
    const approvedVisits = approvedItems.filter((item: any) => item.item_type === 'visit');
    const approvedExpenses = approvedItems.filter((item: any) => item.item_type === 'expense');
    
    // Allow approval with zero items if there are notes (special cases like deposit deductions)
    if (approvedItems.length === 0 && !notes?.trim()) {
      toast.error("No items to approve. For special cases (e.g., deposit deductions), please add a note explaining the situation.");
      return;
    }

    // Show confirmation with counts
    const isSpecialCase = approvedItems.length === 0 && notes?.trim();
    const confirmMessage = isSpecialCase 
      ? `This is a special case with no line items.\n\nNote: ${notes}\n\nApprove this reconciliation?`
      : `You are about to approve this reconciliation with:\n\n` +
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
  
  // Get service type from owner
  const serviceType: ServiceType = (reconciliation.property_owners?.service_type as ServiceType) || 'cohosting';
  const isCohosting = serviceType === 'cohosting';
  
  // Calculate actual totals from verified line items
  // Note: management_fee already includes minimum fee if applicable, don't add order_minimum_fee separately
  const calculated = calculateDueFromOwnerFromLineItems(
    lineItems,
    reconciliation.management_fee,
    reconciliation.total_revenue,
    serviceType
  );

  // No longer show mismatch warnings - the Live Financial Calculator is the source of truth
  // and always calculates from verified line items in real-time

  // Split items by verification status - only show expenses and visits in "Needs Approval" (not booking income)
  const unverifiedItems = lineItems.filter((i: any) => !i.verified && i.item_type !== "booking" && i.item_type !== "mid_term_booking");
  
  // Type-specific tabs show ALL items of that type (both verified and unverified)
  const allBookings = lineItems.filter((i: any) => i.item_type === "booking" || i.item_type === "mid_term_booking");
  const allExpenses = lineItems.filter((i: any) => i.item_type === "expense");
  const allVisits = lineItems.filter((i: any) => i.item_type === "visit");
  const allPassThroughFees = lineItems.filter((i: any) => i.item_type === "pass_through_fee");
  
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
            <div className="flex items-center gap-2">
              {reconciliation.property_owners?.id && (
                <ServiceTypeToggle
                  ownerId={reconciliation.property_owners.id}
                  ownerName={reconciliation.property_owners.name || "Owner"}
                  currentType={serviceType}
                  onSuccess={refetch}
                  compact
                />
              )}
              <Badge>{format(new Date(reconciliation.reconciliation_month + 'T00:00:00'), "MMMM yyyy")}</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

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
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Booking Revenue (Owner Keeps)</p>
                    {reconciliation.status === "draft" && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setShowOverrideInput(!showOverrideInput);
                          if (!showOverrideInput && reconciliation.revenue_override !== null) {
                            setRevenueOverride(String(reconciliation.revenue_override));
                          }
                        }}
                        className="text-xs h-6"
                      >
                        {reconciliation.revenue_override !== null ? "Edit Override" : "Override (non-payment)"}
                      </Button>
                    )}
                  </div>
                  
                  {reconciliation.revenue_override !== null && (
                    <div className="p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded text-xs mb-2">
                      <span className="font-medium text-amber-700 dark:text-amber-300">⚠️ Manual Override Active:</span>
                      <span className="ml-1">Revenue overridden to ${Number(reconciliation.revenue_override).toFixed(2)} (tenant non-payment)</span>
                    </div>
                  )}
                  
                  {showOverrideInput && (
                    <div className="p-3 bg-muted/50 border rounded-lg space-y-2 mb-2">
                      <Label className="text-xs font-medium">Manual Revenue Override</Label>
                      <p className="text-xs text-muted-foreground">
                        Use when tenant hasn't paid or paid partially. Set to 0 to apply minimum fee only.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={revenueOverride}
                          onChange={(e) => setRevenueOverride(e.target.value)}
                          className="w-32"
                          step="0.01"
                          min="0"
                        />
                        <Button 
                          size="sm" 
                          onClick={() => {
                            const value = parseFloat(revenueOverride);
                            if (!isNaN(value) && value >= 0) {
                              saveRevenueOverrideMutation.mutate(value);
                            } else {
                              toast.error("Please enter a valid amount");
                            }
                          }}
                          disabled={saveRevenueOverrideMutation.isPending}
                        >
                          Save
                        </Button>
                        {reconciliation.revenue_override !== null && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => saveRevenueOverrideMutation.mutate(null)}
                            disabled={saveRevenueOverrideMutation.isPending}
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  
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
                    <span>Total{reconciliation.revenue_override !== null ? " (Overridden)" : ""}:</span>
                    <span>${Number(reconciliation.total_revenue || 0).toFixed(2)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground mb-3">
                    {isCohosting ? 'Amount Due from Owner' : 'Net Payout to Owner'}
                  </p>
                  <div className="space-y-1">
                    {(() => {
                      const percentage = reconciliation.properties?.management_fee_percentage || 15;
                      const minimumFee = reconciliation.properties?.order_minimum_fee || 0;
                      const calculatedFee = (reconciliation.total_revenue || 0) * (percentage / 100);
                      const actualFee = Number(reconciliation.management_fee || 0);
                      const usedMinimum = minimumFee > 0 && actualFee >= minimumFee && calculatedFee < minimumFee;
                      const hasOverride = reconciliation.revenue_override !== null;
                      
                      return (
                        <div className="flex justify-between text-sm">
                          <span>
                            Management Fee ({percentage}%)
                            {usedMinimum && <span className="text-amber-600 ml-1">(min ${minimumFee})</span>}
                            {hasOverride && <span className="text-amber-600 ml-1">(overridden)</span>}:
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
                    {(calculated.cleaningFees > 0 || calculated.petFees > 0) && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>Cleaning Fees (pass-through):</span>
                          <span className="font-medium text-purple-600">${calculated.cleaningFees.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Pet Fees (pass-through):</span>
                          <span className="font-medium text-purple-600">${calculated.petFees.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className={`flex justify-between font-bold pt-2 border-t text-lg ${isCohosting ? 'text-primary' : 'text-green-600'}`}>
                    <span>{isCohosting ? 'Total Due:' : 'Net Payout:'}</span>
                    <span>${isCohosting ? calculated.dueFromOwner.toFixed(2) : calculated.payoutToOwner.toFixed(2)}</span>
                  </div>
                  {!isCohosting && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Full-service client: Revenue collected by PeachHaus, net amount paid to owner
                    </p>
                  )}
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

        {/* Tenant Payment Review - Only show for mid-term rentals */}
        {data?.midTermBookings && data.midTermBookings.length > 0 && (
          <div className="mt-4">
            {data.midTermBookings.map((booking: any) => (
              <TenantPaymentReview
                key={booking.id}
                propertyId={reconciliation.property_id}
                reconciliationMonth={reconciliation.reconciliation_month}
                expectedRent={Number(booking.monthly_rent) || 0}
                bookingId={booking.id}
                tenantName={booking.tenant_name}
              />
            ))}
          </div>
        )}

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
            {allPassThroughFees.length > 0 && (
              <TabsTrigger value="passthrough" className="text-purple-600">
                Pass-Through ({allPassThroughFees.length})
              </TabsTrigger>
            )}
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
                  onDelete={item.item_type === 'expense' ? (expenseInfo: { id: string; description: string; amount: number }) => setDeleteExpense(expenseInfo) : undefined}
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
                  onDelete={item.item_type === 'expense' ? (expenseInfo: { id: string; description: string; amount: number }) => setDeleteExpense(expenseInfo) : undefined}
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

          <TabsContent value="passthrough" className="space-y-2">
            <Card className="p-4 bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800 mb-4">
              <p className="text-sm text-purple-800 dark:text-purple-200">
                <strong>Pass-Through Fees:</strong> These are cleaning and pet fees collected from guests. 
                Since the owner receives these funds and we pay the service providers, the owner owes us these amounts back.
              </p>
            </Card>
            {allPassThroughFees.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                <p>No pass-through fees found</p>
              </Card>
            ) : (
              allPassThroughFees.map((item: any) => (
                <LineItemRow 
                  key={item.id} 
                  item={item} 
                  onToggleVerified={(id, val) => toggleVerifiedMutation.mutate({ itemId: id, currentValue: val })} 
                  getIcon={getItemIcon}
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

        {/* Service Type and Payment Info Banner */}
        {(reconciliation.status === "approved" || reconciliation.status === "statement_sent") && (
          <Card className={`p-4 ${isCohosting ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant={isCohosting ? "default" : "secondary"} className="text-sm">
                  {isCohosting ? "Co-Hosting" : "Full-Service"}
                </Badge>
                <div className="text-sm">
                  {isCohosting ? (
                    <>
                      <span className="font-medium">Owner Payment Method:</span>{" "}
                      {reconciliation.property_owners?.payment_method === "credit_card" ? (
                        <span className="text-blue-600 dark:text-blue-400">
                          <CreditCard className="w-4 h-4 inline mr-1" />
                          Credit Card (3% fee applies)
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">
                          <Banknote className="w-4 h-4 inline mr-1" />
                          ACH / Bank Transfer
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="font-medium text-green-700 dark:text-green-300">
                      Payout to owner via bank transfer
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{getSettlementLabel(serviceType)}</p>
                <p className={`text-xl font-bold ${isCohosting ? 'text-blue-600' : 'text-green-600'}`}>
                  {formatCurrency(getSettlementAmount(calculated, serviceType))}
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
              <>
                <Button variant="outline" onClick={() => setShowEmailPreview(true)}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Recreate Email Preview
                </Button>
                
                {/* Charge Owner Button (Co-hosting only) */}
                {isCohosting && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={isCharging || calculated.dueFromOwner <= 0}>
                        {isCharging ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Charging...
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4 mr-2" />
                            Charge Owner {formatCurrency(calculated.dueFromOwner)}
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Charge to Owner</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-4">
                            <p>You are about to charge {reconciliation.property_owners?.name} for the following:</p>
                            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Management Fee:</span>
                                <span className="font-medium">{formatCurrency(reconciliation.management_fee || 0)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Visit Fees:</span>
                                <span className="font-medium">{formatCurrency(calculated.visitFees)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Expenses:</span>
                                <span className="font-medium">{formatCurrency(calculated.totalExpenses)}</span>
                              </div>
                              {(calculated.cleaningFees > 0 || calculated.petFees > 0) && (
                                <div className="flex justify-between">
                                  <span>Pass-through Fees:</span>
                                  <span className="font-medium">{formatCurrency(calculated.cleaningFees + calculated.petFees)}</span>
                                </div>
                              )}
                              {(reconciliation.property_owners?.payment_method === "credit_card" || 
                                reconciliation.property_owners?.payment_method === "card" ||
                                reconciliation.property_owners?.payment_method === "ach") && (
                                <div className="flex justify-between text-amber-600">
                                  <span>{getProcessingFeeLabel(reconciliation.property_owners?.payment_method || '')}:</span>
                                  <span className="font-medium">
                                    {formatCurrency(calculateProcessingFee(calculated.dueFromOwner, reconciliation.property_owners?.payment_method || ''))}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between border-t pt-2 font-bold">
                                <span>Total Charge:</span>
                                <span className="text-primary">
                                  {formatCurrency(
                                    calculated.dueFromOwner + calculateProcessingFee(calculated.dueFromOwner, reconciliation.property_owners?.payment_method || '')
                                  )}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              This will charge the owner's saved {reconciliation.property_owners?.payment_method === "credit_card" ? "credit card" : "bank account"}.
                            </p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            setIsCharging(true);
                            try {
                              const { data: result, error } = await supabase.functions.invoke('charge-from-reconciliation', {
                                body: { reconciliation_id: reconciliationId }
                              });
                              
                              if (error) throw error;
                              
                              toast.success(`Successfully charged owner ${formatCurrency(result.amount / 100)}`);
                              await refetch();
                              onSuccess();
                            } catch (error: any) {
                              console.error('Charge error:', error);
                              toast.error(error.message || "Failed to charge owner");
                            } finally {
                              setIsCharging(false);
                            }
                          }}
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Confirm Charge
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                
                {/* Record Payout Button (Full-service only) */}
                {!isCohosting && reconciliation.payout_status !== "completed" && (
                  <AlertDialog onOpenChange={(open) => {
                    if (!open) setPayoutReference("");
                  }}>
                    <AlertDialogTrigger asChild>
                      <Button variant="default" className="bg-green-600 hover:bg-green-700" disabled={isProcessingPayout || (calculated.payoutToOwner || 0) <= 0}>
                        {isProcessingPayout ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Recording...
                          </>
                        ) : (
                          <>
                            <Banknote className="w-4 h-4 mr-2" />
                            Record Payout {formatCurrency(calculated.payoutToOwner || 0)}
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Record Payout to Owner</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-4">
                            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                                ⚠️ Manual Transfer Required
                              </p>
                              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                Please initiate the bank transfer before recording. This action logs the payout for records only.
                              </p>
                            </div>
                            
                            <p>Recording payout to {reconciliation.property_owners?.name}:</p>
                            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Total Revenue:</span>
                                <span className="font-medium text-green-600">{formatCurrency(reconciliation.total_revenue || 0)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Management Fee:</span>
                                <span className="font-medium text-red-600">-{formatCurrency(reconciliation.management_fee || 0)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Visit Fees:</span>
                                <span className="font-medium text-red-600">-{formatCurrency(calculated.visitFees)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Expenses:</span>
                                <span className="font-medium text-red-600">-{formatCurrency(calculated.totalExpenses)}</span>
                              </div>
                              <div className="flex justify-between border-t pt-2 font-bold">
                                <span>Net Payout:</span>
                                <span className="text-green-600">{formatCurrency(calculated.payoutToOwner || 0)}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="payout-reference" className="text-foreground">Transfer Reference (optional)</Label>
                              <Input
                                id="payout-reference"
                                placeholder="e.g. ACH-123456 or Check #789"
                                value={payoutReference}
                                onChange={(e) => setPayoutReference(e.target.value)}
                              />
                              <p className="text-xs text-muted-foreground">
                                Enter your bank's confirmation number for tracking
                              </p>
                            </div>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-green-600 hover:bg-green-700"
                          onClick={async () => {
                            setIsProcessingPayout(true);
                            try {
                              const { data: result, error } = await supabase.functions.invoke('process-owner-payout', {
                                body: { 
                                  reconciliation_id: reconciliationId,
                                  payout_reference: payoutReference || undefined
                                }
                              });
                              
                              if (error) throw error;
                              
                              toast.success(`Payout of ${formatCurrency(result.amount)} recorded successfully`);
                              setPayoutReference("");
                              await refetch();
                              onSuccess();
                            } catch (error: any) {
                              console.error('Payout error:', error);
                              toast.error(error.message || "Failed to record payout");
                            } finally {
                              setIsProcessingPayout(false);
                            }
                          }}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Confirm Payout Recorded
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                
                {/* Status badges are shown in the banner above */}
              </>
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

      <DeleteExpenseDialog
        open={!!deleteExpense}
        onOpenChange={(open) => !open && setDeleteExpense(null)}
        expenseId={deleteExpense?.id || ""}
        expenseDescription={deleteExpense?.description || ""}
        expenseAmount={deleteExpense?.amount}
        reconciliationId={reconciliationId}
        onDeleted={() => {
          // Refetch the current reconciliation data
          refetch();
          // Also invalidate parent queries to update lists
          queryClient.invalidateQueries({ queryKey: ["reconciliations"] });
          queryClient.invalidateQueries({ queryKey: ["expenses"] });
          setDeleteExpense(null);
        }}
      />
    </Dialog>
  );
};

const LineItemRow = ({ item, onToggleVerified, getIcon, showWarnings = false, visitDetails, onDelete }: any) => {
  const isExpense = item.item_type === 'visit' || item.item_type === 'expense' || item.item_type === 'pass_through_fee' || item.amount < 0;
  const displayAmount = item.item_type === 'visit' || item.item_type === 'expense' || item.item_type === 'pass_through_fee'
    ? Math.abs(item.amount) 
    : item.amount;
  
  // Bookings are revenue info, not charges to approve - they should be display-only
  const isBookingItem = item.item_type === 'booking' || item.item_type === 'mid_term_booking';
  
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

  const handleDelete = () => {
    if (onDelete && item.item_type === 'expense' && item.item_id) {
      onDelete({
        id: item.item_id,
        description: item.description || 'Expense',
        amount: Math.abs(item.amount)
      });
    }
  };
  
  return (
    <div className={`flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 ${
      isVisitRelatedExpense ? 'border-red-300 bg-red-50/50 dark:bg-red-950/20' : 
      hasWarning ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : ''
    } ${item.excluded ? 'opacity-50' : ''}`}>
      {/* Bookings are display-only (revenue info), other items have approval checkbox */}
      {isBookingItem ? (
        <div className="w-4 h-4 flex items-center justify-center text-green-600" title="Booking revenue (no approval needed)">
          <Check className="w-4 h-4" />
        </div>
      ) : (
        <Checkbox
          checked={item.verified}
          onCheckedChange={() => onToggleVerified(item.id, item.verified)}
          disabled={item.excluded}
        />
      )}
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
      <div className="flex items-center gap-2">
        <p className={`font-semibold ${isExpense ? "text-red-600" : "text-green-600"}`}>
          {isExpense ? "-" : "+"}${displayAmount.toFixed(2)}
        </p>
        {onDelete && item.item_type === 'expense' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            title="Delete expense"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
