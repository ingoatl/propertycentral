import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, ChevronDown, ChevronRight, ExternalLink, Calendar, CheckCircle2 } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface OverdueTask {
  id: string;
  title: string;
  project_id: string;
  due_date: string;
  phase_title: string;
  property_address: string;
  property_id: string;
}

interface GroupedTasks {
  [projectId: string]: {
    propertyAddress: string;
    propertyId: string;
    tasks: OverdueTask[];
  };
}

interface OverdueTasksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FilterType = "all" | "critical" | "month";

export const OverdueTasksModal = ({ open, onOpenChange }: OverdueTasksModalProps) => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<OverdueTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const loadOverdueTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];

      // Check if user is admin
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      const isAdmin = !!adminRole;

      const { data, error } = await supabase
        .from("onboarding_tasks")
        .select(`
          id, title, project_id, due_date, phase_title,
          onboarding_projects!inner (id, property_id, property_address, status)
        `)
        .eq("onboarding_projects.status", "in-progress")
        .lt("due_date", today)
        .neq("status", "completed")
        .or("field_value.is.null,field_value.eq.")
        .is("file_path", null)
        .order("due_date", { ascending: true })
        .limit(isAdmin ? 500 : 100);

      if (error) throw error;

      const formattedTasks: OverdueTask[] = (data || []).map((task: any) => ({
        id: task.id,
        title: task.title,
        project_id: task.project_id,
        due_date: task.due_date,
        phase_title: task.phase_title,
        property_address: task.onboarding_projects?.property_address || "Unknown Property",
        property_id: task.onboarding_projects?.property_id,
      }));

      setTasks(formattedTasks);
    } catch (error) {
      console.error("Error loading overdue tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setLoading(true);
      loadOverdueTasks();
    }
  }, [open]);

  const getDaysOverdue = (dueDate: string) => {
    return differenceInDays(new Date(), new Date(dueDate));
  };

  const filteredTasks = tasks.filter((task) => {
    const daysOverdue = getDaysOverdue(task.due_date);
    if (filter === "critical") return daysOverdue >= 90;
    if (filter === "month") return daysOverdue <= 30;
    return true;
  });

  const criticalCount = tasks.filter((t) => getDaysOverdue(t.due_date) >= 90).length;
  const monthCount = tasks.filter((t) => getDaysOverdue(t.due_date) <= 30).length;

  const groupedTasks: GroupedTasks = filteredTasks.reduce((acc, task) => {
    if (!acc[task.project_id]) {
      acc[task.project_id] = {
        propertyAddress: task.property_address,
        propertyId: task.property_id,
        tasks: [],
      };
    }
    acc[task.project_id].tasks.push(task);
    return acc;
  }, {} as GroupedTasks);

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

  const handleTaskClick = (task: OverdueTask) => {
    onOpenChange(false);
    navigate(`/properties?openWorkflow=${task.project_id}&taskId=${task.id}`);
  };

  const getUrgencyColor = (daysOverdue: number) => {
    if (daysOverdue >= 90) return "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30";
    if (daysOverdue >= 30) return "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30";
    return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Overdue Tasks ({tasks.length})
          </DialogTitle>
          <DialogDescription>
            Tasks past their due date across all properties
          </DialogDescription>
        </DialogHeader>

        {/* Filter Chips */}
        <div className="flex gap-2 flex-wrap py-2">
          <Badge
            variant={filter === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter("all")}
          >
            All ({tasks.length})
          </Badge>
          <Badge
            variant={filter === "critical" ? "destructive" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter("critical")}
          >
            Critical 90+ days ({criticalCount})
          </Badge>
          <Badge
            variant={filter === "month" ? "secondary" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter("month")}
          >
            This Month ({monthCount})
          </Badge>
        </div>

        {/* Scrollable Task List */}
        <ScrollArea className="h-[55vh] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold text-foreground">All caught up!</h3>
              <p className="text-muted-foreground">No overdue tasks matching your filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedTasks).map(([projectId, { propertyAddress, propertyId, tasks: projectTasks }]) => (
                <Collapsible
                  key={projectId}
                  open={expandedProjects.has(projectId)}
                  onOpenChange={() => toggleProject(projectId)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors text-left">
                        <div className="flex items-center gap-2">
                          {expandedProjects.has(projectId) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium truncate max-w-[300px]">
                            {propertyAddress}
                          </span>
                        </div>
                        <Badge variant="destructive" className="ml-2">
                          {projectTasks.length} task{projectTasks.length !== 1 ? "s" : ""}
                        </Badge>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="divide-y">
                        {projectTasks.map((task) => {
                          const daysOverdue = getDaysOverdue(task.due_date);
                          return (
                            <button
                              key={task.id}
                              onClick={() => handleTaskClick(task)}
                              className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors text-left"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{task.title}</p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <span>{task.phase_title}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Due {format(new Date(task.due_date), "MMM d, yyyy")}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={getUrgencyColor(daysOverdue)}
                                >
                                  {daysOverdue}d overdue
                                </Badge>
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer with Expand All / Collapse All */}
        {!loading && filteredTasks.length > 0 && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpandedProjects(new Set())}
            >
              Collapse All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpandedProjects(new Set(Object.keys(groupedTasks)))}
            >
              Expand All
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
