import { Card, CardContent } from "@/components/ui/card";
import { PropertySummary } from "@/types";
import { TrendingUp, TrendingDown, Home } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PropertyMetricsCardProps {
  property: PropertySummary;
}

export const PropertyMetricsCard = ({ property }: PropertyMetricsCardProps) => {
  const growthRate = property.lastMonthRevenue > 0
    ? ((property.thisMonthRevenue - property.lastMonthRevenue) / property.lastMonthRevenue) * 100
    : 0;

  const totalNights = property.bookingCount > 0 
    ? (property.ownerrezRevenue / (property.revPAR || 1)) 
    : 0;
  const adr = totalNights > 0 ? property.ownerrezRevenue / totalNights : 0;

  return (
    <Card className="border-border/50 hover:shadow-lg transition-shadow duration-300">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Home className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm line-clamp-1">{property.property.name}</h4>
            <p className="text-xs text-muted-foreground line-clamp-1">{property.property.address}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Revenue */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Revenue</span>
              <span className="text-sm font-bold">${property.ownerrezRevenue.toLocaleString()}</span>
            </div>
            {growthRate !== 0 && (
              <div className="flex items-center gap-1">
                {growthRate >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span className={`text-xs font-medium ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(growthRate).toFixed(1)}% vs last month
                </span>
              </div>
            )}
          </div>

          {/* Occupancy */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Occupancy</span>
              <span className="text-sm font-bold">{property.occupancyRate.toFixed(1)}%</span>
            </div>
            <Progress value={property.occupancyRate} className="h-2" />
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
            <div>
              <p className="text-xs text-muted-foreground">Bookings</p>
              <p className="text-sm font-semibold mt-0.5">{property.bookingCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">RevPAR</p>
              <p className="text-sm font-semibold mt-0.5">${property.revPAR.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ADR</p>
              <p className="text-sm font-semibold mt-0.5">${adr.toFixed(0)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
