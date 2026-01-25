import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingTask } from "@/types/onboarding";
import { ClipboardList, Calendar, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TaskWithProject extends OnboardingTask {
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
    tasks: TaskWithProject[];
    overdueTasks: number;
    completedTasks: number;
  };
}

export const AllTasksCard = () => {
  const navigate = useNavigate();
  const [allTasks, setAllTasks] = useState<TaskWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [hasInitializedExpansion, setHasInitializedExpansion] = useState(false);

  const loadAllTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_tasks")
        .select(`
          *,
          onboarding_projects!inner (
            owner_name,
            property_address,
            status
          )
        `)
        .eq("onboarding_projects.status", "in-progress")
        .order("due_date", { ascending: true });

      if (error) throw error;

      setAllTasks((data as TaskWithProject[]) || []);
    } catch (error) {
      console.error("Error loading all tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllTasks();
  }, []);

  // Initialize expanded state with all projects when tasks first load
  useEffect(() => {
    if (allTasks.length > 0 && !hasInitializedExpansion) {
      const grouped = groupTasksByProject();
      setExpandedProjects(new Set(Object.keys(grouped)));
      setHasInitializedExpansion(true);
    }
  }, [allTasks, hasInitializedExpansion]);

  const getDaysUntilDue = (dueDate: string) => {
    return differenceInDays(new Date(dueDate), new Date());
  };

  const getTaskStatusColor = (task: TaskWithProject) => {
    if (task.status === "completed") return "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400";
    
    if (!task.due_date) return "bg-muted border-border";
    
    const daysUntil = getDaysUntilDue(task.due_date);
    if (daysUntil < 0) return "bg-destructive/10 border-destructive/20 text-destructive";
    if (daysUntil <= 2) return "bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400";
    return "bg-muted border-border";
  };

  const groupTasksByProject = (): GroupedTasks => {
    return allTasks.reduce((acc, task) => {
      const projectId = task.project_id;
      if (!acc[projectId]) {
        acc[projectId] = {
          project: task.onboarding_projects || {
            owner_name: "Unknown Project",
            property_address: "No address",
          },
          tasks: [],
          overdueTasks: 0,
          completedTasks: 0,
        };
      }
      acc[projectId].tasks.push(task);
      
      if (task.status === "completed") {
        acc[projectId].completedTasks++;
      }
      
      if (task.due_date && getDaysUntilDue(task.due_date) < 0 && task.status !== "completed") {
        acc[projectId].overdueTasks++;
      }
      
      return acc;
    }, {} as GroupedTasks);
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            All Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (allTasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            No Active Tasks
          </CardTitle>
          <CardDescription>There are no tasks in active projects.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const groupedTasks = groupTasksByProject();
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === "completed").length;
  const overdueTasks = allTasks.filter(t => t.due_date && getDaysUntilDue(t.due_date) < 0 && t.status !== "completed").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            All Tasks ({totalTasks})
          </span>
          <div className="flex gap-2">
            <Badge variant="secondary">{completedTasks} completed</Badge>
            {overdueTasks > 0 && <Badge variant="destructive">{overdueTasks} overdue</Badge>}
          </div>
        </CardTitle>
        <CardDescription>
          All tasks across active projects - click to view details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groupedTasks).map(([projectId, { project, tasks, overdueTasks, completedTasks }]) => (
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
                  <div className="flex gap-2">
                    <Badge variant="secondary">{tasks.length} tasks</Badge>
                    {overdueTasks > 0 && <Badge variant="destructive">{overdueTasks} overdue</Badge>}
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t p-4 space-y-3">
                  {tasks.map((task) => {
                    const daysUntilDue = task.due_date ? getDaysUntilDue(task.due_date) : null;
                    return (
                      <div
                        key={task.id}
                        className={`p-3 rounded-lg border ${getTaskStatusColor(task)} cursor-pointer hover:opacity-80 transition-opacity`}
                        onClick={() => {
                          // Use replace to avoid history buildup and faster navigation
                          navigate(`/properties?openWorkflow=${task.project_id}&taskId=${task.id}`, { replace: true });
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{task.title}</p>
                              <ExternalLink className="h-3 w-3 opacity-50" />
                            </div>
                            <div className="flex items-center gap-2 text-sm flex-wrap">
                              {task.due_date && (
                                <>
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    Due: {format(new Date(task.due_date), "MMM d, yyyy")}
                                  </span>
                                  {daysUntilDue !== null && task.status !== "completed" && (
                                    <Badge variant="outline" className="text-xs">
                                      {daysUntilDue < 0 
                                        ? `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''} overdue`
                                        : `${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} left`
                                      }
                                    </Badge>
                                  )}
                                </>
                              )}
                              {task.status === "completed" && (
                                <Badge variant="outline" className="text-xs bg-green-500/10">
                                  ✓ Completed
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs opacity-90">
                              {task.phase_title}
                            </p>
                          </div>
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
    </Card>
  );
};
