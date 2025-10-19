import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface UpdateDueDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
  currentDueDate: string;
  onUpdate: () => void;
}

export const UpdateDueDateDialog = ({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  currentDueDate,
  onUpdate,
}: UpdateDueDateDialogProps) => {
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(
    currentDueDate ? new Date(currentDueDate) : undefined
  );
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!newDueDate) {
      toast({
        title: "Date Required",
        description: "Please select a new due date.",
        variant: "destructive",
      });
      return;
    }

    if (!comment.trim()) {
      toast({
        title: "Reason Required",
        description: "Please enter a reason for changing the due date.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("onboarding_tasks")
        .update({
          due_date: format(newDueDate, "yyyy-MM-dd"),
          notes: comment.trim(),
        })
        .eq("id", taskId);

      if (error) throw error;

      toast({
        title: "Due Date Updated",
        description: "The task due date has been updated successfully.",
      });

      onUpdate();
      onOpenChange(false);
      setComment("");
    } catch (error) {
      console.error("Error updating due date:", error);
      toast({
        title: "Error",
        description: "Failed to update due date. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Due Date</DialogTitle>
          <DialogDescription>
            Change the due date for this task. You must provide a reason for the change.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Task: <span className="font-semibold text-foreground">{taskTitle}</span>
            </p>
            {currentDueDate && (
              <p className="text-sm text-muted-foreground">
                Current due date: <span className="font-semibold text-foreground">
                  {format(new Date(currentDueDate), "MMM d, yyyy")}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New Due Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !newDueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newDueDate ? format(newDueDate, "PPP") : "Select new date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newDueDate}
                  onSelect={setNewDueDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Reason for Change <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="Explain why the due date needs to be changed..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              This helps maintain accountability and provides context for the change.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !newDueDate || !comment.trim()}>
            {loading ? "Updating..." : "Update Due Date"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
