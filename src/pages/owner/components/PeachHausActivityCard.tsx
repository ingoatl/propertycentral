import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Gauge, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  CheckCircle2, 
  AlertTriangle, 
  DollarSign,
  BarChart3,
  Target,
  Zap,
  Clock,
  Eye,
  MousePointer,
  Calendar,
} from "lucide-react";

interface ListingHealth {
  score: number;
  status: string;
  summary?: string;
}

interface PricingIntelligence {
  current_base_rate: number;
  recommended_rate: number;
  rate_change_percent: number;
  market_adr: number;
  mpi_7_day: number;
  mpi_30_day?: number;
  occupancy_rate: number;
  competitiveness_score: number;
}

interface Optimization {
  type: string;
  date: string;
  status?: string;
  description: string;
  expected_impact: string;
}

interface RevenueAlert {
  type: string;
  severity: string;
  title: string;
  description: string;
  action_taken?: string;
}

interface PerformanceTrends {
  booking_velocity_trend: string;
  ctr_trend: string;
  conversion_trend: string;
}

interface PeachHausActivityCardProps {
  listingHealth?: ListingHealth | null;
  pricingIntelligence?: PricingIntelligence | null;
  recentOptimizations?: Optimization[];
  revenueAlerts?: RevenueAlert[];
  performanceTrends?: PerformanceTrends | null;
  syncedAt?: string | null;
}

const TrendIcon = ({ trend }: { trend: string }) => {
  switch (trend) {
    case "up":
      return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    case "down":
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    default:
      return <Minus className="w-4 h-4 text-muted-foreground" />;
  }
};

const getTrendLabel = (trend: string) => {
  switch (trend) {
    case "up":
      return "Improving";
    case "down":
      return "Declining";
    default:
      return "Stable";
  }
};

