import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertySummary } from "@/types";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Percent, Award } from "lucide-react";
import { PropertyMetricsCard } from "./PropertyMetricsCard";
import { RevenueBarChart } from "./RevenueBarChart";

interface OwnedPropertiesPerformanceProps {
  ownedProperties: PropertySummary[];
}

export const OwnedPropertiesPerformance = ({ ownedProperties }: OwnedPropertiesPerformanceProps) => {
  // Calculate aggregate metrics
  const totalRevenue = ownedProperties.reduce((sum, p) => sum + p.ownerrezRevenue, 0);
  const avgOccupancy = ownedProperties.length > 0
    ? ownedProperties.reduce((sum, p) => sum + p.occupancyRate, 0) / ownedProperties.length
    : 0;
  const totalBookings = ownedProperties.reduce((sum, p) => sum + p.bookingCount, 0);
  const avgRevPAR = ownedProperties.length > 0
    ? ownedProperties.reduce((sum, p) => sum + p.revPAR, 0) / ownedProperties.length
    : 0;
  
  // Calculate ADR (Average Daily Rate)
  const totalNights = ownedProperties.reduce((sum, p) => {
    return sum + (p.bookingCount > 0 ? p.ownerrezRevenue / (p.revPAR * 365) * p.occupancyRate / 100 * 365 : 0);
  }, 0);
  const avgADR = totalNights > 0 ? totalRevenue / totalNights : 0;

  // Find best performer
  const bestPerformer = ownedProperties.reduce((best, current) => 
    current.ownerrezRevenue > best.ownerrezRevenue ? current : best
  , ownedProperties[0] || { property: { name: "N/A" }, ownerrezRevenue: 0 });

  // Calculate month-over-month growth
  const thisMonthRevenue = ownedProperties.reduce((sum, p) => sum + (p.thisMonthRevenue || 0), 0);
  const lastMonthRevenue = ownedProperties.reduce((sum, p) => sum + (p.lastMonthRevenue || 0), 0);
  const growthRate = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-3xl font-bold mt-2">${totalRevenue.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-2">
                  {growthRate >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(growthRate).toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">vs last month</span>
                </div>
              </div>
              <div className="rounded-full bg-primary/20 p-3">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Occupancy</p>
                <p className="text-3xl font-bold mt-2">{avgOccupancy.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-2">Across {ownedProperties.length} properties</p>
              </div>
              <div className="rounded-full bg-primary/10 p-3">
                <Percent className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Bookings</p>
                <p className="text-3xl font-bold mt-2">{totalBookings}</p>
                <p className="text-xs text-muted-foreground mt-2">Active reservations</p>
              </div>
              <div className="rounded-full bg-primary/10 p-3">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Best Performer</p>
                <p className="text-lg font-bold mt-2 line-clamp-1">{bestPerformer.property.name}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  ${bestPerformer.ownerrezRevenue.toLocaleString()} revenue
                </p>
              </div>
              <div className="rounded-full bg-primary/10 p-3">
                <Award className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Average RevPAR</p>
            <p className="text-2xl font-bold mt-2">${avgRevPAR.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Revenue per available room</p>
          </CardContent>
        </Card>
        
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Average ADR</p>
            <p className="text-2xl font-bold mt-2">${avgADR.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Average daily rate</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">This Month</p>
            <p className="text-2xl font-bold mt-2">${thisMonthRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Current month revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <RevenueBarChart properties={ownedProperties} />

      {/* Property Performance Grid */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Individual Property Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ownedProperties.map((property) => (
              <PropertyMetricsCard key={property.property.id} property={property} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
