import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle,
  Copy,
  ExternalLink,
  Loader2,
  Building2,
  CreditCard,
  Clock,
  Bell,
  FileText,
  ArrowRight,
  Mail,
} from "lucide-react";
import { format } from "date-fns";

interface GetPaidModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  vendorId: string;
  vendorName: string;
  vendorPhone?: string | null;
  propertyName: string;
  propertyAddress?: string | null;
  quotedAmount?: number | null;
  completedAt?: string | null;
  isBillComConnected: boolean;
  billcomInviteSentAt?: string | null;
  onEnrollmentComplete?: () => void;
}

const GetPaidModal = ({
  open,
  onOpenChange,
  workOrderId,
  vendorId,
  vendorName,
  vendorPhone,
  propertyName,
  propertyAddress,
  quotedAmount,
  completedAt,
  isBillComConnected,
  billcomInviteSentAt,
  onEnrollmentComplete,
}: GetPaidModalProps) => {
  const [enrolling, setEnrolling] = useState(false);
  const [showManualInstructions, setShowManualInstructions] = useState(false);

  // Generate work order reference (first 8 chars of ID)
  const workOrderRef = `WO-${workOrderId.slice(0, 8).toUpperCase()}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const handleEnrollInBillCom = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "billcom-enroll-on-completion",
        {
          body: {
            vendorId,
            workOrderId,
          },
        }
      );

      if (error) throw error;

      if (data.success) {
        toast.success("Bill.com enrollment started - check your phone/email");
        onEnrollmentComplete?.();
        // Show the enrollment confirmation
      } else {
        toast.error(data.error || "Failed to start enrollment");
      }
    } catch (error: unknown) {
      console.error("Enrollment error:", error);
      toast.error(
        "Failed to start enrollment: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setEnrolling(false);
    }
  };

  // Benefits list for non-connected vendors
  const benefits = [
    { icon: CreditCard, text: "Direct deposit to your bank account" },
    { icon: Clock, text: "Payment in 7-10 business days" },
    { icon: FileText, text: "Track all your invoices in one place" },
    { icon: Bell, text: "Automatic payment notifications" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header - Fortune 500 Style */}
        <DialogHeader className="p-0">
          <div className="bg-white border-b-2 border-black px-6 py-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xs font-semibold tracking-widest uppercase text-black">
                {isBillComConnected ? "Submit Your Invoice" : "Get Paid"}
              </DialogTitle>
              <span className="font-mono text-[10px] text-neutral-500">
                {workOrderRef}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 bg-white">
          {/* Job Summary */}
          <div className="border border-neutral-200 rounded-none">
            <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200">
              <span className="text-[10px] font-semibold tracking-widest uppercase text-neutral-600">
                Job Completed
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
                    Property
                  </p>
                  <p className="text-sm font-medium text-black">{propertyName}</p>
                  {propertyAddress && (
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {propertyAddress}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
                    Reference
                  </p>
                  <button
                    onClick={() => copyToClipboard(workOrderRef, "Reference")}
                    className="font-mono text-sm font-semibold text-black flex items-center gap-1 hover:text-neutral-600"
                  >
                    {workOrderRef}
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="h-px bg-neutral-200" />

              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
                    Amount
                  </p>
                  <p className="font-mono text-lg font-semibold text-black">
                    ${quotedAmount?.toLocaleString() || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
                    Completed
                  </p>
                  <p className="text-sm text-black">
                    {completedAt
                      ? format(new Date(completedAt), "MMM d, yyyy")
                      : "Today"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Connected Vendor Flow */}
          {isBillComConnected ? (
            <div className="space-y-4">
              <div className="bg-neutral-50 border border-neutral-200 p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-neutral-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-black">
                      Invoice Instructions
                    </p>
                    <p className="text-xs text-neutral-600 mt-1">
                      Include reference{" "}
                      <span className="font-mono font-semibold">{workOrderRef}</span>{" "}
                      on your invoice for faster processing.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full h-12 bg-black hover:bg-neutral-800 text-white font-medium"
                asChild
              >
                <a
                  href="https://app.bill.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Open Bill.com
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>

              <p className="text-center text-xs text-neutral-500">
                Expected payment: 7-10 business days after approval
              </p>
            </div>
          ) : showManualInstructions ? (
            /* Manual Invoice Instructions */
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm font-medium text-amber-900 mb-2">
                  Submit Invoice Manually
                </p>
                <p className="text-xs text-amber-800 mb-3">
                  Email your invoice to the address below. Include the reference
                  number in the subject line.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-white p-2 border border-amber-200">
                    <span className="text-xs text-neutral-600">Email:</span>
                    <button
                      onClick={() =>
                        copyToClipboard("invoices@peachhausgroup.com", "Email")
                      }
                      className="flex items-center gap-1 font-medium text-sm text-amber-900"
                    >
                      invoices@peachhausgroup.com
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between bg-white p-2 border border-amber-200">
                    <span className="text-xs text-neutral-600">Reference:</span>
                    <button
                      onClick={() => copyToClipboard(workOrderRef, "Reference")}
                      className="flex items-center gap-1 font-mono font-semibold text-sm text-amber-900"
                    >
                      {workOrderRef}
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-center text-xs text-neutral-500">
                Note: Manual invoices take 14-21 days to process
              </p>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowManualInstructions(false)}
              >
                ← Back to Bill.com Enrollment
              </Button>
            </div>
          ) : (
            /* Non-Connected Vendor - Enrollment Flow */
            <div className="space-y-4">
              <p className="text-sm text-neutral-600">
                Great work! Join our vendor network for fast, reliable payments.
              </p>

              {/* Benefits */}
              <div className="border border-neutral-200">
                <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200">
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-neutral-600">
                    Why Bill.com?
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  {benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <benefit.icon className="h-4 w-4 text-neutral-400 flex-shrink-0" />
                      <span className="text-sm text-neutral-700">{benefit.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {billcomInviteSentAt && (
                <div className="bg-neutral-50 border border-neutral-200 p-3 text-center">
                  <p className="text-xs text-neutral-600">
                    Invite sent on{" "}
                    {format(new Date(billcomInviteSentAt), "MMM d, yyyy")}
                  </p>
                </div>
              )}

              <Button
                className="w-full h-12 bg-black hover:bg-neutral-800 text-white font-medium"
                onClick={handleEnrollInBillCom}
                disabled={enrolling}
              >
                {enrolling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Join Bill.com
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-neutral-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-neutral-500">or</span>
                </div>
              </div>

              <Button
                variant="ghost"
                className="w-full text-neutral-500 hover:text-neutral-700"
                onClick={() => setShowManualInstructions(true)}
              >
                <Mail className="h-4 w-4 mr-2" />
                Submit Invoice Manually
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-neutral-50 border-t border-neutral-200 px-6 py-3 text-center">
          <p className="text-xs text-neutral-500">
            Questions?{" "}
            <a href="tel:+14049915076" className="font-medium text-neutral-700">
              404-991-5076
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GetPaidModal;
