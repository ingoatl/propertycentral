import { OverdueTasksCard } from "./OverdueTasksCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingTask } from "@/types/onboarding";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Clock, TrendingUp, ExternalLink } from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";

interface TaskStats {
  totalAssigned: number;
  completedThisWeek: number;
  upcomingTasks: OnboardingTask[];
  recentlyCompleted: OnboardingTask[];
}

export const UserTasksDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<TaskStats>({
    totalAssigned: 0,
    completedThisWeek: 0,
    upcomingTasks: [],
    recentlyCompleted: [],
  });
  const [loading, setLoading] = useState(true);

  const loadTaskStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isAdmin = roles?.some(r => r.role === "admin");

      // Get user's team role IDs
      const { data: teamRoles } = await supabase
        .from("user_team_roles")
        .select("role_id")
        .eq("user_id", user.id);

      const userRoleIds = teamRoles?.map(tr => tr.role_id) || [];

      const today = new Date();
      const sevenDaysFromNow = addDays(today, 7);
      const sevenDaysAgo = addDays(today, -7);

      // First, update any uncompleted tasks without due dates to have a due date 1 week out
      let updateQuery = supabase
        .from("onboarding_tasks")
        .update({ 
          due_date: sevenDaysFromNow.toISOString().split('T')[0],
          original_due_date: sevenDaysFromNow.toISOString().split('T')[0]
        })
        .neq("status", "completed")
        .is("due_date", null);

      if (!isAdmin) {
        updateQuery = updateQuery.eq("assigned_to_uuid", user.id);
      }

      const { error: updateError } = await updateQuery;

      if (updateError) {
        console.error("Error updating tasks without due dates:", updateError);
      }

      // Total assigned tasks
      let totalQuery = supabase
        .from("onboarding_tasks")
        .select("*", { count: "exact", head: true })
        .neq("status", "completed");

      // All users (including admins) only see their assigned tasks
      if (userRoleIds.length > 0) {
        totalQuery = totalQuery.or(`assigned_to_uuid.eq.${user.id},assigned_role_id.in.(${userRoleIds.join(",")})`);
      } else {
        totalQuery = totalQuery.eq("assigned_to_uuid", user.id);
      }

      const { count: totalCount } = await totalQuery;

      // Completed this week
      let completedQuery = supabase
        .from("onboarding_tasks")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("completed_date", sevenDaysAgo.toISOString());

      // All users (including admins) only see their assigned tasks
      if (userRoleIds.length > 0) {
        completedQuery = completedQuery.or(`assigned_to_uuid.eq.${user.id},assigned_role_id.in.(${userRoleIds.join(",")})`);
      } else {
        completedQuery = completedQuery.eq("assigned_to_uuid", user.id);
      }

      const { count: completedCount } = await completedQuery;

      // Upcoming tasks (next 7 days) - filter for tasks in active/in-progress projects
      let upcomingQuery = supabase
        .from("onboarding_tasks")
        .select(`
          *,
          onboarding_projects!inner (
            owner_name,
            property_address,
            status
          )
        `)
        .neq("status", "completed")
        .in("onboarding_projects.status", ["pending", "in-progress"])
        .gte("due_date", today.toISOString().split('T')[0])
        .lte("due_date", sevenDaysFromNow.toISOString().split('T')[0])
        .order("due_date", { ascending: true })
        .limit(10);

      // All users (including admins) only see their assigned tasks
      if (userRoleIds.length > 0) {
        upcomingQuery = upcomingQuery.or(`assigned_to_uuid.eq.${user.id},assigned_role_id.in.(${userRoleIds.join(",")})`);
      } else {
        upcomingQuery = upcomingQuery.eq("assigned_to_uuid", user.id);
      }

      const { data: upcomingData } = await upcomingQuery;

      // Recently completed
      let recentlyCompletedQuery = supabase
        .from("onboarding_tasks")
        .select(`
          *,
          onboarding_projects (
            owner_name,
            property_address
          )
        `)
        .eq("status", "completed")
        .order("completed_date", { ascending: false })
        .limit(10);

      // All users (including admins) only see their assigned tasks
      if (userRoleIds.length > 0) {
        recentlyCompletedQuery = recentlyCompletedQuery.or(`assigned_to_uuid.eq.${user.id},assigned_role_id.in.(${userRoleIds.join(",")})`);
      } else {
        recentlyCompletedQuery = recentlyCompletedQuery.eq("assigned_to_uuid", user.id);
      }

      const { data: completedData } = await recentlyCompletedQuery;

      setStats({
        totalAssigned: totalCount || 0,
        completedThisWeek: completedCount || 0,
        upcomingTasks: (upcomingData as OnboardingTask[]) || [],
        recentlyCompleted: (completedData as OnboardingTask[]) || [],
      });
    } catch (error) {
      console.error("Error loading task stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaskStats();
  }, []);

  const getDaysUntilDue = (dueDate: string) => {
    return differenceInDays(new Date(dueDate), new Date());
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading your tasks...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Overdue Tasks - Priority Section */}
      <OverdueTasksCard />

      {/* Task Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssigned}</div>
            <p className="text-xs text-muted-foreground">
              Currently assigned to you
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed This Week</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedThisWeek}</div>
            <p className="text-xs text-muted-foreground">
              Tasks finished in last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingTasks.length}</div>
            <p className="text-xs text-muted-foreground">
              Upcoming in next 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Tasks (Next 7 Days)
          </CardTitle>
          <CardDescription>
            Tasks due in the coming week
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.upcomingTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tasks due in the next 7 days
            </p>
          ) : (
            <div className="space-y-3">
              {stats.upcomingTasks.map((task: any) => {
                const daysUntil = getDaysUntilDue(task.due_date);
                return (
                  <div
                    key={task.id}
                    className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/properties?project=${task.project_id}`)}
                  >
                     <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{task.title}</p>
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {task.onboarding_projects?.property_address}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          Phase {task.phase_number}
                        </Badge>
                        {task.assigned_to && (
                          <span>Assigned to: {task.assigned_to}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Due: {task.due_date && format(new Date(task.due_date), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant={daysUntil <= 2 ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recently Completed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            Recently Completed
          </CardTitle>
          <CardDescription>
            Your latest accomplishments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentlyCompleted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recently completed tasks
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentlyCompleted.map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-card opacity-80"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.onboarding_projects?.property_address}
                    </p>
                    {task.completed_date && (
                      <p className="text-xs text-muted-foreground">
                        Completed: {format(new Date(task.completed_date), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                    ✓ Done
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
