import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Circle, Clock } from "lucide-react";
import { WorkOrderTimeline, WorkOrderStatus, STATUS_CONFIG } from "@/types/maintenance";

interface WorkOrderMiniTimelineProps {
  status: WorkOrderStatus;
  timeline: WorkOrderTimeline[];
  createdAt: string;
  className?: string;
}

const STATUS_FLOW: WorkOrderStatus[] = [
  "new",
  "dispatched",
  "in_progress",
  "pending_verification",
  "completed",
];

export function WorkOrderMiniTimeline({
  status,
  timeline,
  createdAt,
  className,
}: WorkOrderMiniTimelineProps) {
  const currentIndex = STATUS_FLOW.indexOf(status);
  const latestEntry = timeline[0];

  // Get relative time for latest entry
  const relativeTime = latestEntry
    ? formatDistanceToNow(new Date(latestEntry.created_at), { addSuffix: true })
    : formatDistanceToNow(new Date(createdAt), { addSuffix: true });

  // Truncate action text
  const latestAction = latestEntry?.action || "Work order created";
  const truncatedAction =
    latestAction.length > 45 ? latestAction.slice(0, 45) + "..." : latestAction;

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-2.5 bg-muted/50 rounded-lg border border-border/50",
        className
      )}
    >
      {/* Status Dots */}
      <div className="flex items-center gap-1">
        {STATUS_FLOW.map((s, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const config = STATUS_CONFIG[s];

          return (
            <div key={s} className="flex items-center">
              {idx > 0 && (
                <div
                  className={cn(
                    "w-4 h-0.5 -mx-0.5",
                    isCompleted ? "bg-primary" : "bg-border"
                  )}
                />
              )}
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center transition-all",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                  !isCompleted && !isCurrent && "bg-muted border border-border"
                )}
                title={config?.label || s}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3" />
                ) : isCurrent ? (
                  <Circle className="h-2 w-2 fill-current" />
                ) : (
                  <Circle className="h-2 w-2 text-muted-foreground/40" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border" />

      {/* Latest Activity */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-muted-foreground truncate">
          {truncatedAction}
        </span>
        <Badge variant="outline" className="text-[10px] h-5 shrink-0">
          {relativeTime}
        </Badge>
      </div>
    </div>
  );
}
