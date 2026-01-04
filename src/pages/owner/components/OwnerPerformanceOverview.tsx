import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Users,
  Star,
  Percent,
  Building2
} from "lucide-react";

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

interface OwnerPerformanceOverviewProps {
  metrics: PerformanceMetrics;
  propertyName?: string;
}

export function OwnerPerformanceOverview({ metrics, propertyName }: OwnerPerformanceOverviewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const avgNightly = metrics.totalBookings > 0 && metrics.totalRevenue > 0
    ? Math.round(metrics.totalRevenue / (metrics.totalBookings * 3)) // Rough estimate
    : 0;

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

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold">Short-Term Rental Revenue</p>
                <p className="text-xs text-muted-foreground">Nightly bookings via Airbnb, VRBO, etc.</p>
              </div>
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
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-semibold">Mid-Term Rental Revenue</p>
                <p className="text-xs text-muted-foreground">Monthly stays (30+ nights)</p>
              </div>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
