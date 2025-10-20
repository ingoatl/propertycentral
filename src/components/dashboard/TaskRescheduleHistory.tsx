import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface RescheduleLog {
  id: string;
  task_id: string;
  project_id: string;
  previous_due_date: string;
  new_due_date: string;
  reason: string;
  rescheduled_by_name: string;
  rescheduled_at: string;
  days_delayed: number;
  task_title?: string;
  property_address?: string;
  owner_name?: string;
}

export const TaskRescheduleHistory = () => {
  const [logs, setLogs] = useState<RescheduleLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRescheduleLogs();
  }, []);

  const loadRescheduleLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("task_reschedule_logs")
        .select(`
          *,
          onboarding_tasks!inner(
            title,
            onboarding_projects!inner(
              property_address,
              owner_name
            )
          )
        `)
        .eq("rescheduled_by", user.id)
        .order("rescheduled_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const formattedLogs = data?.map((log: any) => ({
        ...log,
        task_title: log.onboarding_tasks?.title,
        property_address: log.onboarding_tasks?.onboarding_projects?.property_address,
        owner_name: log.onboarding_tasks?.onboarding_projects?.owner_name,
      })) || [];

      setLogs(formattedLogs);
    } catch (error) {
      console.error("Error loading reschedule logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (days: number) => {
    if (days <= 3) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (days <= 7) return "bg-orange-100 text-orange-800 border-orange-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  const getSeverityIcon = (days: number) => {
    if (days <= 3) return <Clock className="w-3 h-3" />;
    if (days <= 7) return <Calendar className="w-3 h-3" />;
    return <AlertCircle className="w-3 h-3" />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            My Reschedule History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            My Reschedule History
          </CardTitle>
          <CardDescription>Your task reschedule activity</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No reschedule history yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          My Reschedule History
        </CardTitle>
        <CardDescription>
          Recent tasks you've rescheduled ({logs.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-4 border rounded-lg space-y-2 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="font-medium text-sm">{log.task_title}</div>
                  <div className="text-xs text-muted-foreground">
                    {log.property_address} • {log.owner_name}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "flex items-center gap-1",
                    getSeverityColor(log.days_delayed)
                  )}
                >
                  {getSeverityIcon(log.days_delayed)}
                  +{log.days_delayed}d
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>
                  {format(new Date(log.previous_due_date), "MMM d")} → {format(new Date(log.new_due_date), "MMM d, yyyy")}
                </span>
              </div>

              <div className="text-xs bg-muted/50 p-2 rounded">
                <span className="font-medium">Reason:</span> {log.reason}
              </div>

              <div className="text-xs text-muted-foreground">
                {format(new Date(log.rescheduled_at), "PPp")}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
