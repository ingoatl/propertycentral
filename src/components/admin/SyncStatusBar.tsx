import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface SyncSource {
  id: string;
  name: string;
  shortName: string;
  projectSource: string;
  status: "healthy" | "warning" | "error" | "unknown";
  lastSync: Date | null;
  successRate: number;
  totalSyncs: number;
}

export const SyncStatusBar = () => {
  const [sources, setSources] = useState<SyncSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSyncStatus();
    const interval = setInterval(loadSyncStatus, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadSyncStatus = async () => {
    try {
      // Load partner sync logs
      const { data: syncLogs, error } = await supabase
        .from("partner_sync_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Also check if PeachHaus has data even if no sync logs (direct table check)
      const { data: peachhausStats } = await supabase
        .from("property_peachhaus_stats")
        .select("synced_at")
        .order("synced_at", { ascending: false })
        .limit(1);

      // Projects and their data types:
      // 1. PeachHaus Listing Boost = SEO, Pricing, Performance data
      // 2. GuestConnect = Marketing activities from automation
      // 3. Marketing Hub = Aggregate social & outreach stats
      // 4. Mid-Term Nation = MTR property listings
      const sourceConfigs = [
        { id: "peachhaus", name: "Listing Boost", shortName: "Listing Boost", projectSource: "peachhaus-listing-boost", syncTypes: ["property_performance", "listing_health", "peachhaus"] },
        { id: "guestconnect", name: "GuestConnect", shortName: "GuestConnect", projectSource: "peachhaus-guestconnect", syncTypes: ["incoming", "marketing_activities"] },
        { id: "marketing_hub", name: "Marketing Hub", shortName: "Mkt Hub", projectSource: "marketing-hub", syncTypes: ["marketing_stats"] },
        { id: "midtermnation", name: "Mid-Term Nation", shortName: "MTNation", projectSource: "midtermnation", syncTypes: ["incoming", "midterm"] },
      ];

      const sourcesData: SyncSource[] = sourceConfigs.map(config => {
        // Special handling for PeachHaus - check both logs AND direct data
        if (config.id === "peachhaus") {
          const hasData = peachhausStats && peachhausStats.length > 0;
          const lastSyncTime = hasData ? new Date(peachhausStats[0].synced_at) : null;
          const isRecent = lastSyncTime && (Date.now() - lastSyncTime.getTime()) < 24 * 60 * 60 * 1000;
          
          return {
            id: config.id,
            name: config.name,
            shortName: config.shortName,
            projectSource: config.projectSource,
            status: hasData && isRecent ? "healthy" : hasData ? "warning" : "unknown" as SyncSource["status"],
            lastSync: lastSyncTime,
            successRate: hasData ? 100 : 0,
            totalSyncs: hasData ? 1 : 0,
          };
        }

        const relevantLogs = (syncLogs || []).filter(log => 
          config.syncTypes.some(type => 
            log.sync_type?.toLowerCase().includes(type.toLowerCase()) ||
            log.source_system?.toLowerCase().includes(config.id.toLowerCase())
          )
        );

        const successfulLogs = relevantLogs.filter(l => l.sync_status === "completed");
        const lastLog = relevantLogs[0];
        const last24h = relevantLogs.filter(l => 
          new Date(l.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
        );

        let status: SyncSource["status"] = "unknown";
        const successRate = relevantLogs.length > 0 
          ? (successfulLogs.length / relevantLogs.length) * 100 
          : 0;

        if (relevantLogs.length === 0) {
          status = "unknown";
        } else if (successRate >= 80 && last24h.length > 0) {
          status = "healthy";
        } else if (successRate >= 50 || last24h.length > 0) {
          status = "warning";
        } else {
          status = "error";
        }

        return {
          id: config.id,
          name: config.name,
          shortName: config.shortName,
          projectSource: config.projectSource,
          status,
          lastSync: lastLog ? new Date(lastLog.created_at) : null,
          successRate,
          totalSyncs: relevantLogs.length,
        };
      });

      setSources(sourcesData);
    } catch (error) {
      console.error("Error loading sync status:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: SyncSource["status"]) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-3 w-3 text-amber-500" />;
      case "error":
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: SyncSource["status"]) => {
    switch (status) {
      case "healthy":
        return "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400";
      case "warning":
        return "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400";
      case "error":
        return "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400";
      default:
        return "border-muted bg-muted/50 text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg animate-pulse">
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading sync status...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-gradient-to-r from-muted/30 to-muted/10 rounded-lg border border-border/50">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mr-2">
        Integrations:
      </span>
      
      {sources.map((source) => (
        <div
          key={source.id}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border ${getStatusColor(source.status)} transition-colors`}
          title={`${source.name} (${source.projectSource})\nSuccess Rate: ${source.successRate.toFixed(0)}%\nTotal Syncs: ${source.totalSyncs}`}
        >
          {getStatusIcon(source.status)}
          <span className="text-xs font-medium">{source.shortName}</span>
          <span className="text-[10px] opacity-70">
            {source.lastSync 
              ? formatDistanceToNow(source.lastSync, { addSuffix: false }).replace(" ago", "")
              : "Never"}
          </span>
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 ml-auto"
        onClick={() => {
          loadSyncStatus();
          toast.success("Sync status refreshed");
        }}
      >
        <RefreshCw className="h-3 w-3" />
      </Button>
    </div>
  );
};
