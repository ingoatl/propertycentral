import { useState } from "react";
import { PhaseDefinition, OnboardingTask } from "@/types/onboarding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Lock, CheckCircle2, Plus } from "lucide-react";
import { TaskItem } from "./TaskItem";
import { AddTaskDialog } from "./AddTaskDialog";
import { cn } from "@/lib/utils";

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

  return (
    <Card className={cn(
      "transition-all",
      isComplete && "border-green-500/50",
      highlighted && "ring-2 ring-blue-500 shadow-lg"
    )}>
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1 text-left">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono">
                    Phase {phase.id}
                  </Badge>
                  {isComplete && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                  <CardTitle className="text-lg">{phase.title}</CardTitle>
                </div>
                <CardDescription className="mt-2">{phase.description}</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-medium">{Math.round(completion)}%</div>
                  <div className="text-xs text-muted-foreground">
                    {tasks.filter(t => t.status === "completed").length} / {tasks.length}
                  </div>
                </div>
                <ChevronDown className={cn(
                  "w-5 h-5 transition-transform",
                  expanded && "transform rotate-180"
                )} />
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-2 mt-4">
              <div
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  isComplete ? "bg-green-600" : "bg-primary"
                )}
                style={{ width: `${completion}%` }}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-2 pt-0">
            {tasks.map((task) => (
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
    </Card>
  );
};
