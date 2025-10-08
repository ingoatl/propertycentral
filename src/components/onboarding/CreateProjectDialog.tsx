import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ONBOARDING_PHASES } from "@/context/onboardingPhases";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  onSuccess: () => void;
}

export const CreateProjectDialog = ({
  open,
  onOpenChange,
  propertyId,
  propertyName,
  propertyAddress,
  onSuccess,
}: CreateProjectDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [ownerName, setOwnerName] = useState("");

  const handleCreate = async () => {
    if (!ownerName.trim()) {
      toast.error("Owner name is required");
      return;
    }

    try {
      setLoading(true);

      // Create project
      const { data: project, error: projectError } = await supabase
        .from("onboarding_projects")
        .insert({
          property_id: propertyId,
          owner_name: ownerName.trim(),
          property_address: propertyAddress,
          status: "in-progress",
          progress: 0,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create all tasks for all 9 phases
      const allTasks = ONBOARDING_PHASES.flatMap((phase) =>
        phase.tasks.map((task) => ({
          project_id: project.id,
          phase_number: phase.id,
          phase_title: phase.title,
          title: task.title,
          description: task.description,
          field_type: task.field_type,
          status: "pending" as const,
        }))
      );

      const { error: tasksError } = await supabase
        .from("onboarding_tasks")
        .insert(allTasks);

      if (tasksError) throw tasksError;

      toast.success("Onboarding project created successfully!");
      setOwnerName("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error("Failed to create project");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Onboarding Project</DialogTitle>
          <DialogDescription>
            Start a new onboarding workflow for {propertyName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="property">Property</Label>
            <Input
              id="property"
              value={propertyName}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={propertyAddress}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner">Owner Name *</Label>
            <Input
              id="owner"
              placeholder="Enter owner name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
