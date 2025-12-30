import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { OnboardingTask, OnboardingSOP } from "@/types/onboarding";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { CalendarIcon, Upload, FileText, CheckCircle2, Edit2, Copy, Check, Loader2, Settings, MessageSquare, Trash2, BookOpen, User, Clock, ChevronDown, MessageCircleQuestion, Bug } from "lucide-react";
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
import { TaskControlsSidebar } from "./TaskControlsSidebar";
import { AskQuestionDialog } from "@/components/faq/AskQuestionDialog";
import { SubmitBugDialog } from "@/components/bugs/SubmitBugDialog";
import { TaskFilePreview } from "./TaskFilePreview";
import { TaskFileUpload } from "./TaskFileUpload";
import { ProfessionalPhotosUpload } from "./ProfessionalPhotosUpload";
import { PermitStatusDisplay } from "./PermitStatusDisplay";
import { StableFieldWrapper } from "@/components/ui/stable-form";
import { TaskSaveIndicator } from "./TaskSaveIndicator";

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
  const [isCollapsed, setIsCollapsed] = useState(true); // All tasks closed by default
  const [showFAQDialog, setShowFAQDialog] = useState(false);
  const [answeredFAQs, setAnsweredFAQs] = useState<any[]>([]);
  const [showBugDialog, setShowBugDialog] = useState(false);
  const [attachmentsKey, setAttachmentsKey] = useState(0);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [assignedUserName, setAssignedUserName] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'typing' | 'saving' | 'saved'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const { isAdmin } = useAdminCheck();
  const hasValue = task.field_value && task.field_value.trim() !== "";
  const isReadOnly = hasValue && !isAdmin && !isEditing;
  
  const isDueDateOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "completed";

  useEffect(() => {
    // Only load SOP and FAQs when the task is expanded
    if (!isCollapsed) {
      loadSOP();
      loadAnsweredFAQs();
    } else {
      // Reset editing state when task is collapsed
      setIsEditing(false);
    }
  }, [task.id, isCollapsed]);
  
  useEffect(() => {
    // Load assigned user's first name - either from direct assignment or phase assignment
    loadAssignedUserName();
  }, [task.assigned_to_uuid, task.assigned_role_id, task.phase_number]);

  // REMOVED: Auto-correct status logic was causing bugs where rescheduling a due date 
  // would auto-mark tasks as completed if they had any data. Tasks should only be 
  // marked complete when explicitly saved with data, not on every render.

  const loadSOP = async () => {
    // Load global SOP for this task by matching title and phase
    const { data } = await supabase
      .from("onboarding_sops")
      .select("*")
      .eq("task_title", task.title)
      .eq("phase_number", task.phase_number)
      .maybeSingle();

    setSOP(data);
  };
  
  const loadAssignedUserName = async () => {
    // Step 1: Check for direct user assignment
    if (task.assigned_to_uuid) {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("id", task.assigned_to_uuid)
        .maybeSingle();
      
      if (data) {
        setAssignedUserName(data.first_name || data.email?.split('@')[0] || 'Unknown');
        return;
      }
    }
    
    // Step 2: Check for role-based assignment on the task
    if (task.assigned_role_id) {
      const { data: userRoles } = await supabase
        .from("user_team_roles")
        .select(`
          profiles (
            first_name,
            email
          )
        `)
        .eq("role_id", task.assigned_role_id)
        .order('profiles(first_name)');
      
      if (userRoles && userRoles.length > 0) {
        const names = userRoles
          .map(ur => {
            const profile = ur.profiles as any;
            return profile.first_name || profile.email?.split('@')[0] || 'Unknown';
          })
          .filter(name => name !== 'Unknown');
        
        if (names.length === 1) {
          setAssignedUserName(names[0]);
        } else if (names.length === 2) {
          setAssignedUserName(names.join(', '));
        } else if (names.length > 2) {
          setAssignedUserName(`${names[0]} +${names.length - 1}`);
        }
        return;
      }
    }
    
    // Step 3: Fall back to phase-level assignment
    const { data: phaseAssignment } = await supabase
      .from("phase_role_assignments")
      .select("role_id")
      .eq("phase_number", task.phase_number)
      .maybeSingle();
    
    if (phaseAssignment?.role_id) {
      const { data: userRoles } = await supabase
        .from("user_team_roles")
        .select(`
          profiles (
            first_name,
            email
          )
        `)
        .eq("role_id", phaseAssignment.role_id)
        .order('profiles(first_name)');
      
      if (userRoles && userRoles.length > 0) {
        const names = userRoles
          .map(ur => {
            const profile = ur.profiles as any;
            return profile.first_name || profile.email?.split('@')[0] || 'Unknown';
          })
          .filter(name => name !== 'Unknown');
        
        if (names.length === 1) {
          setAssignedUserName(names[0]);
        } else if (names.length === 2) {
          setAssignedUserName(names.join(', '));
        } else if (names.length > 2) {
          setAssignedUserName(`${names[0]} +${names.length - 1}`);
        }
      }
    }
  };

  const loadAnsweredFAQs = async () => {
    const { data } = await supabase
      .from("frequently_asked_questions")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false });

    setAnsweredFAQs(data || []);
  };

  const handleSOPSuccess = () => {
    loadSOP();
  };

  const handleFAQSuccess = () => {
    loadAnsweredFAQs();
  };

  const handleDueDateClick = () => {
    if (isDueDateOverdue) {
      setShowRescheduleDialog(true);
    } else {
      setShowUpdateDueDateDialog(true);
    }
  };


  const handleCopy = async () => {
    const valueToCopy = task.field_value || fieldValue;
    if (valueToCopy) {
      await navigator.clipboard.writeText(valueToCopy);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getDisplayValue = () => {
    if (!task.field_value) return "No value entered";
    
    switch (task.field_type) {
      case "file":
        return task.field_value;
      case "date":
        try {
          const date = new Date(task.field_value);
          if (isNaN(date.getTime())) return "Invalid date";
          return format(date, "MMM d, yyyy");
        } catch {
          return "Invalid date";
        }
      case "checkbox":
        return task.field_value === "true" ? "Yes ✓" : "No";
      case "currency":
        return `$${task.field_value}`;
      default:
        return task.field_value.length > 60 
          ? task.field_value.substring(0, 60) + "..." 
          : task.field_value;
    }
  };

  const autoSave = async (value: string, isCompleted: boolean = true, notesValue?: string) => {
    try {
      setSaveStatus('saving');
      const normalizedValue = value?.trim() || '';
      const hasNotes = (notesValue?.trim() || notes?.trim())?.length > 0;
      const hasFile = !!task.file_path;
      
      // Task is complete if it has ANY meaningful data
      const hasData = normalizedValue.length > 0 || hasFile || hasNotes;
      const newStatus = (isCompleted && hasData) ? "completed" : "pending";
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData: any = {
        field_value: normalizedValue || null,
        notes: notesValue ?? notes,
        status: newStatus,
        completed_date: (newStatus === "completed") ? new Date().toISOString() : null,
        completed_by: (newStatus === "completed") ? user?.id : null,
      };

      await supabase
        .from("onboarding_tasks")
        .update(updateData)
        .eq("id", task.id);

      // Sync owner email/phone to property_owners table when relevant tasks are saved
      if (normalizedValue && (task.title.toLowerCase().includes("owner email") || task.title.toLowerCase().includes("owner phone"))) {
        await syncOwnerInfoToPropertyOwners(normalizedValue, task.title);
      }

      // Update local status without triggering parent update
      setTaskStatus(newStatus);
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      
      // Auto-hide "saved" indicator after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
      
      // Removed onUpdate() call to prevent task card from closing after save
      // Progress bar will update when dialog closes instead
    } catch (error) {
      console.error("Failed to auto-save task:", error);
      setSaveStatus('idle');
      
      // Show error toast for all field updates (except section headers)
      if (task.field_type !== "section_header") {
        toast.error("Save failed — try again", {
          duration: 2000,
          position: "top-right",
        });
      }
    }
  };

  // Sync owner email/phone to property_owners table
  const syncOwnerInfoToPropertyOwners = async (value: string, taskTitle: string) => {
    try {
      // Get the project to find the property_id
      const { data: project } = await supabase
        .from("onboarding_projects")
        .select("property_id")
        .eq("id", task.project_id)
        .maybeSingle();

      if (!project?.property_id) return;

      // Get the property to find the owner_id
      const { data: property } = await supabase
        .from("properties")
        .select("owner_id")
        .eq("id", project.property_id)
        .maybeSingle();

      if (!property?.owner_id) return;

      // Determine which field to update
      const isEmail = taskTitle.toLowerCase().includes("email");
      const isPhone = taskTitle.toLowerCase().includes("phone");

      if (isEmail) {
        await supabase
          .from("property_owners")
          .update({ email: value.toLowerCase() })
          .eq("id", property.owner_id);
        console.log("Synced owner email:", value);
      } else if (isPhone) {
        await supabase
          .from("property_owners")
          .update({ phone: value })
          .eq("id", property.owner_id);
        console.log("Synced owner phone:", value);
      }
    } catch (error) {
      console.error("Failed to sync owner info:", error);
      // Don't throw - this is a background sync
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
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from("onboarding_tasks")
        .update({
          file_path: fileName,
          field_value: file.name,
          status: "completed",
          completed_date: new Date().toISOString(),
          completed_by: user?.id,
        })
        .eq("id", task.id);

      setFieldValue(file.name);
      setShowNAField(false);
      setTaskStatus("completed");
      // Visual feedback only - card stays open, green checkmark shows completion

      // If this is a permit upload, trigger AI analysis
      if (task.title.toLowerCase().includes("permit") || task.title.toLowerCase().includes("license")) {
        await triggerPermitAnalysis(fileName);
      }
    } catch (error: any) {
      console.error("Failed to upload file:", error);
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const triggerPermitAnalysis = async (filePath: string) => {
    try {
      // Get the project to find the property_id
      const { data: project } = await supabase
        .from("onboarding_projects")
        .select("property_id")
        .eq("id", task.project_id)
        .maybeSingle();

      if (!project?.property_id) {
        console.log("No property_id found for permit analysis");
        return;
      }

      // Create a property_documents entry for the permit
      const { data: docEntry, error: docError } = await supabase
        .from("property_documents")
        .insert({
          property_id: project.property_id,
          project_id: task.project_id,
          file_name: task.field_value || "permit.pdf",
          file_path: filePath,
          file_type: filePath.split('.').pop() || "pdf",
          document_type: "str_permit",
        })
        .select()
        .single();

      if (docError) {
        console.error("Failed to create document entry:", docError);
        return;
      }

      toast.info("Analyzing permit with AI...", { duration: 3000 });

      // Call the AI analysis function
      const { data: result, error: analysisError } = await supabase.functions.invoke("analyze-permit", {
        body: {
          documentId: docEntry.id,
          propertyId: project.property_id,
          filePath: filePath,
        },
      });

      if (analysisError) {
        console.error("Permit analysis error:", analysisError);
        toast.error("Failed to analyze permit");
        return;
      }

      if (result?.success) {
        toast.success(result.message || "Permit analyzed successfully");
        
        // If expiration date was extracted, update the related task
        if (result.extractedData?.expiration_date) {
          // Find and update the "Permit Expiration Date" task in this project
          await supabase
            .from("onboarding_tasks")
            .update({
              field_value: result.extractedData.expiration_date,
              status: "completed",
              notes: "Auto-extracted from permit by AI",
            })
            .eq("project_id", task.project_id)
            .eq("title", "Permit Expiration Date");
        }
      } else {
        toast.warning("Could not extract permit details. Please enter expiration date manually.");
      }
    } catch (error) {
      console.error("Permit analysis failed:", error);
    }
  };

  const handleMarkAsNA = async () => {
    if (!naReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from("onboarding_tasks")
        .update({
          field_value: "N/A",
          notes: naReason,
          status: "completed",
          completed_date: new Date().toISOString(),
          completed_by: user?.id,
        })
        .eq("id", task.id);

      setFieldValue("N/A");
      setNotes(naReason);
      setShowNAField(false);
      setTaskStatus("completed");
      // Visual feedback only - no toast, card stays open
      // Progress bar updates when card is collapsed
    } catch (error) {
      console.error("Failed to mark as N/A:", error);
      toast.error("Failed to save");
    }
  };

  const handleDeleteTask = async () => {
    if (!isAdmin) {
      toast.error("Only admins can delete tasks");
      return;
    }

    try {
      // Delete the task instance
      const { error: taskError } = await supabase
        .from("onboarding_tasks")
        .delete()
        .eq("id", task.id);

      if (taskError) throw taskError;

      // Also delete from task templates to prevent it from appearing in future projects
      // Match by phase_number and task_title
      const { error: templateError } = await supabase
        .from("task_templates")
        .delete()
        .eq("phase_number", task.phase_number)
        .eq("task_title", task.title);

      // Don't throw on template error - the template might not exist
      if (templateError) {
        console.warn("Template deletion warning:", templateError);
      }

      toast.success("Task deleted globally");
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
    setHasUnsavedChanges(true);
    setSaveStatus('typing');
  };

  const handleManualSave = () => {
    if (hasUnsavedChanges) {
      autoSave(fieldValue);
    }
  };

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate);
    if (newDate && !isNaN(newDate.getTime())) {
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
                  {date && !isNaN(date.getTime()) ? format(date, "PPP") : <span>Pick a date</span>}
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
        // Special handling for professional photos upload
        if (task.title === "Upload professional photos") {
          return (
            <div className="space-y-3">
              <TaskFilePreview 
                key={attachmentsKey}
                taskId={task.id} 
                onFilesChange={() => {
                  setAttachmentsKey(prev => prev + 1);
                  // Don't call onUpdate() - keeps card open
                }} 
              />
              
              <ProfessionalPhotosUpload 
                taskId={task.id} 
                onFilesUploaded={() => {
                  setUploading(false);
                  setAttachmentsKey(prev => prev + 1);
                  // Don't call onUpdate() - keeps card open
                }} 
              />
            </div>
          );
        }
        
        // Standard file upload for other file tasks
        // Check if this is a permit task
        const isPermitTask = task.title.toLowerCase().includes("permit") || 
                             task.title.toLowerCase().includes("license") ||
                             task.title.toLowerCase().includes("str license");
        
        return (
          <div className="space-y-3">
            {/* Show permit status if this is a permit task */}
            {isPermitTask && (
              <PermitStatusDisplay 
                projectId={task.project_id} 
                taskId={task.id} 
              />
            )}
            
            {/* Multiple file upload system */}
            <TaskFilePreview 
              key={attachmentsKey}
              taskId={task.id} 
              onFilesChange={() => {
                setAttachmentsKey(prev => prev + 1);
                // Don't call onUpdate() - keeps card open
              }} 
            />
            
            <TaskFileUpload 
              taskId={task.id}
              taskTitle={task.title}
              projectId={task.project_id}
              onFilesUploaded={() => {
                setUploading(false);
                setAttachmentsKey(prev => prev + 1);
                // Don't call onUpdate() - keeps card open
              }} 
            />
            
            {/* Mark as N/A option */}
            {!showNAField && (
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

  // When collapsing, trigger parent update to refresh progress bar
  const handleCollapse = () => {
    setIsCollapsed(true);
    onUpdate(); // Update progress bar when card closes
  };

  // Use a single component with Collapsible for smooth animations
  return (
    <>
      <Collapsible 
        open={!isCollapsed} 
        onOpenChange={(open) => {
          if (!open) {
            handleCollapse();
          } else {
            setIsCollapsed(false);
          }
        }}
      >
        <Card 
          id={`task-${task.id}`}
          className={cn(
            "transition-all duration-300 overflow-hidden",
            taskStatus === "completed" && "bg-green-50/30 border-green-500",
            isCollapsed && "hover:bg-accent/50 cursor-pointer"
          )}
        >
          {/* HEADER - Always visible, clickable to expand/collapse */}
          <CollapsibleTrigger asChild>
            <div 
              className={cn(
                "p-3 transition-colors cursor-pointer touch-manipulation",
                !isCollapsed && "border-b",
                !isCollapsed && (taskStatus === "completed" 
                  ? "bg-green-100/50 hover:bg-green-100/70" 
                  : "bg-muted/30 hover:bg-muted/40")
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {taskStatus === "completed" ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 flex-shrink-0" />
                  )}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={cn(
                      "font-semibold truncate transition-all",
                      isCollapsed ? "text-sm" : "text-[20px] leading-tight"
                    )}>{task.title}</span>
                    {sop && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium hover:underline flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSOPDialog(true);
                        }}
                      >
                        <BookOpen className="w-3 h-3" />
                        SOP
                      </button>
                    )}
                    {isCollapsed && task.field_value && (
                      <>
                        <span className="text-muted-foreground">|</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {getDisplayValue()}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy();
                          }}
                          className="h-6 px-2 ml-1 flex-shrink-0"
                        >
                          {copied ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isCollapsed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowBugDialog(true);
                      }}
                      className="h-7 px-2 text-xs gap-1"
                      title="Submit a bug or improvement request"
                    >
                      <Bug className="w-3 h-3" />
                    </Button>
                  )}
                  {isCollapsed && task.due_date && (() => {
                    try {
                      const dueDate = new Date(task.due_date);
                      if (isNaN(dueDate.getTime())) return null;
                      return (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(dueDate, "MMM d")}
                        </div>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                  <TaskStatusBadge status={taskStatus} dueDate={task.due_date} />
                  <ChevronDown className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform duration-500 ease-out",
                    !isCollapsed && "rotate-180"
                  )} />
                </div>
              </div>
              {!isCollapsed && task.description && (
                <p className="text-sm text-muted-foreground mt-1 ml-8">{task.description}</p>
              )}
            </div>
          </CollapsibleTrigger>

          {/* EXPANDABLE CONTENT - Animated */}
          <CollapsibleContent>
            <div 
              className="flex"
              onClick={(e) => e.stopPropagation()}
            >
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
              
              {/* Show assigned user for admins */}
              {isAdmin && assignedUserName && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAssignmentDialog(true)}
                  className="h-8 gap-2 text-xs whitespace-nowrap"
                >
                  <User className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium">{assignedUserName}</span>
                  <span className="text-muted-foreground">• Reassign</span>
                </Button>
              )}
            </div>

            {/* Field Input with Copy Button */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {task.field_value && (
                    <>
                      <span className="text-sm font-medium">Value entered:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopy}
                        className="h-7 px-2 text-xs"
                        title="Copy value"
                      >
                        {copied ? <><Check className="w-3 h-3 mr-1" /> Copied</> : <><Copy className="w-3 h-3 mr-1" /> Copy</>}
                      </Button>
                      {!isEditing && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditing(true)}
                          className="h-7 px-2 text-xs gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit Value
                        </Button>
                      )}
                    </>
                  )}
                  <div className="flex items-center gap-2">
                    <TaskSaveIndicator status={saveStatus} />
                    {hasUnsavedChanges && (
                      <Button
                        size="sm"
                        onClick={handleManualSave}
                        disabled={saveStatus === 'saving'}
                        className="h-7"
                      >
                        {saveStatus === 'saving' ? 'Saving...' : 'Save'}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {taskStatus !== 'completed' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={async () => {
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        await supabase
                          .from("onboarding_tasks")
                          .update({
                            status: 'completed',
                            completed_date: new Date().toISOString(),
                            completed_by: user?.id,
                          })
                          .eq("id", task.id);
                        
                        setTaskStatus('completed');
                        // Visual feedback only - card stays open, green styling shows completion
                      } catch (error) {
                        console.error("Failed to mark as complete:", error);
                        toast.error("Failed to update task");
                      }
                    }}
                    className="h-8"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Mark Complete
                  </Button>
                  )}
                </div>
              </div>
              {renderField()}
              
              {/* Lawncare Subcard with Additional Fields */}
              {task.title === "Lawncare" && (
                <Card className="mt-4 bg-muted/30">
                  <CardContent className="p-4 space-y-4">
                    <h4 className="text-sm font-semibold mb-3">Lawncare Details</h4>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`lawncare-company-${task.id}`}>Company Name</Label>
                      <Input
                        id={`lawncare-company-${task.id}`}
                        placeholder="Enter lawncare company name"
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`lawncare-phone-${task.id}`}>Phone Number</Label>
                      <Input
                        id={`lawncare-phone-${task.id}`}
                        type="tel"
                        placeholder="Enter phone number"
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`lawncare-schedule-${task.id}`}>Schedule</Label>
                      <Select>
                        <SelectTrigger id={`lawncare-schedule-${task.id}`} className="w-full">
                          <SelectValue placeholder="Select schedule" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="semi-weekly">Semi-Weekly</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`lawncare-payment-${task.id}`}>Negotiated Payment</Label>
                      <Input
                        id={`lawncare-payment-${task.id}`}
                        type="number"
                        step="0.01"
                        placeholder="Enter amount"
                        className="w-full"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Upload button for all tasks (not just file type) */}
              {!["section_header", "file"].includes(task.field_type) && (
                <div className="mt-2 space-y-3">
                  {/* All file attachments handled by TaskFilePreview and TaskFileUpload components */}
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
                    onFilesUploaded={() => {
                      setUploading(false);
                      setAttachmentsKey(prev => prev + 1);
                      onUpdate();
                    }} 
                  />
                </div>
              )}
            </div>

            {/* Answered FAQs Section */}
            {answeredFAQs.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <MessageCircleQuestion className="w-4 h-4" />
                  Answered FAQs for this Task
                </h4>
                <div className="space-y-3">
                  {answeredFAQs.map((faq) => (
                    <div key={faq.id} className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm font-medium mb-1">{faq.question}</p>
                      <p className="text-sm text-muted-foreground">{faq.answer}</p>
                      {faq.category && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          {faq.category}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reschedule History Log */}
            <TaskRescheduleHistoryLog taskId={task.id} />

            {/* Submit a Bug Button - Available to all users */}
            <div className="mt-4 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBugDialog(true)}
                className="w-full gap-2"
              >
                <Bug className="w-4 h-4" />
                Submit a Bug or Improvement Request
              </Button>
            </div>

            {/* Comments Section */}
            <InlineComments taskId={task.id} />
          </div>

          {/* RIGHT: Task Controls Sidebar */}
          <TaskControlsSidebar
            task={task}
            sop={sop}
            isAdmin={isAdmin}
            onEditTask={handleRequestEdit}
            onDeleteTask={handleRequestDelete}
            onViewSOP={() => setShowSOPDialog(true)}
            onEditSOP={() => setShowSOPFormDialog(true)}
            onUpdateDueDate={handleDueDateClick}
            onAddFAQ={() => setShowFAQDialog(true)}
          />
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
        phaseNumber={task.phase_number}
        taskId={task.id}
        taskTitle={task.title}
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

      <AskQuestionDialog
        open={showFAQDialog}
        onOpenChange={(open) => {
          setShowFAQDialog(open);
          if (!open) handleFAQSuccess();
        }}
        projectId={task.project_id}
        taskId={task.id}
      />

      <SubmitBugDialog
        open={showBugDialog}
        onOpenChange={setShowBugDialog}
        taskId={task.id}
        projectId={task.project_id}
      />
    </>
  );
};
