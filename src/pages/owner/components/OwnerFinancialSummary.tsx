import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  DollarSign, 
  TrendingUp, 
  Receipt,
  ArrowRight,
  Building2,
  Calendar,
  Percent,
  CheckCircle2,
  AlertCircle
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

interface OwnerFinancialSummaryProps {
  statements: Statement[];
  isCohosting?: boolean;
  managementFeePercentage?: number;
  propertyName?: string;
}

export function OwnerFinancialSummary({ 
  statements, 
  isCohosting = false,
  managementFeePercentage = 18,
  propertyName
}: OwnerFinancialSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Get current month data
  const currentMonthData = useMemo(() => {
    if (statements.length === 0) return null;
    
    // Sort by date descending and get most recent
    const sorted = [...statements].sort((a, b) => 
      new Date(b.reconciliation_month).getTime() - new Date(a.reconciliation_month).getTime()
    );
    
    const latest = sorted[0];
    const previous = sorted[1];
    
    // Calculate management fee
    const grossRevenue = (latest.short_term_revenue || 0) + (latest.mid_term_revenue || 0) + (latest.total_revenue || 0);
    const managementFee = grossRevenue * (managementFeePercentage / 100);
    
    // Calculate net - different logic for co-hosting vs full-service
    const netToOwner = isCohosting 
      ? (latest.total_revenue || 0) - (latest.net_to_owner || 0) // Co-hosting: revenue minus what they owe
      : (latest.net_to_owner || 0); // Full-service: net_to_owner is what they receive
    
    // Calculate MoM change if we have previous month
    let momChange = 0;
    let momPercentage = 0;
    if (previous) {
      const previousNet = isCohosting 
        ? (previous.total_revenue || 0) - (previous.net_to_owner || 0)
        : (previous.net_to_owner || 0);
      momChange = netToOwner - previousNet;
      momPercentage = previousNet !== 0 ? ((momChange / Math.abs(previousNet)) * 100) : 0;
    }
    
    return {
      month: latest.reconciliation_month,
      monthLabel: format(new Date(latest.reconciliation_month), "MMMM yyyy"),
      grossRevenue: latest.total_revenue || 0,
      strRevenue: latest.short_term_revenue || 0,
      mtrRevenue: latest.mid_term_revenue || 0,
      expenses: Math.abs(latest.total_expenses || 0),
      managementFee,
      netToOwner,
      status: latest.status,
      momChange,
      momPercentage,
      hasPreviousMonth: !!previous,
    };
  }, [statements, isCohosting, managementFeePercentage]);

  if (!currentMonthData) {
    return (
      <Card className="border-none shadow-lg bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-950/30 dark:to-slate-900/20">
        <CardContent className="py-8 text-center">
          <Receipt className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No financial data available yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-xl bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-950/80 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            This Month at a Glance
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant={currentMonthData.status === 'approved' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {currentMonthData.status === 'approved' ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" />Finalized</>
              ) : (
                <><AlertCircle className="h-3 w-3 mr-1" />Pending</>
              )}
            </Badge>
            <span className="text-sm font-medium text-muted-foreground">
              {currentMonthData.monthLabel}
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Gross Revenue */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-muted-foreground">Gross Revenue</span>
            </div>
            <span className="font-mono font-semibold text-emerald-600">
              {formatCurrency(currentMonthData.grossRevenue)}
            </span>
          </div>

          {/* Revenue breakdown */}
          {(currentMonthData.strRevenue > 0 || currentMonthData.mtrRevenue > 0) && (
            <div className="pl-5 space-y-2 border-l-2 border-muted ml-1">
              {currentMonthData.strRevenue > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-3 w-3" />
                    Short-term rentals
                  </span>
                  <span className="font-mono">{formatCurrency(currentMonthData.strRevenue)}</span>
                </div>
              )}
              {currentMonthData.mtrRevenue > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    Mid-term rentals
                  </span>
                  <span className="font-mono">{formatCurrency(currentMonthData.mtrRevenue)}</span>
                </div>
              )}
            </div>
          )}

          <Separator className="my-2" />

          {/* Deductions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm text-muted-foreground">Expenses</span>
            </div>
            <span className="font-mono font-medium text-red-600">
              -{formatCurrency(currentMonthData.expenses)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                Management Fee
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {managementFeePercentage}%
                </Badge>
              </span>
            </div>
            <span className="font-mono font-medium text-amber-600">
              -{formatCurrency(currentMonthData.managementFee)}
            </span>
          </div>

          <Separator className="my-2" />

          {/* Net to Owner */}
          <div className="flex items-center justify-between bg-primary/5 dark:bg-primary/10 rounded-lg p-3 -mx-1">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-semibold">Net to You</span>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-xl text-primary">
                {formatCurrency(currentMonthData.netToOwner)}
              </span>
              {currentMonthData.hasPreviousMonth && (
                <div className={`text-xs flex items-center justify-end gap-1 mt-0.5 ${
                  currentMonthData.momChange >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {currentMonthData.momChange >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <ArrowRight className="h-3 w-3 rotate-45" />
                  )}
                  {currentMonthData.momChange >= 0 ? '+' : ''}
                  {formatCurrency(currentMonthData.momChange)}
                  <span className="text-muted-foreground">
                    ({currentMonthData.momPercentage >= 0 ? '+' : ''}{currentMonthData.momPercentage.toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