export function PeachHausActivityCard({
  listingHealth,
  pricingIntelligence,
  recentOptimizations = [],
  revenueAlerts = [],
  performanceTrends,
  syncedAt,
}: PeachHausActivityCardProps) {
  const hasData = listingHealth || pricingIntelligence || recentOptimizations.length > 0 || revenueAlerts.length > 0;

  if (!hasData) {
    return (
      <Card className="border-none shadow-lg bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
        <CardContent className="p-6 text-center">
          <Gauge className="w-12 h-12 mx-auto mb-3 text-amber-500/50" />
          <p className="text-muted-foreground">PeachHaus optimization data will appear here once synced.</p>
        </CardContent>
      </Card>
    );
  }

  const getHealthColor = (status: string, score: number) => {
    if (status === "excellent" || status === "healthy" || score >= 80) {
      return { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200" };
    }
    if (status === "good" || score >= 60) {
      return { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200" };
    }
    if (status === "warning" || score >= 40) {
      return { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200" };
    }
    return { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", border: "border-red-200" };
  };

  return (
    <Card className="border-none shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-amber-600" />
              What PeachHaus Is Doing For Your Listing
            </CardTitle>
            <CardDescription className="mt-1">
              AI-powered optimizations running 24/7 to maximize your revenue
            </CardDescription>
          </div>
          {syncedAt && (
            <Badge variant="outline" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              Updated {new Date(syncedAt).toLocaleDateString()}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Health Score */}
          {listingHealth && (
            <div className={`p-4 rounded-xl text-center ${getHealthColor(listingHealth.status, listingHealth.score).bg}`}>
              <div className={`text-3xl font-bold ${getHealthColor(listingHealth.status, listingHealth.score).text}`}>
                {listingHealth.score}
              </div>
              <p className="text-xs font-medium mt-1">Health Score</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {listingHealth.score >= 80 ? "Excellent visibility" : 
                 listingHealth.score >= 60 ? "Good standing" : 
                 "Needs attention"}
              </p>
            </div>
          )}

          {/* Current Rate */}
          {pricingIntelligence && (
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <div className="text-xl font-bold text-foreground">
                ${pricingIntelligence.current_base_rate}
              </div>
              <p className="text-xs font-medium mt-1">Current Rate</p>
              {pricingIntelligence.recommended_rate !== pricingIntelligence.current_base_rate && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <span className="text-[10px] text-muted-foreground">→</span>
                  <span className="text-xs text-emerald-600 font-medium">${pricingIntelligence.recommended_rate}</span>
                </div>
              )}
            </div>
          )}

          {/* Market Performance Index */}
          {pricingIntelligence?.mpi_7_day && (
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <div className={`text-xl font-bold ${pricingIntelligence.mpi_7_day >= 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {pricingIntelligence.mpi_7_day.toFixed(2)}x
              </div>
              <p className="text-xs font-medium mt-1">Market Index</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {pricingIntelligence.mpi_7_day >= 1 ? "Beating market" : "Below market"}
              </p>
            </div>
          )}

          {/* Occupancy */}
          {pricingIntelligence?.occupancy_rate && (
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <div className="text-xl font-bold text-foreground">
                {Math.round(pricingIntelligence.occupancy_rate * 100)}%
              </div>
              <p className="text-xs font-medium mt-1">Occupancy</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Market: ${pricingIntelligence.market_adr}/night
              </p>
            </div>
          )}
        </div>

        {/* Performance Trends - Explained */}
        {performanceTrends && (
          <div className="bg-muted/20 rounded-xl p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <BarChart3 className="w-4 h-4 text-primary" />
              Performance Trends This Week
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center gap-1 p-3 bg-background rounded-lg">
                <TrendIcon trend={performanceTrends.booking_velocity_trend} />
                <span className="text-xs font-medium">Booking Speed</span>
                <span className="text-[10px] text-muted-foreground">
                  {getTrendLabel(performanceTrends.booking_velocity_trend)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 p-3 bg-background rounded-lg">
                <TrendIcon trend={performanceTrends.ctr_trend} />
                <span className="text-xs font-medium">Click Rate</span>
                <span className="text-[10px] text-muted-foreground">
                  {getTrendLabel(performanceTrends.ctr_trend)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 p-3 bg-background rounded-lg">
                <TrendIcon trend={performanceTrends.conversion_trend} />
                <span className="text-xs font-medium">Conversions</span>
                <span className="text-[10px] text-muted-foreground">
                  {getTrendLabel(performanceTrends.conversion_trend)}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              We continuously monitor these metrics and adjust your listing strategy accordingly
            </p>
          </div>
        )}

        {/* Active Optimizations - What we're actually doing */}
        {recentOptimizations.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Active Optimizations
            </h4>
            <div className="space-y-3">
              {recentOptimizations.slice(0, 4).map((opt, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{opt.description}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      <Zap className="w-3 h-3 inline mr-1" />
                      Expected impact: {opt.expected_impact}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{opt.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue Alerts - Opportunities we're acting on */}
        {revenueAlerts.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-600" />
              Revenue Opportunities We're Acting On
            </h4>
            <div className="space-y-2">
              {revenueAlerts.slice(0, 3).map((alert, idx) => (
                <div key={idx} className={`p-3 rounded-lg border ${
                  alert.severity === 'critical' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30' :
                  alert.severity === 'warning' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30' : 
                  'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30'
                }`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${
                      alert.severity === 'critical' ? 'text-red-500' :
                      alert.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                      {alert.action_taken && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {alert.action_taken}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What we monitor explanation */}
        <div className="bg-muted/20 rounded-xl p-4">
          <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
            <Eye className="w-4 h-4 text-primary" />
            What We Monitor Daily
          </h4>
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Listing Visibility</span>
                <p className="text-muted-foreground">Search ranking, photo quality, and content optimization</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Pricing Intelligence</span>
                <p className="text-muted-foreground">Competitor rates, demand signals, and optimal pricing</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Booking Velocity</span>
                <p className="text-muted-foreground">How quickly your dates are being booked vs market</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Gap Night Recovery</span>
                <p className="text-muted-foreground">Filling orphan nights between bookings</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}