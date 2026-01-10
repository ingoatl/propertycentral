import { memo, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Lead, LeadStage, STAGE_CONFIG, LEAD_STAGES } from "@/types/leads";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import LeadKanbanCard from "./LeadKanbanCard";

interface LeadKanbanColumnProps {
  stage: LeadStage;
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
}

const LeadKanbanColumnComponent = ({ stage, leads, onSelectLead }: LeadKanbanColumnProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  const stageConfig = STAGE_CONFIG[stage];
  const stageInfo = LEAD_STAGES.find((s) => s.stage === stage);

  return (
    <div
      className={cn(
        "flex flex-col min-w-[280px] max-w-[320px] rounded-xl transition-all duration-200",
        isOver && "ring-2 ring-primary/50 bg-primary/5"
      )}
    >
      {/* Column Header */}
      <div
        className="p-3 rounded-t-xl cursor-pointer select-none"
        style={{ backgroundColor: `${stageConfig.accentColor}15` }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
            <div
              className="px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: stageConfig.accentColor }}
            >
              {stageConfig.label}
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              {leads.length}
            </span>
          </div>
        </div>

        {/* Stage description */}
        {!isCollapsed && stageInfo && (
          <p className="text-xs text-muted-foreground mt-2 ml-6">
            {stageInfo.description}
          </p>
        )}
      </div>

      {/* Cards Container */}
      {!isCollapsed && (
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 p-2 space-y-2 rounded-b-xl bg-muted/30 min-h-[200px] transition-colors",
            isOver && "bg-primary/10"
          )}
        >
          <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            {leads.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-xs text-muted-foreground border-2 border-dashed border-muted rounded-lg">
                Drop leads here
              </div>
            ) : (
              leads.map((lead) => (
                <LeadKanbanCard
                  key={lead.id}
                  lead={lead}
                  onClick={() => onSelectLead(lead)}
                />
              ))
            )}
          </SortableContext>
        </div>
      )}
    </div>
  );
};

// Memoize column to prevent unnecessary re-renders
const LeadKanbanColumn = memo(LeadKanbanColumnComponent, (prevProps, nextProps) => {
  if (prevProps.stage !== nextProps.stage) return false;
  if (prevProps.leads.length !== nextProps.leads.length) return false;
  // Check if any lead id or key data changed
  for (let i = 0; i < prevProps.leads.length; i++) {
    const prev = prevProps.leads[i];
    const next = nextProps.leads[i];
    if (prev.id !== next.id || prev.name !== next.name || prev.stage !== next.stage) {
      return false;
    }
  }
  return true;
});

export default LeadKanbanColumn;
