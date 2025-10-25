import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OnboardingProject, OnboardingTask } from "@/types/onboarding";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WorkflowPhases } from "./WorkflowPhases";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ONBOARDING_PHASES } from "@/context/onboardingPhases";
import { InspectionCard } from "./InspectionCard";
import { Input } from "@/components/ui/input";
import { Search, Building2, DollarSign, User, Users } from "lucide-react";
import { useAdminCheck } from "@/hooks/useAdminCheck";

interface WorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: OnboardingProject | null;
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  visitPrice: number;
  onUpdate: () => void;
  taskId?: string;
}

export const WorkflowDialog = ({ open, onOpenChange, project, propertyId, propertyName, propertyAddress, visitPrice, onUpdate, taskId }: WorkflowDialogProps) => {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredTasks, setFilteredTasks] = useState<OnboardingTask[]>([]);
  const [creatingProject, setCreatingProject] = useState(false);
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRoleIds, setUserRoleIds] = useState<string[]>([]);
  const [phaseToRoleMap, setPhaseToRoleMap] = useState<Map<number, string>>(new Map());
  const { isAdmin } = useAdminCheck();

  useEffect(() => {
    loadCurrentUser();
    loadPhaseAssignments();
  }, []);

  useEffect(() => {
    if (open) {
      loadTasks();
    }
  }, [open, project?.id]);

  useEffect(() => {
    // Filter tasks based on search query, "my tasks" filter, and admin status
    let filtered = tasks;

    // Filter admin-only tasks if user is not admin
    if (!isAdmin) {
      filtered = filtered.filter(task => {
        const isAdminOnly = task.description?.includes("(Admin Only)");
        return !isAdminOnly;
      });
    }

    // Apply "my tasks" filter
    if (showMyTasksOnly && currentUserId) {
      filtered = filtered.filter((task) => {
        // Direct assignment to user
        if (task.assigned_to_uuid === currentUserId) {
          return true;
        }
        
        // Task-level role assignment
        if (task.assigned_role_id && userRoleIds.includes(task.assigned_role_id)) {
          return true;
        }
        
        // Phase-level role assignment (when task has no specific assignment)
        if (!task.assigned_role_id && !task.assigned_to_uuid) {
          const phaseRoleId = phaseToRoleMap.get(task.phase_number);
          if (phaseRoleId && userRoleIds.includes(phaseRoleId)) {
            return true;
          }
        }
        
        return false;
      });
    }

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.phase_title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.field_value?.toLowerCase().includes(query) ||
          task.notes?.toLowerCase().includes(query)
      );
    }

    setFilteredTasks(filtered);
  }, [searchQuery, tasks, showMyTasksOnly, currentUserId, userRoleIds, phaseToRoleMap, isAdmin]);

  useEffect(() => {
    // When dialog closes, update parent to refresh progress
    if (!open) {
      onUpdate();
    }
  }, [open]);

  useEffect(() => {
    // Scroll to specific task if taskId is provided
    if (taskId && tasks.length > 0 && !loading) {
      setTimeout(() => {
        const taskElement = document.getElementById(`task-${taskId}`);
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight effect with pulsing animation
          taskElement.classList.add('ring-4', 'ring-primary', 'ring-offset-4', 'transition-all', 'duration-300');
          setTimeout(() => {
            taskElement.classList.remove('ring-4', 'ring-primary', 'ring-offset-4');
          }, 3000);
        }
      }, 500);
    }
  }, [taskId, tasks, loading]);

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      // Get user's role IDs from user_team_roles
      const { data: userRoles } = await supabase
        .from("user_team_roles")
        .select("role_id")
        .eq("user_id", user.id);

      if (userRoles) {
        setUserRoleIds(userRoles.map(r => r.role_id));
      }
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  };

  const loadPhaseAssignments = async () => {
    try {
      const { data: phaseRoles } = await supabase
        .from("phase_role_assignments")
        .select("phase_number, role_id");
      
      if (phaseRoles) {
        const map = new Map(phaseRoles.map(pr => [pr.phase_number, pr.role_id]));
        setPhaseToRoleMap(map);
      }
    } catch (error) {
      console.error("Error loading phase assignments:", error);
    }
  };

  const loadTasks = async () => {
    if (!project?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("onboarding_tasks")
        .select("*")
        .eq("project_id", project.id)
        .order("phase_number")
        .order("created_at");

      if (error) throw error;
      
      const existingTasks = (data || []) as OnboardingTask[];
      
      // Check if we need to add tasks for new phases
      const existingPhases = new Set(existingTasks.map(t => t.phase_number));
      const missingPhaseTasks = [];
      
      for (const phase of ONBOARDING_PHASES) {
        if (!existingPhases.has(phase.id)) {
          // This phase has no tasks - create them
          for (const task of phase.tasks) {
            missingPhaseTasks.push({
              project_id: project.id,
              phase_number: phase.id,
              phase_title: phase.title,
              title: task.title,
              description: task.description,
              field_type: task.field_type,
              status: "pending" as const,
            });
          }
        }
      }
      
      // Insert missing tasks if any
      if (missingPhaseTasks.length > 0) {
        const { error: insertError } = await supabase
          .from("onboarding_tasks")
          .insert(missingPhaseTasks);
          
        if (insertError) {
          console.error("Failed to add missing tasks:", insertError);
        } else {
          // Reload tasks to include the newly added ones
          const { data: updatedData } = await supabase
            .from("onboarding_tasks")
            .select("*")
            .eq("project_id", project.id)
            .order("phase_number")
            .order("created_at");
            
          setTasks((updatedData || []) as OnboardingTask[]);
          return;
        }
      }
      
      setTasks(existingTasks);
    } catch (error: any) {
      toast.error("Failed to load tasks");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartOnboarding = async () => {
    try {
      setCreatingProject(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      // Create onboarding project
      const { data: newProject, error: projectError } = await supabase
        .from('onboarding_projects')
        .insert({
          property_id: propertyId,
          owner_name: 'Property Owner',
          property_address: propertyAddress,
          status: 'pending',
          progress: 0
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create initial tasks for each phase
      const oneWeekOut = new Date();
      oneWeekOut.setDate(oneWeekOut.getDate() + 7);
      const dueDateString = oneWeekOut.toISOString().split('T')[0];
      
      const initialTasks = ONBOARDING_PHASES.flatMap(phase => 
        phase.tasks.map(task => ({
          project_id: newProject.id,
          phase_number: phase.id,
          phase_title: phase.title,
          title: task.title,
          description: task.description,
          field_type: task.field_type,
          status: 'pending' as const,
          due_date: dueDateString,
          original_due_date: dueDateString
        }))
      );

      const { error: tasksError } = await supabase
        .from('onboarding_tasks')
        .insert(initialTasks);

      if (tasksError) throw tasksError;

      toast.success("Onboarding started successfully!");
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error starting onboarding:', error);
      toast.error("Failed to start onboarding");
    } finally {
      setCreatingProject(false);
    }
  };

  const handleTaskUpdate = async () => {
    // Reload tasks to show updated status without closing modal
    await loadTasks();
    if (project?.id) {
      await updateProjectProgress();
    }
  };

  const updateProjectProgress = async () => {
    if (!project?.id) return;

    // Fetch fresh task data to calculate accurate progress
    const { data: freshTasks } = await supabase
      .from("onboarding_tasks")
      .select("status, field_value")
      .eq("project_id", project.id);

    if (!freshTasks) return;

    const totalTasks = freshTasks.length;
    
    // Count tasks that are either completed OR have data filled in
    const uniqueProgressTasks = new Set([
      ...freshTasks.filter(t => t.status === "completed").map((_, i) => `completed-${i}`),
      ...freshTasks.filter(t => t.field_value && t.field_value.trim() !== "").map((_, i) => `data-${i}`)
    ]).size;
    
    // More accurate: count tasks that are completed OR have field_value
    const tasksWithProgress = freshTasks.filter(
      t => t.status === "completed" || (t.field_value && t.field_value.trim() !== "")
    ).length;
    
    const progress = totalTasks > 0 ? (tasksWithProgress / totalTasks) * 100 : 0;

    const { error } = await supabase
      .from("onboarding_projects")
      .update({
        progress,
        status: progress === 100 ? "completed" : progress > 0 ? "in-progress" : "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    if (error) {
      console.error("Failed to update project progress:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] max-md:max-w-full max-md:h-screen max-md:p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 max-md:text-xl">
            {propertyName} - Onboarding Workflow
          </DialogTitle>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground max-md:text-base">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 max-md:h-5 max-md:w-5" />
              {propertyAddress}
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 max-md:h-5 max-md:w-5" />
              Visit Price: ${visitPrice}
            </div>
            {project && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <span className="capitalize">{project.status}</span>
                <span className="ml-4 font-medium">Progress:</span>
                <span>{project.progress}%</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {!project ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Building2 className="h-16 w-16 text-muted-foreground opacity-50" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Onboarding Not Started</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                This property hasn't started the onboarding process yet. Click the button below to create an onboarding project and begin collecting property information.
              </p>
            </div>
            <Button onClick={handleStartOnboarding} disabled={creatingProject} size="lg">
              {creatingProject ? "Creating..." : "Start Onboarding"}
            </Button>
          </div>
          ) : (
          <>
            {/* Filters Row */}
            <div className="flex items-center gap-2 max-md:flex-col">
              <div className="relative flex-1 max-md:w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground max-md:h-5 max-md:w-5" />
                <Input
                  placeholder="Search tasks, phases, values, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 max-md:h-12 max-md:text-base max-md:pl-10"
                />
              </div>
              <Button
                variant={showMyTasksOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowMyTasksOnly(!showMyTasksOnly)}
                className="gap-2 whitespace-nowrap min-w-[120px] max-md:w-full max-md:h-12"
              >
                {showMyTasksOnly ? (
                  <>
                    <User className="w-4 h-4 max-md:h-5 max-md:w-5" />
                    My Tasks
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 max-md:h-5 max-md:w-5" />
                    All Tasks
                  </>
                )}
              </Button>
            </div>

            <ScrollArea className="h-[calc(90vh-280px)] pr-4 max-md:h-[calc(100vh-320px)] max-md:pr-2">
              {loading ? (
                <div className="py-12 text-center text-muted-foreground max-md:text-base">Loading workflow...</div>
              ) : (
                <div className="space-y-4 max-md:space-y-3">
                  {/* Workflow Phases */}
                  <WorkflowPhases
                    projectId={project.id}
                    tasks={filteredTasks}
                    onTaskUpdate={handleTaskUpdate}
                    searchQuery={searchQuery}
                    taskId={taskId}
                    showMyTasksOnly={showMyTasksOnly}
                  />

                  {showMyTasksOnly && filteredTasks.length === 0 && !searchQuery && (
                    <div className="py-12 text-center text-muted-foreground">
                      <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">No tasks assigned to you</p>
                      <p className="text-sm mt-2">Switch to "All Tasks" to see all available tasks</p>
                    </div>
                  )}

                  {searchQuery && filteredTasks.length === 0 && (
                    <div className="py-12 text-center text-muted-foreground">
                      No results found for "{searchQuery}"
                    </div>
                  )}

                  {/* Inspection Card - moved to end */}
                  <InspectionCard projectId={project.id} />
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
