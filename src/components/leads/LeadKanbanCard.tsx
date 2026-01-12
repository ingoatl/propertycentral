import { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Lead, STAGE_CONFIG } from "@/types/leads";
import { Phone, Mail, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface LeadKanbanCardProps {
  lead: Lead;
  onClick: () => void;
}

const LeadKanbanCardComponent = ({ lead, onClick }: LeadKanbanCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: lead.id });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const stageConfig = STAGE_CONFIG[lead.stage];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative bg-card rounded-lg border shadow-sm transition-all duration-200",
        "hover:shadow-md hover:scale-[1.02] hover:-translate-y-0.5",
        "cursor-grab active:cursor-grabbing touch-none",
        isDragging && "opacity-50 shadow-xl scale-105 z-50 rotate-2"
      )}
      onClick={(e) => {
        // Only trigger click if not dragging
        if (!isDragging) {
          onClick();
        }
      }}
    >
      {/* Color accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
        style={{ backgroundColor: stageConfig.accentColor }}
      />

      <div className="p-3 pl-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2 pr-6">
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-sm truncate text-foreground">
              {lead.name}
            </h4>
            {lead.opportunity_source && (
              <span className="text-xs text-muted-foreground">
                via {lead.opportunity_source}
              </span>
            )}
          </div>
        </div>

        {/* Contact info */}
        <div className="space-y-1 mb-3">
          {lead.property_address && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{lead.property_address}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              <span>{lead.phone}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-border/50">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(lead.created_at), "MMM d")}
          </div>
        </div>

        {/* AI Score indicator */}
        {lead.ai_qualification_score && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${lead.ai_qualification_score}%`,
                  backgroundColor: stageConfig.accentColor,
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {lead.ai_qualification_score}%
            </span>
          </div>
        )}

        {/* Quick actions on hover */}
        <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {lead.phone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(`tel:${lead.phone}`);
              }}
              className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              <Phone className="h-3 w-3 text-primary" />
            </button>
          )}
          {lead.email && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(`mailto:${lead.email}`);
              }}
              className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              <Mail className="h-3 w-3 text-primary" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Memoize to prevent re-renders when parent re-renders but lead data hasn't changed
const LeadKanbanCard = memo(LeadKanbanCardComponent, (prevProps, nextProps) => {
  // Only re-render if lead data or onClick reference changes
  return prevProps.lead.id === nextProps.lead.id &&
    prevProps.lead.name === nextProps.lead.name &&
    prevProps.lead.stage === nextProps.lead.stage &&
    prevProps.lead.phone === nextProps.lead.phone &&
    prevProps.lead.email === nextProps.lead.email &&
    prevProps.lead.property_address === nextProps.lead.property_address &&
    prevProps.lead.ai_qualification_score === nextProps.lead.ai_qualification_score;
});

export default LeadKanbanCard;
