import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  MapPin, 
  Building2, 
  Calendar,
  Target,
  Sparkles,
  ArrowUpRight,
  Lightbulb,
  CalendarDays,
  Users,
  Briefcase,
  Shield,
  Plane,
  Home,
  Star,
  Megaphone,
  Trophy,
  Zap,
  BarChart3
} from "lucide-react";
import { UpcomingEventsTimeline } from "./UpcomingEventsTimeline";
import { CorporateHousingDemandCard } from "./CorporateHousingDemandCard";

interface ComparableProperty {
  name: string;
  area: string;
  distance: string;
  bedrooms: number;
  bathrooms: number;
  nightlyRate: number;
  occupancy: number;
  avgMonthly: number;
  platform: string;
}

interface MarketMetrics {
  areaOccupancy: number;
  avgNightlyRate: number;
  yoyGrowth: number;
  marketTrend: "rising" | "stable" | "declining";
}

interface FutureOpportunity {
  title: string;
  timeframe: string;
  description: string;
  potentialImpact: string;
}

interface DemandDriver {
  event: string;
  date: string;
  impact: string;
}

interface OwnerMarketInsightsEnhancedProps {
  propertyName: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyBeds: number;
  propertyBaths: number;
  currentNightlyRate?: number;
  currentOccupancy: number;
  avgMonthlyRevenue: number;
  comparables: ComparableProperty[];
  marketMetrics: MarketMetrics;
  opportunities: FutureOpportunity[];
  demandDrivers: DemandDriver[];
  strengthsForArea: string[];
  generatedAt: string;
  isLoading: boolean;
  loadingProgress: number;
  loadingStep: string;
  isSuperhost?: boolean;
  rentalType?: "hybrid" | "mid_term" | "long_term" | null;
}

