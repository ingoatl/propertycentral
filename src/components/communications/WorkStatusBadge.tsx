import { useState } from "react";
import { Clock, Loader2, CheckCircle2, Archive, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type WorkStatus = "pending" | "in_progress" | "resolved" | "archived";

interface WorkStatusBadgeProps {
  status: WorkStatus;
  communicationId: string;
  onStatusChange?: (newStatus: WorkStatus) => void;
  interactive?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const statusConfig: Record<
  WorkStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    variant: "default" | "secondary" | "outline" | "destructive";
    className: string;
  }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    variant: "outline",
    className: "border-amber-500/50 text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400",
  },
  in_progress: {
    label: "In Progress",
    icon: Loader2,
    variant: "default",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/50 hover:bg-blue-500/20 dark:text-blue-400",
  },
  resolved: {
    label: "Resolved",
    icon: CheckCircle2,
    variant: "default",
    className: "bg-green-500/10 text-green-600 border-green-500/50 hover:bg-green-500/20 dark:text-green-400",
  },
  archived: {
    label: "Archived",
    icon: Archive,
    variant: "secondary",
    className: "bg-muted text-muted-foreground hover:bg-muted/80",
  },
};

export function WorkStatusBadge({
  status,
  communicationId,
  onStatusChange,
  interactive = true,
  size = "sm",
  className,
}: WorkStatusBadgeProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<WorkStatus>(status);

  const config = statusConfig[currentStatus];
  const Icon = config.icon;

  const handleStatusChange = async (newStatus: WorkStatus) => {
    if (newStatus === currentStatus || isUpdating) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("lead_communications")
        .update({ work_status: newStatus })
        .eq("id", communicationId);

      if (error) throw error;

      setCurrentStatus(newStatus);
      onStatusChange?.(newStatus);
      toast.success(`Status updated to ${statusConfig[newStatus].label}`);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-medium transition-colors cursor-pointer",
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1",
        config.className,
        isUpdating && "opacity-50",
        className
      )}
    >
      <Icon className={cn("shrink-0", size === "sm" ? "h-3 w-3" : "h-4 w-4", currentStatus === "in_progress" && "animate-spin")} />
      <span>{config.label}</span>
      {interactive && <ChevronDown className={cn("shrink-0 opacity-50", size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />}
    </Badge>
  );

  if (!interactive) {
    return badge;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isUpdating}>
        {badge}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        {(Object.keys(statusConfig) as WorkStatus[]).map((statusKey) => {
          const statusInfo = statusConfig[statusKey];
          const StatusIcon = statusInfo.icon;
          return (
            <DropdownMenuItem
              key={statusKey}
              onClick={() => handleStatusChange(statusKey)}
              className={cn(
                "gap-2",
                currentStatus === statusKey && "bg-accent"
              )}
            >
              <StatusIcon className="h-4 w-4" />
              <span>{statusInfo.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Compact version for list items
export function WorkStatusDot({
  status,
  className,
}: {
  status: WorkStatus;
  className?: string;
}) {
  const colors: Record<WorkStatus, string> = {
    pending: "bg-amber-500",
    in_progress: "bg-blue-500",
    resolved: "bg-green-500",
    archived: "bg-muted-foreground",
  };

  return (
    <div
      className={cn("h-2 w-2 rounded-full", colors[status], className)}
      title={statusConfig[status].label}
    />
  );
}
