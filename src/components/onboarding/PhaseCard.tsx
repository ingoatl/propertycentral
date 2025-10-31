import { useState, useEffect } from "react";
import { PhaseDefinition, OnboardingTask, OnboardingSOP } from "@/types/onboarding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Lock, CheckCircle2, Plus, FileText, BookOpen } from "lucide-react";
import { TaskItem } from "./TaskItem";
import { AddTaskDialog } from "./AddTaskDialog";
import { SOPDialog } from "./SOPDialog";
import { SOPFormDialog } from "./SOPFormDialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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
}

export const PhaseCard = ({
  phase,
  tasks,
  completion,
  unlocked,
  expanded,
  onToggle,
  onTaskUpdate,
  highlighted = false,
  projectId,
}: PhaseCardProps) => {
  const isComplete = completion === 100;
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [sop, setSOP] = useState<OnboardingSOP | null>(null);
  const [showSOPDialog, setShowSOPDialog] = useState(false);
  const [showSOPFormDialog, setShowSOPFormDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminRole();
    loadSOP();
  }, [phase.id, projectId]);

  const checkAdminRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    setIsAdmin(roles?.some(r => r.role === "admin") || false);
  };

  const loadSOP = async () => {
    // Load global SOP for this phase (not project-specific)
    const { data } = await supabase
      .from("onboarding_sops")
      .select("*")
      .eq("phase_number", phase.id)
      .is("task_id", null)
      .maybeSingle();

    setSOP(data);
  };

  const handleSOPSuccess = () => {
    loadSOP();
  };

  return (
    <Card className={cn(
      "transition-all max-md:shadow-lg",
      isComplete && "bg-green-50 border-green-500",
      highlighted && "ring-2 ring-blue-500 shadow-lg"
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
                    {sop && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline max-md:text-base"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSOPDialog(true);
                        }}
                      >
                        <BookOpen className="w-4 h-4 max-md:w-5 max-md:h-5" />
                        View SOP
                      </button>
                    )}
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
                          onClick={() => setShowSOPFormDialog(true)}
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
                      {(() => {
                        // Exclude section headers from task count
                        const completableTasks = tasks.filter(t => t.field_type !== 'section_header');
                        const completedCount = completableTasks.filter(t => t.status === "completed").length;
                        return `${completedCount} of ${completableTasks.length} tasks`;
                      })()}
                    </div>
                  </div>
                  <ChevronDown className={cn(
                    "w-5 h-5 transition-transform max-md:w-6 max-md:h-6",
                    expanded && "transform rotate-180"
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
            {tasks
              .filter((task) => {
                // Admin-only tasks: hide from non-admins
                const adminOnlyTasks = [
                  'Signed Management Agreement Link',
                  'ACH Details'
                ];
                if (!isAdmin && adminOnlyTasks.includes(task.title)) {
                  return false;
                }
                return true;
              })
              .sort((a, b) => {
                // Define priority order based on title keywords
                const getPriority = (title: string) => {
                  const lowerTitle = title.toLowerCase();
                  if (lowerTitle.includes('owner name') || lowerTitle.includes('owner\'s name')) return 1;
                  if (lowerTitle.includes('owner email') || lowerTitle.includes('owner\'s email')) return 2;
                  if (lowerTitle.includes('owner phone') || lowerTitle.includes('owner\'s phone')) return 3;
                  return 999; // Everything else comes after
                };
                
                const priorityA = getPriority(a.title);
                const priorityB = getPriority(b.title);
                
                if (priorityA !== priorityB) {
                  return priorityA - priorityB;
                }
                
                // If same priority, maintain original order (by creation date)
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              })
              .map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onUpdate={onTaskUpdate}
                />
              ))}
            
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
};
