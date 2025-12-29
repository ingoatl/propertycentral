import { Lead, LeadStage, STAGE_CONFIG, LEAD_STAGES } from "@/types/leads";
import { Users, DollarSign, TrendingUp, Clock } from "lucide-react";

interface LeadStatsBarProps {
  leads: Lead[];
}

const LeadStatsBar = ({ leads }: LeadStatsBarProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const stats = {
    totalLeads: leads.length,
    totalValue: leads.reduce((sum, lead) => sum + (lead.opportunity_value || 0), 0),
    newLeads: leads.filter((l) => l.stage === "new_lead").length,
    contractsSent: leads.filter((l) =>
      ["contract_out", "contract_signed"].includes(l.stage)
    ).length,
    hotLeads: leads.filter((l) => (l.ai_qualification_score || 0) >= 70).length,
  };

  // Calculate stage distribution for mini chart
  const stageDistribution = LEAD_STAGES.map(({ stage }) => ({
    stage,
    count: leads.filter((l) => l.stage === stage).length,
    config: STAGE_CONFIG[stage],
  })).filter((s) => s.count > 0);

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

      {/* Pipeline Value */}
      <div className="flex items-center gap-3 min-w-fit">
        <div className="p-2 rounded-lg bg-green-500/10">
          <DollarSign className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(stats.totalValue)}
          </p>
          <p className="text-xs text-muted-foreground">Pipeline Value</p>
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

      {/* Contracts */}
      <div className="flex items-center gap-3 min-w-fit">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <Clock className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{stats.contractsSent}</p>
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
