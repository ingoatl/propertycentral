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
import { CalendarIcon, Upload, FileText, CheckCircle2, Edit2, Copy, Check, Loader2, Settings, MessageSquare, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PinVerificationDialog } from "./PinVerificationDialog";
import { TaskCommentsDialog } from "./TaskCommentsDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [showNAField, setShowNAField] = useState(task.field_value === "N/A");
  const [naReason, setNAReason] = useState(task.notes || "");
  const [taskStatus, setTaskStatus] = useState(task.status);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showCommentsDialog, setShowCommentsDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<"edit" | "delete" | null>(null);

  const hasValue = task.field_value && task.field_value.trim() !== "";
  const isReadOnly = hasValue && !isEditing;

  const handleCopy = async () => {
    if (fieldValue) {
      await navigator.clipboard.writeText(fieldValue);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const autoSave = async (value: string, isCompleted: boolean = true, notesValue?: string) => {
    try {
      const newStatus = isCompleted && value ? "completed" : "pending";
      const updateData: any = {
        field_value: value,
        notes: notesValue ?? notes,
        status: newStatus,
        completed_date: isCompleted && value ? new Date().toISOString() : null,
      };

      await supabase
        .from("onboarding_tasks")
        .update(updateData)
        .eq("id", task.id);

      // Update local status immediately for visual feedback
      setTaskStatus(newStatus);
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
      setShowNAField(false);
      setTaskStatus("completed");
      toast.success("File uploaded successfully");
    } catch (error: any) {
      console.error("Failed to upload file:", error);
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleMarkAsNA = async () => {
    if (!naReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    try {
      await supabase
        .from("onboarding_tasks")
        .update({
          field_value: "N/A",
          notes: naReason,
          status: "completed",
          completed_date: new Date().toISOString(),
        })
        .eq("id", task.id);

      setFieldValue("N/A");
      setShowNAField(false);
      setTaskStatus("completed");
      toast.success("Marked as not applicable");
    } catch (error) {
      console.error("Failed to mark as N/A:", error);
      toast.error("Failed to save");
    }
  };

  const handlePinVerified = () => {
    if (pendingAction === "delete") {
      handleDeleteTask();
    } else if (pendingAction === "edit") {
      setIsEditing(true);
    }
    setPendingAction(null);
  };

  const handleDeleteTask = async () => {
    try {
      const { error } = await supabase
        .from("onboarding_tasks")
        .delete()
        .eq("id", task.id);

      if (error) throw error;

      toast.success("Task deleted");
      onUpdate();
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast.error("Failed to delete task");
    }
  };

  const handleRequestEdit = () => {
    setPendingAction("edit");
    setShowPinDialog(true);
  };

  const handleRequestDelete = () => {
    setPendingAction("delete");
    setShowPinDialog(true);
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
      case "section_header":
        return (
          <div className="my-6 pt-6 first:mt-0 first:pt-0 border-t-2 border-primary/30 first:border-t-0">
            <div className="bg-primary/5 -mx-4 px-4 py-3 rounded-lg">
              <h3 className="text-base font-bold text-primary uppercase tracking-wide flex items-center gap-2">
                <span className="text-xl">{task.title.split(" ")[0]}</span>
                <span>{task.title.substring(task.title.indexOf(" ") + 1)}</span>
              </h3>
            </div>
          </div>
        );

      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={task.id}
              checked={taskStatus === "completed"}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>{task.title}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await navigator.clipboard.writeText(task.title);
                    toast.success("Task name copied!");
                  }}
                  className="h-5 w-5"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              {hasValue && (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-6 px-2 text-xs"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                    className="h-6 px-2 text-xs"
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    {isEditing ? "Cancel" : "Edit"}
                  </Button>
                </div>
              )}
            </div>
            <Textarea
              value={fieldValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={handleInputBlur}
              placeholder={task.description || "Enter details..."}
              rows={2}
              disabled={isReadOnly}
              className={cn(
                "text-sm",
                isReadOnly && "border-2 border-green-200 bg-green-50/30 text-foreground font-medium resize-none"
              )}
            />
          </div>
        );

      case "date":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>{task.title}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await navigator.clipboard.writeText(task.title);
                    toast.success("Task name copied!");
                  }}
                  className="h-5 w-5"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              {hasValue && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  className="h-6 px-2 text-xs"
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  {isEditing ? "Cancel" : "Edit"}
                </Button>
              )}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isReadOnly}
                  className={cn(
                    "w-full justify-start text-left font-normal text-sm h-9",
                    !date && "text-muted-foreground",
                    isReadOnly && "border-2 border-green-200 bg-green-50/30 text-foreground font-medium"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
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
            <div className="flex items-center gap-2">
              <Label>{task.title}</Label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await navigator.clipboard.writeText(task.title);
                  toast.success("Task name copied!");
                }}
                className="h-5 w-5"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            
            {!showNAField ? (
              <>
                <div className="flex items-center gap-2">
                  <Input 
                    type="file" 
                    onChange={handleFileUpload}
                    disabled={uploading || task.field_value === "N/A"}
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
                  <a
                    href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/onboarding-documents/${task.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-green-600 hover:text-green-700 hover:underline"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{task.field_value}</span>
                  </a>
                )}
                
                {!task.file_path && task.field_value !== "N/A" && (
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowNAField(true)}
                    className="h-7 text-xs"
                  >
                    Mark as Not Applicable
                  </Button>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={naReason}
                  onChange={(e) => setNAReason(e.target.value)}
                  placeholder="Why is this not available?"
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button 
                    type="button"
                    size="sm" 
                    onClick={handleMarkAsNA}
                    className="h-7 text-xs"
                  >
                    Save
                  </Button>
                  <Button 
                    type="button"
                    size="sm" 
                    variant="outline"
                    onClick={() => setShowNAField(false)}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            
            {task.field_value === "N/A" && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-amber-900">Not Applicable</p>
                    <p className="text-xs text-amber-700 mt-0.5">{task.notes}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case "currency":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>{task.title}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await navigator.clipboard.writeText(task.title);
                    toast.success("Task name copied!");
                  }}
                  className="h-5 w-5"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              {hasValue && (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-6 px-2 text-xs"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                    className="h-6 px-2 text-xs"
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    {isEditing ? "Cancel" : "Edit"}
                  </Button>
                </div>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                value={fieldValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onBlur={handleInputBlur}
                className={cn(
                  "pl-7 h-9 text-sm",
                  isReadOnly && "border-2 border-green-200 bg-green-50/30 text-foreground font-medium"
                )}
                placeholder="0.00"
                disabled={isReadOnly}
              />
            </div>
          </div>
        );

      case "phone":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>{task.title}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await navigator.clipboard.writeText(task.title);
                    toast.success("Task name copied!");
                  }}
                  className="h-5 w-5"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              {hasValue && (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-6 px-2 text-xs"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                    className="h-6 px-2 text-xs"
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    {isEditing ? "Cancel" : "Edit"}
                  </Button>
                </div>
              )}
            </div>
            <Input
              type="tel"
              value={fieldValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={handleInputBlur}
              placeholder="(555) 123-4567"
              disabled={isReadOnly}
              className={cn(
                "h-9 text-sm",
                isReadOnly && "border-2 border-green-200 bg-green-50/30 text-foreground font-medium"
              )}
            />
          </div>
        );

      case "radio":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>{task.title}</Label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await navigator.clipboard.writeText(task.title);
                  toast.success("Task name copied!");
                }}
                className="h-5 w-5"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-medium">{task.title}</Label>
                
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCommentsDialog(true)}
                  className="h-4 w-4"
                >
                  <MessageSquare className="w-2.5 h-2.5" />
                </Button>
                
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await navigator.clipboard.writeText(task.title);
                    toast.success("Copied!");
                  }}
                  className="h-4 w-4"
                >
                  <Copy className="w-2.5 h-2.5" />
                </Button>
                
                {/* Inline screenshot upload */}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                    asChild
                  >
                    <span>
                      {uploading ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : task.file_path ? (
                        <CheckCircle2 className="w-2.5 h-2.5 text-green-600" />
                      ) : (
                        <Upload className="w-2.5 h-2.5" />
                      )}
                    </span>
                  </Button>
                </label>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                  >
                    <Settings className="w-2.5 h-2.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleRequestEdit}>
                    <Edit2 className="w-3 h-3 mr-2" />
                    Edit Task
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRequestDelete} className="text-red-600">
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <Input
              value={fieldValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={() => {
                handleInputBlur();
                if (isEditing) setIsEditing(false);
              }}
              placeholder={task.description || "Enter value..."}
              disabled={!isEditing && isReadOnly}
              className={cn(
                "h-7 text-xs",
                !isEditing && isReadOnly && "border-green-200 bg-green-50/30 text-foreground font-medium"
              )}
            />
            
            {/* Screenshot preview if uploaded */}
            {task.file_path && (
              <a
                href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/onboarding-documents/${task.file_path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-green-600 hover:underline"
              >
                <FileText className="w-3 h-3" />
                Screenshot uploaded
              </a>
            )}
            
            {/* Notes section - always show if there are notes */}
            {task.notes && (
              <div className="bg-muted/50 rounded p-1.5 border border-border/50">
                <p className="text-[10px] text-muted-foreground whitespace-pre-wrap">{task.notes}</p>
              </div>
            )}
          </div>
        );
    }
  };

  // Don't wrap section headers in cards
  if (task.field_type === "section_header") {
    return renderField();
  }

  return (
    <>
      <Card className={cn(
        "transition-colors py-2",
        taskStatus === "completed" && "bg-green-50/50 border-green-200"
      )}>
        <CardContent className="py-2 px-3">
          {renderField()}
        </CardContent>
      </Card>

      <PinVerificationDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        onVerified={handlePinVerified}
      />

      <TaskCommentsDialog
        open={showCommentsDialog}
        onOpenChange={setShowCommentsDialog}
        taskId={task.id}
        taskTitle={task.title}
      />
    </>
  );
};
