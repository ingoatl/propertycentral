import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingTask } from "@/types/onboarding";
import { AlertCircle, Calendar, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { RescheduleDueDateDialog } from "@/components/onboarding/RescheduleDueDateDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface OverdueTaskWithProject extends OnboardingTask {
  onboarding_projects?: {
    owner_name: string;
    property_address: string;
  };
}

interface GroupedTasks {
  [projectId: string]: {
    project: {
      owner_name: string;
      property_address: string;
    };
    tasks: OverdueTaskWithProject[];
  };
}

export const OverdueTasksCard = () => {
  const navigate = useNavigate();
  const [overdueTasks, setOverdueTasks] = useState<OverdueTaskWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCardExpanded, setIsCardExpanded] = useState(false); // Card starts COLLAPSED
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set()); // Projects start collapsed
  const [rescheduleTask, setRescheduleTask] = useState<OverdueTaskWithProject | null>(null);

  const loadOverdueTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is admin
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      const isAdmin = !!adminRole;
      const today = new Date().toISOString().split('T')[0];

      let query = supabase
        .from("onboarding_tasks")
        .select(`
          *,
          onboarding_projects!inner (
            owner_name,
            property_address,
            status
          )
        `)
        .lt("due_date", today)
        .neq("status", "completed")
        .eq("onboarding_projects.status", "in-progress")
        .or("field_value.is.null,field_value.eq.")
        .is("file_path", null)
        .order("due_date", { ascending: true });

      // Admins see ALL overdue tasks, regular users only see their assigned tasks
      if (!isAdmin) {
        // Get user's team role IDs
        const { data: teamRoles } = await supabase
          .from("user_team_roles")
          .select("role_id")
          .eq("user_id", user.id);

        const userRoleIds = teamRoles?.map(tr => tr.role_id) || [];

        // Filter by user assignment - either directly assigned or by role
        if (userRoleIds.length > 0) {
          query = query.or(`assigned_to_uuid.eq.${user.id},assigned_role_id.in.(${userRoleIds.join(",")})`);
        } else {
          query = query.eq("assigned_to_uuid", user.id);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      setOverdueTasks((data as OverdueTaskWithProject[]) || []);
    } catch (error) {
      console.error("Error loading overdue tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverdueTasks();
  }, []);

  const getDaysOverdue = (dueDate: string) => {
    return differenceInDays(new Date(), new Date(dueDate));
  };

  const getUrgencyColor = (daysOverdue: number) => {
    if (daysOverdue >= 4) return "bg-destructive/10 border-destructive/20 text-destructive";
    if (daysOverdue >= 1) return "bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400";
    return "bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400";
  };

  const groupTasksByProject = (): GroupedTasks => {
    return overdueTasks.reduce((acc, task) => {
      const projectId = task.project_id;
      if (!acc[projectId]) {
        acc[projectId] = {
          project: task.onboarding_projects || {
            owner_name: "Unknown Project",
            property_address: "No address",
          },
          tasks: [],
        };
      }
      acc[projectId].tasks.push(task);
      return acc;
    }, {} as GroupedTasks);
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev || []);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const groupedTasks = groupTasksByProject();
  const allProjectIds = Object.keys(groupedTasks);

  // Expand/Collapse all projects helper
  const toggleAllProjects = (expand: boolean) => {
    if (expand) {
      setExpandedProjects(new Set(allProjectIds));
    } else {
      setExpandedProjects(new Set());
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Overdue Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (overdueTasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <AlertCircle className="h-5 w-5" />
            No Overdue Tasks
          </CardTitle>
          <CardDescription>Great job! All your tasks are on track.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Collapsible open={isCardExpanded} onOpenChange={setIsCardExpanded}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-destructive">
                  {isCardExpanded ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                  <AlertCircle className="h-5 w-5" />
                  Overdue Tasks
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">{overdueTasks.length} total</Badge>
                  <span className="text-xs text-muted-foreground font-normal">
                    across {allProjectIds.length} properties
                  </span>
                </div>
              </CardTitle>
              <CardDescription>
                {isCardExpanded ? "Tasks past their due date" : "Click to expand and view all overdue tasks"}
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Expand/Collapse All Controls */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAllProjects(false)}
                  disabled={expandedProjects.size === 0}
                >
                  Collapse All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAllProjects(true)}
                  disabled={expandedProjects.size === allProjectIds.length}
                >
                  Expand All
                </Button>
              </div>

              {Object.entries(groupedTasks).map(([projectId, { project, tasks }]) => (
                <Collapsible
                  key={projectId}
                  open={expandedProjects.has(projectId)}
                  onOpenChange={() => toggleProject(projectId)}
                >
                  <div className="rounded-lg border bg-card">
                    <CollapsibleTrigger asChild>
                      <button className="flex w-full items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-2">
                          {expandedProjects.has(projectId) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div>
                            <p className="font-semibold">{project.property_address}</p>
                            <p className="text-sm text-muted-foreground">{project.owner_name}</p>
                          </div>
                        </div>
                        <Badge variant="destructive">{tasks.length} overdue</Badge>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t p-4 space-y-3">
                        {tasks.map((task) => {
                          const daysOverdue = getDaysOverdue(task.due_date || "");
                          return (
                            <div
                              key={task.id}
                              className={`p-3 rounded-lg border ${getUrgencyColor(daysOverdue)} cursor-pointer hover:opacity-80 transition-opacity`}
                              onClick={() => {
                                navigate(`/properties?openWorkflow=${task.project_id}&taskId=${task.id}`, { replace: true });
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">{task.title}</p>
                                    <ExternalLink className="h-3 w-3 opacity-50" />
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-3 w-3" />
                                    <span>
                                      Due: {task.due_date && format(new Date(task.due_date), "MMM d, yyyy")}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {daysOverdue} day{daysOverdue !== 1 ? "s" : ""} ago
                                    </Badge>
                                  </div>
                                  <p className="text-xs opacity-90">
                                    {task.phase_title}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRescheduleTask(task);
                                  }}
                                >
                                  Reschedule
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {rescheduleTask && (
        <RescheduleDueDateDialog
          open={!!rescheduleTask}
          onOpenChange={(open) => !open && setRescheduleTask(null)}
          taskId={rescheduleTask.id}
          taskTitle={rescheduleTask.title}
          currentDueDate={rescheduleTask.due_date || ""}
          originalDueDate={rescheduleTask.original_due_date || rescheduleTask.due_date || ""}
          onUpdate={() => {
            loadOverdueTasks();
            setRescheduleTask(null);
          }}
        />
      )}
    </>
  );
};
