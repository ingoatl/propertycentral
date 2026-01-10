import { Lead, LeadStage, STAGE_CONFIG, LEAD_STAGES } from "@/types/leads";
import { Users, TrendingUp, FileText } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface LeadStatsBarProps {
  leads: Lead[];
}

const LeadStatsBar = ({ leads }: LeadStatsBarProps) => {
  const isMobile = useIsMobile();
  
  const stats = {
    totalLeads: leads.length,
    newLeads: leads.filter((l) => l.stage === "new_lead").length,
    contractsOut: leads.filter((l) => l.stage === "contract_out").length,
  };

  // Calculate stage distribution for mini chart
  const stageDistribution = LEAD_STAGES.map(({ stage }) => ({
    stage,
    count: leads.filter((l) => l.stage === stage).length,
    config: STAGE_CONFIG[stage],
  })).filter((s) => s.count > 0);

  // Mobile: 2x2 grid layout
  if (isMobile) {
    return (
      <div className="grid grid-cols-2 gap-3 p-3 bg-card border rounded-xl shadow-sm">
        {/* Total Leads */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{stats.totalLeads}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>

        {/* New Leads */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10">
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{stats.newLeads}</p>
            <p className="text-xs text-muted-foreground">New</p>
          </div>
        </div>

        {/* Contracts Out */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10">
            <FileText className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{stats.contractsOut}</p>
            <p className="text-xs text-muted-foreground">Contracts</p>
          </div>
        </div>

        {/* Mini stage pills */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {stageDistribution.slice(0, 4).map(({ stage, count, config }) => (
            <div
              key={stage}
              className="h-6 min-w-[20px] px-1 rounded flex items-center justify-center text-xs font-medium text-white shrink-0"
              style={{ backgroundColor: config.accentColor }}
            >
              {count}
            </div>
          ))}
          {stageDistribution.length > 4 && (
            <div className="h-6 px-1.5 rounded bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
              +{stageDistribution.length - 4}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop: horizontal layout
  return (
    <div className="flex items-center gap-6 p-4 bg-card border rounded-xl shadow-sm overflow-x-auto">
      {/* Total Leads */}
      <div className="flex items-center gap-3 min-w-fit">
        <div className="p-2 rounded-lg bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{stats.totalLeads}</p>
          <p className="text-xs text-muted-foreground">Total Leads</p>
        </div>
      </div>

      <div className="h-10 w-px bg-border" />

      {/* New Leads */}
      <div className="flex items-center gap-3 min-w-fit">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <TrendingUp className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{stats.newLeads}</p>
          <p className="text-xs text-muted-foreground">New Leads</p>
        </div>
      </div>

      <div className="h-10 w-px bg-border" />

      {/* Contracts Out */}
      <div className="flex items-center gap-3 min-w-fit">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <FileText className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{stats.contractsOut}</p>
          <p className="text-xs text-muted-foreground">Contracts Out</p>
        </div>
      </div>

      {/* Mini stage distribution */}
      <div className="h-10 w-px bg-border" />
      <div className="flex items-center gap-1 min-w-fit">
        {stageDistribution.slice(0, 6).map(({ stage, count, config }) => (
          <div
            key={stage}
            className="group relative"
          >
            <div
              className="h-8 min-w-[24px] px-1 rounded flex items-center justify-center text-xs font-medium text-white"
              style={{ backgroundColor: config.accentColor }}
            >
              {count}
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              {config.label}
            </div>
          </div>
        ))}
        {stageDistribution.length > 6 && (
          <div className="h-8 px-2 rounded bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
            +{stageDistribution.length - 6}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadStatsBar;
