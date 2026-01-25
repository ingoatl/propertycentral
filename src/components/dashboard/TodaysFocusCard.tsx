import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  Sun, 
  Moon, 
  Sunrise,
  AlertCircle, 
  Clock, 
  Phone, 
  CheckCircle2,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { format, differenceInDays, isToday } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

interface TodaysFocusData {
  userName: string;
  overdueCount: number;
  dueTodayCount: number;
  scheduledCallsToday: number;
  completedThisWeek: number;
  totalThisWeek: number;
  urgentTasks: Array<{
    id: string;
    title: string;
    project_id: string;
    due_date: string | null;
    property_address?: string;
  }>;
}

export const TodaysFocusCard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<TodaysFocusData | null>(null);
  const [loading, setLoading] = useState(true);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Good morning", icon: Sunrise };
    if (hour < 17) return { text: "Good afternoon", icon: Sun };
    return { text: "Good evening", icon: Moon };
  };

  const loadFocusData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user profile for name
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("id", user.id)
        .maybeSingle();

      const userName = profile?.first_name || profile?.email?.split("@")[0] || "there";
      const today = new Date().toISOString().split('T')[0];
      
      // Check if user is admin
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      const isAdmin = !!adminRole;

      // Run queries in parallel
      const [overdueResult, dueTodayResult, callsResult, weekTasksResult] = await Promise.all([
        // Overdue tasks
        supabase
          .from("onboarding_tasks")
          .select(`
            id, title, project_id, due_date,
            onboarding_projects!inner (property_address, status)
          `)
          .eq("onboarding_projects.status", "in-progress")
          .lt("due_date", today)
          .neq("status", "completed")
          .or("field_value.is.null,field_value.eq.")
          .is("file_path", null)
          .order("due_date", { ascending: true })
          .limit(isAdmin ? 100 : 20),
        
        // Tasks due today
        supabase
          .from("onboarding_tasks")
          .select(`
            id, title, project_id, due_date,
            onboarding_projects!inner (property_address, status)
          `)
          .eq("onboarding_projects.status", "in-progress")
          .eq("due_date", today)
          .neq("status", "completed")
          .limit(50),
        
        // Scheduled calls today
        supabase
          .from("discovery_calls")
          .select("id, scheduled_at")
          .gte("scheduled_at", `${today}T00:00:00`)
          .lt("scheduled_at", `${today}T23:59:59`)
          .eq("status", "scheduled"),
        
        // Tasks completed this week (for progress)
        supabase
          .from("onboarding_tasks")
          .select("id, status, updated_at")
          .gte("updated_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      const overdueTasks = overdueResult.data || [];
      const dueTodayTasks = dueTodayResult.data || [];
      const calls = callsResult.data || [];
      const weekTasks = weekTasksResult.data || [];

      const completedThisWeek = weekTasks.filter(t => t.status === "completed").length;
      const totalThisWeek = weekTasks.length;

      // Get top 3 most urgent tasks (overdue first, then due today)
      const urgentTasks = [
        ...overdueTasks.slice(0, 2).map(t => ({
          id: t.id,
          title: t.title,
          project_id: t.project_id,
          due_date: t.due_date,
          property_address: (t.onboarding_projects as any)?.property_address
        })),
        ...dueTodayTasks.slice(0, 1).map(t => ({
          id: t.id,
          title: t.title,
          project_id: t.project_id,
          due_date: t.due_date,
          property_address: (t.onboarding_projects as any)?.property_address
        }))
      ].slice(0, 3);

      setData({
        userName,
        overdueCount: overdueTasks.length,
        dueTodayCount: dueTodayTasks.length,
        scheduledCallsToday: calls.length,
        completedThisWeek,
        totalThisWeek,
        urgentTasks
      });
    } catch (error) {
      console.error("Error loading focus data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFocusData();
  }, []);

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
        <CardContent className="p-6">
          <div className="animate-pulse flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/20" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-primary/20 rounded" />
              <div className="h-4 w-32 bg-primary/10 rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { text: greetingText, icon: GreetingIcon } = getGreeting();
  const weeklyProgress = data.totalThisWeek > 0 
    ? Math.round((data.completedThisWeek / data.totalThisWeek) * 100) 
    : 0;

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Greeting Section */}
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/20">
              <GreetingIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {greetingText}, {data.userName}!
              </h2>
              <p className="text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </p>
            </div>
          </div>

          {/* Stats Pills */}
          <div className="flex flex-wrap gap-3">
            {data.overdueCount > 0 && (
              <Badge 
                variant="destructive" 
                className="px-4 py-2 text-sm cursor-pointer hover:opacity-80"
                onClick={() => navigate("/properties")}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                {data.overdueCount} Overdue
              </Badge>
            )}
            {data.dueTodayCount > 0 && (
              <Badge 
                variant="outline" 
                className="px-4 py-2 text-sm bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400 cursor-pointer hover:opacity-80"
                onClick={() => navigate("/properties")}
              >
                <Clock className="h-4 w-4 mr-2" />
                {data.dueTodayCount} Due Today
              </Badge>
            )}
            {data.scheduledCallsToday > 0 && (
              <Badge 
                variant="outline" 
                className="px-4 py-2 text-sm bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400"
              >
                <Phone className="h-4 w-4 mr-2" />
                {data.scheduledCallsToday} Call{data.scheduledCallsToday !== 1 ? 's' : ''} Today
              </Badge>
            )}
            {data.overdueCount === 0 && data.dueTodayCount === 0 && (
              <Badge 
                variant="outline" 
                className="px-4 py-2 text-sm bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                All caught up!
              </Badge>
            )}
          </div>
        </div>

        {/* Progress & Urgent Tasks */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Weekly Progress</span>
              <span className="font-medium">{data.completedThisWeek}/{data.totalThisWeek} tasks</span>
            </div>
            <Progress value={weeklyProgress} className="h-2" />
          </div>

          {/* Urgent Tasks Preview */}
          {data.urgentTasks.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Needs Attention</span>
              <div className="flex flex-wrap gap-2">
                {data.urgentTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => navigate(`/properties?openWorkflow=${task.project_id}&taskId=${task.id}`)}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors truncate max-w-[200px]"
                    title={`${task.title} - ${task.property_address || 'View task'}`}
                  >
                    {task.title}
                  </button>
                ))}
                {data.overdueCount + data.dueTodayCount > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-auto py-1.5 px-3"
                    onClick={() => navigate("/properties")}
                  >
                    +{data.overdueCount + data.dueTodayCount - 3} more
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
