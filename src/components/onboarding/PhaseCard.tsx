import { useState, useMemo, memo } from "react";
import { PhaseDefinition, OnboardingTask, OnboardingSOP } from "@/types/onboarding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, CheckCircle2, Plus, FileText, BookOpen } from "lucide-react";
import { TaskItem } from "./TaskItem";
import { AddTaskDialog } from "./AddTaskDialog";
import { SOPDialog } from "./SOPDialog";
import { SOPFormDialog } from "./SOPFormDialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { PLATFORM_CATEGORIES, getPlatformCategory } from "@/context/onboardingPhases";

interface PhaseCardProps {
  phase: PhaseDefinition;
  tasks: OnboardingTask[];
  completion: number;
  unlocked: boolean;
  expanded: boolean;
  onToggle: () => void;
  onTaskUpdate: () => void;
  highlighted?: boolean;
  projectId: string;
  isPartnerProperty?: boolean;
  assignedUserNames?: Map<string, string>; // Pre-loaded from parent
}

// Memoized component to prevent unnecessary re-renders
export const PhaseCard = memo(({
  phase,
  tasks,
  completion,
  unlocked,
  expanded,
  onToggle,
  onTaskUpdate,
  highlighted = false,
  projectId,
  isPartnerProperty = false,
  assignedUserNames,
}: PhaseCardProps) => {
  const isComplete = completion === 100;
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [sop, setSOP] = useState<OnboardingSOP | null>(null);
  const [showSOPDialog, setShowSOPDialog] = useState(false);
  const [showSOPFormDialog, setShowSOPFormDialog] = useState(false);
  const [sopLoaded, setSopLoaded] = useState(false);

  // Use cached admin check hook instead of local DB call
  const { isAdmin } = useAdminCheck();

  // Load SOP lazily only when user clicks to view it
  const loadSOP = async () => {
    if (sopLoaded) return;
    const { data } = await supabase
      .from("onboarding_sops")
      .select("*")
      .eq("phase_number", phase.id)
      .is("task_id", null)
      .maybeSingle();
    setSOP(data);
    setSopLoaded(true);
  };

  const handleSOPClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await loadSOP();
    setShowSOPDialog(true);
  };

  const handleSOPFormClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await loadSOP();
    setShowSOPFormDialog(true);
  };

  const handleSOPSuccess = () => {
    setSopLoaded(false);
    loadSOP();
  };

  // Memoize filtered and sorted tasks
  const { filteredTasks, groupedTasks, taskCount, completedCount } = useMemo(() => {
    // Tasks to hide for ALL properties
    const globalHiddenTasks = ['Mobile'];
    
    // Tasks to hide for Partner Properties only
    const partnerHiddenTasks = [
      'Airbnb', 'Airbnb – 1-Year Listing', 'VRBO', 'Booking.com',
      'Furnished Finder', 'CHBO (Corporate Housing by Owner)',
      'June Homes', 'Direct Booking Page'
    ];
    
    // Admin-only tasks
    const adminOnlyTasks = ['Signed Management Agreement Link', 'ACH Details'];

    const filtered = tasks.filter(task => {
      if (globalHiddenTasks.includes(task.title)) return false;
      if (isPartnerProperty && partnerHiddenTasks.includes(task.title)) return false;
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
      const priorityA = getPriority(a.title);
      const priorityB = getPriority(b.title);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Group Phase 7 tasks by platform category
    let grouped: Map<string, OnboardingTask[]> | null = null;
    if (phase.id === 7) {
      grouped = new Map();
      for (const [key, data] of Object.entries(PLATFORM_CATEGORIES)) {
        grouped.set(key, []);
      }
      grouped.set('other', []);
      
      for (const task of sorted) {
        const category = getPlatformCategory(task.title);
        if (category && grouped.has(category)) {
          grouped.get(category)!.push(task);
        } else {
          grouped.get('other')!.push(task);
        }
      }
    }

    // Calculate task counts
    const completableTasks = sorted.filter(t => t.field_type !== 'section_header');
    const completed = completableTasks.filter(
      t => t.status === "completed" || (t.field_value && t.field_value.trim() !== "")
    ).length;

    return {
      filteredTasks: sorted,
      groupedTasks: grouped,
      taskCount: completableTasks.length,
      completedCount: completed
    };
  }, [tasks, isAdmin, isPartnerProperty, phase.id]);

  // Render tasks for Phase 7 grouped by category
  const renderGroupedTasks = () => {
    if (!groupedTasks) return null;

    return (
      <>
        {Object.entries(PLATFORM_CATEGORIES).map(([key, data]) => {
          const categoryTasks = groupedTasks.get(key) || [];
          if (categoryTasks.length === 0) return null;

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-2 py-2 px-1 border-b border-muted">
                <span className="text-lg">{data.emoji}</span>
                <span className="font-medium text-sm">{data.title}</span>
                <Badge variant="outline" className="text-xs ml-auto">
                  {data.priority}
                </Badge>
              </div>
              {categoryTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onUpdate={onTaskUpdate}
                  assignedUserName={assignedUserNames?.get(task.id)}
                />
              ))}
            </div>
          );
        })}
        {/* Other uncategorized tasks */}
        {(groupedTasks.get('other') || []).map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onUpdate={onTaskUpdate}
            assignedUserName={assignedUserNames?.get(task.id)}
          />
        ))}
      </>
    );
  };

  return (
    <Card className={cn(
      "transition-all duration-300 ease-out max-md:shadow-lg hover:shadow-md",
      isComplete && "bg-green-50 border-green-500",
      highlighted && "ring-2 ring-blue-500 shadow-lg",
      expanded && "shadow-lg"
    )}>
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <div className="w-full cursor-pointer">
            <CardHeader className="hover:bg-muted/50 transition-colors max-md:p-5">
              <div className="flex items-start justify-between max-md:flex-col max-md:gap-4">
                <div className="flex-1 text-left max-md:w-full">
                  <div className="flex items-center gap-3 mb-2 max-md:flex-wrap">
                    <Badge variant="outline" className="font-mono text-sm px-3 py-1 max-md:text-base max-md:px-4 max-md:py-1.5">
                      Phase {phase.id}
                    </Badge>
                    {isComplete && <CheckCircle2 className="w-5 h-5 text-green-600 max-md:w-6 max-md:h-6" />}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline max-md:text-base"
                      onClick={handleSOPClick}
                    >
                      <BookOpen className="w-4 h-4 max-md:w-5 max-md:h-5" />
                      View SOP
                    </button>
                  </div>
                  <div className="flex items-start justify-between gap-4 max-md:flex-col max-md:gap-3">
                    <div className="flex-1 max-md:w-full">
                      <CardTitle className="text-xl font-bold mb-2 max-md:text-2xl">{phase.title}</CardTitle>
                      <CardDescription className="max-md:text-base max-md:leading-relaxed">{phase.description}</CardDescription>
                    </div>
                    {/* SOP Buttons - Right Side */}
                    <div className="flex items-center gap-2 flex-shrink-0 max-md:hidden" onClick={(e) => e.stopPropagation()}>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSOPFormClick}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          {sop ? "Edit SOP" : "Add SOP"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 max-md:w-full max-md:justify-between">
                  <div className="text-right max-md:text-left">
                    <div className="text-lg font-semibold max-md:text-2xl">{Math.round(completion)}%</div>
                    <div className="text-xs text-muted-foreground max-md:text-sm">
                      {completedCount} of {taskCount} tasks
                    </div>
                  </div>
                  <ChevronDown className={cn(
                    "w-5 h-5 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] max-md:w-6 max-md:h-6",
                    expanded && "rotate-180"
                  )} />
                </div>
              </div>

              {/* Progress Bar - Full Width */}
              <div className="w-full bg-muted rounded-full h-2.5 mt-4 max-md:h-3 max-md:mt-5">
                <div
                  className={cn(
                    "h-2.5 rounded-full transition-all duration-300 max-md:h-3",
                    isComplete ? "bg-green-600" : "bg-primary"
                  )}
                  style={{ width: `${completion}%` }}
                />
              </div>
            </CardHeader>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-2 pt-0 max-md:space-y-3 max-md:p-5 max-md:pt-0">
            {phase.id === 7 ? (
              renderGroupedTasks()
            ) : (
              filteredTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onUpdate={onTaskUpdate}
                  assignedUserName={assignedUserNames?.get(task.id)}
                />
              ))
            )}
            
            <Button
              onClick={() => setShowAddTaskDialog(true)}
              variant="outline"
              size="sm"
              className="w-full mt-4 max-md:h-12 max-md:text-base"
            >
              <Plus className="w-3 h-3 mr-2 max-md:w-5 max-md:h-5" />
              Add Task to Phase {phase.id}
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <AddTaskDialog
        open={showAddTaskDialog}
        onOpenChange={setShowAddTaskDialog}
        projectId={projectId}
        phaseNumber={phase.id}
        phaseTitle={phase.title}
        onSuccess={onTaskUpdate}
      />

      <SOPDialog
        sop={sop}
        open={showSOPDialog}
        onOpenChange={setShowSOPDialog}
      />

      <SOPFormDialog
        projectId={projectId}
        phaseNumber={phase.id}
        existingSOP={sop}
        open={showSOPFormDialog}
        onOpenChange={setShowSOPFormDialog}
        onSuccess={handleSOPSuccess}
      />
    </Card>
  );
});

PhaseCard.displayName = "PhaseCard";
