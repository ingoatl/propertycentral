import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Activity,
  Cloud,
  ArrowDownLeft,
  ArrowUpRight,
  Wrench,
  Clock,
  Zap,
  TrendingUp,
  Shield,
} from "lucide-react";

interface SyncSource {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  lastSync: string | null;
  status: "healthy" | "warning" | "error" | "unknown";
  successRate: number;
  totalSyncs: number;
  failedSyncs: number;
  lastError?: string;
}

interface WatchdogLog {
  id: string;
  check_type: string;
  status: string;
  run_at: string;
  issues_found: string[] | null;
  details: any;
}

interface HealingAction {
  timestamp: string;
  action: string;
  type: string;
  status: "completed" | "pending" | "failed";
}

export function IntegrationStatusDashboard() {
  const [syncSources, setSyncSources] = useState<SyncSource[]>([]);
  const [watchdogLogs, setWatchdogLogs] = useState<WatchdogLog[]>([]);
  const [healingActions, setHealingActions] = useState<HealingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningWatchdog, setRunningWatchdog] = useState(false);
  const [overallHealth, setOverallHealth] = useState<"healthy" | "warning" | "error">("healthy");

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load partner sync logs grouped by source
      const { data: syncLogs } = await supabase
        .from("partner_sync_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      // Load recent watchdog logs
      const { data: watchdogs } = await supabase
        .from("watchdog_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      // Process sync sources
      const sourceMap = new Map<string, { total: number; failed: number; lastSync: string; lastError?: string }>();

      for (const log of syncLogs || []) {
        const source = log.source_system || "unknown";
        const existing = sourceMap.get(source) || { total: 0, failed: 0, lastSync: "", lastError: undefined };
        existing.total++;
        if (log.sync_status === "failed" || log.sync_status === "partial") {
          existing.failed++;
          if (!existing.lastError && log.error_details) {
            existing.lastError = typeof log.error_details === "string" 
              ? log.error_details 
              : JSON.stringify(log.error_details).slice(0, 100);
          }
        }
        if (!existing.lastSync || log.created_at > existing.lastSync) {
          existing.lastSync = log.created_at;
        }
        sourceMap.set(source, existing);
      }

      // Build sync sources list with predefined integrations
      const sources: SyncSource[] = [
        {
          id: "peachhaus",
          name: "PeachHaus",
          description: "peachhaus-guestconnect",
          icon: <TrendingUp className="h-4 w-4" />,
          lastSync: sourceMap.get("peachhaus")?.lastSync || null,
          status: getSourceStatus(sourceMap.get("peachhaus")),
          successRate: getSuccessRate(sourceMap.get("peachhaus")),
          totalSyncs: sourceMap.get("peachhaus")?.total || 0,
          failedSyncs: sourceMap.get("peachhaus")?.failed || 0,
          lastError: sourceMap.get("peachhaus")?.lastError,
        },
        {
          id: "guestconnect",
          name: "GuestConnect",
          description: "peachhaus-guestconnect",
          icon: <Cloud className="h-4 w-4" />,
          lastSync: sourceMap.get("guestconnect")?.lastSync || null,
          status: getSourceStatus(sourceMap.get("guestconnect")),
          successRate: getSuccessRate(sourceMap.get("guestconnect")),
          totalSyncs: sourceMap.get("guestconnect")?.total || 0,
          failedSyncs: sourceMap.get("guestconnect")?.failed || 0,
          lastError: sourceMap.get("guestconnect")?.lastError,
        },
        {
          id: "marketing_hub",
          name: "Marketing Hub",
          description: "peachhaus-guestconnect",
          icon: <Zap className="h-4 w-4" />,
          lastSync: sourceMap.get("marketing_hub")?.lastSync || null,
          status: getSourceStatus(sourceMap.get("marketing_hub")),
          successRate: getSuccessRate(sourceMap.get("marketing_hub")),
          totalSyncs: sourceMap.get("marketing_hub")?.total || 0,
          failedSyncs: sourceMap.get("marketing_hub")?.failed || 0,
          lastError: sourceMap.get("marketing_hub")?.lastError,
        },
        {
          id: "midtermnation",
          name: "Mid-Term Nation",
          description: "midtermnation",
          icon: <Shield className="h-4 w-4" />,
          lastSync: sourceMap.get("midtermnation")?.lastSync || null,
          status: getSourceStatus(sourceMap.get("midtermnation")),
          successRate: getSuccessRate(sourceMap.get("midtermnation")),
          totalSyncs: sourceMap.get("midtermnation")?.total || 0,
          failedSyncs: sourceMap.get("midtermnation")?.failed || 0,
          lastError: sourceMap.get("midtermnation")?.lastError,
        },
      ];

      setSyncSources(sources);
      setWatchdogLogs(watchdogs || []);

      // Extract healing actions from watchdog logs
      const actions: HealingAction[] = [];
      for (const log of watchdogs || []) {
        const details = log.details as any;
        if (details?.healingActions) {
          for (const action of details.healingActions) {
            actions.push({
              timestamp: log.run_at,
              action: action,
              type: log.check_type,
              status: "completed",
            });
          }
        }
        // Also check details.details.healingActions (nested structure)
        if (details?.details?.healingActions) {
          for (const action of details.details.healingActions) {
            actions.push({
              timestamp: log.run_at,
              action: action,
              type: log.check_type,
              status: "completed",
            });
          }
        }
      }
      setHealingActions(actions.slice(0, 10));

      // Determine overall health
      const hasErrors = sources.some(s => s.status === "error");
      const hasWarnings = sources.some(s => s.status === "warning");
      const watchdogErrors = watchdogs?.some(w => w.status === "error");
      
      if (hasErrors || watchdogErrors) {
        setOverallHealth("error");
      } else if (hasWarnings) {
        setOverallHealth("warning");
      } else {
        setOverallHealth("healthy");
      }

    } catch (error) {
      console.error("Error loading integration data:", error);
      toast.error("Failed to load integration status");
    } finally {
      setLoading(false);
    }
  };

  const getSourceStatus = (source?: { total: number; failed: number; lastSync: string }): "healthy" | "warning" | "error" | "unknown" => {
    if (!source || source.total === 0) return "unknown";
    const failRate = source.failed / source.total;
    const lastSyncAge = source.lastSync ? Date.now() - new Date(source.lastSync).getTime() : Infinity;
    const hoursSinceSync = lastSyncAge / (1000 * 60 * 60);
    
    if (hoursSinceSync > 48 || failRate > 0.5) return "error";
    if (hoursSinceSync > 24 || failRate > 0.2) return "warning";
    return "healthy";
  };

  const getSuccessRate = (source?: { total: number; failed: number }): number => {
    if (!source || source.total === 0) return 0;
    return Math.round(((source.total - source.failed) / source.total) * 100);
  };

  const runSelfHealingWatchdog = async () => {
    setRunningWatchdog(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-healing-watchdog`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Watchdog failed");
      }

      const actionsCount = result.healingActions?.length || 0;
      const issuesCount = result.issues?.length || 0;

      if (actionsCount > 0) {
        toast.success(`Watchdog healed ${actionsCount} issue(s)`);
      } else if (issuesCount > 0) {
        toast.warning(`Watchdog found ${issuesCount} issue(s) that need attention`);
      } else {
        toast.success("All integrations healthy - no healing needed");
      }

      loadData();
    } catch (error: unknown) {
      console.error("Watchdog error:", error);
      toast.error(error instanceof Error ? error.message : "Watchdog failed");
    } finally {
      setRunningWatchdog(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      healthy: "bg-green-50 text-green-700 border-green-200",
      warning: "bg-amber-50 text-amber-700 border-amber-200",
      error: "bg-red-50 text-red-700 border-red-200",
      unknown: "bg-gray-50 text-gray-500 border-gray-200",
    };
    
    return (
      <Badge variant="outline" className={variants[status] || variants.unknown}>
        {getStatusIcon(status)}
        <span className="ml-1 capitalize">{status}</span>
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Health Header */}
      <Card className={`border-l-4 ${
        overallHealth === "healthy" ? "border-l-green-500" :
        overallHealth === "warning" ? "border-l-amber-500" : "border-l-red-500"
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                overallHealth === "healthy" ? "bg-green-100" :
                overallHealth === "warning" ? "bg-amber-100" : "bg-red-100"
              }`}>
                <Activity className={`h-6 w-6 ${
                  overallHealth === "healthy" ? "text-green-600" :
                  overallHealth === "warning" ? "text-amber-600" : "text-red-600"
                }`} />
              </div>
              <div>
                <CardTitle className="text-xl">Integration Health Monitor</CardTitle>
                <CardDescription>
                  Real-time status of all data sync sources with self-healing watchdog
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(overallHealth)}
              <Button 
                onClick={runSelfHealingWatchdog} 
                disabled={runningWatchdog}
                className="gap-2"
              >
                {runningWatchdog ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Wrench className="h-4 w-4" />
                )}
                Run Watchdog
              </Button>
              <Button variant="outline" onClick={loadData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sync Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {syncSources.map((source) => (
          <Card key={source.id} className={`${
            source.status === "error" ? "border-red-200" :
            source.status === "warning" ? "border-amber-200" : ""
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    source.status === "healthy" ? "bg-green-100 text-green-600" :
                    source.status === "warning" ? "bg-amber-100 text-amber-600" :
                    source.status === "error" ? "bg-red-100 text-red-600" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {source.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{source.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded w-fit">
                      {source.description}
                    </p>
                  </div>
                </div>
                {getStatusIcon(source.status)}
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Success Rate</span>
                    <span className={`font-medium ${
                      source.successRate >= 90 ? "text-green-600" :
                      source.successRate >= 70 ? "text-amber-600" : "text-red-600"
                    }`}>
                      {source.successRate}%
                    </span>
                  </div>
                  <Progress 
                    value={source.successRate} 
                    className={`h-1.5 ${
                      source.successRate >= 90 ? "[&>div]:bg-green-500" :
                      source.successRate >= 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"
                    }`}
                  />
                </div>
                
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Syncs</span>
                  <span className="font-medium">{source.totalSyncs}</span>
                </div>
                
                {source.failedSyncs > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-red-500">Failed</span>
                    <span className="font-medium text-red-600">{source.failedSyncs}</span>
                  </div>
                )}
                
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {source.lastSync ? (
                      <span>Last sync {formatDistanceToNow(new Date(source.lastSync))} ago</span>
                    ) : (
                      <span>No syncs recorded</span>
                    )}
                  </div>
                </div>

                {source.lastError && (
                  <div className="text-xs text-red-500 truncate" title={source.lastError}>
                    Error: {source.lastError}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Watchdog Logs & Healing Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Watchdog Runs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Watchdog Activity
            </CardTitle>
            <CardDescription>Recent automated health checks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {watchdogLogs.slice(0, 8).map((log) => (
                <div 
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {log.check_type.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.run_at))} ago
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {log.issues_found && log.issues_found.length > 0 ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 text-xs">
                        {log.issues_found.length} issue(s)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                        All clear
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {watchdogLogs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No watchdog runs recorded
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Self-Healing Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Self-Healing Actions
            </CardTitle>
            <CardDescription>Automatic fixes performed by watchdog</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {healingActions.map((action, idx) => (
                <div 
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-green-50/50 border border-green-100 rounded-lg"
                >
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{action.action}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {action.type.replace(/_/g, " ")} • {formatDistanceToNow(new Date(action.timestamp))} ago
                    </p>
                  </div>
                </div>
              ))}
              {healingActions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No healing actions recorded recently
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sync Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Sync Activity</CardTitle>
          <CardDescription>Detailed log of incoming data syncs</CardDescription>
        </CardHeader>
        <CardContent>
          <SyncActivityTable />
        </CardContent>
      </Card>
    </div>
  );
}

function SyncActivityTable() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const { data } = await supabase
      .from("partner_sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15);
    
    setLogs(data || []);
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Loading...</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Properties</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                {log.sync_type === "incoming" ? (
                  <ArrowDownLeft className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowUpRight className="h-3 w-3 text-blue-500" />
                )}
                <span className="font-medium capitalize">{log.source_system}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {log.sync_type}
            </TableCell>
            <TableCell>
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  log.sync_status === "completed" ? "bg-green-50 text-green-700" :
                  log.sync_status === "partial" ? "bg-amber-50 text-amber-700" :
                  log.sync_status === "failed" ? "bg-red-50 text-red-700" :
                  "bg-gray-50 text-gray-600"
                }`}
              >
                {log.sync_status}
              </Badge>
            </TableCell>
            <TableCell>
              <span className="text-green-600">+{log.properties_synced || 0}</span>
              {log.properties_failed > 0 && (
                <span className="text-red-600 ml-2">-{log.properties_failed}</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {format(new Date(log.created_at), "MMM d, h:mm a")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
