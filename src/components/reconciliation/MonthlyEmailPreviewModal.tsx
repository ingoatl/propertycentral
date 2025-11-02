import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, Send, TestTube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface MonthlyEmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reconciliation: any;
  onSuccess: () => void;
}

export const MonthlyEmailPreviewModal = ({
  open,
  onOpenChange,
  reconciliation,
  onSuccess,
}: MonthlyEmailPreviewModalProps) => {
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingOwner, setIsSendingOwner] = useState(false);

  const handleSendTestEmail = async () => {
    setIsSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke("send-monthly-report", {
        body: { 
          reconciliation_id: reconciliation.id,
          test_email: "info@peachhausgroup.com"
        },
      });

      if (error) throw error;
      toast.success("Test email sent to info@peachhausgroup.com");
    } catch (error: any) {
      toast.error(error.message || "Failed to send test email");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendOwnerEmail = async () => {
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

    setIsSendingOwner(true);
    try {
      const { error } = await supabase.functions.invoke("send-monthly-report", {
        body: { reconciliation_id: reconciliation.id },
      });

      if (error) throw error;

      toast.success(`Monthly statement sent to ${reconciliation.property_owners?.email}`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to send owner email");
    } finally {
      setIsSendingOwner(false);
    }
  };

  const monthLabel = format(new Date(reconciliation.reconciliation_month + 'T00:00:00'), "MMMM yyyy");
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5);
  const deadlineDate = nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Monthly Statement Email Preview
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="p-6 bg-muted/50">
            <div className="space-y-2 text-sm">
              <p><strong>To:</strong> {reconciliation.property_owners?.name} ({reconciliation.property_owners?.email})</p>
              <p><strong>Subject:</strong> Monthly Statement for {reconciliation.properties?.name} - {monthLabel}</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Monthly Property Statement</h3>
                <p className="text-sm text-muted-foreground">
                  Dear {reconciliation.property_owners?.name},
                </p>
              </div>

              <p className="text-sm">
                Please find attached your monthly property statement for <strong>{reconciliation.properties?.name}</strong> for the month of <strong>{monthLabel}</strong>.
              </p>

              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold">Financial Summary</h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Revenue:</span>
                    <span className="font-semibold text-green-600">${Number(reconciliation.total_revenue || 0).toFixed(2)}</span>
                  </div>
                  
                  <div className="border-t pt-2 space-y-1">
                    <div className="flex justify-between text-muted-foreground">
                      <span className="ml-4">• Short-term Bookings:</span>
                      <span>${Number(reconciliation.short_term_revenue || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span className="ml-4">• Mid-term Rental:</span>
                      <span>${Number(reconciliation.mid_term_revenue || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t pt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Expenses:</span>
                      <span className="font-semibold text-red-600">${Number(reconciliation.total_expenses || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Management Fee ({reconciliation.properties?.management_fee_percentage || 15}%):</span>
                      <span>${Number(reconciliation.management_fee || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Order Minimum Fee:</span>
                      <span>${Number(reconciliation.order_minimum_fee || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t pt-2">
                    <div className="flex justify-between text-lg">
                      <span className="font-bold">Net Amount Due:</span>
                      <span className="font-bold text-primary">${Number(reconciliation.net_to_owner || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm font-semibold mb-2">⚠️ Important Notice</p>
                <p className="text-sm">
                  Please review this statement carefully. If you have any questions or disputes, respond by <strong>{deadlineDate}</strong>. 
                  The amount will be automatically charged to your payment method on file on that date unless we hear from you.
                </p>
              </div>

              <p className="text-sm">
                If you have any questions about this statement, please don't hesitate to contact us.
              </p>

              <p className="text-sm">
                Best regards,<br />
                <strong>Peach Haus Property Management</strong>
              </p>
            </div>
          </Card>

          <div className="flex justify-between pt-4 border-t gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleSendTestEmail}
                disabled={isSendingTest || isSendingOwner}
              >
                <TestTube className="w-4 h-4 mr-2" />
                {isSendingTest ? "Sending..." : "Send Test Email"}
              </Button>
              <Button
                onClick={handleSendOwnerEmail}
                disabled={isSendingTest || isSendingOwner}
              >
                <Send className="w-4 h-4 mr-2" />
                {isSendingOwner ? "Sending..." : "Send Monthly Owner Email"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
