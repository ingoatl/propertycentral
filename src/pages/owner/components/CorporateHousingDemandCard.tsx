import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Briefcase, 
  Shield, 
  Plane, 
  Heart,
  Building2,
  Calendar,
  TrendingUp,
  Users,
  Clock,
  Sparkles
} from "lucide-react";
import { format, addMonths } from "date-fns";

interface CorporateHousingDemandCardProps {
  propertyCity?: string;
  propertyAddress?: string;
}

// Corporate housing demand cycles - these are consistent patterns
const getDemandCycles = (city: string = "Atlanta") => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Calculate next occurrence of each cycle
  const cycles = [
    {
      id: "corporate-relocations",
      title: "Corporate Relocation Season",
      icon: Briefcase,
      gradientFrom: "from-blue-500",
      gradientTo: "to-indigo-600",
      description: "Fortune 500 companies relocating executives and teams. Peak hiring and transfer season.",
      timing: "January - March & August - October",
      typicalStay: "30-90 days",
      demand: "High",
      nextPeak: getNextPeakDate([0, 1, 2, 7, 8, 9], now), // Jan-Mar, Aug-Oct
      drivers: [
        `Major employers in ${city} area`,
        "New job starts and transfers",
        "Project-based assignments"
      ]
    },
    {
      id: "insurance-placements",
      title: "Insurance Displacement Housing",
      icon: Shield,
      gradientFrom: "from-amber-500",
      gradientTo: "to-orange-600",
      description: "Families displaced by home damage from storms, fires, or renovations. Guaranteed payments from insurers.",
      timing: "Year-round (peaks: storm seasons)",
      typicalStay: "2-6 months",
      demand: "Steady",
      nextPeak: getNextPeakDate([5, 6, 7, 8], now), // Summer storm season
      drivers: [
        "Home repairs and renovations",
        "Storm damage displacement",
        "Fire and water damage claims"
      ]
    },
    {
      id: "healthcare-travelers",
      title: "Healthcare Traveler Contracts",
      icon: Heart,
      gradientFrom: "from-rose-500",
      gradientTo: "to-pink-600",
      description: "Travel nurses, physicians, and medical professionals on 13-week contracts at local hospitals.",
      timing: "Quarterly contract cycles",
      typicalStay: "13 weeks (standard)",
      demand: "High",
      nextPeak: getNextQuarterStart(now),
      drivers: [
        `${city} area hospital systems`,
        "Seasonal healthcare demand",
        "Specialty medical rotations"
      ]
    },
    {
      id: "relocation-services",
      title: "Relocation & Real Estate Clients",
      icon: Plane,
      gradientFrom: "from-emerald-500",
      gradientTo: "to-teal-600",
      description: "Families moving to the area, searching for permanent housing. Referred by relocation companies and realtors.",
      timing: "Spring & Summer (school transitions)",
      typicalStay: "30-60 days",
      demand: "High",
      nextPeak: getNextPeakDate([3, 4, 5, 6], now), // Apr-Jul
      drivers: [
        "School year transitions",
        "New home closings",
        "Job relocations"
      ]
    },
    {
      id: "project-contractors",
      title: "Project Contractors & Consultants",
      icon: Building2,
      gradientFrom: "from-slate-500",
      gradientTo: "to-gray-600",
      description: "Business consultants, contractors, and project teams on extended assignments in the area.",
      timing: "Year-round",
      typicalStay: "1-3 months",
      demand: "Steady",
      nextPeak: addMonths(now, 1),
      drivers: [
        "Construction projects",
        "Corporate consulting",
        "Government contracts"
      ]
    }
  ];

  return cycles;
};

function getNextPeakDate(peakMonths: number[], now: Date): Date {
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Find the next peak month
  for (const month of peakMonths) {
    if (month > currentMonth) {
      return new Date(currentYear, month, 15);
    }
  }
  // Wrap to next year
  return new Date(currentYear + 1, peakMonths[0], 15);
}

function getNextQuarterStart(now: Date): Date {
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const quarterStarts = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct
  
  for (const month of quarterStarts) {
    if (month > currentMonth) {
      return new Date(currentYear, month, 1);
    }
  }
  return new Date(currentYear + 1, 0, 1);
}

const DemandCycleCard = memo(({ cycle }: { cycle: ReturnType<typeof getDemandCycles>[0] }) => {
  const IconComponent = cycle.icon;
  const daysUntilPeak = Math.ceil((cycle.nextPeak.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  
  const demandBadge = cycle.demand === "High" 
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";

  return (
    <div className="group relative bg-card border rounded-xl p-5 hover:shadow-lg transition-all duration-300 hover:border-primary/30">
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${cycle.gradientFrom} ${cycle.gradientTo} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <IconComponent className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
            {cycle.title}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {cycle.typicalStay}
            </Badge>
            <Badge className={`text-xs ${demandBadge}`}>
              {cycle.demand} Demand
            </Badge>
          </div>
        </div>
      </div>
      
      {/* Description */}
      <p className="text-sm text-muted-foreground mb-4">
        {cycle.description}
      </p>
      
      {/* Timing */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <Calendar className="h-4 w-4 text-primary" />
        <span className="font-medium">{cycle.timing}</span>
      </div>
      
      {/* Next Peak */}
      <div className="p-3 bg-muted/30 rounded-lg mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Next Peak Period</span>
          <Badge variant="outline" className="text-xs">
            {daysUntilPeak <= 30 ? `${daysUntilPeak} days` : format(cycle.nextPeak, "MMM yyyy")}
          </Badge>
        </div>
      </div>
      
      {/* Drivers */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Key Drivers</p>
        <div className="flex flex-wrap gap-1.5">
          {cycle.drivers.map((driver, idx) => (
            <span key={idx} className="text-xs px-2 py-1 bg-primary/5 text-foreground/80 rounded-md">
              {driver}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});

DemandCycleCard.displayName = "DemandCycleCard";

export const CorporateHousingDemandCard = memo(function CorporateHousingDemandCard({
  propertyCity = "Atlanta",
  propertyAddress,
}: CorporateHousingDemandCardProps) {
  const demandCycles = getDemandCycles(propertyCity);

  return (
    <Card className="border-none shadow-lg overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              Corporate & Extended Stay Demand
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Mid-term rental opportunities for your property
            </p>
          </div>
          <Badge variant="secondary" className="text-xs gap-1">
            <Sparkles className="h-3 w-3" />
            MTR Focus
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {demandCycles.map((cycle) => (
            <DemandCycleCard key={cycle.id} cycle={cycle} />
          ))}
        </div>
        
        {/* How PeachHaus Drives MTR Bookings */}
        <div className="mt-6 p-4 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-xl border border-primary/10">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">How PeachHaus Drives Mid-Term Bookings</p>
              <p className="text-sm text-muted-foreground mt-1">
                We actively partner with corporate relocation firms, insurance adjusters, and healthcare staffing agencies 
                to maintain a steady pipeline of qualified mid-term tenants. Our relationships with Fortune 500 HR departments 
                and major insurers provide reliable, guaranteed placements.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
