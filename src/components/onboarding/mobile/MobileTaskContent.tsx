import { useState } from "react";
import { OnboardingTask } from "@/types/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Calendar as CalendarIcon, Pencil, Trash2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TaskFileUpload } from "../TaskFileUpload";
import { TaskFilePreview } from "../TaskFilePreview";

interface MobileTaskContentProps {
  task: OnboardingTask;
  onUpdate: () => void;
  isAdmin?: boolean;
  onEditTask?: () => void;
  onDeleteTask?: () => void;
}

export const MobileTaskContent = ({ 
  task, 
  onUpdate, 
  isAdmin = false,
  onEditTask,
  onDeleteTask 
}: MobileTaskContentProps) => {
  const [fieldValue, setFieldValue] = useState(task.field_value || "");
  const [isSaving, setIsSaving] = useState(false);
  const [date, setDate] = useState<Date | undefined>(
    task.field_value && task.field_type === "date" ? new Date(task.field_value) : undefined
  );
  const [attachmentsKey, setAttachmentsKey] = useState(0);

  const isCompleted = task.status === "completed";

  const handleSave = async (value: string) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const hasData = value.trim().length > 0;
      
      await supabase
        .from("onboarding_tasks")
        .update({
          field_value: value || null,
          status: hasData ? "completed" : "pending",
          completed_date: hasData ? new Date().toISOString() : null,
          completed_by: hasData ? user?.id : null,
        })
        .eq("id", task.id);

      toast.success("Saved");
      onUpdate();
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkComplete = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from("onboarding_tasks")
        .update({
          status: "completed",
          completed_date: new Date().toISOString(),
          completed_by: user?.id,
        })
        .eq("id", task.id);

      toast.success("Marked complete");
      onUpdate();
    } catch (error) {
      console.error("Failed to mark complete:", error);
      toast.error("Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = () => {
    switch (task.field_type) {
      case "checkbox":
        return (
          <div className="flex items-center gap-3">
            <Checkbox
              id={task.id}
              checked={isCompleted}
              onCheckedChange={(checked) => handleSave(checked ? "true" : "false")}
              className="w-6 h-6"
            />
            <Label htmlFor={task.id} className="text-base cursor-pointer">
              {task.description || "Complete this task"}
            </Label>
          </div>
        );

      case "textarea":
        return (
          <div className="space-y-3">
            <Textarea
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              placeholder={task.description || "Enter details..."}
              rows={3}
              className="text-base rounded-xl resize-none"
            />
            <Button
              onClick={() => handleSave(fieldValue)}
              disabled={isSaving}
              className="w-full h-12 rounded-xl text-base font-medium"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        );

      case "date":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full h-12 justify-start text-left font-normal text-base rounded-xl",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-3 h-5 w-5" />
                {date ? format(date, "PPP") : "Select a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(newDate) => {
                  setDate(newDate);
                  if (newDate) handleSave(format(newDate, "yyyy-MM-dd"));
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case "file":
        return (
          <div className="space-y-3">
            <TaskFilePreview 
              key={attachmentsKey}
              taskId={task.id} 
              onFilesChange={() => {
                setAttachmentsKey(prev => prev + 1);
                onUpdate();
              }}
            />
            <TaskFileUpload 
              taskId={task.id}
              taskTitle={task.title}
              projectId={task.project_id}
              onFilesUploaded={() => {
                setAttachmentsKey(prev => prev + 1);
                onUpdate();
              }} 
            />
          </div>
        );

      case "currency":
        return (
          <div className="space-y-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-base">$</span>
              <Input
                type="number"
                step="0.01"
                value={fieldValue}
                onChange={(e) => setFieldValue(e.target.value)}
                placeholder="0.00"
                className="pl-8 h-12 text-base rounded-xl"
              />
            </div>
            <Button
              onClick={() => handleSave(fieldValue)}
              disabled={isSaving}
              className="w-full h-12 rounded-xl text-base font-medium"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        );

      case "radio":
        return (
          <RadioGroup
            value={fieldValue}
            onValueChange={(value) => {
              setFieldValue(value);
              handleSave(value);
            }}
            className="space-y-2"
          >
            {["Yes", "No"].map((option) => (
              <div 
                key={option}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border transition-colors",
                  fieldValue === option 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:bg-muted/50"
                )}
              >
                <RadioGroupItem value={option} id={`${task.id}-${option}`} />
                <Label htmlFor={`${task.id}-${option}`} className="text-base flex-1 cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "phone":
        return (
          <div className="space-y-3">
            <Input
              type="tel"
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              placeholder="Enter phone number"
              className="h-12 text-base rounded-xl"
            />
            <Button
              onClick={() => handleSave(fieldValue)}
              disabled={isSaving}
              className="w-full h-12 rounded-xl text-base font-medium"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        );

      default: // text
        return (
          <div className="space-y-3">
            <Input
              type="text"
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              placeholder={task.description || "Enter value..."}
              className="h-12 text-base rounded-xl"
            />
            <Button
              onClick={() => handleSave(fieldValue)}
              disabled={isSaving}
              className="w-full h-12 rounded-xl text-base font-medium"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Description */}
      {task.description && (
        <p className="text-[14px] text-muted-foreground leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Field Input */}
      {renderField()}

      {/* File attachments for non-file fields */}
      {!["section_header", "file", "checkbox"].includes(task.field_type) && (
        <div className="pt-2">
          <TaskFilePreview 
            key={attachmentsKey + 1}
            taskId={task.id} 
            onFilesChange={() => {
              setAttachmentsKey(prev => prev + 1);
              onUpdate();
            }}
          />
        </div>
      )}

      {/* Mark Complete Button (when not auto-completed) */}
      {!isCompleted && !["checkbox"].includes(task.field_type) && (
        <Button
          onClick={handleMarkComplete}
          variant="outline"
          disabled={isSaving}
          className="w-full h-12 rounded-xl text-base font-medium gap-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
        >
          <CheckCircle2 className="w-5 h-5" />
          Mark Complete
        </Button>
      )}

      {/* Admin Actions */}
      {isAdmin && (
        <div className="flex gap-2 pt-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEditTask}
            className="flex-1 h-10 gap-2 text-muted-foreground"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteTask}
            className="flex-1 h-10 gap-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
};
