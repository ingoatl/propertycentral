import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, formatDistanceToNow } from "date-fns";

type SyncStatus = "idle" | "syncing" | "success" | "error";

export function SyncStatusIndicator() {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Load last sync time from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("ghl_last_sync");
    if (stored) {
      setLastSync(new Date(stored));
    }
  }, []);

  const handleManualSync = async () => {
    if (status === "syncing") return;
    
    setStatus("syncing");
    setErrorMessage(null);

    try {
      // Sync GHL conversations
      const { data, error } = await supabase.functions.invoke("ghl-sync-conversations", {
        body: { limit: 50 },
      });

      if (error) throw error;

      const now = new Date();
      setLastSync(now);
      localStorage.setItem("ghl_last_sync", now.toISOString());
      setStatus("success");

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
      queryClient.invalidateQueries({ queryKey: ["conversation-thread"] });

      toast.success(`Synced ${data?.synced || 0} messages`);

      // Reset to idle after 3 seconds
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      console.error("Sync failed:", err);
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Sync failed");
      
      // Only show toast for actual errors, not connection issues
      if (err instanceof Error && !err.message.includes("network")) {
        toast.error("Sync failed. Try again.");
      }

      // Reset to idle after 5 seconds
      setTimeout(() => setStatus("idle"), 5000);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "syncing":
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <RefreshCw className="h-4 w-4" />;
    }
  };

  const getTooltipContent = () => {
    if (status === "syncing") return "Syncing...";
    if (status === "error") return errorMessage || "Sync failed";
    if (lastSync) {
      return `Last synced ${formatDistanceToNow(lastSync, { addSuffix: true })}`;
    }
    return "Click to sync";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualSync}
            disabled={status === "syncing"}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            {getStatusIcon()}
            {lastSync && status === "idle" && (
              <span className="hidden sm:inline text-xs">
                {format(lastSync, "h:mm a")}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
