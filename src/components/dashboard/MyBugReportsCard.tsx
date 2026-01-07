import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bug, Loader2, ExternalLink, Calendar, Plus } from "lucide-react";
import { format } from "date-fns";
import { SubmitBugDialog } from "@/components/bugs/SubmitBugDialog";
interface BugReport {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  submitted_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  loom_video_url: string | null;
  screenshot_path: string | null;
  properties?: { name: string };
  onboarding_projects?: { property_address: string };
  onboarding_tasks?: { title: string };
}

export function MyBugReportsCard() {
  const [myBugs, setMyBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBugDialog, setShowBugDialog] = useState(false);
  useEffect(() => {
    loadMyBugs();
  }, []);

  const loadMyBugs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("bug_reports")
        .select(`
          *,
          properties:property_id(name),
          onboarding_projects:project_id(property_address),
          onboarding_tasks:task_id(title)
        `)
        .eq("submitted_by", user.id)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setMyBugs(data || []);
    } catch (error) {
      console.error("Error loading bug reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "resolved": return "default";
      case "in_progress": return "secondary";
      case "open": return "outline";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          My Bug & Improvement Requests
        </CardTitle>
        <CardDescription>
          Track your submitted bug reports and improvement suggestions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {myBugs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>You haven't submitted any bug reports yet.</p>
            <p className="text-sm mt-2">Use the "Report Bug" button to submit your first report.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myBugs.map((bug) => (
              <div
                key={bug.id}
                className="border rounded-lg p-4 space-y-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <h4 className="font-semibold">{bug.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {bug.description}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge variant={getStatusColor(bug.status)}>
                      {bug.status === "in_progress" ? "In Progress" : bug.status}
                    </Badge>
                    <Badge variant={getPriorityColor(bug.priority)}>
                      {bug.priority}
                    </Badge>
                  </div>
                </div>

                {/* Context Information */}
                {(bug.properties || bug.onboarding_projects || bug.onboarding_tasks) && (
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {bug.properties && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Property:</span> {bug.properties.name}
                      </span>
                    )}
                    {bug.onboarding_projects && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Project:</span> {bug.onboarding_projects.property_address}
                      </span>
                    )}
                    {bug.onboarding_tasks && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Task:</span> {bug.onboarding_tasks.title}
                      </span>
                    )}
                  </div>
                )}

                {/* Links */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Submitted {format(new Date(bug.submitted_at), "MMM d, yyyy")}
                  </div>
                  {bug.loom_video_url && (
                    <a
                      href={bug.loom_video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Loom Video
                    </a>
                  )}
                  {bug.screenshot_path && (
                    <span className="text-muted-foreground">
                      📸 Screenshot attached
                    </span>
                  )}
                </div>

                {/* Resolution */}
                {bug.status === "resolved" && bug.resolution_notes && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-md border border-green-200 dark:border-green-800">
                    <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                      ✓ Resolved {bug.resolved_at && `on ${format(new Date(bug.resolved_at), "MMM d, yyyy")}`}
                    </p>
                    <p className="text-sm text-muted-foreground">{bug.resolution_notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t">
          <Button onClick={() => setShowBugDialog(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Report Bug
          </Button>
        </div>
      </CardContent>

      <SubmitBugDialog
        open={showBugDialog}
        onOpenChange={setShowBugDialog}
      />
    </Card>
  );
}
