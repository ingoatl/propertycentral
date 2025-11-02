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
    const toastId = toast.loading("Sending test emails...");
    try {
      const { error } = await supabase.functions.invoke("send-monthly-report", {
        body: { 
          reconciliation_id: reconciliation.id,
          test_email: "info@peachhausgroup.com"
        },
      });

      if (error) throw error;
      toast.success("Test emails sent successfully to info@peachhausgroup.com", { id: toastId });
    } catch (error: any) {
      toast.error(error.message || "Failed to send test emails", { id: toastId });
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
            Monthly Email Previews (2 Emails)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Email 1 - Official Statement */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">Email 1: Official Owner Statement</h3>
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
              <p className="text-sm text-gray-200 mb-1">{reconciliation.properties?.address}</p>
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

            {/* Itemized Financial Statement */}
            <div className="p-8 bg-gray-50 dark:bg-gray-800/50">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 uppercase tracking-wide border-b-4 border-[#FF8C42] pb-3">
                Itemized Financial Statement
              </h2>
              
              {/* Revenue Section */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-green-600 dark:text-green-400 uppercase mb-3">Revenue</h3>
                <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-sm">
                  {Number(reconciliation.short_term_revenue || 0) > 0 && (
                    <div className="flex justify-between p-3 border-b dark:border-gray-700">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Short-term Booking Revenue</span>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        ${Number(reconciliation.short_term_revenue || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {Number(reconciliation.mid_term_revenue || 0) > 0 && (
                    <div className="flex justify-between p-3 border-b dark:border-gray-700">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Mid-term Rental Revenue</span>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        ${Number(reconciliation.mid_term_revenue || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between p-4 bg-green-50 dark:bg-green-950/20">
                    <span className="text-sm font-bold text-green-800 dark:text-green-200">Subtotal: Gross Revenue</span>
                    <span className="text-sm font-bold text-green-800 dark:text-green-200">
                      ${Number(reconciliation.total_revenue || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expenses Section */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase mb-3">Expenses</h3>
                <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-sm">
                  <div className="flex justify-between p-3 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Management Fee ({reconciliation.properties?.management_fee_percentage || 15}%)
                    </span>
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                      -${Number(reconciliation.management_fee || 0).toFixed(2)}
                    </span>
                  </div>
                  {Number(reconciliation.order_minimum_fee || 0) > 0 && (
                    <div className="flex justify-between p-3 border-b dark:border-gray-700">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Order Minimum Fee</span>
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                        -${Number(reconciliation.order_minimum_fee || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between p-3 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400 pl-4">
                      • Property Visits & Other Expenses
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      -${Number(reconciliation.total_expenses || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between p-4 bg-red-50 dark:bg-red-950/20">
                    <span className="text-sm font-bold text-red-800 dark:text-red-200">Subtotal: Total Expenses</span>
                    <span className="text-sm font-bold text-red-800 dark:text-red-200">
                      -${(Number(reconciliation.total_expenses || 0) + Number(reconciliation.management_fee || 0) + Number(reconciliation.order_minimum_fee || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Section */}
              <div className={`rounded-lg p-5 text-white shadow-lg ${Number(reconciliation.net_to_owner || 0) >= 0 ? 'bg-gradient-to-r from-purple-600 to-blue-600' : 'bg-gradient-to-r from-red-600 to-red-700'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-base font-bold uppercase tracking-wide">
                    Net Amount {Number(reconciliation.net_to_owner || 0) >= 0 ? 'Due To' : 'Due From'} Owner
                  </span>
                  <span className="text-2xl font-black">
                    {Number(reconciliation.net_to_owner || 0) >= 0 ? '$' : '-$'}{Math.abs(Number(reconciliation.net_to_owner || 0)).toFixed(2)}
                  </span>
                </div>
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
          </div>

          {/* Email 2 - Performance Report */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">Email 2: Property Performance Report</h3>
            <Card className="p-4 bg-muted/30">
              <div className="space-y-1 text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-muted-foreground min-w-16">To:</span>
                  <span>{reconciliation.property_owners?.email}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-muted-foreground min-w-16">Subject:</span>
                  <span>Property Performance Report - {reconciliation.properties?.name} - {monthLabel}</span>
                </div>
              </div>
            </Card>

            {/* Performance Email Preview */}
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
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-center text-white">
                <h1 className="text-2xl font-semibold tracking-wide mb-2">Property Performance Report</h1>
                <p className="text-lg mb-1">{reconciliation.properties?.name}</p>
                <p className="text-sm text-gray-200">{monthLabel}</p>
              </div>

              {/* Performance Content */}
              <div className="p-8">
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-6 rounded-lg border-l-4 border-purple-500">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                    <span className="text-2xl mr-2">📊</span> AI-Powered Insights
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed italic">
                    Performance analysis, booking trends, and strategic recommendations will be included here...
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-[#2c3e50] text-white p-8 text-center border-t-4 border-[#FF8C42]">
                <p className="font-semibold text-base tracking-wide mb-3">
                  PeachHaus Property Management
                </p>
                <p className="text-sm text-gray-300 mb-4">
                  Questions? Contact us at{' '}
                  <a href="mailto:info@peachhausgroup.com" className="text-[#FF8C42] font-semibold">
                    info@peachhausgroup.com
                  </a>
                </p>
              </div>
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
