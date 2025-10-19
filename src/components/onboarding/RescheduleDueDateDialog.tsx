import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, AlertCircle } from "lucide-react";
import { format, addWeeks, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RescheduleDueDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
  currentDueDate: string;
  originalDueDate: string;
  onUpdate: () => void;
}

export const RescheduleDueDateDialog = ({ 
  open, 
  onOpenChange, 
  taskId,
  taskTitle,
  currentDueDate,
  originalDueDate,
  onUpdate 
}: RescheduleDueDateDialogProps) => {
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(
    currentDueDate ? new Date(currentDueDate) : undefined
  );
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const maxDate = addWeeks(new Date(), 4);
  const today = startOfDay(new Date());

  const handleSave = async () => {
    if (!newDueDate) {
      toast.error("Please select a new due date");
      return;
    }

    if (!comment.trim()) {
      toast.error("Please enter a reason for rescheduling");
      return;
    }

    if (isBefore(newDueDate, today)) {
      toast.error("Due date cannot be in the past");
      return;
    }

    try {
      setLoading(true);

      // Update task with new due date
      const { error } = await supabase
        .from("onboarding_tasks")
        .update({ 
          due_date: format(newDueDate, "yyyy-MM-dd"),
          notes: comment.trim()
        })
        .eq("id", taskId);

      if (error) throw error;

      toast.success("Due date rescheduled");
      onUpdate();
      onOpenChange(false);
      setComment("");
    } catch (error: any) {
      toast.error("Failed to reschedule: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reschedule Overdue Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Message */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-destructive">This task is overdue</p>
                <p className="text-muted-foreground">
                  Task: <span className="font-semibold">{taskTitle}</span>
                </p>
                {originalDueDate && (
                  <p className="text-muted-foreground">
                    Original due date: <span className="font-semibold">{format(new Date(originalDueDate), "MMM d, yyyy")}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* New Due Date */}
          <div className="space-y-2">
            <Label>New Due Date (max 4 weeks out)</Label>
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
                  {newDueDate ? format(newDueDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={newDueDate}
                  onSelect={setNewDueDate}
                  disabled={(date) => 
                    isBefore(date, today) || isBefore(maxDate, date)
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              You can reschedule up to {format(maxDate, "MMM d, yyyy")}
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason for Rescheduling *</Label>
            <Textarea
              placeholder="Please explain why this task needs to be rescheduled..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              A comment is required to reschedule an overdue task
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => {
                onOpenChange(false);
                setComment("");
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={loading || !comment.trim()}
            >
              {loading ? "Saving..." : "Reschedule Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
