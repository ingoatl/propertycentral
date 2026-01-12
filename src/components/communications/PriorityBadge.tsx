import { Zap, AlertTriangle, Clock, Hourglass } from "lucide-react";

type Priority = "urgent" | "important" | "normal" | "low";
type Status = "open" | "snoozed" | "done" | "archived" | "awaiting";

interface PriorityBadgeProps {
  priority?: Priority;
  status?: Status;
  snoozedUntil?: string;
  compact?: boolean;
}

export function PriorityBadge({ priority, status, snoozedUntil, compact = false }: PriorityBadgeProps) {
  // Show awaiting badge if awaiting response
  if (status === "awaiting") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-cyan-500/10 text-cyan-600 ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } font-medium`}>
        <Hourglass className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {!compact && "Awaiting"}
      </span>
    );
  }

  // Show snoozed badge if snoozed
  if (status === "snoozed") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } font-medium`}>
        <Clock className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {!compact && "Snoozed"}
      </span>
    );
  }

  // Show done badge if done
  if (status === "done") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-green-500/10 text-green-600 ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } font-medium`}>
        ✓
        {!compact && " Done"}
      </span>
    );
  }

  // Priority badges - only show for urgent/important
  if (priority === "urgent") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-600 ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } font-medium`}>
        <Zap className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {!compact && "Urgent"}
      </span>
    );
  }

  if (priority === "important") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } font-medium`}>
        <AlertTriangle className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {!compact && "Important"}
      </span>
    );
  }

  // No badge for normal/low priority
  return null;
}
