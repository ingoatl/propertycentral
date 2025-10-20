import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Calendar, AlertCircle, TrendingUp, Users, BarChart3 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
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

interface Stats {
  totalReschedules: number;
  avgDelay: number;
  mostRescheduledTasks: Array<{ task_title: string; count: number }>;
  topReschedulers: Array<{ name: string; count: number }>;
}

export const RescheduleLogsTab = () => {
  const [logs, setLogs] = useState<RescheduleLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<RescheduleLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalReschedules: 0,
    avgDelay: 0,
    mostRescheduledTasks: [],
    topReschedulers: [],
  });

  const [filters, setFilters] = useState({
    search: "",
    severity: "all",
    dateRange: "all",
  });

  useEffect(() => {
    loadRescheduleLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, filters]);

  const loadRescheduleLogs = async () => {
    try {
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
        .order("rescheduled_at", { ascending: false });

      if (error) throw error;

      const formattedLogs = data?.map((log: any) => ({
        ...log,
        task_title: log.onboarding_tasks?.title,
        property_address: log.onboarding_tasks?.onboarding_projects?.property_address,
        owner_name: log.onboarding_tasks?.onboarding_projects?.owner_name,
      })) || [];

      setLogs(formattedLogs);
      calculateStats(formattedLogs);
    } catch (error) {
      console.error("Error loading reschedule logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: RescheduleLog[]) => {
    const thisMonth = data.filter(log => {
      const logDate = new Date(log.rescheduled_at);
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());
      return logDate >= monthStart && logDate <= monthEnd;
    });

    const avgDelay = thisMonth.length > 0
      ? Math.round(thisMonth.reduce((sum, log) => sum + log.days_delayed, 0) / thisMonth.length)
      : 0;

    // Most rescheduled tasks
    const taskCounts = data.reduce((acc, log) => {
      const key = log.task_title || "Unknown Task";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostRescheduledTasks = Object.entries(taskCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([task_title, count]) => ({ task_title, count }));

    // Top reschedulers
    const userCounts = data.reduce((acc, log) => {
      acc[log.rescheduled_by_name] = (acc[log.rescheduled_by_name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topReschedulers = Object.entries(userCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    setStats({
      totalReschedules: thisMonth.length,
      avgDelay,
      mostRescheduledTasks,
      topReschedulers,
    });
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.task_title?.toLowerCase().includes(search) ||
          log.property_address?.toLowerCase().includes(search) ||
          log.owner_name?.toLowerCase().includes(search) ||
          log.rescheduled_by_name.toLowerCase().includes(search)
      );
    }

    // Severity filter
    if (filters.severity !== "all") {
      filtered = filtered.filter((log) => {
        if (filters.severity === "low") return log.days_delayed <= 3;
        if (filters.severity === "medium") return log.days_delayed > 3 && log.days_delayed <= 7;
        if (filters.severity === "high") return log.days_delayed > 7;
        return true;
      });
    }

    // Date range filter
    if (filters.dateRange !== "all") {
      const now = new Date();
      filtered = filtered.filter((log) => {
        const logDate = new Date(log.rescheduled_at);
        if (filters.dateRange === "week") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return logDate >= weekAgo;
        }
        if (filters.dateRange === "month") {
          return logDate >= startOfMonth(now) && logDate <= endOfMonth(now);
        }
        return true;
      });
    }

    setFilteredLogs(filtered);
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
    return <div className="p-8 text-center">Loading reschedule logs...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReschedules}</div>
            <p className="text-xs text-muted-foreground">Total reschedules</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. Delay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgDelay} days</div>
            <p className="text-xs text-muted-foreground">Average delay duration</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Top Task
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium truncate">
              {stats.mostRescheduledTasks[0]?.task_title || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.mostRescheduledTasks[0]?.count || 0} reschedules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Top User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium truncate">
              {stats.topReschedulers[0]?.name || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.topReschedulers[0]?.count || 0} reschedules
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Task, property, user..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <Select
                value={filters.severity}
                onValueChange={(value) => setFilters({ ...filters, severity: value })}
              >
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="low">Low (1-3 days)</SelectItem>
                  <SelectItem value="medium">Medium (4-7 days)</SelectItem>
                  <SelectItem value="high">High (8+ days)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateRange">Date Range</Label>
              <Select
                value={filters.dateRange}
                onValueChange={(value) => setFilters({ ...filters, dateRange: value })}
              >
                <SelectTrigger id="dateRange">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Reschedule History</CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {logs.length} total reschedules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No reschedule logs found matching your filters.
              </p>
            ) : (
              filteredLogs.map((log) => (
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
                        "flex items-center gap-1 shrink-0",
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
                      {format(new Date(log.previous_due_date), "MMM d")} →{" "}
                      {format(new Date(log.new_due_date), "MMM d, yyyy")}
                    </span>
                  </div>

                  <div className="text-xs bg-muted/50 p-2 rounded">
                    <span className="font-medium">Reason:</span> {log.reason}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>By: {log.rescheduled_by_name}</span>
                    <span>{format(new Date(log.rescheduled_at), "PPp")}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
