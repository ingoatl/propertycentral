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
import { CalendarIcon, Upload, FileText, CheckCircle2 } from "lucide-react";
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
  const [uploading, setUploading] = useState(false);

  const autoSave = async (value: string, isCompleted: boolean = true) => {
    try {
      const updateData: any = {
        field_value: value,
        notes,
        status: isCompleted && value ? "completed" : "pending",
        completed_date: isCompleted && value ? new Date().toISOString() : null,
      };

      await supabase
        .from("onboarding_tasks")
        .update(updateData)
        .eq("id", task.id);

      // Update the UI after save
      onUpdate();
    } catch (error) {
      console.error("Failed to auto-save task:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${task.project_id}/${task.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('onboarding-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Update task with file path
      await supabase
        .from("onboarding_tasks")
        .update({
          file_path: fileName,
          field_value: file.name,
          status: "completed",
          completed_date: new Date().toISOString(),
        })
        .eq("id", task.id);

      setFieldValue(file.name);
      onUpdate();
    } catch (error: any) {
      console.error("Failed to upload file:", error);
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleCheckboxChange = async (checked: boolean) => {
    await autoSave(checked ? "true" : "false", checked);
  };

  const handleInputChange = (value: string) => {
    setFieldValue(value);
  };

  const handleInputBlur = () => {
    if (fieldValue !== task.field_value) {
      autoSave(fieldValue);
    }
  };

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate);
    if (newDate) {
      autoSave(format(newDate, "yyyy-MM-dd"));
    }
  };

  const handleRadioChange = (value: string) => {
    setFieldValue(value);
    autoSave(value);
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
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={handleInputBlur}
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
                  onSelect={handleDateChange}
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
              <Input 
                type="file" 
                onChange={handleFileUpload}
                disabled={uploading}
                className="flex-1"
              />
              {task.file_path && (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              )}
            </div>
            {uploading && (
              <p className="text-xs text-muted-foreground">Uploading...</p>
            )}
            {task.file_path && !uploading && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <FileText className="w-4 h-4" />
                <span>{task.field_value || "File uploaded"}</span>
              </div>
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
                onChange={(e) => handleInputChange(e.target.value)}
                onBlur={handleInputBlur}
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
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={handleInputBlur}
              placeholder="(555) 123-4567"
            />
          </div>
        );

      case "radio":
        return (
          <div className="space-y-2">
            <Label>{task.title}</Label>
            <RadioGroup value={fieldValue} onValueChange={handleRadioChange}>
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
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={handleInputBlur}
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
        {renderField()}
      </CardContent>
    </Card>
  );
};
