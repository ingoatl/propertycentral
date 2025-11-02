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
    const toastId = toast.loading("Sending test email...");
    try {
      const { error } = await supabase.functions.invoke("send-monthly-report", {
        body: { 
          reconciliation_id: reconciliation.id,
          test_email: "info@peachhausgroup.com"
        },
      });

      if (error) throw error;
      toast.success("Test email sent successfully to info@peachhausgroup.com", { id: toastId });
    } catch (error: any) {
      toast.error(error.message || "Failed to send test email", { id: toastId });
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
          {/* Email Metadata */}
          <Card className="p-4 bg-muted/30">
            <div className="space-y-1 text-sm">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-muted-foreground min-w-16">To:</span>
                <span>{reconciliation.property_owners?.email}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold text-muted-foreground min-w-16">Subject:</span>
                <span>Monthly Owner Statement - {reconciliation.properties?.name} - {monthLabel}</span>
              </div>
            </div>
          </Card>

          {/* Email Preview - Professional Format */}
          <div className="border rounded-lg overflow-hidden shadow-sm bg-white dark:bg-gray-900">
            {/* Logo Header */}
            <div className="bg-white dark:bg-gray-900 border-b-4 border-[#FF8C42] p-8 text-center">
              <img 
                src="/peachhaus-logo.png" 
                alt="PeachHaus Property Management" 
                className="max-w-[280px] h-auto mx-auto"
              />
            </div>

            {/* Title Section */}
            <div className="bg-[#5a6c7d] p-6 text-center text-white">
              <h1 className="text-2xl font-semibold tracking-wide mb-2">Monthly Owner Statement</h1>
              <p className="text-lg mb-1">{reconciliation.properties?.name}</p>
              <p className="text-sm text-gray-200">{monthLabel}</p>
            </div>

            {/* Legal Notice */}
            <div className="bg-yellow-50 dark:bg-yellow-950/30 border-2 border-yellow-400 dark:border-yellow-700 p-6 m-6 rounded">
              <h3 className="text-yellow-800 dark:text-yellow-200 font-bold text-lg mb-3 flex items-center">
                <span className="text-xl mr-2">⚠️</span> Action Required
              </h3>
              <p className="text-yellow-900 dark:text-yellow-100 text-sm leading-relaxed mb-3">
                Please carefully review this financial statement. If you have any questions or discrepancies, 
                you must notify PeachHaus Property Management in writing by{' '}
                <strong className="text-yellow-800 dark:text-yellow-200">{deadlineDate}</strong>.
              </p>
              <p className="text-yellow-800 dark:text-yellow-200 text-xs leading-relaxed italic">
                Failure to respond by the deadline will constitute acceptance of this statement as accurate and complete.
              </p>
            </div>

            {/* Financial Summary */}
            <div className="p-8 bg-gray-50 dark:bg-gray-800/50">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 uppercase tracking-wide">
                Financial Summary
              </h2>
              <div className="bg-white dark:bg-gray-900 shadow-sm rounded overflow-hidden">
                <table className="w-full">
                  <tbody>
                    <tr className="border-b dark:border-gray-700">
                      <td className="p-4 font-semibold text-gray-700 dark:text-gray-300">Total Revenue</td>
                      <td className="p-4 text-right font-bold text-green-600 dark:text-green-400">
                        ${Number(reconciliation.total_revenue || 0).toFixed(2)}
                      </td>
                    </tr>
                    <tr className="border-b dark:border-gray-700">
                      <td className="p-4 font-semibold text-gray-700 dark:text-gray-300">Total Expenses</td>
                      <td className="p-4 text-right font-bold text-red-600 dark:text-red-400">
                        ${Number(reconciliation.total_expenses || 0).toFixed(2)}
                      </td>
                    </tr>
                    <tr className="bg-[#5a6c7d] text-white">
                      <td className="p-5 font-bold text-base">Net Amount Due to Owner</td>
                      <td className="p-5 text-right font-bold text-xl">
                        ${Number(reconciliation.net_to_owner || 0).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Performance Insights Section Preview */}
            <div className="p-8 bg-blue-50 dark:bg-blue-950/20 border-t dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 uppercase tracking-wide flex items-center">
                <span className="text-2xl mr-2">📊</span> Property Performance & Insights
              </h2>
              <div className="bg-white dark:bg-gray-900 p-6 rounded border-l-4 border-[#FF8C42]">
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed italic">
                  AI-powered insights and performance analysis will be included here...
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-[#2c3e50] text-white p-8 text-center border-t-4 border-[#FF8C42]">
              <p className="font-semibold text-base tracking-wide mb-3">
                PeachHaus Property Management
              </p>
              <p className="text-sm text-gray-300 mb-4">
                Questions or concerns? Contact us at{' '}
                <a href="mailto:info@peachhausgroup.com" className="text-[#FF8C42] font-semibold">
                  info@peachhausgroup.com
                </a>
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                This is an official financial statement. Please retain for your records.
              </p>
            </div>
          </div>

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
