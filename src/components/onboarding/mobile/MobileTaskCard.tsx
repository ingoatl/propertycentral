import { useState, memo } from "react";
import { OnboardingTask } from "@/types/onboarding";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, ChevronRight, Clock, AlertCircle, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast } from "date-fns";
import { toast } from "sonner";

interface MobileTaskCardProps {
  task: OnboardingTask;
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

export const MobileTaskCard = memo(({ 
  task, 
  isExpanded, 
  onToggle, 
  children 
}: MobileTaskCardProps) => {
  const [copied, setCopied] = useState(false);
  const isCompleted = task.status === "completed";
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isCompleted;
  const hasValue = task.field_value && task.field_value.trim() !== "";

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.field_value) {
      await navigator.clipboard.writeText(task.field_value);
      setCopied(true);
      toast.success("Copied");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getDisplayValue = () => {
    if (!task.field_value) return null;
    
    switch (task.field_type) {
      case "date":
        try {
          const date = new Date(task.field_value);
          return isNaN(date.getTime()) ? task.field_value : format(date, "MMM d, yyyy");
        } catch {
          return task.field_value;
        }
      case "checkbox":
        return task.field_value === "true" ? "Yes" : "No";
      case "currency":
        return `$${task.field_value}`;
      default:
        return task.field_value.length > 40 
          ? task.field_value.substring(0, 40) + "..." 
          : task.field_value;
    }
  };

  const displayValue = getDisplayValue();

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div 
        className={cn(
          "rounded-2xl transition-all duration-300 overflow-hidden",
          "bg-card border border-border/50",
          "shadow-sm hover:shadow-md active:scale-[0.99]",
          isCompleted && "bg-green-50/50 border-green-200/50",
          isOverdue && !isCompleted && "border-destructive/30"
        )}
      >
        {/* Task Header - Apple-like touch target */}
        <CollapsibleTrigger asChild>
          <button 
            className={cn(
              "w-full text-left px-4 py-3.5 flex items-center gap-3",
              "active:bg-muted/50 transition-colors touch-manipulation",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            )}
          >
            {/* Status Icon */}
            <div className="flex-shrink-0">
              {isCompleted ? (
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              ) : isOverdue ? (
                <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-medium text-[15px] leading-tight line-clamp-1",
                isCompleted && "text-green-700"
              )}>
                {task.title}
              </p>
              
              {/* Value preview or due date */}
              {!isExpanded && (
                <div className="flex items-center gap-2 mt-1">
                  {displayValue ? (
                    <p className="text-[13px] text-muted-foreground line-clamp-1">
                      {displayValue}
                    </p>
                  ) : task.due_date ? (
                    <p className={cn(
                      "text-[13px] flex items-center gap-1",
                      isOverdue ? "text-destructive" : "text-muted-foreground"
                    )}>
                      <Clock className="w-3 h-3" />
                      {isOverdue ? "Overdue • " : ""}
                      {(() => {
                        try {
                          return format(new Date(task.due_date), "MMM d");
                        } catch {
                          return "";
                        }
                      })()}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            {/* Right accessories */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Copy button for completed tasks with values */}
              {!isExpanded && hasValue && (
                <button
                  onClick={handleCopy}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    "bg-muted/50 active:bg-muted transition-colors",
                    "touch-manipulation"
                  )}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              )}
              
              {/* Chevron */}
              <ChevronRight className={cn(
                "w-5 h-5 text-muted-foreground/50 transition-transform duration-300",
                isExpanded && "rotate-90"
              )} />
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expandable Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 space-y-4">
            {/* Divider */}
            <div className="h-px bg-border/50" />
            
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});

MobileTaskCard.displayName = "MobileTaskCard";
