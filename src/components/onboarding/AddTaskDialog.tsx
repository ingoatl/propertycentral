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

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("onboarding_tasks")
        .insert({
          project_id: projectId,
          phase_number: phaseNumber,
          phase_title: phaseTitle,
          title: title.trim(),
          description: description.trim() || null,
          field_type: fieldType,
          status: "pending",
        });

      if (error) throw error;

      toast.success("Task added successfully");
      setTitle("");
      setDescription("");
      setFieldType("text");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Failed to add task:", error);
      toast.error("Failed to add task");
    } finally {
      setSubmitting(false);
    }
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
