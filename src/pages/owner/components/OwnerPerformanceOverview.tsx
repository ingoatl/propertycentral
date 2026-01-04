import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Users,
  Star,
  Percent,
  Building2,
  Info,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";

interface PerformanceMetrics {
  totalRevenue: number;
  strRevenue: number;
  mtrRevenue: number;
  totalBookings: number;
  strBookings: number;
  mtrBookings: number;
  occupancyRate: number;
  averageRating: number | null;
  reviewCount: number;
}

interface MtrBreakdownItem {
  month: string;
  tenant: string;
  amount: number;
  source: string;
  days?: number;
}

interface StrBreakdownItem {
  guest: string;
  checkIn: string;
  checkOut: string;
  amount: number;
  source: string;
}

interface RevenueBreakdown {
  mtr: MtrBreakdownItem[];
  str: StrBreakdownItem[];
  summary: {
    mtrFromStatements: number;
    mtrFromFutureBookings: number;
    strFromReconciliation: number;
    strFromBookings: number;
  };
}

interface OwnerPerformanceOverviewProps {
  metrics: PerformanceMetrics;
  propertyName?: string;
  revenueBreakdown?: RevenueBreakdown;
}

export function OwnerPerformanceOverview({ metrics, propertyName, revenueBreakdown }: OwnerPerformanceOverviewProps) {
  const [showMtrModal, setShowMtrModal] = useState(false);
  const [showStrModal, setShowStrModal] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyDetailed = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatMonth = (monthStr: string) => {
    try {
      const [year, month] = monthStr.split('-');
      return format(new Date(parseInt(year), parseInt(month) - 1, 1), 'MMMM yyyy');
    } catch {
      return monthStr;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-none shadow-lg dark:from-emerald-950/30 dark:to-emerald-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Revenue</p>
                <p className="text-3xl font-bold tracking-tight mt-1">
                  {formatCurrency(metrics.totalRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">All-time earnings</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-none shadow-lg dark:from-blue-950/30 dark:to-blue-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Occupancy Rate</p>
                <p className="text-3xl font-bold tracking-tight mt-1">
                  {metrics.occupancyRate}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">This year</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Percent className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-none shadow-lg dark:from-purple-950/30 dark:to-purple-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Bookings</p>
                <p className="text-3xl font-bold tracking-tight mt-1">
                  {metrics.totalBookings}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.strBookings} STR · {metrics.mtrBookings} MTR
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-none shadow-lg dark:from-amber-950/30 dark:to-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Guest Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                  <p className="text-3xl font-bold tracking-tight">
                    {metrics.averageRating?.toFixed(1) || "—"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.reviewCount} review{metrics.reviewCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Star className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown - Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card 
          className="border-none shadow-lg cursor-pointer hover:shadow-xl transition-shadow group"
          onClick={() => setShowStrModal(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Short-Term Rental Revenue</p>
                <p className="text-xs text-muted-foreground">Nightly bookings via Airbnb, VRBO, etc.</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total STR Revenue</span>
                <span className="font-semibold font-mono">{formatCurrency(metrics.strRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">STR Bookings</span>
                <span className="font-semibold">{metrics.strBookings}</span>
              </div>
              {metrics.strBookings > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg per Booking</span>
                  <span className="font-semibold font-mono">
                    {formatCurrency(metrics.strRevenue / metrics.strBookings)}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" /> Click for detailed breakdown
              </p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border-none shadow-lg cursor-pointer hover:shadow-xl transition-shadow group"
          onClick={() => setShowMtrModal(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Mid-Term Rental Revenue</p>
                <p className="text-xs text-muted-foreground">Monthly stays (30+ nights)</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total MTR Revenue</span>
                <span className="font-semibold font-mono">{formatCurrency(metrics.mtrRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">MTR Bookings</span>
                <span className="font-semibold">{metrics.mtrBookings}</span>
              </div>
              {metrics.mtrBookings > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Monthly Rate</span>
                  <span className="font-semibold font-mono">
                    {formatCurrency(metrics.mtrRevenue / metrics.mtrBookings)}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" /> Click for detailed breakdown
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MTR Revenue Breakdown Modal */}
      <Dialog open={showMtrModal} onOpenChange={setShowMtrModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              Mid-Term Rental Revenue Breakdown
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm">How MTR Revenue is Calculated</h4>
                <p className="text-sm text-muted-foreground">
                  MTR revenue is calculated from monthly statements (after any manual adjustments) plus projected future bookings.
                </p>
                {revenueBreakdown?.summary && (
                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-800">
                    <div>
                      <p className="text-xs text-muted-foreground">From Statements</p>
                      <p className="font-semibold">{formatCurrencyDetailed(revenueBreakdown.summary.mtrFromStatements)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">From Future Bookings</p>
                      <p className="font-semibold">{formatCurrencyDetailed(revenueBreakdown.summary.mtrFromFutureBookings)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Detailed Breakdown */}
              {revenueBreakdown?.mtr && revenueBreakdown.mtr.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Monthly Breakdown</h4>
                  <div className="space-y-2">
                    {revenueBreakdown.mtr.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{formatMonth(item.month)}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.tenant}
                            {item.days && ` • ${item.days} days`}
                          </p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {item.source === 'statement' ? 'From Statement' : 'Projected'}
                          </Badge>
                        </div>
                        <p className="font-semibold font-mono text-lg">{formatCurrencyDetailed(item.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No MTR revenue data available</p>
              )}

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total MTR Revenue</span>
                  <span className="font-bold text-xl font-mono">{formatCurrency(metrics.mtrRevenue)}</span>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* STR Revenue Breakdown Modal */}
      <Dialog open={showStrModal} onOpenChange={setShowStrModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-orange-600" />
              Short-Term Rental Revenue Breakdown
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm">How STR Revenue is Calculated</h4>
                <p className="text-sm text-muted-foreground">
                  STR revenue is aggregated from your monthly owner statements. Each booking's total amount includes the nightly rate and any fees collected.
                </p>
                {revenueBreakdown?.summary && (
                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-orange-200 dark:border-orange-800">
                    <div>
                      <p className="text-xs text-muted-foreground">From Statements</p>
                      <p className="font-semibold">{formatCurrencyDetailed(revenueBreakdown.summary.strFromReconciliation)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Booking Total</p>
                      <p className="font-semibold">{formatCurrencyDetailed(revenueBreakdown.summary.strFromBookings)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Detailed Breakdown */}
              {revenueBreakdown?.str && revenueBreakdown.str.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Booking Details ({revenueBreakdown.str.length} bookings)</h4>
                  <div className="space-y-2">
                    {revenueBreakdown.str.slice(0, 20).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{item.guest}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(item.checkIn)} - {formatDate(item.checkOut)}
                          </p>
                        </div>
                        <p className="font-semibold font-mono">{formatCurrencyDetailed(item.amount)}</p>
                      </div>
                    ))}
                    {revenueBreakdown.str.length > 20 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        + {revenueBreakdown.str.length - 20} more bookings
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No STR revenue data available</p>
              )}

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total STR Revenue</span>
                  <span className="font-bold text-xl font-mono">{formatCurrency(metrics.strRevenue)}</span>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}