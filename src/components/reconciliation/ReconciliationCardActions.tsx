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
  Archive
} from "lucide-react";
import { toast } from "sonner";
import { generateAuditReport } from "@/lib/exportAuditReport";

interface ReconciliationCardActionsProps {
  reconciliation: any;
  isOffboarded: boolean;
  onReview: () => void;
  onOffboard: () => void;
  onSendPerformanceEmail: () => Promise<void>;
  onSendOwnerStatement: () => Promise<void>;
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

  return (
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
              onClick={onSendPerformanceEmail}
              disabled={sendingPerformance || sendingStatement}
            >
              {sendingPerformance ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Performance</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onSendOwnerStatement}
              disabled={sendingPerformance || sendingStatement}
            >
              {sendingStatement ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">
                    {reconciliation.status === "statement_sent" ? "Resend" : "Statement"}
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
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleExportAuditReport} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-2" />
              )}
              Export Audit Report
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onReview}>
              <History className="w-4 h-4 mr-2" />
              View Audit Trail
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
  );
};
