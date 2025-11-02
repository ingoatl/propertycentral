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
            Monthly Owner Statement Preview
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Official Owner Statement */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">Official Owner Statement</h3>
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

            {/* Email Preview - New PeachHaus Design */}
          <div className="border rounded-lg overflow-hidden shadow-sm bg-white dark:bg-gray-900">
            {/* Logo Header */}
            <div className="bg-white dark:bg-gray-900 border-b-4 border-[#FF8C42] p-8 text-center">
              <img 
                src="/peachhaus-logo.png" 
                alt="PeachHaus Property Management" 
                className="max-w-[280px] h-auto mx-auto"
              />
            </div>

            {/* Orange Header with Title */}
            <div className="bg-[#FF7F00] p-8 text-center text-white">
              <h1 className="text-3xl font-bold tracking-wide mb-3">
                🏡 PeachHaus Monthly Summary
              </h1>
              <p className="text-lg opacity-95">
                Property: {reconciliation.properties?.name} | Period: {monthLabel}
              </p>
            </div>

            {/* Professional Summary */}
            <div className="p-8 bg-white dark:bg-gray-900">
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 mb-4">
                Dear Property Owner,
              </p>
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 mb-4">
                Please find enclosed your official monthly financial statement for the period ending {monthLabel}. 
                This statement provides a comprehensive breakdown of all revenue collected and expenses incurred on your behalf 
                during the reporting period. All amounts reflected herein have been verified and reconciled with our accounting records.
              </p>
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                In accordance with our management agreement, payment processing will occur automatically unless we receive written notification of discrepancies prior to the deadline.
              </p>
            </div>

            {/* Property Info Card */}
            <div className="mx-8 mb-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-start gap-5">
                {reconciliation.properties?.image_path ? (
                  <div className="flex-shrink-0">
                    <img 
                      src={reconciliation.properties.image_path} 
                      alt={reconciliation.properties.name}
                      className="w-44 h-28 object-cover rounded-xl shadow-md"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <span className="text-2xl">🏠</span>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    {reconciliation.properties?.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    📍 {reconciliation.properties?.address}
                  </p>
                </div>
              </div>
            </div>

            {/* Performance Summary */}
            <div className="p-8 bg-white dark:bg-gray-900">
              <h2 className="text-xl font-bold text-[#FF7F00] mb-6 uppercase tracking-wide">
                📊 Performance Summary
              </h2>
              
              {/* Income & Activity Section */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
                  Income & Activity
                </h3>
                <div className="space-y-3">
                  {Number(reconciliation.short_term_revenue || 0) > 0 && (
                    <div className="flex justify-between pb-3 border-b dark:border-gray-700">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Short-term Booking Revenue</span>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        ${Number(reconciliation.short_term_revenue || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {Number(reconciliation.mid_term_revenue || 0) > 0 && (
                    <div className="flex justify-between pb-3 border-b dark:border-gray-700">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Mid-term Rental Revenue</span>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        ${Number(reconciliation.mid_term_revenue || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-4 bg-green-50 dark:bg-green-950/20 -mx-6 px-6 py-4 rounded-lg">
                    <span className="text-sm font-bold text-green-800 dark:text-green-200">Subtotal: Gross Revenue</span>
                    <span className="text-sm font-bold text-green-800 dark:text-green-200">
                      ${Number(reconciliation.total_revenue || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* PeachHaus Services Rendered Section */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
                  🧰 PeachHaus Services Rendered
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between pb-3 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Management & Oversight ({reconciliation.properties?.management_fee_percentage || 15}%)
                    </span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      ${Number(reconciliation.management_fee || 0).toFixed(2)}
                    </span>
                  </div>
                  {Number(reconciliation.order_minimum_fee || 0) > 0 && (
                    <div className="flex justify-between pb-3 border-b dark:border-gray-700">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Operational Minimum Fee</span>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        ${Number(reconciliation.order_minimum_fee || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pb-3 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400 pl-4">
                      • Property Visits & Other Expenses
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      ${Number(reconciliation.total_expenses || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-4 bg-orange-50 dark:bg-orange-950/20 -mx-6 px-6 py-4 rounded-lg">
                    <span className="text-sm font-bold text-orange-800 dark:text-orange-200">Subtotal: Services Provided</span>
                    <span className="text-sm font-bold text-orange-800 dark:text-orange-200">
                      ${(Number(reconciliation.total_expenses || 0) + Number(reconciliation.management_fee || 0) + Number(reconciliation.order_minimum_fee || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance Summary Section */}
              <div className={`rounded-xl p-6 shadow-md ${Number(reconciliation.net_to_owner || 0) >= 0 ? 'bg-green-50 dark:bg-green-950/20 border-2 border-green-500' : 'bg-orange-50 dark:bg-orange-950/20 border-2 border-[#FF7F00]'}`}>
                <h3 className={`text-lg font-bold mb-4 ${Number(reconciliation.net_to_owner || 0) >= 0 ? 'text-green-800 dark:text-green-200' : 'text-orange-800 dark:text-orange-200'}`}>
                  💼 Balance Summary
                </h3>
                <div className="flex justify-between items-center">
                  <span className={`text-lg font-bold ${Number(reconciliation.net_to_owner || 0) >= 0 ? 'text-green-800 dark:text-green-200' : 'text-orange-800 dark:text-orange-200'}`}>
                    Amount Due {Number(reconciliation.net_to_owner || 0) >= 0 ? 'to' : 'from'} Owner
                  </span>
                  <span className={`text-2xl font-black ${Number(reconciliation.net_to_owner || 0) >= 0 ? 'text-green-600' : 'text-[#FF7F00]'}`}>
                    ${Math.abs(Number(reconciliation.net_to_owner || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Thank You Message */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5 mt-6 text-center">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Thank you for partnering with PeachHaus.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  All charges reflect completed services that maintain your property's quality and performance readiness.
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
                This is an official financial statement. Please retain for your records.<br />
                Thank you for trusting PeachHaus with your investment property.
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
                {isSendingOwner ? "Sending..." : "Send Owner Statement"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
