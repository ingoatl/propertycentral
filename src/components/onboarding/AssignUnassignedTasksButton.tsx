import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserCog } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const AssignUnassignedTasksButton = () => {
  const [loading, setLoading] = useState(false);

  const handleAssignTasks = async () => {
    try {
      setLoading(true);
      console.log("Starting task assignment process...");

      // Fetch all necessary data
      const [phaseData, templateData, roleData, tasksData] = await Promise.all([
        supabase.from("phase_role_assignments").select("*"),
        supabase.from("task_templates").select("*"),
        supabase.from("user_team_roles").select("user_id, role_id").eq("is_primary", true),
        supabase
          .from("onboarding_tasks")
          .select("id, phase_number, title, project_id")
          .or("assigned_to_uuid.is.null,assigned_role_id.is.null")
          .neq("status", "completed"),
      ]);

      if (phaseData.error) throw phaseData.error;
      if (templateData.error) throw templateData.error;
      if (roleData.error) throw roleData.error;
      if (tasksData.error) throw tasksData.error;

      const phaseAssignments = phaseData.data || [];
      const taskTemplates = templateData.data || [];
      const userTeamRoles = roleData.data || [];
      const unassignedTasks = tasksData.data || [];

      console.log(`Found ${unassignedTasks.length} tasks to process`);
      console.log(`Available phase assignments: ${phaseAssignments.length}`);
      console.log(`Available task templates: ${taskTemplates.length}`);
      console.log(`Available user team roles: ${userTeamRoles.length}`);

      if (unassignedTasks.length === 0) {
        toast.info("All tasks are already assigned!");
        return;
      }

      // Process each task and determine assignment
      const updates = unassignedTasks.map((task) => {
        let assignedToUuid = null;
        let assignedRoleId = null;

        // Check for task-level template override (first priority)
        const taskTemplate = taskTemplates.find(
          (t: any) => t.phase_number === task.phase_number && t.task_title === task.title
        );

        if (taskTemplate?.default_role_id) {
          assignedRoleId = taskTemplate.default_role_id;
          console.log(`Task "${task.title}" assigned role ${assignedRoleId} from template`);
        } else {
          // Use phase assignment (second priority)
          const phaseAssignment = phaseAssignments.find(
            (p: any) => p.phase_number === task.phase_number
          );
          if (phaseAssignment) {
            assignedRoleId = phaseAssignment.role_id;
            console.log(`Task "${task.title}" assigned role ${assignedRoleId} from phase ${task.phase_number}`);
          }
        }

        // Find user with that role (third priority - map role to user)
        if (assignedRoleId) {
          const userRole = userTeamRoles.find((ur: any) => ur.role_id === assignedRoleId);
          if (userRole) {
            assignedToUuid = userRole.user_id;
            console.log(`Task "${task.title}" assigned to user ${assignedToUuid}`);
          } else {
            console.log(`No primary user found for role ${assignedRoleId}`);
          }
        }

        return {
          id: task.id,
          assigned_to_uuid: assignedToUuid,
          assigned_role_id: assignedRoleId,
        };
      });

      // Update tasks in batches using upsert for better performance
      const batchSize = 100;
      let updatedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        for (const update of batch) {
          const { error } = await supabase
            .from("onboarding_tasks")
            .update({
              assigned_to_uuid: update.assigned_to_uuid,
              assigned_role_id: update.assigned_role_id,
            })
            .eq("id", update.id);

          if (!error) {
            updatedCount++;
          } else {
            errorCount++;
            console.error(`Failed to update task ${update.id}:`, error);
          }
        }
      }

      const assignedToUserCount = updates.filter(u => u.assigned_to_uuid).length;
      const assignedToRoleCount = updates.filter(u => u.assigned_role_id && !u.assigned_to_uuid).length;
      
      console.log(`Assignment complete: ${assignedToUserCount} assigned to users, ${assignedToRoleCount} assigned to roles only, ${errorCount} errors`);

      if (assignedToUserCount > 0) {
        toast.success(
          `Successfully assigned ${assignedToUserCount} tasks to team members! ${assignedToRoleCount > 0 ? `(${assignedToRoleCount} tasks assigned to roles but need team members)` : ''}`
        );
      } else if (assignedToRoleCount > 0) {
        toast.warning(
          `${assignedToRoleCount} tasks assigned to roles, but no primary team members found for those roles. Please assign team members in the Team Matrix.`
        );
      } else {
        toast.warning("No tasks could be assigned. Please configure Team Matrix with role assignments and team members.");
      }

      // Reload the page to show updates
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error("Error assigning tasks:", error);
      toast.error("Failed to assign tasks: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserCog className="h-4 w-4" />
          Assign Unassigned Tasks
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Assign Unassigned Tasks?</AlertDialogTitle>
          <AlertDialogDescription>
            This will automatically assign all unassigned tasks to team members based on the
            current Team Matrix configuration. Tasks will be assigned according to:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Task-specific role assignments (from task templates)</li>
              <li>Phase-level role assignments (from phase matrix)</li>
              <li>Primary team member for each role</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleAssignTasks} disabled={loading}>
            {loading ? "Assigning..." : "Assign Tasks"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
