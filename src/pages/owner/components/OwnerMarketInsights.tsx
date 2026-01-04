import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  MapPin, 
  Building2, 
  Calendar,
  Target,
  Sparkles,
  ExternalLink,
  ArrowUpRight,
  Lightbulb,
  CalendarDays
} from "lucide-react";

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

interface OwnerMarketInsightsProps {
  propertyName: string;
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
}

export function OwnerMarketInsights({
  propertyName,
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
}: OwnerMarketInsightsProps) {
  const trendColors = {
    rising: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30",
    stable: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
    declining: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
  };

  return (
    <div className="space-y-6">
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

      {/* Demand Drivers & Location Strengths */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Demand Drivers */}
        {demandDrivers.length > 0 && (
          <Card className="border-none shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-amber-600" />
                Upcoming Events Driving Demand
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {demandDrivers.map((driver, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-2 h-2 mt-2 rounded-full bg-amber-500 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{driver.event}</p>
                      <p className="text-xs text-muted-foreground">{driver.date}</p>
                      <p className="text-xs text-muted-foreground mt-1">{driver.impact}</p>
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
              <ul className="space-y-3">
                {strengthsForArea.map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                      <TrendingUp className="h-3 w-3 text-emerald-600" />
                    </div>
                    <p className="text-sm">{strength}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
