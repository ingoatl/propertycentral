import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  Calendar,
  DollarSign,
  Home,
  BarChart3,
  Target
} from "lucide-react";
import { format } from "date-fns";

interface Statement {
  id: string;
  reconciliation_month: string;
  total_revenue: number;
  total_expenses: number;
  net_to_owner: number;
  actual_net_earnings?: number;
  status: string;
  short_term_revenue?: number;
  mid_term_revenue?: number;
}

interface OwnerYTDPerformanceProps {
  statements: Statement[];
  occupancyRate?: number;
  totalBookings?: number;
  isCohosting?: boolean;
}

export function OwnerYTDPerformance({ 
  statements, 
  occupancyRate = 0,
  totalBookings = 0,
  isCohosting = false
}: OwnerYTDPerformanceProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate YTD metrics
  const ytdMetrics = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    // Filter statements for current year
    const ytdStatements = statements.filter(s => {
      const statementDate = new Date(s.reconciliation_month);
      return statementDate.getFullYear() === currentYear;
    });
    
    // Calculate totals
    const ytdRevenue = ytdStatements.reduce((sum, s) => sum + (s.total_revenue || 0), 0);
    const ytdExpenses = ytdStatements.reduce((sum, s) => sum + Math.abs(s.total_expenses || 0), 0);
    const ytdNet = ytdStatements.reduce((sum, s) => {
      const net = isCohosting 
        ? (s.total_revenue || 0) - (s.net_to_owner || 0)
        : (s.net_to_owner || 0);
      return sum + net;
    }, 0);
    
    // Calculate average monthly
    const monthsWithData = ytdStatements.length || 1;
    const avgMonthlyRevenue = ytdRevenue / monthsWithData;
    const avgMonthlyNet = ytdNet / monthsWithData;
    
    // Project full year based on current average
    const remainingMonths = 12 - (currentMonth + 1);
    const projectedYearEnd = ytdRevenue + (avgMonthlyRevenue * remainingMonths);
    
    // Calculate progress through year
    const yearProgress = ((currentMonth + 1) / 12) * 100;
    
    return {
      ytdRevenue,
      ytdExpenses,
      ytdNet,
      avgMonthlyRevenue,
      avgMonthlyNet,
      monthsWithData,
      projectedYearEnd,
      yearProgress,
      currentYear,
    };
  }, [statements, isCohosting]);

  return (
    <Card className="border-none shadow-lg bg-gradient-to-br from-indigo-50/80 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
            </div>
            {ytdMetrics.currentYear} Year-to-Date
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {ytdMetrics.monthsWithData} month{ytdMetrics.monthsWithData !== 1 ? 's' : ''} of data
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Year progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Year Progress</span>
            <span>{ytdMetrics.yearProgress.toFixed(0)}% complete</span>
          </div>
          <Progress value={ytdMetrics.yearProgress} className="h-2" />
        </div>

        {/* Key YTD stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3 w-3" />
              YTD Revenue
            </div>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {formatCurrency(ytdMetrics.ytdRevenue)}
            </p>
          </div>

          <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3 w-3" />
              YTD Net
            </div>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(ytdMetrics.ytdNet)}
            </p>
          </div>

          <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Calendar className="h-3 w-3" />
              Avg Monthly
            </div>
            <p className="text-lg font-bold">
              {formatCurrency(ytdMetrics.avgMonthlyRevenue)}
            </p>
          </div>

          <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Home className="h-3 w-3" />
              Occupancy
            </div>
            <p className="text-lg font-bold">
              {occupancyRate}%
            </p>
          </div>
        </div>

        {/* Projection */}
        {ytdMetrics.monthsWithData >= 3 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 rounded-lg p-3 border border-amber-200/50 dark:border-amber-800/30">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs mb-1">
              <Target className="h-3 w-3" />
              Projected Year-End Revenue
            </div>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
              {formatCurrency(ytdMetrics.projectedYearEnd)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Based on current monthly average
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