// Memoize the entire component to prevent unnecessary re-renders
export const OwnerMarketInsightsEnhanced = memo(function OwnerMarketInsightsEnhanced({
  propertyName,
  propertyAddress,
  propertyCity,
  propertyBeds,
  propertyBaths,
  currentNightlyRate,
  currentOccupancy,
  avgMonthlyRevenue,
  comparables,
  marketMetrics,
  opportunities,
  demandDrivers,
  strengthsForArea,
  generatedAt,
  isLoading,
  loadingProgress,
  loadingStep,
  isSuperhost = false,
  rentalType = "hybrid",
}: OwnerMarketInsightsEnhancedProps) {
  const isMTROnly = rentalType === "mid_term";
  const isHybrid = rentalType === "hybrid" || !rentalType;
  
  const trendColors = {
    rising: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30",
    stable: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
    declining: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
  };

  // Loading state with smooth animated progress bar and engaging content
  if (isLoading) {
    // Tips to show during loading based on property type
    const loadingTips = isMTROnly ? [
      "💼 Corporate housing in Atlanta commands 20-30% premium over STR rates",
      "🏥 Metro Atlanta has 60+ hospitals hiring travel nurses year-round",
      "🏢 Fortune 500 HQs: Home Depot, Delta, Coca-Cola, UPS all relocate executives here",
      "📊 This report includes data from AirDNA, Furnished Finder & corporate housing databases",
    ] : [
      "⚽ FIFA World Cup 2026 games in Atlanta could drive 400%+ rate increases",
      "🎸 Mercedes-Benz Stadium hosts 70+ major events annually",
      "📊 This report aggregates data from AirDNA, PriceLabs & local market APIs",
      "🏆 SEC Championship & Peach Bowl drive massive December demand",
    ];
    
    const tipIndex = Math.floor((loadingProgress / 25)) % loadingTips.length;
    
    return (
      <div className="space-y-6">
        <Card className="border-none shadow-lg overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
          <CardContent className="py-16">
            <div className="max-w-xl mx-auto text-center space-y-6">
              {/* Animated icon container */}
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                </div>
              </div>
              
              {/* Header */}
              <div className="space-y-2">
                <h3 className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  Building Your Market Intelligence Report
                </h3>
                <p className="text-primary font-medium h-6 transition-all duration-700">{loadingStep}</p>
              </div>
              
              {/* Smooth progress bar */}
              <div className="space-y-2 px-4">
                <div className="relative h-3 bg-muted/50 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer" />
                  <div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary to-primary/80 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${loadingProgress}%` }}
                  >
                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-r from-transparent to-white/30 rounded-full" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground font-medium tabular-nums">
                  {loadingProgress}% complete
                </p>
              </div>
              
              {/* Value proposition during loading */}
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 text-left">
                <p className="text-sm text-muted-foreground mb-2 font-medium">
                  💡 Did you know?
                </p>
                <p className="text-sm text-foreground transition-all duration-500">
                  {loadingTips[tipIndex]}
                </p>
              </div>
              
              {/* What's being analyzed */}
              <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                <div className={`p-2 rounded-lg transition-all duration-500 ${loadingProgress >= 25 ? 'bg-primary/10 text-primary' : 'bg-muted/30'}`}>
                  <BarChart3 className="h-4 w-4 mx-auto mb-1" />
                  Revenue Data
                </div>
                <div className={`p-2 rounded-lg transition-all duration-500 ${loadingProgress >= 50 ? 'bg-primary/10 text-primary' : 'bg-muted/30'}`}>
                  <Building2 className="h-4 w-4 mx-auto mb-1" />
                  Comparables
                </div>
                <div className={`p-2 rounded-lg transition-all duration-500 ${loadingProgress >= 75 ? 'bg-primary/10 text-primary' : 'bg-muted/30'}`}>
                  <Calendar className="h-4 w-4 mx-auto mb-1" />
                  Events & Demand
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground italic">
                This comprehensive market analysis is included free with your PeachHaus management
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* How PeachHaus Maximizes Property Performance */}
      <Card className="border-none shadow-lg overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Megaphone className="h-5 w-5 text-primary" />
              How PeachHaus Maximizes Your Property Performance
            </CardTitle>
            <Badge variant="secondary" className="gap-1">
              <Zap className="h-3 w-3" />
              Active Management
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-background/80 rounded-xl border border-primary/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Star className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold">Multi-Channel Distribution</p>
                  <p className="text-xs text-muted-foreground">Maximum Exposure</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Listed on Airbnb, VRBO, Booking.com, and our direct booking site for maximum visibility.
              </p>
            </div>
            
            <div className="p-4 bg-background/80 rounded-xl border border-primary/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold">Dynamic Pricing</p>
                  <p className="text-xs text-muted-foreground">AI-Optimized Rates</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                We use PriceLabs to automatically adjust rates for events, seasons, and demand patterns.
              </p>
            </div>
            
            <div className="p-4 bg-background/80 rounded-xl border border-primary/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold">Corporate & Insurance</p>
                  <p className="text-xs text-muted-foreground">Premium Placements</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Partnerships with Fortune 500 companies and major insurers for guaranteed, longer-term stays.
              </p>
            </div>
            
            <div className="p-4 bg-background/80 rounded-xl border border-primary/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Users className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold">24/7 Guest Support</p>
                  <p className="text-xs text-muted-foreground">5-Star Service</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Professional guest communication and review management to maintain top ratings.
              </p>
            </div>
          </div>

          {/* Superhost Status - Only show if property has it */}
          {isSuperhost && (
            <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200/50 dark:border-amber-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-200">Superhost Status Achieved</p>
                  <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
                    Your property maintains Superhost status with priority search placement and enhanced visibility on Airbnb.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Diversification - Placement Types */}
      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5 text-purple-600" />
            Revenue Diversification Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Corporate Housing */}
            <div className="group p-4 bg-muted/30 rounded-xl border border-transparent hover:border-primary/20 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold">Corporate Housing</p>
                  <Badge variant="outline" className="text-xs">High Value</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Partner with Fortune 500 companies for executive relocations. Typical stays of 30-90+ days with premium rates.
              </p>
              <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <ArrowUpRight className="h-3 w-3" />
                20-30% higher than STR rates
              </div>
            </div>

            {/* Insurance Placements */}
            <div className="group p-4 bg-muted/30 rounded-xl border border-transparent hover:border-primary/20 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                  <Shield className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold">Insurance Placements</p>
                  <Badge variant="outline" className="text-xs">Steady Income</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Partner network with major insurance companies for families displaced by home damage. Guaranteed payments.
              </p>
              <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <ArrowUpRight className="h-3 w-3" />
                Fills gap periods reliably
              </div>
            </div>

            {/* Relocation Services */}
            <div className="group p-4 bg-muted/30 rounded-xl border border-transparent hover:border-primary/20 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                  <Plane className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold">Relocation Services</p>
                  <Badge variant="outline" className="text-xs">Growing Demand</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Partnerships with relocation companies and real estate agents for families moving to Atlanta. Typical 30-60 day stays.
              </p>
              <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <ArrowUpRight className="h-3 w-3" />
                Consistent MTR pipeline
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demand Timeline - Different for MTR vs Hybrid/STR */}
      {isMTROnly ? (
        <CorporateHousingDemandCard
          propertyCity={propertyCity}
          propertyAddress={propertyAddress}
        />
      ) : (
        demandDrivers.length > 0 && (
          <UpcomingEventsTimeline
            events={demandDrivers}
            propertyAddress={propertyAddress}
            propertyCity={propertyCity}
          />
        )
      )}

      {/* Comparable Properties */}
      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
              Comparable STR Properties in Your Area
            </CardTitle>
            <Badge variant="secondary" className="text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              AI Market Research
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Your Property Row */}
          <div className="mb-4 p-4 bg-primary/5 rounded-xl border-2 border-primary/20">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="font-semibold text-primary">{propertyName} (Your Property)</p>
                <p className="text-sm text-muted-foreground">
                  {propertyBeds} bed · {propertyBaths} bath
                </p>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <p className="font-semibold">${currentNightlyRate || "—"}</p>
                  <p className="text-xs text-muted-foreground">per night</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{currentOccupancy}%</p>
                  <p className="text-xs text-muted-foreground">occupancy</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${avgMonthlyRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">avg/mo</p>
                </div>
              </div>
            </div>
          </div>

          {/* Comparable Properties Table */}
          {comparables.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-muted-foreground">Property</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Beds</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Nightly</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Occupancy</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Avg Monthly</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Platform</th>
                  </tr>
                </thead>
                <tbody>
                  {comparables.map((comp, idx) => (
                    <tr key={idx} className="border-b border-muted/50">
                      <td className="py-3">
                        <p className="font-medium">{comp.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {comp.distance}
                        </p>
                      </td>
                      <td className="text-right py-3">{comp.bedrooms}/{comp.bathrooms}</td>
                      <td className="text-right py-3 font-mono">${comp.nightlyRate}</td>
                      <td className="text-right py-3">{comp.occupancy}%</td>
                      <td className="text-right py-3 font-mono">${comp.avgMonthly.toLocaleString()}</td>
                      <td className="text-right py-3">
                        <Badge variant="outline" className="text-xs">{comp.platform}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Market Metrics Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div className="text-center p-4 bg-muted/30 rounded-xl">
              <p className="text-2xl font-bold">{marketMetrics.areaOccupancy}%</p>
              <p className="text-xs text-muted-foreground">Area Occupancy</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-xl">
              <p className="text-2xl font-bold font-mono">${marketMetrics.avgNightlyRate}</p>
              <p className="text-xs text-muted-foreground">Avg Nightly Rate</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-xl">
              <p className="text-2xl font-bold text-emerald-600">+{marketMetrics.yoyGrowth}%</p>
              <p className="text-xs text-muted-foreground">YoY Revenue Growth</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-xl">
              <Badge className={trendColors[marketMetrics.marketTrend]}>
                {marketMetrics.marketTrend}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">Market Trend</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Future Opportunities */}
      {opportunities.length > 0 && (
        <Card className="border-none shadow-lg overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-purple-600" />
              Future Strategy & Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {opportunities.map((opp, idx) => (
                <div key={idx} className="p-4 bg-muted/30 rounded-xl border border-muted">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">{opp.title}</h4>
                    <Badge variant="outline" className="text-xs shrink-0">
                      <CalendarDays className="h-3 w-3 mr-1" />
                      {opp.timeframe}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{opp.description}</p>
                  <div className="flex items-center gap-1 text-xs text-emerald-600">
                    <ArrowUpRight className="h-3 w-3" />
                    {opp.potentialImpact}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Location Strengths */}
      {strengthsForArea.length > 0 && (
        <Card className="border-none shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-emerald-600" />
              Why Your Location is Strong
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {strengthsForArea.map((strength, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                    <TrendingUp className="h-3 w-3 text-emerald-600" />
                  </div>
                  <p className="text-sm">{strength}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
});
