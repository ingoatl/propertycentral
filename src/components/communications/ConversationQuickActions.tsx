import { Clock, CheckCheck, RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ConversationQuickActionsProps {
  status?: "open" | "snoozed" | "done" | "archived" | "awaiting";
  onMarkDone: () => void;
  onSnooze: (hours: number) => void;
  onReopen: () => void;
  onMarkAwaiting?: () => void;
  isUpdating?: boolean;
  compact?: boolean;
}

export function ConversationQuickActions({
  status = "open",
  onMarkDone,
  onSnooze,
  onReopen,
  isUpdating,
  compact = false,
}: ConversationQuickActionsProps) {
  if (compact) {
    // Compact version for conversation list items - just icons
    return (
      <div 
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "done" ? (
          <button
            onClick={onReopen}
            disabled={isUpdating}
            className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Reopen"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        ) : (
          <>
            <button
              onClick={onMarkDone}
              disabled={isUpdating}
              className="p-1.5 rounded-full hover:bg-green-500/10 transition-colors text-muted-foreground hover:text-green-600 disabled:opacity-50"
              title="Mark as done"
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={isUpdating}
                  className="p-1.5 rounded-full hover:bg-amber-500/10 transition-colors text-muted-foreground hover:text-amber-600 disabled:opacity-50"
                  title="Snooze"
                >
                  <Clock className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem onClick={() => onSnooze(1)}>
                  <Clock className="h-4 w-4 mr-2" />
                  1 hour
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSnooze(4)}>
                  <Clock className="h-4 w-4 mr-2" />
                  4 hours
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSnooze(24)}>
                  <Clock className="h-4 w-4 mr-2" />
                  Tomorrow
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    );
  }

  // Full version for conversation detail header
  return (
    <div className="flex items-center gap-2">
      {status === "done" ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onReopen}
          disabled={isUpdating}
          className="gap-1.5"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Reopen</span>
        </Button>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onMarkDone}
            disabled={isUpdating}
            className="gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
          >
            <CheckCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Done</span>
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isUpdating}
                className="gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
              >
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Snooze</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSnooze(1)}>
                <Clock className="h-4 w-4 mr-2" />
                1 hour
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSnooze(4)}>
                <Clock className="h-4 w-4 mr-2" />
                4 hours
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSnooze(24)}>
                <Clock className="h-4 w-4 mr-2" />
                Tomorrow
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSnooze(72)}>
                <Clock className="h-4 w-4 mr-2" />
                3 days
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
