import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingProject } from "@/types/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Clipboard } from "lucide-react";
import { toast } from "sonner";
import { OnboardingProjectCard } from "./OnboardingProjectCard";
import { CreateProjectDialog } from "./CreateProjectDialog";

interface OnboardingTabProps {
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
}

export const OnboardingTab = ({ propertyId, propertyName, propertyAddress }: OnboardingTabProps) => {
  const [projects, setProjects] = useState<OnboardingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [propertyId]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      console.log("Loading onboarding projects for property:", propertyId);
      
      const { data, error } = await supabase
        .from("onboarding_projects")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load onboarding projects:", error);
        toast.error("Failed to load onboarding projects: " + error.message);
        setProjects([]);
      } else {
        console.log("Loaded projects:", data);
        setProjects((data || []) as OnboardingProject[]);
      }
    } catch (error: any) {
      console.error("Exception loading projects:", error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Onboarding Workflow</h2>
          <p className="text-sm text-muted-foreground">9-phase STR property onboarding system</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          New Onboarding Project
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading projects...</p>
          </CardContent>
        </Card>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clipboard className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">No onboarding projects yet</p>
            <Button onClick={() => setShowCreateDialog(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Start Onboarding
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <OnboardingProjectCard
              key={project.id}
              project={project}
              onUpdate={loadProjects}
            />
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        propertyId={propertyId}
        propertyName={propertyName}
        propertyAddress={propertyAddress}
        onSuccess={loadProjects}
      />
    </div>
  );
};
