import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const SYNC_STORAGE_KEY = "ghl_last_sync_time";

export function useGhlAutoSync() {
  const queryClient = useQueryClient();
  const syncInProgress = useRef(false);
  const hasRunInitialSync = useRef(false);

  useEffect(() => {
    const shouldSync = () => {
      // Always run on first mount
      if (!hasRunInitialSync.current) return true;
      
      const lastSync = localStorage.getItem(SYNC_STORAGE_KEY);
      if (!lastSync) return true;
      return Date.now() - parseInt(lastSync) > SYNC_INTERVAL_MS;
    };

    const syncGhlData = async (force = false) => {
      if (syncInProgress.current) return;
      if (!force && !shouldSync()) return;
      
      syncInProgress.current = true;
      hasRunInitialSync.current = true;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          syncInProgress.current = false;
          return;
        }

        console.log("[GHL Sync] Starting background sync...");
        
        // Sync conversations with higher limit for initial sync
        const { data: convData, error: convError } = await supabase.functions.invoke("ghl-sync-conversations", {
          body: { limit: 100 }
        });
        
        if (convError) {
          console.error("[GHL Sync] Conversations sync error:", convError);
        } else {
          console.log("[GHL Sync] Conversations result:", convData);
        }
        
        // Sync call transcripts
        const { data: callData, error: callError } = await supabase.functions.invoke("ghl-fetch-call-transcripts", {
          body: { syncAll: true }
        });
        
        if (callError) {
          console.error("[GHL Sync] Call transcripts sync error:", callError);
        } else {
          console.log("[GHL Sync] Call transcripts result:", callData);
        }
        
        // Update last sync time
        localStorage.setItem(SYNC_STORAGE_KEY, Date.now().toString());
        
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ["all-communications"] });
        queryClient.invalidateQueries({ queryKey: ["lead-communications"] });
        
        console.log("[GHL Sync] Background sync completed");
      } catch (err) {
        console.error("[GHL Sync] Error:", err);
      } finally {
        syncInProgress.current = false;
      }
    };

    // Force initial sync on mount
    syncGhlData(true);

    // Set up interval for periodic sync
    const intervalId = setInterval(() => syncGhlData(false), SYNC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [queryClient]);
}
