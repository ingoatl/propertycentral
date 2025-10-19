import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Calendar, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { OnboardingTask } from "@/types/onboarding";

interface TaskWithProject extends OnboardingTask {
  onboarding_projects?: {
    owner_name: string;
    property_address: string;
  };
}

interface ActiveTasksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: TaskWithProject[];
}

export const ActiveTasksModal = ({ open, onOpenChange, tasks }: ActiveTasksModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Active Tasks ({tasks.length})</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => {
                  navigate(`/properties?openWorkflow=${task.project_id}&taskId=${task.id}`);
                  onOpenChange(false);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{task.title}</p>
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </div>
                    {task.onboarding_projects && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          {task.onboarding_projects.property_address}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {task.onboarding_projects.owner_name}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs">
                        {task.phase_title}
                      </Badge>
                      {task.due_date && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span className="text-xs">
                            Due: {format(new Date(task.due_date), "MMM d, yyyy")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                No active tasks found
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
