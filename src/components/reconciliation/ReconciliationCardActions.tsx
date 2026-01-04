import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Eye, 
  Send, 
  Mail, 
  Loader2, 
  MoreHorizontal, 
  UserMinus, 
  FileSpreadsheet, 
  History,
  Archive,
  CreditCard,
  ExternalLink,
  TestTube2
} from "lucide-react";
import { toast } from "sonner";
import { generateAuditReport } from "@/lib/exportAuditReport";
import { AuditTrailDialog } from "./AuditTrailDialog";
import { supabase } from "@/integrations/supabase/client";

interface ReconciliationCardActionsProps {
  reconciliation: any;
  isOffboarded: boolean;
  onReview: () => void;
  onOffboard: () => void;
  onSendPerformanceEmail: () => void;
  onSendOwnerStatement: () => void;
  sendingPerformance: boolean;
  sendingStatement: boolean;
}

export const ReconciliationCardActions = ({
  reconciliation,
  isOffboarded,
  onReview,
  onOffboard,
  onSendPerformanceEmail,
  onSendOwnerStatement,
  sendingPerformance,
  sendingStatement,
}: ReconciliationCardActionsProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [sendingPaymentEmail, setSendingPaymentEmail] = useState(false);
  const [sendingDashboardInvite, setSendingDashboardInvite] = useState(false);
  const [sendingTestPaymentEmail, setSendingTestPaymentEmail] = useState(false);
  
  const canSendEmails = 
    (reconciliation.status === "approved" || reconciliation.status === "statement_sent") && 
    !isOffboarded;

  const handleExportAuditReport = async () => {
    try {
      setIsExporting(true);
      await generateAuditReport(reconciliation.id);
      toast.success("Audit report exported successfully");
    } catch (error: any) {
      console.error("Error exporting audit report:", error);
      toast.error("Failed to export audit report");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendDashboardInvite = async () => {
    const owner = reconciliation.properties?.property_owners;
    if (!owner) {
      toast.error("No owner found for this property");
      return;
    }

    try {
      setSendingDashboardInvite(true);
      
      const { data, error } = await supabase.functions.invoke('owner-magic-link', {
        body: {
          owner_id: owner.id,
          send_email: true
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Dashboard invite sent to ${owner.email}${data.second_owner_invited ? ' and second owner' : ''}`);
    } catch (error: any) {
      console.error("Error sending dashboard invite:", error);
      toast.error("Failed to send dashboard invite");
    } finally {
      setSendingDashboardInvite(false);
    }
  };

  const handleSendPaymentTransitionEmail = async () => {
    const owner = reconciliation.properties?.property_owners;
    if (!owner) {
      toast.error("No owner found for this property");
      return;
    }

    if (!owner.email) {
      toast.error("Owner has no email address");
      return;
    }

    try {
      setSendingPaymentEmail(true);
      
      const { data, error } = await supabase.functions.invoke('send-billing-transition-email', {
        body: {
          ownerName: owner.name,
          ownerEmail: owner.email,
          ownerId: owner.id,
          propertyName: reconciliation.properties?.name || 'Your Property'
        }
      });

      if (error) throw error;

      toast.success(`Payment setup email sent to ${owner.email}`);
    } catch (error: any) {
      console.error("Error sending payment transition email:", error);
      toast.error("Failed to send payment setup email");
    } finally {
      setSendingPaymentEmail(false);
    }
  };

  const handleSendTestPaymentEmail = async () => {
    try {
      setSendingTestPaymentEmail(true);
      
      const { data, error } = await supabase.functions.invoke('send-billing-transition-email', {
        body: {
          ownerName: "Test Owner",
          ownerEmail: "info@peachhausgroup.com",
          ownerId: reconciliation.properties?.property_owners?.id || "test",
          propertyName: reconciliation.properties?.name || 'Test Property'
        }
      });

      if (error) throw error;

      toast.success("Test payment setup email sent to info@peachhausgroup.com");
    } catch (error: any) {
      console.error("Error sending test payment email:", error);
      toast.error("Failed to send test payment email");
    } finally {
      setSendingTestPaymentEmail(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2 w-full">
        {/* Primary Action - Review Button */}
        <Button
          onClick={onReview}
          className="w-full"
          size="lg"
        >
          <Eye className="w-4 h-4 mr-2" />
          Review Reconciliation
        </Button>

        {/* Secondary Actions Row */}
        <div className="flex gap-2">
          {canSendEmails && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  const owner = reconciliation.properties?.property_owners;
                  if (owner?.id) {
                    window.open(`/owner-dashboard?owner=${owner.id}`, '_blank');
                  } else {
                    toast.error("No owner found for this property");
                  }
                }}
                title="View owner dashboard"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onSendOwnerStatement}
                disabled={sendingPerformance || sendingStatement}
                title="Send statement email to owner"
              >
                {sendingStatement ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">
                      {reconciliation.status === "statement_sent" ? "Resend Statement" : "Statement"}
                    </span>
                  </>
                )}
              </Button>
            </>
          )}

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={canSendEmails ? "" : "flex-1"}>
                <MoreHorizontal className="w-4 h-4" />
                <span className="ml-1 hidden sm:inline">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setShowAuditTrail(true)}>
                <History className="w-4 h-4 mr-2" />
                View Audit Trail
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportAuditReport} disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                Export GREC Report
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                onClick={handleSendPaymentTransitionEmail} 
                disabled={sendingPaymentEmail}
              >
                {sendingPaymentEmail ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Send Payment Setup Email
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={handleSendTestPaymentEmail} 
                disabled={sendingTestPaymentEmail}
                className="text-blue-600"
              >
                {sendingTestPaymentEmail ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <TestTube2 className="w-4 h-4 mr-2" />
                )}
                Test Payment Email (info@)
              </DropdownMenuItem>
              
              {!isOffboarded && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={onOffboard}
                    className="text-destructive focus:text-destructive"
                  >
                    <UserMinus className="w-4 h-4 mr-2" />
                    Offboard Property
                  </DropdownMenuItem>
                </>
              )}
              
              {isOffboarded && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <Archive className="w-4 h-4 mr-2" />
                    Archived Property
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Audit Trail Dialog */}
      <AuditTrailDialog
        reconciliationId={reconciliation.id}
        open={showAuditTrail}
        onOpenChange={setShowAuditTrail}
      />
    </>
  );
};
