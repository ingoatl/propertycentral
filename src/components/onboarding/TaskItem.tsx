import { useState } from "react";
import { OnboardingTask } from "@/types/onboarding";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Upload, Save, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TaskItemProps {
  task: OnboardingTask;
  onUpdate: () => void;
}

export const TaskItem = ({ task, onUpdate }: TaskItemProps) => {
  const [fieldValue, setFieldValue] = useState(task.field_value || "");
  const [notes, setNotes] = useState(task.notes || "");
  const [date, setDate] = useState<Date | undefined>(
    task.field_value && task.field_type === "date" ? new Date(task.field_value) : undefined
  );
  const [saving, setSaving] = useState(false);

  const handleCheckboxChange = async (checked: boolean) => {
    try {
      const { error } = await supabase
        .from("onboarding_tasks")
        .update({
          status: checked ? "completed" : "pending",
          completed_date: checked ? new Date().toISOString() : null,
          field_value: checked ? "true" : "false",
        })
        .eq("id", task.id);

      if (error) throw error;
      // Update parent without triggering re-renders that might close modal
      setTimeout(() => onUpdate(), 50);
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleSave = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      setSaving(true);
      const updateData: any = {
        field_value: fieldValue,
        notes,
        status: fieldValue ? "completed" : "pending",
        completed_date: fieldValue ? new Date().toISOString() : null,
      };

      if (task.field_type === "date" && date) {
        updateData.field_value = format(date, "yyyy-MM-dd");
      }

      const { error } = await supabase
        .from("onboarding_tasks")
        .update(updateData)
        .eq("id", task.id);

      if (error) throw error;
      // Update parent without triggering re-renders that might close modal
      setTimeout(() => onUpdate(), 50);
    } catch (error) {
      console.error("Failed to save task:", error);
    } finally {
      setSaving(false);
    }
  };

  const renderField = () => {
    switch (task.field_type) {
      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={task.id}
              checked={task.status === "completed"}
              onCheckedChange={handleCheckboxChange}
            />
            <Label htmlFor={task.id} className="cursor-pointer">
              {task.title}
            </Label>
          </div>
        );

      case "textarea":
        return (
          <div className="space-y-2">
            <Label>{task.title}</Label>
            <Textarea
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              placeholder={task.description || "Enter details..."}
              rows={3}
            />
          </div>
        );

      case "date":
        return (
          <div className="space-y-2">
            <Label>{task.title}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        );

      case "file":
        return (
          <div className="space-y-2">
            <Label>{task.title}</Label>
            <div className="flex items-center gap-2">
              <Input type="file" />
              <Button size="sm" variant="outline">
                <Upload className="w-4 h-4" />
              </Button>
            </div>
            {task.file_path && (
              <p className="text-xs text-muted-foreground">File uploaded</p>
            )}
          </div>
        );

      case "currency":
        return (
          <div className="space-y-2">
            <Label>{task.title}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                value={fieldValue}
                onChange={(e) => setFieldValue(e.target.value)}
                className="pl-7"
                placeholder="0.00"
              />
            </div>
          </div>
        );

      case "phone":
        return (
          <div className="space-y-2">
            <Label>{task.title}</Label>
            <Input
              type="tel"
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
        );

      case "radio":
        return (
          <div className="space-y-2">
            <Label>{task.title}</Label>
            <RadioGroup value={fieldValue} onValueChange={setFieldValue}>
              {["Yes", "No", "N/A"].map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${task.id}-${option}`} />
                  <Label htmlFor={`${task.id}-${option}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            <Label>{task.title}</Label>
            <Input
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              placeholder={task.description || "Enter value..."}
            />
          </div>
        );
    }
  };

  return (
    <Card className={cn(
      "transition-colors",
      task.status === "completed" && "bg-green-50 border-green-200"
    )}>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {renderField()}

          {task.field_type !== "checkbox" && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes..."
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="outline" size="sm">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Comments
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
