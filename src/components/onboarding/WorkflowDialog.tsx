import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OnboardingProject, OnboardingTask } from "@/types/onboarding";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WorkflowPhases } from "./WorkflowPhases";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ONBOARDING_PHASES } from "@/context/onboardingPhases";

interface WorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: OnboardingProject;
  onUpdate: () => void;
}

export const WorkflowDialog = ({ open, onOpenChange, project, onUpdate }: WorkflowDialogProps) => {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadTasks();
    }
  }, [open, project.id]);

  useEffect(() => {
    // When dialog closes, update parent to refresh progress
    if (!open) {
      onUpdate();
    }
  }, [open]);

  const loadTasks = async () => {
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

  const handleTaskUpdate = async () => {
    // Reload tasks to show updated status without closing modal
    await loadTasks();
    await updateProjectProgress();
  };

  const updateProjectProgress = async () => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === "completed").length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const { error } = await supabase
      .from("onboarding_projects")
      .update({
        progress,
        status: progress === 100 ? "completed" : "in-progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    if (error) {
      console.error("Failed to update project progress:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {project.owner_name} - Onboarding Workflow
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{project.property_address}</p>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)] pr-4">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading workflow...</div>
          ) : (
            <WorkflowPhases
              projectId={project.id}
              tasks={tasks}
              onTaskUpdate={handleTaskUpdate}
            />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
