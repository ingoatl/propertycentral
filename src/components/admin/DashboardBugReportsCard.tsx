import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bug, Clock, ExternalLink, AlertCircle, CheckCircle } from "lucide-react";
import { ResolveBugDialog } from "./ResolveBugDialog";
import { format } from "date-fns";

interface BugReport {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  submitted_at: string;
  submitted_by: string;
  loom_video_url: string | null;
  property_id: string | null;
  project_id: string | null;
  task_id: string | null;
  profiles?: {
    first_name: string | null;
    email: string;
  };
  properties?: {
    name: string;
  } | null;
}

export const DashboardBugReportsCard = () => {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const { toast } = useToast();

  const loadBugReports = async () => {
    try {
      const { data, error } = await supabase
        .from("bug_reports")
        .select("*")
        .in("status", ["open", "in_progress"])
        .order("priority", { ascending: true })
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles and properties separately
      const bugsWithDetails = await Promise.all((data || []).map(async (bug) => {
        const profilePromise = supabase
          .from("profiles")
          .select("first_name, email")
          .eq("id", bug.submitted_by)
          .single();

        const propertyPromise = bug.property_id
          ? supabase.from("properties").select("name").eq("id", bug.property_id).single()
          : Promise.resolve({ data: null });

        const [{ data: profile }, { data: property }] = await Promise.all([
          profilePromise,
          propertyPromise,
        ]);

        return {
          ...bug,
          profiles: profile,
          properties: property,
        };
      }));

      setBugs(bugsWithDetails as any);
    } catch (error: any) {
      console.error("Error loading bug reports:", error);
      toast({
        title: "Error",
        description: "Failed to load bug reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBugReports();
  }, []);

  const handleStatusChange = async (bugId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("bug_reports")
        .update({ status: newStatus })
        .eq("id", bugId);

      if (error) throw error;

      toast({
        title: "Status updated",
      });
      loadBugReports();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleResolve = (bug: BugReport) => {
    setSelectedBug(bug);
    setShowResolveDialog(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "destructive";
      case "in_progress": return "secondary";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Bug Reports & Improvement Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Bug Reports & Improvement Requests
            {bugs.length > 0 && (
              <Badge variant="secondary">{bugs.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bugs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No open bug reports or improvement requests
            </p>
          ) : (
            <div className="space-y-4">
              {bugs.map((bug) => (
                <div key={bug.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getPriorityColor(bug.priority)}>
                          {bug.priority}
                        </Badge>
                        <Badge variant={getStatusColor(bug.status)}>
                          {bug.status.replace("_", " ")}
                        </Badge>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(bug.submitted_at), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="font-medium mb-2">{bug.title}</p>
                      <p className="text-sm text-muted-foreground mb-2">{bug.description}</p>
                      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                        <span>Submitted by: {bug.profiles?.first_name || bug.profiles?.email || "Unknown"}</span>
                        {bug.properties && (
                          <span>Property: {bug.properties.name}</span>
                        )}
                      </div>
                      {bug.loom_video_url && (
                        <a
                          href={bug.loom_video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Loom Video
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {bug.status === "open" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(bug.id, "in_progress")}
                      >
                        <AlertCircle className="h-4 w-4 mr-1" />
                        Mark In Progress
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleResolve(bug)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Resolve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ResolveBugDialog
        bug={selectedBug}
        open={showResolveDialog}
        onOpenChange={setShowResolveDialog}
        onResolved={loadBugReports}
      />
    </>
  );
};
