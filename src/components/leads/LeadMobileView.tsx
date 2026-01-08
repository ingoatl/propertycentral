import { useState } from "react";
import { Lead, STAGE_CONFIG, LeadStage } from "@/types/leads";
import { Phone, Mail, MapPin, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import MobileStageSelector from "./MobileStageSelector";

interface LeadMobileViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onStageChange: (leadId: string, newStage: LeadStage, previousStage: LeadStage) => void;
}

const LeadMobileView = ({ leads, onSelectLead, onStageChange }: LeadMobileViewProps) => {
  const [stageSelectorLead, setStageSelectorLead] = useState<Lead | null>(null);

  return (
    <div className="space-y-2">
      {leads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No leads found
        </div>
      ) : (
        leads.map((lead) => {
          const stageConfig = STAGE_CONFIG[lead.stage];
          return (
            <div
              key={lead.id}
              className="bg-card border rounded-xl overflow-hidden active:bg-muted/50 transition-colors"
            >
              {/* Main content - tappable to open lead details */}
              <div
                className="flex items-center gap-3 p-4"
                onClick={() => onSelectLead(lead)}
              >
                {/* Stage indicator */}
                <div
                  className="w-1.5 h-14 rounded-full shrink-0"
                  style={{ backgroundColor: stageConfig.accentColor }}
                />

                {/* Lead info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground truncate">
                      {lead.name}
                    </p>
                    {lead.lead_number && (
                      <span className="text-xs text-muted-foreground">
                        #{lead.lead_number}
                      </span>
                    )}
                  </div>

                  {lead.property_address && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{lead.property_address}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-1.5">
                    {lead.opportunity_source && (
                      <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                        {lead.opportunity_source}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(lead.created_at), "MMM d")}
                    </span>
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </div>

              {/* Bottom action bar */}
              <div className="flex items-center border-t bg-muted/30">
                {/* Stage badge - tappable to change stage */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setStageSelectorLead(lead);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                  style={{ color: stageConfig.accentColor }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: stageConfig.accentColor }}
                  />
                  {stageConfig.label}
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-border" />

                {/* Quick actions */}
                {lead.phone && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`tel:${lead.phone}`);
                    }}
                    className="flex items-center justify-center w-14 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <Phone className="h-4 w-4 text-primary" />
                  </button>
                )}
                {lead.email && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`mailto:${lead.email}`);
                    }}
                    className="flex items-center justify-center w-14 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <Mail className="h-4 w-4 text-primary" />
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Stage selector bottom sheet */}
      <MobileStageSelector
        open={!!stageSelectorLead}
        onOpenChange={(open) => !open && setStageSelectorLead(null)}
        currentStage={stageSelectorLead?.stage || "new_lead"}
        onStageSelect={(newStage) => {
          if (stageSelectorLead && newStage !== stageSelectorLead.stage) {
            onStageChange(stageSelectorLead.id, newStage, stageSelectorLead.stage);
          }
          setStageSelectorLead(null);
        }}
      />
    </div>
  );
};

export default LeadMobileView;
