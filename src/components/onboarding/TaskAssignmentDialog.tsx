import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TaskAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  projectId: string;
  phaseNumber: number;
  currentAssignedToUuid: string | null;
  currentDueDate: string | null;
  onUpdate: () => void;
}

export const TaskAssignmentDialog = ({ 
  open, 
  onOpenChange, 
  taskId,
  projectId,
  phaseNumber,
  currentAssignedToUuid,
  currentDueDate,
  onUpdate 
}: TaskAssignmentDialogProps) => {
  const [approvedUsers, setApprovedUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>(currentAssignedToUuid || "unassigned");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [dueDate, setDueDate] = useState<Date | undefined>(
    currentDueDate ? new Date(currentDueDate) : undefined
  );
  const [phaseRoleInfo, setPhaseRoleInfo] = useState<{ roleName: string; userName: string } | null>(null);

  useEffect(() => {
    loadApprovedUsers();
    loadPhaseRoleInfo();
  }, [phaseNumber, projectId]);

  useEffect(() => {
    setSelectedUser(currentAssignedToUuid || "unassigned");
    setDueDate(currentDueDate ? new Date(currentDueDate) : undefined);
  }, [currentAssignedToUuid, currentDueDate, open]);

  const loadApprovedUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, first_name")
      .eq("status", "approved")
      .order("first_name");

    setApprovedUsers(data || []);
  };

  const loadPhaseRoleInfo = async () => {
    // Get the role assigned to this phase
    const { data: phaseAssignment } = await supabase
      .from("phase_role_assignments")
      .select(`
        role_id,
        team_roles (
          role_name
        )
      `)
      .eq("phase_number", phaseNumber)
      .maybeSingle();

    if (phaseAssignment?.role_id) {
      // Get users assigned to this role
      const { data: userRoles } = await supabase
        .from("user_team_roles")
        .select(`
          user_id,
          profiles (
            first_name,
            email
          )
        `)
        .eq("role_id", phaseAssignment.role_id)
        .eq("is_primary", true)
        .maybeSingle();

      if (phaseAssignment.team_roles && userRoles?.profiles) {
        setPhaseRoleInfo({
          roleName: (phaseAssignment.team_roles as any).role_name,
          userName: (userRoles.profiles as any).first_name || (userRoles.profiles as any).email.split('@')[0]
        });
      }
    }
  };

  const handleSave = async () => {
    try {
      const actualUserId = selectedUser === "unassigned" ? null : selectedUser;
      
      const updateData: any = { 
        assigned_to_uuid: actualUserId,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null
      };

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
          const { data: taskData } = await supabase
            .from("onboarding_tasks")
            .select("title, field_type")
            .eq("id", taskId)
            .single();

          if (taskData) {
            await supabase.from("task_templates").upsert({
              phase_number: phaseNumber,
              task_title: taskData.title,
              default_role_id: roleData.role_id,
              field_type: taskData.field_type,
            }, {
              onConflict: "phase_number,task_title",
            });

            toast.success("Assignment saved as template for future projects");
          }
        }
      }

      await supabase
        .from("onboarding_tasks")
        .update(updateData)
        .eq("id", taskId);

      toast.success("Task updated");
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Failed to update task");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Task Assignment & Due Date</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Phase Default Assignment Info */}
          {phaseRoleInfo && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-primary mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-medium text-primary">Phase Default Assignment</p>
                  <p className="text-muted-foreground">
                    This phase is assigned to the <span className="font-semibold">{phaseRoleInfo.roleName}</span> role.
                  </p>
                  <p className="text-muted-foreground">
                    Currently assigned to: <span className="font-semibold">{phaseRoleInfo.userName}</span>
                  </p>
                  <p className="text-muted-foreground italic mt-2">
                    If you leave this task as "Unassigned", it will default to the phase's assigned team member ({phaseRoleInfo.userName}).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Task Assignment */}
          <div className="space-y-2">
            <Label>Assign Task To</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Unassigned (uses phase default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  Unassigned {phaseRoleInfo ? `(defaults to ${phaseRoleInfo.userName})` : ""}
                </SelectItem>
                {approvedUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name || user.email.split('@')[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Override the phase default by selecting a specific team member.
            </p>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Save as Template */}
          {selectedUser !== "unassigned" && (
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <Checkbox 
                id="save-template"
                checked={saveAsTemplate}
                onCheckedChange={(c) => setSaveAsTemplate(c as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="save-template" className="cursor-pointer font-medium">
                  Save as Template
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Apply this assignment to all future projects for this task
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
