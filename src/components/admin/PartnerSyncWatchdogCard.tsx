import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Activity,
  ArrowUpRight,
  ArrowDownLeft
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

interface SyncLog {
  id: string;
  sync_type: string;
  source_system: string;
  properties_synced: number;
  properties_failed: number;
  sync_status: string;
  started_at: string;
  completed_at: string | null;
  error_details: any;
}

export const PartnerSyncWatchdogCard = () => {
  const [recentSyncs, setRecentSyncs] = useState<SyncLog[]>([]);
  const [partnerPropertyCount, setPartnerPropertyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // Refresh every 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [syncLogsResult, countResult] = await Promise.all([
        supabase
          .from("partner_sync_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("partner_properties")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
      ]);

      if (syncLogsResult.error) throw syncLogsResult.error;
      setRecentSyncs(syncLogsResult.data || []);
      setPartnerPropertyCount(countResult.count || 0);
    } catch (error) {
      console.error("Error loading watchdog data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLastSuccessfulSync = () => {
    return recentSyncs.find(s => s.sync_status === "completed" && s.sync_type === "incoming");
  };

  const getSyncHealth = () => {
    const lastSync = getLastSuccessfulSync();
    if (!lastSync) return { status: "warning", message: "No syncs recorded" };

    const syncAge = Date.now() - new Date(lastSync.started_at).getTime();
    const hoursAgo = syncAge / (1000 * 60 * 60);

    if (hoursAgo > 25) {
      return { status: "error", message: `Last sync ${Math.round(hoursAgo)}h ago - overdue!` };
    }
    if (hoursAgo > 12) {
      return { status: "warning", message: `Last sync ${Math.round(hoursAgo)}h ago` };
    }
    return { status: "healthy", message: `Synced ${formatDistanceToNow(new Date(lastSync.started_at))} ago` };
  };

  const health = getSyncHealth();

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-5 bg-muted rounded w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-orange-400">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-500" />
            <CardTitle className="text-base">Partner Sync Watchdog</CardTitle>
          </div>
          <Badge 
            variant={health.status === "healthy" ? "outline" : health.status === "warning" ? "secondary" : "destructive"}
            className={`gap-1 ${
              health.status === "healthy" ? "text-green-600 border-green-300" :
              health.status === "warning" ? "text-amber-600 border-amber-300" : ""
            }`}
          >
            {health.status === "healthy" ? <CheckCircle className="w-3 h-3" /> :
             health.status === "warning" ? <Clock className="w-3 h-3" /> :
             <AlertTriangle className="w-3 h-3" />}
            {health.status === "healthy" ? "Healthy" : health.status === "warning" ? "Warning" : "Alert"}
          </Badge>
        </div>
        <CardDescription>{health.message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-primary">{partnerPropertyCount}</div>
            <div className="text-xs text-muted-foreground">Partner Properties</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-orange-500">
              {recentSyncs.filter(s => s.sync_status === "completed").length}
            </div>
            <div className="text-xs text-muted-foreground">Recent Syncs (10)</div>
          </div>
        </div>

        {recentSyncs.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Recent Activity</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {recentSyncs.slice(0, 5).map((sync) => (
                <div 
                  key={sync.id} 
                  className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded"
                >
                  <div className="flex items-center gap-2">
                    {sync.sync_type === "incoming" ? (
                      <ArrowDownLeft className="w-3 h-3 text-green-500" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3 text-blue-500" />
                    )}
                    <span className="text-muted-foreground">
                      {format(new Date(sync.started_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">+{sync.properties_synced}</span>
                    {sync.properties_failed > 0 && (
                      <span className="text-red-600">-{sync.properties_failed}</span>
                    )}
                    {sync.sync_status === "completed" ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : sync.sync_status === "failed" ? (
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                    ) : (
                      <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              loadData();
              toast.success("Watchdog data refreshed");
            }}
          >
            <RefreshCw className="w-3 h-3 mr-2" />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={async () => {
              try {
                toast.loading("Syncing properties to Comms Hub...");
                const { data, error } = await supabase.functions.invoke("sync-properties-to-comms-hub", {
                  body: { sync_all: true }
                });
                toast.dismiss();
                if (error) {
                  toast.error("Sync failed: " + error.message);
                } else {
                  toast.success(`Synced ${data.synced_count || 0} properties to Comms Hub`);
                  loadData();
                }
              } catch (e: any) {
                toast.dismiss();
                toast.error("Sync failed: " + e.message);
              }
            }}
          >
            <ArrowUpRight className="w-3 h-3 mr-2" />
            Sync to Comms Hub
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
