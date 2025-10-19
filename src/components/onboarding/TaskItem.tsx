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
import { CalendarIcon, Upload, FileText, CheckCircle2, Edit2, Copy, Check, Loader2, Settings, MessageSquare, Trash2, BookOpen, Paperclip } from "lucide-react";
import { format, addWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PinVerificationDialog } from "./PinVerificationDialog";
import { InlineComments } from "./InlineComments";
import { SOPDialog } from "./SOPDialog";
import { SOPFormDialog } from "./SOPFormDialog";
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
  const [showNAField, setShowNAField] = useState(false);
  const [naReason, setNAReason] = useState("");
  const [taskStatus, setTaskStatus] = useState(task.status);
  const [copied, setCopied] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [sop, setSOP] = useState<OnboardingSOP | null>(null);
  const [showSOPDialog, setShowSOPDialog] = useState(false);
  const [showSOPFormDialog, setShowSOPFormDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [approvedUsers, setApprovedUsers] = useState<any[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  const hasValue = task.field_value && task.field_value.trim() !== "";
  const isReadOnly = hasValue && !isAdmin && !isEditing;
  const hasProof = !!(task.file_path || (fieldValue && fieldValue.startsWith('http')) || (fieldValue && fieldValue !== "N/A" && fieldValue.length > 10));

  useEffect(() => {
    checkAdminRole();
    loadSOP();
    loadApprovedUsers();
  }, [task.id]);

  const checkAdminRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    setIsAdmin(roles?.some(r => r.role === "admin") || false);
  };

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

  const loadApprovedUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, first_name")
      .eq("status", "approved")
      .order("first_name");

    setApprovedUsers(data || []);
  };

  const handleSOPSuccess = () => {
    loadSOP();
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
      // Validate proof requirement if completing
      if (isCompleted && task.requires_proof) {
        const proof = 
          task.file_path || 
          (value && value.startsWith('http')) || 
          (value && value !== "N/A" && value.length > 10);
        
        if (!proof) {
          toast.error("This task requires proof (file, link, or detailed notes)");
          return;
        }
      }

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
      onUpdate(); // Trigger progress update
    } catch (error) {
      console.error("Failed to auto-save task:", error);
    }
  };

  const handleReassign = async (userId: string) => {
    try {
      // Convert "unassigned" to null
      const actualUserId = userId === "unassigned" ? null : userId;
      
      const updateData: any = { assigned_to_uuid: actualUserId };

      // If "Save as template" is checked, also update the template
      if (saveAsTemplate && actualUserId) {
        const { data: roleData } = await supabase
          .from("user_team_roles")
          .select("role_id")
          .eq("user_id", actualUserId)
          .eq("is_primary", true)
          .maybeSingle();

        if (roleData?.role_id) {
          updateData.assigned_role_id = roleData.role_id;

          // Upsert task template
          await supabase.from("task_templates").upsert({
            phase_number: task.phase_number,
            task_title: task.title,
            default_role_id: roleData.role_id,
            field_type: task.field_type,
          }, {
            onConflict: "phase_number,task_title",
          });

          toast.success("Assignment saved as template for future projects");
        }
      }

      await supabase
        .from("onboarding_tasks")
        .update(updateData)
        .eq("id", task.id);

      toast.success("Task reassigned");
      onUpdate();
    } catch (error: any) {
      toast.error("Failed to reassign task");
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
    setIsEditing(true);
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
          <div className="flex items-center justify-between">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                >
                  <Settings className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRequestEdit}>
                  <Edit2 className="w-3 h-3 mr-2" />
                  Edit Field
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleRequestDelete}
                  className="text-destructive"
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <InlineComments taskId={task.id} />
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
                {hasValue && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-6 px-2 text-xs"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                  >
                    <Settings className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleRequestEdit}>
                    <Edit2 className="w-3 h-3 mr-2" />
                    Edit Field
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRequestDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                  >
                    <Settings className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleRequestEdit}>
                    <Edit2 className="w-3 h-3 mr-2" />
                    Edit Field
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRequestDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <InlineComments taskId={task.id} />
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                  >
                    <Settings className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleRequestEdit}>
                    <Edit2 className="w-3 h-3 mr-2" />
                    Edit Field
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRequestDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <InlineComments taskId={task.id} />
            
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
                {hasValue && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-6 px-2 text-xs"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                  >
                    <Settings className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleRequestEdit}>
                    <Edit2 className="w-3 h-3 mr-2" />
                    Edit Field
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRequestDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <InlineComments taskId={task.id} />
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
                {hasValue && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-6 px-2 text-xs"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                  >
                    <Settings className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleRequestEdit}>
                    <Edit2 className="w-3 h-3 mr-2" />
                    Edit Field
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRequestDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <InlineComments taskId={task.id} />
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                  >
                    <Settings className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleRequestDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <InlineComments taskId={task.id} />
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
                    Edit Field
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRequestDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <InlineComments taskId={task.id} />
            
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
      <Card className={cn(
        "transition-colors py-2 border-2",
        taskStatus === "completed" && hasProof && "bg-green-50/50 border-green-500"
      )}>
        <CardContent className="py-2 px-3">
          {/* Assignment Row */}
          <div className="flex items-center gap-2 mb-2 p-2 bg-muted/30 rounded text-xs">
            <Label className="min-w-[70px]">Assigned:</Label>
            <Select value={task.assigned_to_uuid || "unassigned"} onValueChange={handleReassign}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {approvedUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name || user.email.split('@')[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Checkbox 
              id={`tpl-${task.id}`}
              checked={saveAsTemplate}
              onCheckedChange={(c) => setSaveAsTemplate(c as boolean)}
            />
            <Label htmlFor={`tpl-${task.id}`} className="cursor-pointer whitespace-nowrap">Template</Label>
          </div>

          {/* Proof Badges */}
          {task.requires_proof && taskStatus !== "completed" && (
            <Badge variant="outline" className="mb-2 text-xs gap-1 bg-amber-50">
              <Paperclip className="w-3 h-3" />Proof Required
            </Badge>
          )}
          {taskStatus === "completed" && hasProof && (
            <Badge variant="outline" className="mb-2 text-xs gap-1 bg-green-50 border-green-500">
              <CheckCircle2 className="w-3 h-3" />Proof Provided
            </Badge>
          )}
          
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              {renderField()}
            </div>
            {/* SOP Buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSOPFormDialog(true)}
                  className="h-7 px-2"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  {sop ? "Edit" : "Add"} SOP
                </Button>
              )}
              {sop && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSOPDialog(true)}
                  className="h-7 px-2"
                >
                  <BookOpen className="w-3 h-3 mr-1" />
                  View SOP
                </Button>
              )}
            </div>
          </div>
        </CardContent>
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
    </>
  );
};
