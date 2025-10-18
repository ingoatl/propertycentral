import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { OnboardingSOP } from "@/types/onboarding";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SOPFormDialogProps {
  projectId: string;
  phaseNumber?: number;
  taskId?: string;
  existingSOP?: OnboardingSOP | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const SOPFormDialog = ({
  projectId,
  phaseNumber,
  taskId,
  existingSOP,
  open,
  onOpenChange,
  onSuccess,
}: SOPFormDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loomUrl, setLoomUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existingSOP) {
      setTitle(existingSOP.title);
      setDescription(existingSOP.description || "");
      setLoomUrl(existingSOP.loom_video_url || "");
    } else {
      setTitle("");
      setDescription("");
      setLoomUrl("");
    }
  }, [existingSOP, open]);

  const validateLoomUrl = (url: string) => {
    if (!url) return true; // Optional field
    return /loom\.com\/(share|embed)\/[a-zA-Z0-9]+/.test(url);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }

    if (loomUrl && !validateLoomUrl(loomUrl)) {
      toast({ 
        title: "Invalid Loom URL", 
        description: "Please enter a valid Loom video URL",
        variant: "destructive" 
      });
      return;
    }

    setSaving(true);

    try {
      const sopData = {
        project_id: projectId,
        phase_number: phaseNumber,
        task_id: taskId,
        title: title.trim(),
        description: description.trim() || null,
        loom_video_url: loomUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (existingSOP) {
        // Update existing SOP
        const { error } = await supabase
          .from("onboarding_sops")
          .update(sopData)
          .eq("id", existingSOP.id);

        if (error) throw error;
        toast({ title: "SOP updated successfully" });
      } else {
        // Create new SOP
        const { error } = await supabase
          .from("onboarding_sops")
          .insert([sopData]);

        if (error) throw error;
        toast({ title: "SOP created successfully" });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save SOP:", error);
      toast({ 
        title: "Failed to save SOP", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existingSOP ? "Edit SOP" : "Add SOP"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Phase 1 Setup Instructions"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loom">Loom Video URL</Label>
            <Input
              id="loom"
              value={loomUrl}
              onChange={(e) => setLoomUrl(e.target.value)}
              placeholder="https://www.loom.com/share/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add instructions, notes, or guidelines..."
              rows={6}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : existingSOP ? "Update SOP" : "Create SOP"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
