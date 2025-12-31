import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import {
  FileText,
  User,
  Calendar,
  DollarSign,
  Check,
  X,
  History,
  Download,
  FileSpreadsheet,
  Building,
  ClipboardList,
} from "lucide-react";
import { generateAuditReport } from "@/lib/exportAuditReport";
import { toast } from "sonner";

interface AuditTrailDialogProps {
  reconciliationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AuditLogEntry {
  id: string;
  action: string;
  user_id: string | null;
  item_id: string | null;
  notes: string | null;
  previous_values: any;
  new_values: any;
  created_at: string;
  user_name?: string;
}

export const AuditTrailDialog = ({
  reconciliationId,
  open,
  onOpenChange,
}: AuditTrailDialogProps) => {
  const [isExporting, setIsExporting] = useState(false);

  // Fetch reconciliation details
  const { data: reconciliation } = useQuery({
    queryKey: ["audit-reconciliation", reconciliationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_reconciliations")
        .select(`
          *,
          properties(id, name, address, management_fee_percentage),
          property_owners(id, name, email, service_type)
        `)
        .eq("id", reconciliationId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch audit log entries
  const { data: auditLogs } = useQuery({
    queryKey: ["audit-logs", reconciliationId],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from("reconciliation_audit_log")
        .select("*")
        .eq("reconciliation_id", reconciliationId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user names for display
      const userIds = [...new Set(logs?.map((l) => l.user_id).filter(Boolean))] as string[];
      
      let userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, email")
          .in("id", userIds);

        if (profiles) {
          userMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.first_name || p.email || "Unknown User";
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return (logs || []).map((log) => ({
        ...log,
        user_name: log.user_id ? userMap[log.user_id] || "Unknown User" : "System",
      })) as AuditLogEntry[];
    },
    enabled: open,
  });

  // Fetch all line items with approval metadata
  const { data: lineItems } = useQuery({
    queryKey: ["audit-line-items", reconciliationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reconciliation_line_items")
        .select("*")
        .eq("reconciliation_id", reconciliationId)
        .order("date", { ascending: false });

      if (error) throw error;

      // Fetch approver names
      const approverIds = [...new Set(data?.map((i) => i.approved_by).filter(Boolean))] as string[];
      
      let approverMap: Record<string, string> = {};
      if (approverIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, email")
          .in("id", approverIds);

        if (profiles) {
          approverMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.first_name || p.email || "Unknown";
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return (data || []).map((item) => ({
        ...item,
        approved_by_name: item.approved_by ? approverMap[item.approved_by] || "Unknown" : null,
      }));
    },
    enabled: open,
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await generateAuditReport(reconciliationId);
      toast.success("GREC-compliant audit report exported");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export audit report");
    } finally {
      setIsExporting(false);
    }
  };

  const formatActionName = (action: string): string => {
    const actionMap: Record<string, string> = {
      created: "Reconciliation Created",
      items_added: "Items Added",
      visits_added: "Visits Added",
      item_approved: "Item Approved",
      item_rejected: "Item Unapproved",
      approved: "Reconciliation Approved",
      statement_sent: "Statement Sent to Owner",
      charged: "Owner Charged",
      payout_recorded: "Payout Recorded",
      finalized: "Reconciliation Finalized",
    };
    return actionMap[action] || action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("approved") || action === "item_approved") return "bg-green-600";
    if (action.includes("rejected") || action === "item_rejected") return "bg-red-600";
    if (action === "created" || action.includes("added")) return "bg-blue-600";
    if (action === "charged" || action === "payout_recorded") return "bg-purple-600";
    return "bg-gray-600";
  };

  // Calculate summary statistics
  const totalRevenue = reconciliation?.total_revenue || 0;
  const totalExpenses = lineItems
    ?.filter((i) => i.item_type === "expense" && i.verified && !i.excluded)
    .reduce((sum, i) => sum + Math.abs(i.amount), 0) || 0;
  const totalVisitFees = lineItems
    ?.filter((i) => i.item_type === "visit" && i.verified && !i.excluded)
    .reduce((sum, i) => sum + Math.abs(i.amount), 0) || 0;
  const approvedItems = lineItems?.filter((i) => i.verified && !i.excluded).length || 0;
  const totalItems = lineItems?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5" />
              <span>GREC Audit Trail</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                "Exporting..."
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export Full Report
                </>
              )}
            </Button>
          </DialogTitle>
        </DialogHeader>

        {reconciliation && (
          <div className="flex-1 overflow-hidden">
            {/* Property & Period Summary - GREC Required */}
            <Card className="p-4 mb-4 bg-muted/30">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <Building className="w-3 h-3" /> Property
                  </p>
                  <p className="font-semibold">{reconciliation.properties?.name}</p>
                  <p className="text-xs text-muted-foreground">{reconciliation.properties?.address}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" /> Owner
                  </p>
                  <p className="font-semibold">{reconciliation.property_owners?.name}</p>
                  <p className="text-xs text-muted-foreground">{reconciliation.property_owners?.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Period
                  </p>
                  <p className="font-semibold">
                    {format(new Date(reconciliation.reconciliation_month + "T00:00:00"), "MMMM yyyy")}
                  </p>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {reconciliation.status?.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <ClipboardList className="w-3 h-3" /> Items
                  </p>
                  <p className="font-semibold">{approvedItems} / {totalItems} approved</p>
                </div>
              </div>
            </Card>

            <Tabs defaultValue="ledger" className="flex-1">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="ledger">
                  <DollarSign className="w-4 h-4 mr-1" />
                  Property Ledger
                </TabsTrigger>
                <TabsTrigger value="approvals">
                  <Check className="w-4 h-4 mr-1" />
                  Approvals
                </TabsTrigger>
                <TabsTrigger value="timeline">
                  <History className="w-4 h-4 mr-1" />
                  Timeline
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[400px] mt-4">
                {/* Property Ledger - GREC Required */}
                <TabsContent value="ledger" className="m-0">
                  <div className="space-y-4">
                    {/* Financial Summary */}
                    <Card className="p-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Financial Summary (GREC Property Ledger)
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <p className="text-xs text-muted-foreground">Total Revenue</p>
                          <p className="font-bold text-green-600 text-lg">${totalRevenue.toFixed(2)}</p>
                        </div>
                        <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                          <p className="text-xs text-muted-foreground">Total Expenses</p>
                          <p className="font-bold text-red-600 text-lg">${totalExpenses.toFixed(2)}</p>
                        </div>
                        <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                          <p className="text-xs text-muted-foreground">Visit Fees</p>
                          <p className="font-bold text-orange-600 text-lg">${totalVisitFees.toFixed(2)}</p>
                        </div>
                        <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                          <p className="text-xs text-muted-foreground">Management Fee</p>
                          <p className="font-bold text-amber-600 text-lg">${(reconciliation.management_fee || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </Card>

                    {/* Itemized Transaction Ledger */}
                    <Card className="p-4">
                      <h4 className="font-semibold mb-3">Transaction Ledger</h4>
                      <div className="space-y-2">
                        {lineItems?.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-2 rounded border ${
                              item.verified && !item.excluded
                                ? "bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-800"
                                : item.excluded
                                ? "bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800 opacity-60"
                                : "bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800"
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {item.item_type}
                                </Badge>
                                <span className="font-medium text-sm">{item.description}</span>
                                {item.excluded && (
                                  <Badge variant="destructive" className="text-xs">Excluded</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(item.date + "T00:00:00"), "MMM dd, yyyy")}
                                {item.category && ` • ${item.category}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${item.amount < 0 ? "text-red-600" : "text-green-600"}`}>
                                {item.amount < 0 ? "-" : "+"}${Math.abs(item.amount).toFixed(2)}
                              </p>
                              {item.verified && !item.excluded ? (
                                <Check className="w-4 h-4 text-green-600 ml-auto" />
                              ) : item.excluded ? (
                                <X className="w-4 h-4 text-gray-400 ml-auto" />
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                </TabsContent>

                {/* Approvals Tab - GREC Required: Who approved what */}
                <TabsContent value="approvals" className="m-0">
                  <Card className="p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Approval Record (GREC Compliance)
                    </h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Complete record of who approved each line item and when - required for GREC audit compliance.
                    </p>
                    <div className="space-y-2">
                      {lineItems
                        ?.filter((item) => item.approved_by)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                          >
                            <div>
                              <p className="font-medium text-sm">{item.description}</p>
                              <p className="text-xs text-muted-foreground">
                                ${Math.abs(item.amount).toFixed(2)} • {item.category || item.item_type}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <User className="w-3 h-3 text-muted-foreground" />
                                <span className="text-sm font-medium">{item.approved_by_name}</span>
                              </div>
                              {item.approved_at && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(item.approved_at), "MMM dd, yyyy h:mm a")}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      {lineItems?.filter((item) => item.approved_by).length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          No approval records yet
                        </p>
                      )}
                    </div>

                    {/* Reconciliation-level approvals */}
                    <div className="mt-6 pt-4 border-t">
                      <h5 className="font-medium mb-3">Reconciliation Status History</h5>
                      <div className="space-y-2">
                        {reconciliation.reviewed_by && (
                          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-600">Reviewed</Badge>
                              <span className="text-sm">Reconciliation reviewed</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {reconciliation.reviewed_at && format(new Date(reconciliation.reviewed_at), "MMM dd, yyyy h:mm a")}
                            </p>
                          </div>
                        )}
                        {reconciliation.approved_by && (
                          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-green-600">Approved</Badge>
                              <span className="text-sm">Reconciliation approved for billing</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {reconciliation.approved_at && format(new Date(reconciliation.approved_at), "MMM dd, yyyy h:mm a")}
                            </p>
                          </div>
                        )}
                        {reconciliation.statement_sent_at && (
                          <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-purple-600">Sent</Badge>
                              <span className="text-sm">Statement sent to owner</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(reconciliation.statement_sent_at), "MMM dd, yyyy h:mm a")}
                            </p>
                          </div>
                        )}
                        {reconciliation.charged_at && (
                          <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-indigo-600">Charged</Badge>
                              <span className="text-sm">Owner payment processed</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(reconciliation.charged_at), "MMM dd, yyyy h:mm a")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                {/* Timeline Tab - Full Activity Log */}
                <TabsContent value="timeline" className="m-0">
                  <Card className="p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Complete Activity Timeline
                    </h4>
                    <div className="space-y-3">
                      {auditLogs?.map((log, index) => (
                        <div
                          key={log.id}
                          className="relative pl-6 pb-3 border-l-2 border-muted last:border-l-0"
                        >
                          <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-primary" />
                          <div className="flex items-start justify-between">
                            <div>
                              <Badge className={`${getActionBadgeColor(log.action)} mb-1`}>
                                {formatActionName(log.action)}
                              </Badge>
                              {log.notes && (
                                <p className="text-sm text-muted-foreground">{log.notes}</p>
                              )}
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              <p className="font-medium">{log.user_name}</p>
                              <p>{format(new Date(log.created_at), "MMM dd, h:mm a")}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!auditLogs || auditLogs.length === 0) && (
                        <p className="text-center text-muted-foreground py-8">
                          No activity recorded yet
                        </p>
                      )}
                    </div>
                  </Card>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
