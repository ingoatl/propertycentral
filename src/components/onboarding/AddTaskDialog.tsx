import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { FieldType } from "@/types/onboarding";
import { TaskFileUpload } from "./TaskFileUpload";

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phaseNumber: number;
  phaseTitle: string;
  onSuccess: () => void;
}

export const AddTaskDialog = ({
  open,
  onOpenChange,
  projectId,
  phaseNumber,
  phaseTitle,
  onSuccess,
}: AddTaskDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [submitting, setSubmitting] = useState(false);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Create task template for all future projects
      const { error: templateError } = await supabase
        .from("task_templates")
        .insert({
          phase_number: phaseNumber,
          task_title: title.trim(),
          field_type: fieldType,
        });

      if (templateError) throw templateError;

      // Step 2: Get all existing projects
      const { data: projects, error: projectsError } = await supabase
        .from("onboarding_projects")
        .select("id");

      if (projectsError) throw projectsError;

      // Step 3: Create task instance for all existing projects in this phase
      if (projects && projects.length > 0) {
        const taskInstances = projects.map(project => ({
          project_id: project.id,
          phase_number: phaseNumber,
          phase_title: phaseTitle,
          title: title.trim(),
          description: description.trim() || null,
          field_type: fieldType,
          status: "pending" as const,
        }));

        const { data: insertedTasks, error: tasksError } = await supabase
          .from("onboarding_tasks")
          .insert(taskInstances)
          .select();

        if (tasksError) throw tasksError;
        
        // Store the first created task ID for file uploads
        if (insertedTasks && insertedTasks.length > 0) {
          setCreatedTaskId(insertedTasks[0].id);
        }
      }

      toast.success(`Task added globally to all ${projects?.length || 0} properties`);
      setTitle("");
      setDescription("");
      setFieldType("text");
      onSuccess();
    } catch (error) {
      console.error("Failed to add task:", error);
      toast.error("Failed to add task globally");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setFieldType("text");
    setCreatedTaskId(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>
            Add a new task to {phaseTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fieldType">Field Type</Label>
            <Select value={fieldType} onValueChange={(value) => setFieldType(value as FieldType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text Input</SelectItem>
                <SelectItem value="textarea">Text Area</SelectItem>
                <SelectItem value="checkbox">Checkbox</SelectItem>
                <SelectItem value="date">Date Picker</SelectItem>
                <SelectItem value="file">File Upload</SelectItem>
                <SelectItem value="currency">Currency</SelectItem>
                <SelectItem value="phone">Phone Number</SelectItem>
                <SelectItem value="radio">Radio Buttons</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {createdTaskId && (
            <TaskFileUpload taskId={createdTaskId} />
          )}

          <div className="flex gap-2">
            {createdTaskId ? (
              <Button
                type="button"
                onClick={handleClose}
                className="w-full"
              >
                Done
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Task"
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
