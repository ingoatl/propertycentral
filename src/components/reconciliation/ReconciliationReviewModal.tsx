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
import { Check, Home, DollarSign, Eye, RotateCcw } from "lucide-react";
import { toast } from "sonner";

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
  const [isSendingStatement, setIsSendingStatement] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["reconciliation", reconciliationId],
    queryFn: async () => {
      const { data: rec, error: recError } = await supabase
        .from("monthly_reconciliations")
        .select(`
          *,
          properties(name, address, management_fee_percentage),
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

      return { reconciliation: rec, lineItems: items };
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

      toast.success("Reconciliation approved! Click 'Send Statement to Owner' to email the report.");
      refetch();
      setNotes("");
    } catch (error: any) {
      toast.error(error.message || "Failed to approve reconciliation");
    } finally {
      setIsApproving(false);
    }
  };

  const handleSendStatement = async () => {
    if (!reconciliation.property_owners?.email) {
      toast.error("Owner email not found");
      return;
    }

    const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5);
    const deadlineDate = nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    const confirmed = window.confirm(
      `This will send the monthly statement to:\n\n` +
      `Owner: ${reconciliation.property_owners?.name}\n` +
      `Email: ${reconciliation.property_owners?.email}\n\n` +
      `Review Deadline: ${deadlineDate}\n` +
      `Net Amount: $${Number(reconciliation.net_to_owner || 0).toFixed(2)}\n\n` +
      `The owner will be charged automatically on ${deadlineDate} unless they respond.\n\n` +
      `Send statement now?`
    );

    if (!confirmed) return;

    setIsSendingStatement(true);
    try {
      const { error } = await supabase.functions.invoke("send-monthly-report", {
        body: { reconciliation_id: reconciliationId },
      });

      if (error) throw error;

      toast.success(`Statement sent successfully to ${reconciliation.property_owners?.email}`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to send statement");
    } finally {
      setIsSendingStatement(false);
    }
  };

  if (!data) return null;

  const { reconciliation, lineItems } = data;
  const bookings = lineItems.filter((i: any) => i.item_type === "booking" || i.item_type === "mid_term_booking");
  const expenses = lineItems.filter((i: any) => i.item_type === "expense");
  const visits = lineItems.filter((i: any) => i.item_type === "visit");
  const orderMinimums = lineItems.filter((i: any) => i.item_type === "order_minimum");
  
  // Calculate total visit revenue (company income)
  const totalVisitRevenue = visits.reduce((sum: number, v: any) => sum + Math.abs(v.amount || 0), 0);

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
            <Badge>{format(new Date(reconciliation.reconciliation_month), "MMMM yyyy")}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Card className="p-6 bg-muted/50">
          <h3 className="font-semibold mb-4">📊 Financial Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Owner Revenue</p>
              <p className="text-sm">Short-term Bookings: ${Number(reconciliation.short_term_revenue || 0).toFixed(2)}</p>
              <p className="text-sm">Mid-term Rental: ${Number(reconciliation.mid_term_revenue || 0).toFixed(2)}</p>
              <p className="font-semibold mt-1 text-green-600">Total Revenue: ${Number(reconciliation.total_revenue || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Owner Deductions</p>
              <p className="text-sm">Expenses: ${Number(reconciliation.total_expenses || 0).toFixed(2)}</p>
              <p className="text-sm">Visit Charges: ${totalVisitRevenue.toFixed(2)}</p>
              <p className="text-sm">Management Fee ({reconciliation.properties?.management_fee_percentage || 15}%): ${Number(reconciliation.management_fee || 0).toFixed(2)}</p>
              <p className="text-sm">Order Minimum: ${Number(reconciliation.order_minimum_fee || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Company Income</p>
              <p className="text-sm">Visit Revenue: <span className="text-blue-600 font-semibold">${totalVisitRevenue.toFixed(2)}</span></p>
              <p className="text-sm">Management Fee: <span className="text-blue-600 font-semibold">${Number(reconciliation.management_fee || 0).toFixed(2)}</span></p>
              <p className="text-sm">Order Minimum: <span className="text-blue-600 font-semibold">${Number(reconciliation.order_minimum_fee || 0).toFixed(2)}</span></p>
              <p className="font-semibold mt-1 text-blue-600">Total Company Income: ${(totalVisitRevenue + Number(reconciliation.management_fee || 0) + Number(reconciliation.order_minimum_fee || 0)).toFixed(2)}</p>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="all" className="mt-4">
          <TabsList>
            <TabsTrigger value="all">All ({lineItems.length})</TabsTrigger>
            <TabsTrigger value="bookings">Bookings ({bookings.length})</TabsTrigger>
            <TabsTrigger value="expenses">Expenses ({expenses.length})</TabsTrigger>
            <TabsTrigger value="visits">Visits ({visits.length})</TabsTrigger>
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
              <Button onClick={handleSendStatement} disabled={isSendingStatement}>
                {isSendingStatement ? "Sending..." : "Send Statement to Owner"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const LineItemRow = ({ item, onToggleVerified, getIcon }: any) => {
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
          {format(new Date(item.date), "MMM dd, yyyy")} • {item.category}
        </p>
      </div>
      <p className={`font-semibold ${item.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
        {item.amount >= 0 ? "+" : ""}${Number(item.amount || 0).toFixed(2)}
      </p>
    </div>
  );
};