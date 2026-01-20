import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, differenceInDays } from "date-fns";
import {
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  Building2,
  RefreshCw,
  ExternalLink,
  TrendingUp,
  FileText,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

interface VendorPaymentStats {
  totalVendors: number;
  connectedVendors: number;
  pendingInvites: number;
  notConnected: number;
  enrollmentRate: number;
}

interface PendingInvoice {
  workOrderId: string;
  workOrderRef: string;
  vendorId: string;
  vendorName: string;
  propertyName: string;
  quotedAmount: number;
  completedAt: string;
  daysSinceCompletion: number;
  billcomConnected: boolean;
}

const VendorPaymentDashboard = () => {
  // Fetch vendor stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["vendor-payment-stats"],
    queryFn: async () => {
      const { data: vendors, error } = await supabase
        .from("vendors")
        .select("id, billcom_vendor_id, billcom_invite_sent_at, status");

      if (error) throw error;

      const activeVendors = vendors?.filter(v => v.status === "active") || [];
      const totalVendors = activeVendors.length;
      const connectedVendors = activeVendors.filter(v => v.billcom_vendor_id).length;
      const pendingInvites = activeVendors.filter(v => !v.billcom_vendor_id && v.billcom_invite_sent_at).length;
      const notConnected = activeVendors.filter(v => !v.billcom_vendor_id && !v.billcom_invite_sent_at).length;

      return {
        totalVendors,
        connectedVendors,
        pendingInvites,
        notConnected,
        enrollmentRate: totalVendors > 0 ? Math.round((connectedVendors / totalVendors) * 100) : 0,
      } as VendorPaymentStats;
    },
  });

  // Fetch pending invoices (completed work orders without invoice)
  const { data: pendingInvoices = [], isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ["pending-vendor-invoices"],
    queryFn: async () => {
      const { data: workOrders, error } = await supabase
        .from("work_orders")
        .select(`
          id, title, quoted_cost, completed_at, status,
          property:properties(name),
          assigned_vendor:vendors!work_orders_assigned_vendor_id_fkey(id, name, billcom_vendor_id)
        `)
        .in("status", ["pending_verification", "completed"])
        .not("completed_at", "is", null)
        .not("assigned_vendor_id", "is", null)
        .order("completed_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return (workOrders || []).map(wo => {
        const vendor = wo.assigned_vendor as unknown as { id: string; name: string; billcom_vendor_id: string | null } | null;
        const property = wo.property as unknown as { name: string } | null;
        
        return {
          workOrderId: wo.id,
          workOrderRef: `WO-${wo.id.slice(0, 8).toUpperCase()}`,
          vendorId: vendor?.id || "",
          vendorName: vendor?.name || "Unknown",
          propertyName: property?.name || "Unknown Property",
          quotedAmount: wo.quoted_cost || 0,
          completedAt: wo.completed_at,
          daysSinceCompletion: differenceInDays(new Date(), new Date(wo.completed_at!)),
          billcomConnected: !!vendor?.billcom_vendor_id,
        } as PendingInvoice;
      });
    },
  });

  // Calculate invoice stats
  const totalPendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.quotedAmount, 0);
  const overdueInvoices = pendingInvoices.filter(inv => inv.daysSinceCompletion > 7);
  const recentInvoices = pendingInvoices.filter(inv => inv.daysSinceCompletion <= 7);

  const handleRefresh = async () => {
    await Promise.all([refetchStats(), refetchInvoices()]);
    toast.success("Dashboard refreshed");
  };

  const getStatusBadge = (invoice: PendingInvoice) => {
    if (!invoice.billcomConnected) {
      return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">Not on Bill.com</Badge>;
    }
    if (invoice.daysSinceCompletion > 14) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    if (invoice.daysSinceCompletion > 7) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Pending</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-100 text-green-800">Recent</Badge>;
  };

  const isLoading = statsLoading || invoicesLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Vendor Payments</h2>
          <p className="text-sm text-muted-foreground">Bill.com enrollment & invoice tracking</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Bill.com Enrollment Rate */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Enrollment Rate</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">{stats?.enrollmentRate || 0}%</span>
              </div>
              <Progress value={stats?.enrollmentRate || 0} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {stats?.connectedVendors || 0} of {stats?.totalVendors || 0} vendors
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pending Invoices */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending Invoices</span>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">{pendingInvoices.length}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ${totalPendingAmount.toLocaleString()} total
            </p>
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Overdue (7+ days)</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-amber-600">{overdueInvoices.length}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Need follow-up
            </p>
          </CardContent>
        </Card>

        {/* Not Connected */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Not Enrolled</span>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">{stats?.notConnected || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.pendingInvites || 0} pending invite
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Enrollment Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Bill.com Enrollment Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats?.connectedVendors || 0}</p>
                <p className="text-xs text-green-600 dark:text-green-500">Connected</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
              <Clock className="h-8 w-8 text-amber-600" />
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats?.pendingInvites || 0}</p>
                <p className="text-xs text-amber-600 dark:text-amber-500">Invite Pending</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
              <UserX className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.notConnected || 0}</p>
                <p className="text-xs text-muted-foreground">Not Invited</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invoices Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pending Invoices
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <a href="https://app.bill.com" target="_blank" rel="noopener noreferrer">
                Open Bill.com <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            {pendingInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                <p className="text-sm font-medium text-foreground">All caught up!</p>
                <p className="text-xs text-muted-foreground">No pending invoices</p>
              </div>
            ) : (
              <div className="divide-y">
                {pendingInvoices.map((invoice) => (
                  <div key={invoice.workOrderId} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-foreground">{invoice.vendorName}</span>
                          {getStatusBadge(invoice)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate">{invoice.propertyName}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="font-mono text-muted-foreground">{invoice.workOrderRef}</span>
                          <span className="text-muted-foreground">
                            Completed {format(new Date(invoice.completedAt), "MMM d")} ({invoice.daysSinceCompletion}d ago)
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-semibold text-foreground">
                          ${invoice.quotedAmount.toLocaleString()}
                        </p>
                        {!invoice.billcomConnected && (
                          <p className="text-[10px] text-amber-600 mt-1">Manual invoice</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorPaymentDashboard;
