import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Percent,
  Activity,
} from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";

interface Statement {
  id: string;
  reconciliation_month: string;
  total_revenue: number;
  total_expenses: number;
  net_to_owner: number;
  status: string;
}

interface OwnerPerformanceChartsProps {
  statements: Statement[];
  propertyName?: string;
}

export function OwnerPerformanceCharts({ statements, propertyName }: OwnerPerformanceChartsProps) {
  // Prepare chart data - last 12 months
  const revenueData = useMemo(() => {
    const sortedStatements = [...statements].sort((a, b) => 
      new Date(a.reconciliation_month).getTime() - new Date(b.reconciliation_month).getTime()
    );

    return sortedStatements.slice(-12).map(s => ({
      month: format(new Date(s.reconciliation_month), "MMM"),
      fullMonth: format(new Date(s.reconciliation_month), "MMMM yyyy"),
      revenue: s.total_revenue || 0,
      expenses: Math.abs(s.total_expenses || 0),
      net: s.net_to_owner || 0,
    }));
  }, [statements]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (statements.length === 0) return null;

    const totalRevenue = statements.reduce((sum, s) => sum + (s.total_revenue || 0), 0);
    const totalNet = statements.reduce((sum, s) => sum + (s.net_to_owner || 0), 0);
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

    return {
      totalRevenue,
      totalNet,
      avgMonthlyRevenue,
      avgMonthlyNet,
      growthRate,
      expenseRatio,
      thisMonthRevenue: thisMonth?.total_revenue || 0,
      thisMonthNet: thisMonth?.net_to_owner || 0,
      lastMonthRevenue: lastMonth?.total_revenue || 0,
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
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-none shadow-lg dark:from-emerald-950/30 dark:to-emerald-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Avg Monthly Revenue</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(metrics.avgMonthlyRevenue)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-none shadow-lg dark:from-blue-950/30 dark:to-blue-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Avg Monthly Net</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(metrics.avgMonthlyNet)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-none shadow-lg dark:from-purple-950/30 dark:to-purple-900/20">
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
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-none shadow-lg dark:from-amber-950/30 dark:to-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Expense Ratio</p>
                <p className="text-2xl font-bold mt-1">{metrics.expenseRatio.toFixed(1)}%</p>
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
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Revenue Trend
          </CardTitle>
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
    </div>
  );
}
