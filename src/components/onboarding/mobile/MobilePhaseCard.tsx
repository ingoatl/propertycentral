import { useState, useMemo, memo } from "react";
import { PhaseDefinition, OnboardingTask } from "@/types/onboarding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, CheckCircle2, Plus } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MobileTaskCard } from "./MobileTaskCard";
import { MobileTaskContent } from "./MobileTaskContent";
import { cn } from "@/lib/utils";

interface MobilePhaseCardProps {
  phase: PhaseDefinition;
  tasks: OnboardingTask[];
  completion: number;
  expanded: boolean;
  onToggle: () => void;
  onTaskUpdate: () => void;
  projectId: string;
  isAdmin?: boolean;
}

export const MobilePhaseCard = memo(({
  phase,
  tasks,
  completion,
  expanded,
  onToggle,
  onTaskUpdate,
  projectId,
  isAdmin = false,
}: MobilePhaseCardProps) => {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const isComplete = completion === 100;

  const { filteredTasks, taskCount, completedCount } = useMemo(() => {
    // Filter out hidden and admin-only tasks
    const globalHiddenTasks = ['Mobile'];
    const adminOnlyTasks = ['Signed Management Agreement Link', 'ACH Details'];

    const filtered = tasks.filter(task => {
      if (globalHiddenTasks.includes(task.title)) return false;
      if (!isAdmin && adminOnlyTasks.includes(task.title)) return false;
      return true;
    });

    // Sort tasks
    const sorted = filtered.sort((a, b) => {
      const getPriority = (title: string) => {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('owner name')) return 1;
        if (lowerTitle.includes('owner email')) return 2;
        if (lowerTitle.includes('owner phone')) return 3;
        return 999;
      };
      return getPriority(a.title) - getPriority(b.title) || 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const completable = sorted.filter(t => t.field_type !== 'section_header');
    const completed = completable.filter(
      t => t.status === "completed" || (t.field_value && t.field_value.trim() !== "")
    ).length;

    return {
      filteredTasks: sorted,
      taskCount: completable.length,
      completedCount: completed
    };
  }, [tasks, isAdmin]);

  const handleTaskToggle = (taskId: string) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  return (
    <div className={cn(
      "rounded-2xl overflow-hidden transition-all duration-300",
      "bg-card border border-border/50 shadow-sm",
      isComplete && "border-green-300 bg-gradient-to-br from-green-50/50 to-card"
    )}>
      <Collapsible open={expanded} onOpenChange={onToggle}>
        {/* Phase Header */}
        <CollapsibleTrigger asChild>
          <button className={cn(
            "w-full text-left px-4 py-4 flex items-center gap-3",
            "active:bg-muted/30 transition-colors touch-manipulation",
            "focus:outline-none"
          )}>
            {/* Phase Badge */}
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm",
              isComplete 
                ? "bg-green-500 text-white" 
                : "bg-primary/10 text-primary"
            )}>
              {isComplete ? <CheckCircle2 className="w-5 h-5" /> : phase.id}
            </div>

            {/* Title & Progress */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[16px] leading-tight line-clamp-1">
                {phase.title}
              </h3>
              <div className="flex items-center gap-2 mt-1.5">
                {/* Progress Bar */}
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isComplete ? "bg-green-500" : "bg-primary"
                    )}
                    style={{ width: `${completion}%` }}
                  />
                </div>
                <span className="text-[12px] text-muted-foreground flex-shrink-0">
                  {completedCount}/{taskCount}
                </span>
              </div>
            </div>

            {/* Chevron */}
            <ChevronDown className={cn(
              "w-5 h-5 text-muted-foreground/50 transition-transform duration-300 flex-shrink-0",
              expanded && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>

        {/* Tasks List */}
        <CollapsibleContent>
          <div className="px-3 pb-4 space-y-2">
            {/* Section headers and tasks */}
            {filteredTasks.map((task) => {
              // Render section headers differently
              if (task.field_type === 'section_header') {
                return (
                  <div key={task.id} className="pt-4 pb-2 first:pt-0">
                    <h4 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                      {task.title}
                    </h4>
                  </div>
                );
              }

              return (
                <MobileTaskCard
                  key={task.id}
                  task={task}
                  isExpanded={expandedTaskId === task.id}
                  onToggle={() => handleTaskToggle(task.id)}
                >
                  <MobileTaskContent
                    task={task}
                    onUpdate={() => {
                      onTaskUpdate();
                      setExpandedTaskId(null);
                    }}
                    isAdmin={isAdmin}
                  />
                </MobileTaskCard>
              );
            })}

            {/* Add Task Button */}
            <Button
              variant="ghost"
              className="w-full h-12 rounded-xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground gap-2 hover:bg-muted/50"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});

MobilePhaseCard.displayName = "MobilePhaseCard";
