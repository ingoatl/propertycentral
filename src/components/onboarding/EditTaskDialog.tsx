import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OnboardingTask, FieldType } from "@/types/onboarding";

interface EditTaskDialogProps {
  task: OnboardingTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const EditTaskDialog = ({ task, open, onOpenChange, onSuccess }: EditTaskDialogProps) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [fieldType, setFieldType] = useState<FieldType>(task.field_type);
  const [phaseNumber, setPhaseNumber] = useState(task.phase_number.toString());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(task.title);
      setDescription(task.description || "");
      setFieldType(task.field_type);
      setPhaseNumber(task.phase_number.toString());
    }
  }, [open, task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("onboarding_tasks")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          field_type: fieldType,
          phase_number: parseInt(phaseNumber),
        })
        .eq("id", task.id);

      if (error) throw error;

      toast.success("Task updated successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update task:", error);
      toast.error("Failed to update task");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description (optional)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fieldType">Field Type</Label>
            <Select value={fieldType} onValueChange={(value) => setFieldType(value as FieldType)}>
              <SelectTrigger id="fieldType">
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
                <SelectItem value="section_header">Section Header</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phase">Phase Number</Label>
            <Select value={phaseNumber} onValueChange={setPhaseNumber}>
              <SelectTrigger id="phase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    Phase {num}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
