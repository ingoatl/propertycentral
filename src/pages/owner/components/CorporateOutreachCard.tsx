import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Briefcase, 
  HeartPulse, 
  HardHat, 
  Shield, 
  Plane,
  Home,
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  CheckCircle,
  Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OutreachStats {
  total_companies_contacted?: number;
  industries_targeted?: string[];
  emails_sent?: number;
  calls_made?: number;
  hotsheets_distributed?: number;
  decision_makers_identified?: number;
}

interface CorporateOutreachCardProps {
  outreach?: OutreachStats | null;
  reportMonth?: string | null;
}

// Industry value mapping - explains WHY each industry matters to owners
const INDUSTRY_VALUE_MAP: Record<string, {
  icon: React.ReactNode;
  title: string;
  benefit: string;
  avgStayLength: string;
  avgRevenue: string;
  bookingType: string;
  color: string;
}> = {
  insurance: {
    icon: <Shield className="w-5 h-5" />,
    title: "Insurance Adjusters",
    benefit: "Handle disaster recovery claims and need housing for displaced families",
    avgStayLength: "8-14 nights",
    avgRevenue: "$1,200-2,400",
    bookingType: "Urgent, flexible dates",
    color: "from-blue-500 to-cyan-500",
  },
  corporate: {
    icon: <Briefcase className="w-5 h-5" />,
    title: "Corporate Relocation",
    benefit: "Relocating employees who need housing during transition periods",
    avgStayLength: "2-8 weeks",
    avgRevenue: "$2,500-4,000",
    bookingType: "Planned, professional",
    color: "from-indigo-500 to-purple-500",
  },
  medical: {
    icon: <HeartPulse className="w-5 h-5" />,
    title: "Travel Nurses & Healthcare",
    benefit: "Healthcare professionals on 13-week contracts with stable, predictable income",
    avgStayLength: "13 weeks (90 days)",
    avgRevenue: "$4,500-8,000",
    bookingType: "Long-term, reliable",
    color: "from-rose-500 to-pink-500",
  },
  construction: {
    icon: <HardHat className="w-5 h-5" />,
    title: "Traveling Contractors",
    benefit: "Project-based workers who need housing near work sites",
    avgStayLength: "2-8 weeks",
    avgRevenue: "$1,800-3,500",
    bookingType: "Project-based",
    color: "from-amber-500 to-orange-500",
  },
  travel: {
    icon: <Plane className="w-5 h-5" />,
    title: "Travel Agencies",
    benefit: "Bulk bookings for group travel and corporate retreats",
    avgStayLength: "3-7 nights",
    avgRevenue: "$800-1,500",
    bookingType: "Repeat business",
    color: "from-emerald-500 to-teal-500",
  },
  relocation: {
    icon: <Home className="w-5 h-5" />,
    title: "Relocation Services",
    benefit: "Families in transition between homes, often urgent bookings",
    avgStayLength: "2-6 weeks",
    avgRevenue: "$2,000-4,500",
    bookingType: "Urgent, extended",
    color: "from-violet-500 to-purple-500",
  },
};

// Normalize industry names for matching
const normalizeIndustry = (industry: string): string => {
  const lower = industry.toLowerCase();
  if (lower.includes("insurance")) return "insurance";
  if (lower.includes("corporate") || lower.includes("business")) return "corporate";
  if (lower.includes("medical") || lower.includes("nurse") || lower.includes("health")) return "medical";
  if (lower.includes("construction") || lower.includes("contractor")) return "construction";
  if (lower.includes("travel") || lower.includes("agency")) return "travel";
  if (lower.includes("relocation") || lower.includes("moving")) return "relocation";
  return "corporate"; // Default fallback
};

export function CorporateOutreachCard({ outreach, reportMonth }: CorporateOutreachCardProps) {
  if (!outreach) return null;

  const totalContacts = (outreach.emails_sent || 0) + (outreach.calls_made || 0);
  const industries = outreach.industries_targeted || [];
  
  // Calculate potential revenue from outreach
  const estimatedPipelineValue = (outreach.total_companies_contacted || 0) * 850; // Conservative avg per company

  return (
    <Card className="border-none shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Who We're Reaching For You
            </CardTitle>
            <CardDescription className="mt-1">
              Corporate outreach to fill your calendar with quality, extended-stay bookings
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  We contact companies in industries that typically need short-term housing. 
                  Company names are kept confidential to protect business relationships.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Hero Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="text-3xl font-bold text-blue-600">
                {outreach.total_companies_contacted || 0}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Decision Makers Reached</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <span className="text-3xl font-bold text-emerald-600">{totalContacts}</span>
            </div>
            <p className="text-xs text-muted-foreground">Touchpoints This Month</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 rounded-xl">
            <div className="flex items-center justify-center gap-2 mb-1">
              <DollarSign className="h-5 w-5 text-purple-600" />
              <span className="text-3xl font-bold text-purple-600">
                ${(estimatedPipelineValue / 1000).toFixed(1)}k
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Pipeline Value</p>
          </div>
        </div>

        {/* Industry Breakdown with Value Explanations */}
        {industries.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Industries We're Targeting & Why
            </h4>
            <div className="space-y-3">
              {industries.slice(0, 4).map((industry, idx) => {
                const normalized = normalizeIndustry(industry);
                const info = INDUSTRY_VALUE_MAP[normalized] || INDUSTRY_VALUE_MAP.corporate;
                
                return (
                  <div 
                    key={idx} 
                    className="p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${info.color} flex items-center justify-center text-white flex-shrink-0`}>
                        {info.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-semibold">{info.title}</h5>
                          <Badge variant="secondary" className="text-xs">
                            {info.bookingType}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {info.benefit}
                        </p>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-primary" />
                            <span className="text-muted-foreground">Avg stay:</span>
                            <span className="font-medium">{info.avgStayLength}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-emerald-600" />
                            <span className="text-muted-foreground">Revenue:</span>
                            <span className="font-medium text-emerald-600">{info.avgRevenue}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Value Proposition Footer */}
        <div className="mt-6 p-4 bg-muted/30 rounded-xl">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="font-medium text-sm mb-1">Why Corporate Outreach Matters</h5>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Corporate guests book longer stays (averaging 2-8 weeks vs 2-3 nights for leisure), 
                pay consistently, and often become repeat clients. One corporate relationship can 
                fill your calendar for months at a time, reducing turnover costs and vacancy risk.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
