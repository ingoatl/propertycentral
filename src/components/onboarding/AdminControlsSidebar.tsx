import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Edit2, BookOpen, FileText, User, Calendar, Trash2, MessageCircleQuestion } from "lucide-react";
import { OnboardingTask, OnboardingSOP } from "@/types/onboarding";

interface AdminControlsSidebarProps {
  task: OnboardingTask;
  sop: OnboardingSOP | null;
  onEditTask: () => void;
  onDeleteTask: () => void;
  onViewSOP: () => void;
  onEditSOP: () => void;
  onAssignTask: () => void;
  onUpdateDueDate: () => void;
  onAddFAQ: () => void;
}

export const AdminControlsSidebar = ({
  task,
  sop,
  onEditTask,
  onDeleteTask,
  onViewSOP,
  onEditSOP,
  onAssignTask,
  onUpdateDueDate,
  onAddFAQ,
}: AdminControlsSidebarProps) => {
  return (
    <div className="w-48 border-l bg-muted/10 p-3 space-y-2 flex-shrink-0">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Admin Controls
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onEditTask}
        className="w-full justify-start text-xs"
      >
        <Edit2 className="w-3 h-3 mr-2" />
        Edit Task
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onDeleteTask}
        className="w-full justify-start text-xs text-destructive hover:text-destructive"
      >
        <Trash2 className="w-3 h-3 mr-2" />
        Delete Task
      </Button>

      <Separator className="my-2" />

      {sop ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onViewSOP}
            className="w-full justify-start text-xs"
          >
            <BookOpen className="w-3 h-3 mr-2" />
            View SOP
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEditSOP}
            className="w-full justify-start text-xs"
          >
            <FileText className="w-3 h-3 mr-2" />
            Edit SOP
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={onEditSOP}
          className="w-full justify-start text-xs"
        >
          <FileText className="w-3 h-3 mr-2" />
          Add SOP
        </Button>
      )}

      <Separator className="my-2" />

      <Button
        variant="outline"
        size="sm"
        onClick={onAssignTask}
        className="w-full justify-start text-xs"
      >
        <User className="w-3 h-3 mr-2" />
        {task.assigned_to_uuid ? "Reassign" : "Assign Task"}
      </Button>

      {task.assigned_to_uuid && (
        <div className="text-xs text-muted-foreground pl-2 py-1">
          Assigned to: {task.assigned_to || "User"}
        </div>
      )}

      <Separator className="my-2" />

      <Button
        variant="outline"
        size="sm"
        onClick={onAddFAQ}
        className="w-full justify-start text-xs"
      >
        <MessageCircleQuestion className="w-3 h-3 mr-2" />
        Add FAQ
      </Button>
    </div>
  );
};
