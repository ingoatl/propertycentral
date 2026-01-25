import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Home, TrendingUp, ArrowRight, Phone, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfWeek, endOfWeek, isToday } from "date-fns";

interface AdminFocusData {
  callsToday: number;
  callsThisWeek: number;
  propertiesOnboarding: number;
  activeProperties: number;
  pendingApprovals: number;
  teamPerformance: number;
}

export const AdminFocusPanel = () => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-focus"],
    queryFn: async (): Promise<AdminFocusData> => {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

      // Get discovery calls for today and this week
      const { data: calls } = await supabase
        .from("discovery_calls")
        .select("id, scheduled_at, status")
        .gte("scheduled_at", weekStart.toISOString())
        .lte("scheduled_at", weekEnd.toISOString())
        .eq("status", "scheduled");

      const callsToday = (calls || []).filter(c => isToday(new Date(c.scheduled_at))).length;
      const callsThisWeek = (calls || []).length;

      // Get properties in onboarding
      const { count: propertiesOnboarding } = await supabase
        .from("onboarding_projects")
        .select("id", { count: "exact" })
        .eq("status", "in-progress");

      // Get active properties
      const { count: activeProperties } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true });

      // Get pending profile approvals
      const { count: pendingApprovals } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending" as any);

      // Calculate team performance (completed tasks this week / total tasks)
      const { data: tasks } = await supabase
        .from("onboarding_tasks")
        .select("id, status, updated_at")
        .gte("updated_at", weekStart.toISOString());

      const completedTasks = (tasks || []).filter(t => t.status === "completed").length;
      const totalTasks = (tasks || []).length;
      const teamPerformance = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        callsToday,
        callsThisWeek,
        propertiesOnboarding: propertiesOnboarding || 0,
        activeProperties: activeProperties || 0,
        pendingApprovals: pendingApprovals || 0,
        teamPerformance,
      };
    },
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/50 via-background to-background dark:from-indigo-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
          <LayoutDashboard className="h-5 w-5" />
          Leadership Overview
          {data.callsToday > 0 && (
            <Badge className="ml-auto bg-indigo-600">
              <Phone className="h-3 w-3 mr-1" />
              {data.callsToday} calls today
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-indigo-100/50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-indigo-600" />
              <span className="text-xs text-muted-foreground">This Week</span>
            </div>
            <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{data.callsThisWeek} calls</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-100/50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Onboarding</span>
            </div>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{data.propertiesOnboarding}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-100/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{data.activeProperties}</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-100/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Team</span>
            </div>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{data.teamPerformance}%</p>
          </div>
        </div>

        {/* Pending Approvals */}
        {data.pendingApprovals > 0 && (
          <div className="p-3 rounded-lg bg-orange-100/50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                  {data.pendingApprovals} user{data.pendingApprovals !== 1 ? 's' : ''} pending approval
                </span>
              </div>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => navigate("/team")}
              >
                Review
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* All Clear State */}
        {data.callsToday === 0 && data.pendingApprovals === 0 && (
          <div className="text-center py-2 text-muted-foreground">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-green-500" />
            <p className="text-sm">No immediate actions needed</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button 
            className="flex-1" 
            variant="outline"
            size="sm"
            onClick={() => navigate("/leads")}
          >
            View Leads
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button 
            className="flex-1" 
            variant="outline"
            size="sm"
            onClick={() => navigate("/properties")}
          >
            Properties
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
