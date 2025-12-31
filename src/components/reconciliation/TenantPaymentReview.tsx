import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { AlertTriangle, Plus, DollarSign, Check, Trash2, Mail, Banknote } from "lucide-react";
import { toast } from "sonner";

interface TenantPaymentReviewProps {
  propertyId: string;
  reconciliationMonth: string;
  expectedRent: number;
  bookingId?: string;
  tenantName?: string;
}

export const TenantPaymentReview = ({
  propertyId,
  reconciliationMonth,
  expectedRent,
  bookingId,
  tenantName,
}: TenantPaymentReviewProps) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPayment, setNewPayment] = useState({
    amount: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    payment_method: "zelle",
    reference_number: "",
    notes: "",
  });
  
  const queryClient = useQueryClient();
  
  const startDate = startOfMonth(parseISO(reconciliationMonth + '-01'));
  const endDate = endOfMonth(startDate);

  // Fetch existing tenant payments for this property and month
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["tenant-payments", propertyId, reconciliationMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_payments")
        .select("*")
        .eq("property_id", propertyId)
        .gte("payment_date", format(startDate, "yyyy-MM-dd"))
        .lte("payment_date", format(endDate, "yyyy-MM-dd"))
        .order("payment_date", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payment-related email insights for this property and month
  const { data: paymentEmails = [] } = useQuery({
    queryKey: ["payment-emails", propertyId, reconciliationMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_insights")
        .select("*")
        .eq("property_id", propertyId)
        .gte("email_date", format(startDate, "yyyy-MM-dd"))
        .lte("email_date", format(endDate, "yyyy-MM-dd") + "T23:59:59")
        .or("subject.ilike.%zelle%,subject.ilike.%venmo%,subject.ilike.%payment%received%,summary.ilike.%payment%received%,summary.ilike.%sent you%,category.eq.payment")
        .order("email_date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const discrepancy = expectedRent - totalPaid;
  const hasDiscrepancy = Math.abs(discrepancy) >= 0.01;
  const isShort = discrepancy > 0;

  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("tenant_payments")
        .insert({
          property_id: propertyId,
          booking_id: bookingId || null,
          amount: parseFloat(newPayment.amount),
          payment_date: newPayment.payment_date,
          payment_method: newPayment.payment_method,
          reference_number: newPayment.reference_number || null,
          notes: newPayment.notes || null,
          entered_by: user?.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-payments", propertyId, reconciliationMonth] });
      toast.success("Payment recorded");
      setShowAddForm(false);
      setNewPayment({
        amount: "",
        payment_date: format(new Date(), "yyyy-MM-dd"),
        payment_method: "zelle",
        reference_number: "",
        notes: "",
      });
    },
    onError: () => {
      toast.error("Failed to record payment");
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("tenant_payments")
        .delete()
        .eq("id", paymentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-payments", propertyId, reconciliationMonth] });
      toast.success("Payment removed");
    },
    onError: () => {
      toast.error("Failed to remove payment");
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading payment data...</div>;
  }

  return (
    <Card className={`p-4 ${hasDiscrepancy ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800' : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'}`}>
      <div className="flex items-start gap-3 mb-4">
        {hasDiscrepancy ? (
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
        ) : (
          <Check className="w-5 h-5 text-green-600 mt-0.5" />
        )}
        <div className="flex-1">
          <h4 className="font-semibold flex items-center gap-2">
            <Banknote className="w-4 h-4" />
            Tenant Payment Review {tenantName && <span className="font-normal text-muted-foreground">- {tenantName}</span>}
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            Track actual rent payments received vs expected monthly rent
          </p>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-background rounded-lg">
        <div>
          <p className="text-xs text-muted-foreground">Expected Rent</p>
          <p className="text-lg font-semibold">${expectedRent.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Received</p>
          <p className={`text-lg font-semibold ${totalPaid >= expectedRent ? 'text-green-600' : 'text-amber-600'}`}>
            ${totalPaid.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {isShort ? "Short by" : discrepancy < 0 ? "Overpaid" : "Balance"}
          </p>
          <p className={`text-lg font-semibold ${hasDiscrepancy ? (isShort ? 'text-red-600' : 'text-blue-600') : 'text-green-600'}`}>
            {hasDiscrepancy ? (
              isShort ? `-$${discrepancy.toFixed(2)}` : `+$${Math.abs(discrepancy).toFixed(2)}`
            ) : (
              <Check className="w-5 h-5 inline" />
            )}
          </p>
        </div>
      </div>

      {/* Payment Emails Detected */}
      {paymentEmails.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Mail className="w-3 h-3" />
            Payment-related emails detected ({paymentEmails.length})
          </p>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {paymentEmails.slice(0, 5).map((email) => (
              <div key={email.id} className="text-xs p-2 bg-background rounded border">
                <p className="font-medium truncate">{email.subject}</p>
                <p className="text-muted-foreground">{format(parseISO(email.email_date), "MMM d, yyyy")}</p>
                {email.expense_amount && (
                  <Badge variant="outline" className="mt-1">
                    ${Number(email.expense_amount).toFixed(2)}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recorded Payments */}
      {payments.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Recorded Payments ({payments.length})</p>
          <div className="space-y-2">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-2 bg-background rounded border">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">${Number(payment.amount).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(payment.payment_date), "MMM d, yyyy")} via {payment.payment_method}
                      {payment.reference_number && ` • Ref: ${payment.reference_number}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("Remove this payment?")) {
                      deletePaymentMutation.mutate(payment.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Payment Form */}
      {showAddForm ? (
        <div className="p-3 bg-background rounded-lg border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Amount</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <Label className="text-xs">Payment Date</Label>
              <Input
                type="date"
                value={newPayment.payment_date}
                onChange={(e) => setNewPayment({ ...newPayment, payment_date: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Payment Method</Label>
              <Select
                value={newPayment.payment_method}
                onValueChange={(v) => setNewPayment({ ...newPayment, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="venmo">Venmo</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="ach">ACH Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Reference # (optional)</Label>
              <Input
                placeholder="Confirmation ID"
                value={newPayment.reference_number}
                onChange={(e) => setNewPayment({ ...newPayment, reference_number: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              placeholder="e.g., Partial payment, tenant agreed to pay rest next week"
              value={newPayment.notes}
              onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => addPaymentMutation.mutate()}
              disabled={!newPayment.amount || parseFloat(newPayment.amount) <= 0 || addPaymentMutation.isPending}
            >
              {addPaymentMutation.isPending ? "Saving..." : "Add Payment"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Manual Payment
        </Button>
      )}

      {/* Discrepancy Explanation */}
      {hasDiscrepancy && (
        <div className="mt-4 p-3 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            ⚠️ Payment Discrepancy Detected
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            {isShort ? (
              <>
                Tenant has paid ${totalPaid.toFixed(2)} of ${expectedRent.toFixed(2)} expected rent. 
                Consider using the "Override (non-payment)" button above to adjust the revenue calculation 
                or continue adding payments as they come in.
              </>
            ) : (
              <>
                Tenant has overpaid by ${Math.abs(discrepancy).toFixed(2)}. 
                This may be a security deposit, prepayment, or error. Please verify.
              </>
            )}
          </p>
        </div>
      )}
    </Card>
  );
};
