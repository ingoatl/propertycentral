import { OverdueTasksCard } from "./OverdueTasksCard";
import { ActiveTasksModal } from "./ActiveTasksModal";
import { EnhancedTeamPerformance } from "./EnhancedTeamPerformance";
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

interface TeamMember {
  name: string;
  roleName?: string;
  phases?: number[];
  tasksCompleted: number;
  tasksTotal: number;
  completionRate: number;
  properties?: string[];
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
  const [showActiveTasksModal, setShowActiveTasksModal] = useState(false);
  const [allActiveTasks, setAllActiveTasks] = useState<OnboardingTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);

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

      // Also get all active tasks for the modal
      let allActiveQuery = supabase
        .from("onboarding_tasks")
        .select(`
          *,
          onboarding_projects (
            owner_name,
            property_address
          )
        `)
        .neq("status", "completed")
        .order("due_date", { ascending: true });

      if (userRoleIds.length > 0) {
        allActiveQuery = allActiveQuery.or(`assigned_to_uuid.eq.${user.id},assigned_role_id.in.(${userRoleIds.join(",")})`);
      } else {
        allActiveQuery = allActiveQuery.eq("assigned_to_uuid", user.id);
      }

      const { data: allActiveData } = await allActiveQuery;
      setAllActiveTasks((allActiveData as OnboardingTask[]) || []);

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

      // Load team performance data
      await loadTeamData();
    } catch (error) {
      console.error("Error loading task stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamData = async () => {
    try {
      const { data: tasks } = await supabase
        .from("onboarding_tasks")
        .select(`
          id,
          status,
          phase_number,
          assigned_role_id,
          project_id,
          onboarding_projects!inner(property_address)
        `);

      const { data: userRoles } = await supabase
        .from("user_team_roles")
        .select(`
          user_id,
          role_id,
          profiles!inner(first_name, id),
          team_roles!inner(role_name, id)
        `);

      const { data: phaseRoles } = await supabase
        .from("phase_role_assignments")
        .select("phase_number, role_id");

      if (!tasks || !userRoles) return;

      const roleMap = new Map<string, { name: string; roleName: string; phases: Set<number>; properties: Set<string> }>();

      userRoles.forEach((ur: any) => {
        const key = `${ur.user_id}-${ur.role_id}`;
        const phases = phaseRoles?.filter(pr => pr.role_id === ur.role_id).map(pr => pr.phase_number) || [];
        
        roleMap.set(key, {
          name: ur.profiles.first_name || "Unknown",
          roleName: ur.team_roles.role_name,
          phases: new Set(phases),
          properties: new Set()
        });
      });

      const memberStats = new Map<string, { completed: number; total: number }>();

      tasks.forEach((task: any) => {
        if (!task.assigned_role_id) return;

        const matchingRoles = userRoles.filter((ur: any) => ur.role_id === task.assigned_role_id);
        const propertyAddress = task.onboarding_projects?.property_address;

        matchingRoles.forEach((ur: any) => {
          const key = `${ur.user_id}-${ur.role_id}`;
          const member = roleMap.get(key);
          if (member && propertyAddress) {
            member.properties.add(propertyAddress);
          }

          if (!memberStats.has(key)) {
            memberStats.set(key, { completed: 0, total: 0 });
          }
          const stats = memberStats.get(key)!;
          stats.total += 1 / matchingRoles.length;
          if (task.status === "completed") {
            stats.completed += 1 / matchingRoles.length;
          }
        });
      });

      const members: TeamMember[] = Array.from(roleMap.entries()).map(([key, data]) => {
        const stats = memberStats.get(key) || { completed: 0, total: 0 };
        return {
          name: data.name,
          roleName: data.roleName,
          phases: Array.from(data.phases),
          tasksCompleted: Math.round(stats.completed),
          tasksTotal: Math.round(stats.total),
          completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
          properties: Array.from(data.properties)
        };
      });

      const totalTasksCount = tasks.length;
      const completedTasksCount = tasks.filter((t: any) => t.status === "completed").length;

      setTeamMembers(members);
      setTotalTasks(totalTasksCount);
      setCompletedTasks(completedTasksCount);
    } catch (error) {
      console.error("Error loading team data:", error);
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
    <div className="space-y-6 max-md:space-y-4">
      {/* Overdue Tasks - Priority Section */}
      <OverdueTasksCard />

      {/* Task Statistics */}
      <div className="grid gap-4 max-md:gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowActiveTasksModal(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 max-md:pb-3">
            <CardTitle className="text-sm max-md:text-base font-medium">Active Tasks</CardTitle>
            <Clock className="h-4 w-4 max-md:h-5 max-md:w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl max-md:text-3xl font-bold">{stats.totalAssigned}</div>
            <p className="text-xs max-md:text-sm text-muted-foreground">
              Click to view all active tasks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 max-md:pb-3">
            <CardTitle className="text-sm max-md:text-base font-medium">Completed This Week</CardTitle>
            <CheckCircle2 className="h-4 w-4 max-md:h-5 max-md:w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl max-md:text-3xl font-bold">{stats.completedThisWeek}</div>
            <p className="text-xs max-md:text-sm text-muted-foreground">
              Tasks finished in last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 max-md:pb-3">
            <CardTitle className="text-sm max-md:text-base font-medium">Due This Week</CardTitle>
            <TrendingUp className="h-4 w-4 max-md:h-5 max-md:w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl max-md:text-3xl font-bold">{stats.upcomingTasks.length}</div>
            <p className="text-xs max-md:text-sm text-muted-foreground">
              Upcoming in next 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 max-md:text-lg">
            <Calendar className="h-5 w-5 max-md:h-6 max-md:w-6" />
            Upcoming Tasks (Next 7 Days)
          </CardTitle>
          <CardDescription className="max-md:text-sm">
            Tasks due in the coming week
          </CardDescription>
        </CardHeader>
        <CardContent className="max-md:px-3">
          {stats.upcomingTasks.length === 0 ? (
            <p className="text-sm max-md:text-base text-muted-foreground text-center py-4">
              No tasks due in the next 7 days
            </p>
          ) : (
            <div className="space-y-3 max-md:space-y-4">
              {stats.upcomingTasks.map((task: any) => {
                const daysUntil = getDaysUntilDue(task.due_date);
                return (
                  <div
                    key={task.id}
                    className="flex items-start justify-between p-3 max-md:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => {
                      // Navigate to properties page and open workflow at this specific task
                      navigate(`/properties?openWorkflow=${task.project_id}&taskId=${task.id}`);
                    }}
                  >
                     <div className="space-y-1 max-md:space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium max-md:text-lg">{task.title}</p>
                        <ExternalLink className="h-3 w-3 max-md:h-4 max-md:w-4 opacity-50" />
                      </div>
                      <p className="text-sm max-md:text-base text-muted-foreground">
                        {task.onboarding_projects?.property_address}
                      </p>
                      <div className="flex items-center gap-2 text-xs max-md:text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs max-md:text-sm">
                          {task.phase_title}
                        </Badge>
                        {task.assigned_to && (
                          <span>Assigned to: {task.assigned_to}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm max-md:text-base">
                        <Calendar className="h-3 w-3 max-md:h-4 max-md:w-4" />
                        <span>
                          Due: {task.due_date && format(new Date(task.due_date), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant={daysUntil <= 2 ? "destructive" : "secondary"}
                      className="text-xs max-md:text-sm max-md:px-3 max-md:py-1"
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
          <CardTitle className="flex items-center gap-2 max-md:text-lg">
            <CheckCircle2 className="h-5 w-5 max-md:h-6 max-md:w-6 text-green-600 dark:text-green-400" />
            Recently Completed
          </CardTitle>
          <CardDescription className="max-md:text-sm">
            Your latest accomplishments
          </CardDescription>
        </CardHeader>
        <CardContent className="max-md:px-3">
          {stats.recentlyCompleted.length === 0 ? (
            <p className="text-sm max-md:text-base text-muted-foreground text-center py-4">
              No recently completed tasks
            </p>
          ) : (
            <div className="space-y-3 max-md:space-y-4">
              {stats.recentlyCompleted.map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between p-3 max-md:p-4 rounded-lg border bg-card opacity-80"
                >
                  <div className="space-y-1 max-md:space-y-2">
                    <p className="font-medium max-md:text-lg">{task.title}</p>
                    <p className="text-sm max-md:text-base text-muted-foreground">
                      {task.onboarding_projects?.property_address}
                    </p>
                    {task.completed_date && (
                      <p className="text-xs max-md:text-sm text-muted-foreground">
                        Completed: {format(new Date(task.completed_date), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs max-md:text-sm max-md:px-3 max-md:py-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                    ✓ Done
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Performance */}
      {teamMembers.length > 0 && (
        <EnhancedTeamPerformance
          teamMembers={teamMembers}
          totalTasks={totalTasks}
          completedTasks={completedTasks}
        />
      )}

      {/* Active Tasks Modal */}
      <ActiveTasksModal
        open={showActiveTasksModal}
        onOpenChange={setShowActiveTasksModal}
        tasks={allActiveTasks}
      />
    </div>
  );
};
