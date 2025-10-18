import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingProject } from "@/types/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Clipboard, FileText, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { OnboardingProjectCard } from "./OnboardingProjectCard";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { PropertyMasterPage } from "./PropertyMasterPage";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_projects")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Failed to load onboarding projects:", error);
        toast.error("Failed to load onboarding projects: " + error.message);
        setProjects([]);
      } else {
        setProjects((data || []) as OnboardingProject[]);
      }
    } catch (error: any) {
      console.error("Exception loading projects:", error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const latestProject = projects[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Onboarding</h2>
          <p className="text-sm text-muted-foreground">Manage property onboarding and information</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading...</p>
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
        <Tabs defaultValue="master" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="master" className="gap-2">
              <FileText className="h-4 w-4" />
              Property Master Page
            </TabsTrigger>
            <TabsTrigger value="workflow" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              Onboarding Workflow
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="master" className="mt-6">
            <PropertyMasterPage
              projectId={latestProject.id}
              propertyId={propertyId}
              propertyName={propertyName}
              propertyAddress={propertyAddress}
            />
          </TabsContent>
          
          <TabsContent value="workflow" className="mt-6">
            <div className="grid gap-4">
              {projects.map((project) => (
                <OnboardingProjectCard
                  key={project.id}
                  project={project}
                  onUpdate={loadProjects}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
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
