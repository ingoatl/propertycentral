import { useState, useEffect } from "react";
import { OnboardingTask, OnboardingSOP } from "@/types/onboarding";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Upload, FileText, CheckCircle2, Edit2, Copy, Check, Loader2, Settings, MessageSquare, Trash2, BookOpen, User, Clock } from "lucide-react";
import { format, addWeeks, isBefore, startOfDay, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PinVerificationDialog } from "./PinVerificationDialog";
import { InlineComments } from "./InlineComments";
import { SOPDialog } from "./SOPDialog";
import { SOPFormDialog } from "./SOPFormDialog";
import { TaskAssignmentDialog } from "./TaskAssignmentDialog";
import { RescheduleDueDateDialog } from "./RescheduleDueDateDialog";
import { UpdateDueDateDialog } from "./UpdateDueDateDialog";
import { EditTaskDialog } from "./EditTaskDialog";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskDueDateDisplay } from "./TaskDueDateDisplay";
import { TaskRescheduleHistoryLog } from "./TaskRescheduleHistoryLog";
import { AdminControlsSidebar } from "./AdminControlsSidebar";

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
  const [showNAField, setShowNAField] = useState(false);
  const [naReason, setNAReason] = useState("");
  const [taskStatus, setTaskStatus] = useState(task.status);
  const [copied, setCopied] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [sop, setSOP] = useState<OnboardingSOP | null>(null);
  const [showSOPDialog, setShowSOPDialog] = useState(false);
  const [showSOPFormDialog, setShowSOPFormDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showUpdateDueDateDialog, setShowUpdateDueDateDialog] = useState(false);
  const [showEditTaskDialog, setShowEditTaskDialog] = useState(false);
  
  const { isAdmin } = useAdminCheck();
  const hasValue = task.field_value && task.field_value.trim() !== "";
  const isReadOnly = hasValue && !isAdmin && !isEditing;
  
  const isDueDateOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "completed";

  useEffect(() => {
    loadSOP();
  }, [task.id]);

  const loadSOP = async () => {
    const { data } = await supabase
      .from("onboarding_sops")
      .select("*")
      .eq("project_id", task.project_id)
      .eq("task_id", task.id)
      .is("phase_number", null)
      .maybeSingle();

    setSOP(data);
  };

  const handleSOPSuccess = () => {
    loadSOP();
  };

  const handleDueDateClick = () => {
    if (isDueDateOverdue) {
      setShowRescheduleDialog(true);
    } else {
      setShowUpdateDueDateDialog(true);
    }
  };


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
      // Task is complete if any data exists: field_value, file_path, or notes
      const hasData = value || task.file_path || notesValue;
      const newStatus = isCompleted && hasData ? "completed" : "pending";
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
      onUpdate(); // Trigger progress update
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
      setNotes(naReason);
      setShowNAField(false);
      setTaskStatus("completed");
      toast.success("Marked as not applicable");
      onUpdate(); // Trigger progress update
    } catch (error) {
      console.error("Failed to mark as N/A:", error);
      toast.error("Failed to save");
    }
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

  const handlePinVerified = () => {
    handleDeleteTask();
  };

  const handleRequestEdit = () => {
    setShowEditTaskDialog(true);
  };

  const handleRequestDelete = () => {
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
            {task.field_value !== "N/A" && (
              <>
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
                {!hasValue && !showNAField && (
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
            )}
            
            {showNAField && task.field_value !== "N/A" && (
              <div className="space-y-2">
                <Textarea
                  value={naReason}
                  onChange={(e) => setNAReason(e.target.value)}
                  placeholder="Reason for N/A..."
                  rows={2}
                  className="text-xs"
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
                    {task.notes && <p className="text-xs text-amber-700 mt-0.5">{task.notes}</p>}
                  </div>
                  {isAdmin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFieldValue("");
                        setShowNAField(false);
                        autoSave("", false, "");
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case "date":
        return (
          <div className="space-y-2">
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
            {!hasValue && !showNAField && task.field_value !== "N/A" && (
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
            
            {showNAField && task.field_value !== "N/A" && (
              <div className="space-y-2">
                <Textarea
                  value={naReason}
                  onChange={(e) => setNAReason(e.target.value)}
                  placeholder="Reason for N/A..."
                  rows={2}
                  className="text-xs"
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
                    {task.notes && <p className="text-xs text-amber-700 mt-0.5">{task.notes}</p>}
                  </div>
                  {isAdmin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFieldValue("");
                        setShowNAField(false);
                        autoSave("", false, "");
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case "phone":
        return (
          <div className="space-y-2">
            {task.field_value !== "N/A" && (
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
            )}
            {!hasValue && !showNAField && task.field_value !== "N/A" && (
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
            
            {showNAField && task.field_value !== "N/A" && (
              <div className="space-y-2">
                <Textarea
                  value={naReason}
                  onChange={(e) => setNAReason(e.target.value)}
                  placeholder="Reason for N/A..."
                  rows={2}
                  className="text-xs"
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
                    {task.notes && <p className="text-xs text-amber-700 mt-0.5">{task.notes}</p>}
                  </div>
                  {isAdmin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFieldValue("");
                        setShowNAField(false);
                        autoSave("", false, "");
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case "radio":
        return (
          <div className="space-y-2">
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
            
            {task.field_value !== "N/A" && (
              <>
                <Input
                  value={fieldValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onBlur={handleInputBlur}
                  placeholder={task.description || "Enter value..."}
                  disabled={isReadOnly}
                  className={cn(
                    "h-7 text-xs",
                    isReadOnly && "border-green-200 bg-green-50/30 text-foreground font-medium"
                  )}
                />
                
                {/* Show clickable link if it's a URL */}
                {fieldValue && (fieldValue.startsWith('http://') || fieldValue.startsWith('https://')) && (
                  <a
                    href={fieldValue}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <FileText className="w-3 h-3" />
                    Open link
                  </a>
                )}
              </>
            )}
            
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
            
            {!hasValue && !showNAField && task.field_value !== "N/A" && (
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
            
            {showNAField && task.field_value !== "N/A" && (
              <div className="space-y-2">
                <Textarea
                  value={naReason}
                  onChange={(e) => setNAReason(e.target.value)}
                  placeholder="Reason for N/A..."
                  rows={2}
                  className="text-xs"
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
                    {task.notes && <p className="text-xs text-amber-700 mt-0.5">{task.notes}</p>}
                  </div>
                  {isAdmin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFieldValue("");
                        setShowNAField(false);
                        autoSave("", false, "");
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
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
      <Card 
        id={`task-${task.id}`}
        className={cn(
          "transition-colors overflow-hidden",
          taskStatus === "completed" && "border-green-500/50"
        )}
      >
        {/* HEADER SECTION - Prominent Title & Status */}
        <div className="bg-muted/30 p-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-[20px] font-bold leading-tight mb-1">{task.title}</h3>
              {task.description && (
                <p className="text-sm text-muted-foreground">{task.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <TaskStatusBadge status={taskStatus} dueDate={task.due_date} />
            </div>
          </div>
        </div>

        {/* MAIN CONTENT + ADMIN SIDEBAR */}
        <div className="flex">
          {/* LEFT: Main Content (VA-focused) */}
          <div className="flex-1 p-4 space-y-4">
            {/* Due Date & Assignment Info */}
            <div className="flex gap-3 flex-wrap items-center">
              {task.due_date && (
                <TaskDueDateDisplay
                  dueDate={task.due_date}
                  status={taskStatus}
                  onClick={handleDueDateClick}
                />
              )}
              
              {task.assigned_to_uuid && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>Assigned to: <span className="font-medium">{task.assigned_to}</span></span>
                </div>
              )}
            </div>

            {/* Field Input */}
            <div>
              {renderField()}
            </div>

            {/* Reschedule History Log */}
            <TaskRescheduleHistoryLog taskId={task.id} />

            {/* Comments Section */}
            <InlineComments taskId={task.id} />
          </div>

          {/* RIGHT: Admin Sidebar */}
          {isAdmin && (
            <AdminControlsSidebar
              task={task}
              sop={sop}
              onEditTask={handleRequestEdit}
              onDeleteTask={handleRequestDelete}
              onViewSOP={() => setShowSOPDialog(true)}
              onEditSOP={() => setShowSOPFormDialog(true)}
              onAssignTask={() => setShowAssignmentDialog(true)}
              onUpdateDueDate={handleDueDateClick}
            />
          )}
        </div>
      </Card>

      <PinVerificationDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        onVerified={handlePinVerified}
      />

      <SOPDialog
        sop={sop}
        open={showSOPDialog}
        onOpenChange={setShowSOPDialog}
      />

      <SOPFormDialog
        projectId={task.project_id}
        taskId={task.id}
        existingSOP={sop}
        open={showSOPFormDialog}
        onOpenChange={setShowSOPFormDialog}
        onSuccess={handleSOPSuccess}
      />

      <TaskAssignmentDialog
        open={showAssignmentDialog}
        onOpenChange={setShowAssignmentDialog}
        taskId={task.id}
        projectId={task.project_id}
        phaseNumber={task.phase_number}
        currentAssignedToUuid={task.assigned_to_uuid || null}
        onUpdate={onUpdate}
      />

      <RescheduleDueDateDialog
        open={showRescheduleDialog}
        onOpenChange={setShowRescheduleDialog}
        taskId={task.id}
        taskTitle={task.title}
        currentDueDate={task.due_date || ""}
        originalDueDate={(task.original_due_date && task.original_due_date.trim()) || task.due_date || ""}
        onUpdate={onUpdate}
      />

      <UpdateDueDateDialog
        open={showUpdateDueDateDialog}
        onOpenChange={setShowUpdateDueDateDialog}
        task={task}
        onUpdate={onUpdate}
      />

      <EditTaskDialog
        task={task}
        open={showEditTaskDialog}
        onOpenChange={setShowEditTaskDialog}
        onSuccess={onUpdate}
      />
    </>
  );
};
