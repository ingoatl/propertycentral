import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Percent,
  Activity,
  Info,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";

interface Statement {
  id: string;
  reconciliation_month: string;
  total_revenue: number;
  total_expenses: number;
  net_to_owner: number;
  actual_net_earnings?: number; // Calculated correctly based on service type
  status: string;
  short_term_revenue?: number;
  mid_term_revenue?: number;
}

interface MonthlyRevenueData {
  month: string;
  str: number;
  mtr: number;
  total: number;
  expenses?: number;
  net?: number;
}

interface OwnerPerformanceChartsProps {
  statements: Statement[];
  monthlyRevenueData?: MonthlyRevenueData[];
  propertyName?: string;
}

type TimeFilter = "6m" | "12m" | "all";

export function OwnerPerformanceCharts({ statements, monthlyRevenueData, propertyName }: OwnerPerformanceChartsProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [showNetEarningsModal, setShowNetEarningsModal] = useState(false);
  const [showMoMModal, setShowMoMModal] = useState(false);
  const [showExpenseRatioModal, setShowExpenseRatioModal] = useState(false);

  // Prepare chart data - use enriched monthlyRevenueData if available, fall back to statements
  const revenueData = useMemo(() => {
    // Prefer enriched monthly revenue data (includes booking-calculated revenue for months without reconciliations)
    if (monthlyRevenueData && monthlyRevenueData.length > 0) {
      const sortedData = [...monthlyRevenueData].sort((a, b) => 
        new Date(a.month).getTime() - new Date(b.month).getTime()
      );

      let filteredData = sortedData;
      if (timeFilter === "6m") {
        filteredData = sortedData.slice(-6);
      } else if (timeFilter === "12m") {
        filteredData = sortedData.slice(-12);
      }

      return filteredData.map(d => ({
        month: format(new Date(d.month), "MMM yy"),
        fullMonth: format(new Date(d.month), "MMMM yyyy"),
        revenue: d.total || 0,
        expenses: typeof d.expenses === 'number' ? d.expenses : 0,
        net: typeof d.net === 'number' ? d.net : (d.total || 0),
      }));
    }

    // Fall back to statements data
    const sortedStatements = [...statements].sort((a, b) => 
      new Date(a.reconciliation_month).getTime() - new Date(b.reconciliation_month).getTime()
    );

    let filteredStatements = sortedStatements;
    if (timeFilter === "6m") {
      filteredStatements = sortedStatements.slice(-6);
    } else if (timeFilter === "12m") {
      filteredStatements = sortedStatements.slice(-12);
    }
    // "all" shows everything

    return filteredStatements.map(s => ({
      month: format(new Date(s.reconciliation_month), "MMM yy"),
      fullMonth: format(new Date(s.reconciliation_month), "MMMM yyyy"),
      revenue: s.total_revenue || 0,
      expenses: Math.abs(s.total_expenses || 0),
      net: s.actual_net_earnings ?? s.net_to_owner ?? 0,
    }));
  }, [statements, monthlyRevenueData, timeFilter]);

  // Calculate metrics from ALL data (not filtered)
  const metrics = useMemo(() => {
    if (statements.length === 0) return null;

    const totalRevenue = statements.reduce((sum, s) => sum + (s.total_revenue || 0), 0);
    const totalNet = statements.reduce((sum, s) => sum + (s.actual_net_earnings ?? s.net_to_owner ?? 0), 0);
    const totalExpenses = statements.reduce((sum, s) => sum + Math.abs(s.total_expenses || 0), 0);

    const avgMonthlyRevenue = totalRevenue / statements.length;
    const avgMonthlyNet = totalNet / statements.length;

    // Compare last month to previous month
    const sortedStatements = [...statements].sort((a, b) => 
      new Date(b.reconciliation_month).getTime() - new Date(a.reconciliation_month).getTime()
    );
    
    const thisMonth = sortedStatements[0];
    const lastMonth = sortedStatements[1];

    let growthRate = 0;
    if (lastMonth && lastMonth.total_revenue > 0) {
      growthRate = ((thisMonth.total_revenue - lastMonth.total_revenue) / lastMonth.total_revenue) * 100;
    }

    // Calculate expense ratio
    const expenseRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

    // Get sorted statements for detailed breakdown
    const recentStatements = sortedStatements.slice(0, 6).map(s => ({
      month: format(new Date(s.reconciliation_month), "MMMM yyyy"),
      revenue: s.total_revenue || 0,
      expenses: Math.abs(s.total_expenses || 0),
      net: s.actual_net_earnings ?? s.net_to_owner ?? 0,
      str: (s as any).short_term_revenue || 0,
      mtr: (s as any).mid_term_revenue || 0,
    }));

    // Calculate date range labels for clarity
    const oldestStatement = sortedStatements[sortedStatements.length - 1];
    const newestStatement = sortedStatements[0];
    
    const dateRangeLabel = oldestStatement && newestStatement
      ? `${format(new Date(oldestStatement.reconciliation_month), "MMM yyyy")} – ${format(new Date(newestStatement.reconciliation_month), "MMM yyyy")}`
      : "N/A";

    const thisMonthShort = thisMonth ? format(new Date(thisMonth.reconciliation_month), "MMM") : "";
    const lastMonthShort = lastMonth ? format(new Date(lastMonth.reconciliation_month), "MMM") : "";
    const momComparisonLabel = thisMonth && lastMonth
      ? `${thisMonthShort} vs ${lastMonthShort} ${format(new Date(thisMonth.reconciliation_month), "yyyy")}`
      : "N/A";

    return {
      totalRevenue,
      totalNet,
      totalExpenses,
      avgMonthlyRevenue,
      avgMonthlyNet,
      growthRate,
      expenseRatio,
      thisMonthRevenue: thisMonth?.total_revenue || 0,
      thisMonthNet: thisMonth?.actual_net_earnings ?? thisMonth?.net_to_owner ?? 0,
      thisMonthExpenses: Math.abs(thisMonth?.total_expenses || 0),
      lastMonthRevenue: lastMonth?.total_revenue || 0,
      lastMonthNet: lastMonth?.actual_net_earnings ?? lastMonth?.net_to_owner ?? 0,
      monthsOfData: statements.length,
      recentStatements,
      thisMonthLabel: thisMonth ? format(new Date(thisMonth.reconciliation_month), "MMMM yyyy") : "N/A",
      lastMonthLabel: lastMonth ? format(new Date(lastMonth.reconciliation_month), "MMMM yyyy") : "N/A",
      dateRangeLabel,
      momComparisonLabel,
    };
  }, [statements]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-2">{payload[0]?.payload?.fullMonth || label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <span className="font-mono font-medium">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!metrics || statements.length === 0) {
    return (
      <Card className="border-none shadow-lg">
        <CardContent className="py-12 text-center">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No performance data available yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Revenue Card */}
        <Card 
          className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-none shadow-lg dark:from-emerald-950/30 dark:to-emerald-900/20 cursor-pointer hover:shadow-xl transition-all group"
          onClick={() => setShowRevenueModal(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Revenue</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(metrics.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {metrics.dateRangeLabel}
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Earnings Card */}
        <Card 
          className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-none shadow-lg dark:from-blue-950/30 dark:to-blue-900/20 cursor-pointer hover:shadow-xl transition-all group"
          onClick={() => setShowNetEarningsModal(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Net Earnings</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(metrics.totalNet)}</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {metrics.dateRangeLabel} (after fees)
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Month-over-Month Card */}
        <Card 
          className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-none shadow-lg dark:from-purple-950/30 dark:to-purple-900/20 cursor-pointer hover:shadow-xl transition-all group"
          onClick={() => setShowMoMModal(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Month-over-Month</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className={`text-2xl font-bold ${metrics.growthRate >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {metrics.growthRate >= 0 ? "+" : ""}{metrics.growthRate.toFixed(1)}%
                  </p>
                  {metrics.growthRate >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {metrics.momComparisonLabel}
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expense Ratio Card */}
        <Card 
          className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-none shadow-lg dark:from-amber-950/30 dark:to-amber-900/20 cursor-pointer hover:shadow-xl transition-all group"
          onClick={() => setShowExpenseRatioModal(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Expense Ratio</p>
                <p className="text-2xl font-bold mt-1">{metrics.expenseRatio.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {metrics.dateRangeLabel} avg
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Percent className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card className="border-none shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              Revenue Trend
            </CardTitle>
            <div className="flex gap-1">
              <Button 
                variant={timeFilter === "6m" ? "secondary" : "ghost"} 
                size="sm"
                onClick={() => setTimeFilter("6m")}
              >
                6M
              </Button>
              <Button 
                variant={timeFilter === "12m" ? "secondary" : "ghost"} 
                size="sm"
                onClick={() => setTimeFilter("12m")}
              >
                12M
              </Button>
              <Button 
                variant={timeFilter === "all" ? "secondary" : "ghost"} 
                size="sm"
                onClick={() => setTimeFilter("all")}
              >
                All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  name="Net Earnings"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#netGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Comparison */}
      <Card className="border-none shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Monthly Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" name="Net" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Total Revenue Modal */}
      <Dialog open={showRevenueModal} onOpenChange={setShowRevenueModal}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              Total Revenue Breakdown
            </DialogTitle>
            <DialogDescription>
              All income from your property over {metrics.monthsOfData} months of statements
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-xl p-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">Total Revenue (All Time)</p>
                  <p className="text-4xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(metrics.totalRevenue)}</p>
                  <p className="text-sm text-muted-foreground mt-1">From {metrics.monthsOfData} monthly statements</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Average Monthly</p>
                    <p className="font-bold text-lg">{formatCurrency(metrics.avgMonthlyRevenue)}</p>
                  </div>
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Most Recent Month</p>
                    <p className="font-bold text-lg">{formatCurrency(metrics.thisMonthRevenue)}</p>
                  </div>
                </div>
              </div>

              {/* Recent Months Breakdown */}
              {metrics.recentStatements.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Recent Months
                  </h4>
                  <div className="space-y-2">
                    {metrics.recentStatements.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="font-medium">{s.month}</span>
                        <span className="font-mono font-semibold">{formatCurrency(s.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explanation */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                <h4 className="font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  How This is Calculated
                </h4>
                <p className="text-muted-foreground">
                  Total Revenue is the sum of all income from your property including:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                  <li>Short-term rental bookings (Airbnb, VRBO, direct bookings)</li>
                  <li>Mid-term rental income (monthly tenant payments)</li>
                  <li>Any other rental-related income</li>
                </ul>
                <p className="text-muted-foreground mt-2">
                  This is calculated from your monthly reconciliation statements, which are generated 
                  after each month closes with all bookings and adjustments finalized.
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Net Earnings Modal */}
      <Dialog open={showNetEarningsModal} onOpenChange={setShowNetEarningsModal}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              Net Earnings Breakdown
            </DialogTitle>
            <DialogDescription>
              Your actual profit after all expenses are deducted
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl p-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">Total Net Earnings</p>
                  <p className="text-4xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(metrics.totalNet)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Average Monthly Net</p>
                    <p className="font-bold text-lg">{formatCurrency(metrics.avgMonthlyNet)}</p>
                  </div>
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Most Recent Month</p>
                    <p className="font-bold text-lg">{formatCurrency(metrics.thisMonthNet)}</p>
                  </div>
                </div>
              </div>

              {/* Calculation Formula */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  The Calculation
                </h4>
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                        <span>Total Revenue</span>
                      </div>
                      <span className="font-mono font-semibold">{formatCurrency(metrics.totalRevenue)}</span>
                    </div>
                    <div className="flex items-center justify-between text-red-600">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        <span>Total Expenses</span>
                      </div>
                      <span className="font-mono font-semibold">- {formatCurrency(metrics.totalExpenses)}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between font-semibold text-lg">
                      <span>Net Earnings</span>
                      <span className="text-blue-600 font-mono">{formatCurrency(metrics.totalNet)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                <h4 className="font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  What's Included in Expenses
                </h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                  <li>Management fees (percentage of revenue)</li>
                  <li>Cleaning costs between guests</li>
                  <li>Maintenance and repairs</li>
                  <li>Supplies and restocking</li>
                  <li>Platform fees (Airbnb, VRBO service fees)</li>
                  <li>Any property-related purchases</li>
                </ul>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Month-over-Month Modal */}
      <Dialog open={showMoMModal} onOpenChange={setShowMoMModal}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                {metrics.growthRate >= 0 ? (
                  <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-red-600" />
                )}
              </div>
              Month-over-Month Growth
            </DialogTitle>
            <DialogDescription>
              How your revenue changed from the previous month
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 rounded-xl p-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">Revenue Change</p>
                  <p className={`text-5xl font-bold ${metrics.growthRate >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {metrics.growthRate >= 0 ? "+" : ""}{metrics.growthRate.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Comparison */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Month Comparison
                </h4>
                <div className="bg-muted/30 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Previous Month</p>
                      <p className="font-medium">{metrics.lastMonthLabel}</p>
                    </div>
                    <span className="font-mono font-semibold text-lg">{formatCurrency(metrics.lastMonthRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Most Recent Month</p>
                      <p className="font-medium">{metrics.thisMonthLabel}</p>
                    </div>
                    <span className="font-mono font-semibold text-lg">{formatCurrency(metrics.thisMonthRevenue)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Difference</span>
                    <span className={`font-mono font-semibold text-lg ${metrics.growthRate >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {metrics.growthRate >= 0 ? "+" : ""}{formatCurrency(metrics.thisMonthRevenue - metrics.lastMonthRevenue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                <h4 className="font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  How This is Calculated
                </h4>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Formula</p>
                  <p className="font-mono text-sm">
                    ((This Month - Last Month) ÷ Last Month) × 100
                  </p>
                </div>
                <p className="text-muted-foreground mt-2">
                  A positive percentage means your revenue grew compared to the previous month, 
                  while a negative percentage indicates a decrease. Seasonal fluctuations are 
                  normal for rental properties.
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Expense Ratio Modal */}
      <Dialog open={showExpenseRatioModal} onOpenChange={setShowExpenseRatioModal}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Percent className="h-5 w-5 text-amber-600" />
              </div>
              Expense Ratio Explained
            </DialogTitle>
            <DialogDescription>
              What percentage of your revenue goes to expenses
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 rounded-xl p-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">Expense Ratio</p>
                  <p className="text-5xl font-bold text-amber-700 dark:text-amber-400">{metrics.expenseRatio.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    For every $100 of revenue, {formatCurrency(metrics.expenseRatio)} goes to expenses
                  </p>
                </div>
                
                {/* Visual Bar */}
                <div className="mt-4">
                  <div className="h-6 bg-emerald-200/50 dark:bg-emerald-900/30 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-red-500/70 flex items-center justify-center text-xs font-medium text-white"
                      style={{ width: `${Math.min(100, metrics.expenseRatio)}%` }}
                    >
                      {metrics.expenseRatio.toFixed(0)}%
                    </div>
                    <div 
                      className="h-full bg-emerald-500/70 flex items-center justify-center text-xs font-medium text-white"
                      style={{ width: `${Math.max(0, 100 - metrics.expenseRatio)}%` }}
                    >
                      {(100 - metrics.expenseRatio).toFixed(0)}%
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Expenses</span>
                    <span>Net Earnings</span>
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  The Math
                </h4>
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Total Expenses</span>
                    <span className="font-mono">{formatCurrency(metrics.totalExpenses)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total Revenue</span>
                    <span className="font-mono">{formatCurrency(metrics.totalRevenue)}</span>
                  </div>
                  <Separator />
                  <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Expense Ratio = Expenses ÷ Revenue × 100</p>
                    <p className="font-mono">
                      {formatCurrency(metrics.totalExpenses)} ÷ {formatCurrency(metrics.totalRevenue)} × 100 = {metrics.expenseRatio.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Benchmarks */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                <h4 className="font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Industry Benchmarks
                </h4>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Excellent (well-optimized)</span>
                    <span className="font-semibold text-emerald-600">Under 25%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Good (typical range)</span>
                    <span className="font-semibold text-amber-600">25% - 40%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">High (review needed)</span>
                    <span className="font-semibold text-red-600">Over 40%</span>
                  </div>
                </div>
                <p className="text-muted-foreground mt-3">
                  Your expense ratio of {metrics.expenseRatio.toFixed(1)}% is {
                    metrics.expenseRatio < 25 ? "excellent - your property is running efficiently!" :
                    metrics.expenseRatio < 40 ? "in the typical range for professionally managed properties." :
                    "higher than average. We may want to review expenses together."
                  }
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
