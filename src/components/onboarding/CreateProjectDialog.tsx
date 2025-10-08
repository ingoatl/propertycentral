import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ONBOARDING_PHASES } from "@/context/onboardingPhases";
import { Plus } from "lucide-react";

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
  const [owners, setOwners] = useState<any[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [showNewOwnerForm, setShowNewOwnerForm] = useState(false);
  const [newOwnerData, setNewOwnerData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (open) {
      loadOwners();
    }
  }, [open]);

  const loadOwners = async () => {
    try {
      const { data, error } = await supabase
        .from("property_owners")
        .select("*")
        .order("name");

      if (error) throw error;
      setOwners(data || []);
    } catch (error) {
      console.error("Failed to load owners:", error);
    }
  };

  const handleCreate = async () => {
    let ownerId = selectedOwnerId;

    // If creating new owner
    if (showNewOwnerForm) {
      if (!newOwnerData.name.trim() || !newOwnerData.email.trim()) {
        toast.error("Owner name and email are required");
        return;
      }

      try {
        const { data: newOwner, error: ownerError } = await supabase
          .from("property_owners")
          .insert({
            name: newOwnerData.name.trim(),
            email: newOwnerData.email.trim(),
            phone: newOwnerData.phone.trim() || null,
            payment_method: "card", // default
          })
          .select()
          .single();

        if (ownerError) throw ownerError;
        ownerId = newOwner.id;

        // Update property with owner_id
        const { error: updateError } = await supabase
          .from("properties")
          .update({ owner_id: ownerId })
          .eq("id", propertyId);

        if (updateError) throw updateError;
      } catch (error: any) {
        toast.error("Failed to create owner: " + error.message);
        return;
      }
    }

    if (!ownerId && !showNewOwnerForm) {
      toast.error("Please select an owner or create a new one");
      return;
    }

    try {
      setLoading(true);

      // Get owner details
      const { data: ownerData } = await supabase
        .from("property_owners")
        .select("name")
        .eq("id", ownerId)
        .single();

      // Update property with owner_id if not already set
      if (selectedOwnerId) {
        await supabase
          .from("properties")
          .update({ owner_id: ownerId })
          .eq("id", propertyId);
      }

      // Create project
      const { data: project, error: projectError } = await supabase
        .from("onboarding_projects")
        .insert({
          property_id: propertyId,
          owner_name: ownerData?.name || newOwnerData.name,
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
      setSelectedOwnerId("");
      setShowNewOwnerForm(false);
      setNewOwnerData({ name: "", email: "", phone: "" });
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
            <Label htmlFor="owner">Property Owner *</Label>
            {!showNewOwnerForm ? (
              <div className="space-y-2">
                <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an owner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {owner.name} ({owner.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewOwnerForm(true)}
                  className="w-full gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create New Owner
                </Button>
              </div>
            ) : (
              <div className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">New Owner Details</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowNewOwnerForm(false);
                      setNewOwnerData({ name: "", email: "", phone: "" });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-owner-name">Name *</Label>
                  <Input
                    id="new-owner-name"
                    placeholder="Enter owner name"
                    value={newOwnerData.name}
                    onChange={(e) => setNewOwnerData({ ...newOwnerData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-owner-email">Email *</Label>
                  <Input
                    id="new-owner-email"
                    type="email"
                    placeholder="owner@example.com"
                    value={newOwnerData.email}
                    onChange={(e) => setNewOwnerData({ ...newOwnerData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-owner-phone">Phone</Label>
                  <Input
                    id="new-owner-phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={newOwnerData.phone}
                    onChange={(e) => setNewOwnerData({ ...newOwnerData, phone: e.target.value })}
                  />
                </div>
              </div>
            )}
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
