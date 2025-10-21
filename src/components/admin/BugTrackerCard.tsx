import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResolveBugDialog } from "./ResolveBugDialog";
import { Bug, ExternalLink, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function BugTrackerCard() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedBug, setSelectedBug] = useState<any>(null);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);

  const { data: bugs, isLoading, refetch } = useQuery({
    queryKey: ["bug-reports", statusFilter, priorityFilter],
    queryFn: async () => {
      let query = supabase
        .from("bug_reports")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (priorityFilter !== "all") {
        query = query.eq("priority", priorityFilter);
      }

      const { data: bugData, error } = await query;
      if (error) throw error;

      // Fetch profiles separately
      const userIds = [...new Set([
        ...bugData.map(b => b.submitted_by),
        ...bugData.filter(b => b.resolved_by).map(b => b.resolved_by!)
      ])];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, email")
        .in("id", userIds);

      // Fetch related data
      const propertyIds = bugData.filter(b => b.property_id).map(b => b.property_id!);
      const { data: properties } = propertyIds.length > 0 
        ? await supabase.from("properties").select("id, name").in("id", propertyIds)
        : { data: [] };

      const projectIds = bugData.filter(b => b.project_id).map(b => b.project_id!);
      const { data: projects } = projectIds.length > 0
        ? await supabase.from("onboarding_projects").select("id, property_address").in("id", projectIds)
        : { data: [] };

      const taskIds = bugData.filter(b => b.task_id).map(b => b.task_id!);
      const { data: tasks } = taskIds.length > 0
        ? await supabase.from("onboarding_tasks").select("id, title").in("id", taskIds)
        : { data: [] };

      // Combine data
      return bugData.map(bug => ({
        ...bug,
        submitted_by_profile: profiles?.find(p => p.id === bug.submitted_by),
        resolved_by_profile: bug.resolved_by ? profiles?.find(p => p.id === bug.resolved_by) : null,
        property: bug.property_id ? properties?.find(p => p.id === bug.property_id) : null,
        project: bug.project_id ? projects?.find(p => p.id === bug.project_id) : null,
        task: bug.task_id ? tasks?.find(t => t.id === bug.task_id) : null,
      }));
    },
  });

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
      case "resolved": return "default";
      case "closed": return "outline";
      default: return "outline";
    }
  };

  const handleStatusChange = async (bugId: string, newStatus: string) => {
    const { error } = await supabase
      .from("bug_reports")
      .update({ status: newStatus })
      .eq("id", bugId);

    if (error) {
      console.error("Error updating status:", error);
    } else {
      refetch();
    }
  };

  const openResolveDialog = (bug: any) => {
    setSelectedBug(bug);
    setIsResolveDialogOpen(true);
  };

  const stats = {
    total: bugs?.length || 0,
    open: bugs?.filter(b => b.status === "open").length || 0,
    inProgress: bugs?.filter(b => b.status === "in_progress").length || 0,
    resolved: bugs?.filter(b => b.status === "resolved").length || 0,
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Bug Tracker
          </CardTitle>
          <CardDescription>
            Track and manage bug reports from users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Statistics */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">Total Bugs</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-destructive">{stats.open}</div>
                <p className="text-xs text-muted-foreground">Open</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-secondary">{stats.inProgress}</div>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.resolved}</div>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bug List */}
          <div className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading bug reports...</p>
            ) : bugs && bugs.length > 0 ? (
              bugs.map((bug) => (
                <Card key={bug.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{bug.title}</h4>
                            <Badge variant={getPriorityColor(bug.priority)}>
                              {bug.priority}
                            </Badge>
                            <Badge variant={getStatusColor(bug.status)}>
                              {bug.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {bug.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(bug.submitted_at), { addSuffix: true })}
                            </span>
                            <span>
                              By: {bug.submitted_by_profile?.first_name || bug.submitted_by_profile?.email}
                            </span>
                            {bug.property && (
                              <span>Property: {bug.property.name}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {bug.loom_video_url && (
                        <a
                          href={bug.loom_video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Loom Video
                        </a>
                      )}

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
                        {(bug.status === "open" || bug.status === "in_progress") && (
                          <Button
                            size="sm"
                            onClick={() => openResolveDialog(bug)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Resolve Bug
                          </Button>
                        )}
                        {bug.status === "resolved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(bug.id, "closed")}
                          >
                            Close Bug
                          </Button>
                        )}
                      </div>

                      {bug.resolution_notes && (
                        <div className="bg-muted p-3 rounded-md">
                          <p className="text-sm font-medium mb-1">Resolution Notes:</p>
                          <p className="text-sm text-muted-foreground">{bug.resolution_notes}</p>
                          {bug.resolved_by_profile && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Resolved by: {bug.resolved_by_profile.first_name || bug.resolved_by_profile.email}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No bug reports found
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <ResolveBugDialog
        bug={selectedBug}
        open={isResolveDialogOpen}
        onOpenChange={setIsResolveDialogOpen}
        onResolved={refetch}
      />
    </>
  );
}
