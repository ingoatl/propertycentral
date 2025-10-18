import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Calendar } from "lucide-react";
import { OnboardingProject } from "@/types/onboarding";
import { format } from "date-fns";
import { WorkflowDialog } from "./WorkflowDialog";

interface OnboardingProjectCardProps {
  project: OnboardingProject;
  onUpdate: () => void;
}

export const OnboardingProjectCard = ({ project, onUpdate }: OnboardingProjectCardProps) => {
  const [showWorkflow, setShowWorkflow] = useState(false);
  
  const handleUpdate = () => {
    // Don't close the modal when updating
    onUpdate();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in-progress":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setShowWorkflow(true)}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl">{project.owner_name}</CardTitle>
              <CardDescription className="mt-1">{project.property_address}</CardDescription>
            </div>
            <Badge className={getStatusColor(project.status)}>
              {project.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{Math.round(project.progress)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>

            {/* Created Date */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Created {format(new Date(project.created_at), "MMM d, yyyy")}</span>
            </div>

            {/* View Workflow Button */}
            <Button variant="outline" className="w-full gap-2" onClick={() => setShowWorkflow(true)}>
              View Workflow
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <WorkflowDialog
        open={showWorkflow}
        onOpenChange={setShowWorkflow}
        project={project}
        propertyId={project.property_id || ''}
        propertyName={project.owner_name}
        propertyAddress={project.property_address}
        visitPrice={0}
        onUpdate={handleUpdate}
      />
    </>
  );
};
