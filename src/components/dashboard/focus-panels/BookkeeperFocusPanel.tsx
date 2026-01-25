import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calculator, Clock, FileCheck, AlertCircle, ArrowRight, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { differenceInDays, endOfMonth, format } from "date-fns";

interface BookkeeperFocusData {
  daysUntilMonthEnd: number;
  draftCount: number;
  pendingCount: number;
  approvedCount: number;
  totalProperties: number;
  unverifiedExpenses: number;
  recentReconciliations: Array<{
    id: string;
    propertyName: string;
    status: string;
    month: string;
  }>;
}

interface BookkeeperFocusPanelProps {
  userName: string;
}

export const BookkeeperFocusPanel = ({ userName }: BookkeeperFocusPanelProps) => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["bookkeeper-focus"],
    queryFn: async (): Promise<BookkeeperFocusData> => {
      const today = new Date();
      const monthEnd = endOfMonth(today);
      const daysUntilMonthEnd = differenceInDays(monthEnd, today);

      // Get reconciliations for current month
      const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      // Get reconciliations for current month - simplified query to avoid type depth issues
      const { data: reconciliations } = await supabase
        .from("monthly_reconciliations")
        .select("id, status, reconciliation_month, property_id")
        .gte("reconciliation_month", currentMonthStart.toISOString().split('T')[0])
        .order("reconciliation_month", { ascending: false });

      // Count unverified expenses
      const { count: unverifiedExpenses } = await supabase
        .from("expense_verifications")
        .select("id", { count: "exact" })
        .eq("verification_status", "pending");

      // Get total managed properties count
      const { count: totalProperties } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true });

      const draftCount = reconciliations?.filter((r: any) => r.status === "draft").length || 0;
      const pendingCount = reconciliations?.filter((r: any) => r.status === "pending").length || 0;
      const approvedCount = reconciliations?.filter((r: any) => r.status === "approved").length || 0;

      const recentReconciliations = (reconciliations || []).slice(0, 5).map((r: any) => ({
        id: r.id,
        propertyName: `Property ${r.property_id?.slice(0, 8) || "Unknown"}`,
        status: r.status,
        month: r.reconciliation_month,
      }));

      return {
        daysUntilMonthEnd,
        draftCount,
        pendingCount,
        approvedCount,
        totalProperties: totalProperties || 0,
        unverifiedExpenses: unverifiedExpenses || 0,
        recentReconciliations,
      };
    },
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const completedCount = data.approvedCount;
  const totalNeeded = data.totalProperties;
  const progressPercent = totalNeeded > 0 ? Math.round((completedCount / totalNeeded) * 100) : 0;

  const getUrgencyColor = () => {
    if (data.daysUntilMonthEnd <= 3) return "text-red-600 bg-red-100 dark:bg-red-900/30";
    if (data.daysUntilMonthEnd <= 7) return "text-orange-600 bg-orange-100 dark:bg-orange-900/30";
    return "text-green-600 bg-green-100 dark:bg-green-900/30";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">Draft</Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Approved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 via-background to-background dark:from-purple-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
          <Calculator className="h-5 w-5" />
          Month-End Reconciliations
          <Badge variant="outline" className={`ml-auto ${getUrgencyColor()}`}>
            <Clock className="h-3 w-3 mr-1" />
            {data.daysUntilMonthEnd} days left
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{completedCount}/{totalNeeded} properties</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                Draft: {data.draftCount}
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                Pending: {data.pendingCount}
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Approved: {data.approvedCount}
              </span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="flex gap-3">
            {data.unverifiedExpenses > 0 && (
              <div className="flex-1 p-3 rounded-lg bg-orange-100/50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <span className="text-xs text-muted-foreground">Unverified</span>
                </div>
                <p className="text-xl font-bold text-orange-700 dark:text-orange-300">{data.unverifiedExpenses}</p>
              </div>
            )}
            <div className="flex-1 p-3 rounded-lg bg-purple-100/50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-muted-foreground">Due</span>
              </div>
              <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{format(endOfMonth(new Date()), "MMM d")}</p>
            </div>
          </div>
        </div>

        {/* Properties Needing Attention */}
        {data.recentReconciliations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Properties Needing Attention
            </h4>
            <div className="space-y-1.5">
              {data.recentReconciliations
                .filter(r => r.status !== "approved")
                .slice(0, 3)
                .map((reconciliation) => (
                  <div 
                    key={reconciliation.id} 
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => navigate("/charges?tab=reconciliations")}
                  >
                    <span className="text-sm truncate max-w-[200px]">{reconciliation.propertyName}</span>
                    {getStatusBadge(reconciliation.status)}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <Button 
          className="w-full" 
          variant="outline"
          onClick={() => navigate("/charges?tab=reconciliations")}
        >
          Go to Reconciliations
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
};
