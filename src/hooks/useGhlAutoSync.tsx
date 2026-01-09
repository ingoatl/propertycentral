import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SYNC_STORAGE_KEY = "ghl_last_sync_time";

export function useGhlAutoSync() {
  const queryClient = useQueryClient();
  const syncInProgress = useRef(false);

  useEffect(() => {
    const shouldSync = () => {
      const lastSync = localStorage.getItem(SYNC_STORAGE_KEY);
      if (!lastSync) return true;
      return Date.now() - parseInt(lastSync) > SYNC_INTERVAL_MS;
    };

    const syncGhlData = async () => {
      if (syncInProgress.current || !shouldSync()) return;
      
      syncInProgress.current = true;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          syncInProgress.current = false;
          return;
        }

        console.log("[GHL Sync] Starting background sync...");
        
        // Sync conversations
        const { error: convError } = await supabase.functions.invoke("ghl-sync-conversations", {
          body: { limit: 30 }
        });
        
        if (convError) {
          console.error("[GHL Sync] Conversations sync error:", convError);
        }
        
        // Sync call transcripts
        const { error: callError } = await supabase.functions.invoke("ghl-fetch-call-transcripts", {
          body: { syncAll: true, limit: 30 }
        });
        
        if (callError) {
          console.error("[GHL Sync] Call transcripts sync error:", callError);
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

    // Initial sync on mount
    syncGhlData();

    // Set up interval for periodic sync
    const intervalId = setInterval(syncGhlData, SYNC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [queryClient]);
}
