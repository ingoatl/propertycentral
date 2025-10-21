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
    const { data } = await supabase
      .from("onboarding_sops")
      .select("*")
      .eq("project_id", projectId)
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
      "transition-all",
      isComplete && "bg-green-50 border-green-500",
      highlighted && "ring-2 ring-blue-500 shadow-lg"
    )}>
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1 text-left">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="outline" className="font-mono text-sm px-3 py-1">
                    Phase {phase.id}
                  </Badge>
                  {isComplete && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                  {sop && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-blue-600 hover:text-blue-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSOPDialog(true);
                      }}
                    >
                      <BookOpen className="w-4 h-4 mr-1" />
                      View SOP
                    </Button>
                  )}
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-xl font-bold mb-2">{phase.title}</CardTitle>
                    <CardDescription>{phase.description}</CardDescription>
                  </div>
                  {/* SOP Buttons - Right Side */}
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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
                    {sop && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSOPDialog(true)}
                      >
                        <BookOpen className="w-4 h-4 mr-1" />
                        View SOP
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 ml-4">
                <div className="text-right">
                  <div className="text-lg font-semibold">{Math.round(completion)}%</div>
                  <div className="text-xs text-muted-foreground">
                    {tasks.filter(t => t.status === "completed").length} of {tasks.length} tasks
                  </div>
                </div>
                <ChevronDown className={cn(
                  "w-5 h-5 transition-transform",
                  expanded && "transform rotate-180"
                )} />
              </div>
            </div>

            {/* Progress Bar - Full Width */}
            <div className="w-full bg-muted rounded-full h-2.5 mt-4">
              <div
                className={cn(
                  "h-2.5 rounded-full transition-all duration-300",
                  isComplete ? "bg-green-600" : "bg-primary"
                )}
                style={{ width: `${completion}%` }}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-2 pt-0">
            {tasks
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
              className="w-full mt-4"
            >
              <Plus className="w-3 h-3 mr-2" />
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
