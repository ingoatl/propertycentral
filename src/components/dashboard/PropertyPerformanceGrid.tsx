import { Card, CardContent } from "@/components/ui/card";
import { PropertySummary } from "@/types";
import { Building2, DollarSign, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PropertyPerformanceGridProps {
  properties: PropertySummary[];
  onPropertyClick: (property: PropertySummary) => void;
}

export const PropertyPerformanceGrid = ({ properties, onPropertyClick }: PropertyPerformanceGridProps) => {
  // Only show managed properties
  const managedProperties = properties.filter(p => p.isManaged);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {managedProperties.map((summary) => (
        <Card
          key={summary.property.id}
          className="cursor-pointer hover:shadow-card transition-all duration-300 border-border/50 hover:border-primary/50"
          onClick={() => onPropertyClick(summary)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm truncate">{summary.property.name}</h3>
              </div>
              {summary.isManaged && (
                <Badge variant="secondary" className="text-xs">Managed</Badge>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Revenue</span>
                <span className="text-sm font-semibold text-foreground">
                  ${summary.ownerrezRevenue.toLocaleString()}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Occupancy</span>
                <span className="text-sm font-medium text-foreground">
                  {summary.occupancyRate.toFixed(1)}%
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  RevPAR
                </span>
                <span className="text-sm font-medium text-foreground">
                  ${summary.revPAR.toFixed(0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
