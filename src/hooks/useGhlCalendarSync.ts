import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";

export interface GhlAppointment {
  ghl_event_id: string;
  ghl_calendar_id: string;
  calendar_name: string;
  title: string;
  status: string;
  scheduled_at: string;
  end_time: string;
  assigned_user_id: string | null;
  notes: string | null;
  location: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  contact_city: string | null;
  contact_state: string | null;
  contact_source: string | null;
  contact_tags: string[];
  lead_id: string | null;
  lead_name: string | null;
  lead_email: string | null;
  lead_phone: string | null;
  lead_property_address: string | null;
  lead_property_type: string | null;
  lead_stage: string | null;
  lead_source: string | null;
  lead_notes: string | null;
}

const GHL_CALENDAR_SYNC_INTERVAL = 2 * 60 * 1000; // 2 minutes
const GHL_CALENDAR_SYNC_KEY = "ghl_calendar_last_sync";

export function useGhlCalendarSync(month?: Date) {
  const queryClient = useQueryClient();
  const syncInProgress = useRef(false);

  // Calculate time range for current month or specified month
  const getTimeRange = () => {
    const targetMonth = month || new Date();
    const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59);
    return {
      startTime: startOfMonth.getTime(),
      endTime: endOfMonth.getTime(),
    };
  };

  const { data: appointments = [], isLoading, error, refetch } = useQuery({
    queryKey: ["ghl-calendar-appointments", month ? month.toISOString().slice(0, 7) : "current"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        return [];
      }

      const { startTime, endTime } = getTimeRange();
      
      console.log("[GHL Calendar] Fetching appointments...");
      
      const { data, error } = await supabase.functions.invoke("ghl-sync-calendar", {
        body: { startTime, endTime },
      });

      if (error) {
        console.error("[GHL Calendar] Error:", error);
        throw error;
      }

      console.log(`[GHL Calendar] Fetched ${data?.appointments?.length || 0} appointments`);
      
      // Update last sync time
      localStorage.setItem(GHL_CALENDAR_SYNC_KEY, Date.now().toString());
      
      return (data?.appointments || []) as GhlAppointment[];
    },
    staleTime: GHL_CALENDAR_SYNC_INTERVAL,
    refetchInterval: GHL_CALENDAR_SYNC_INTERVAL,
    retry: 1,
  });

  // Auto-sync on mount if stale
  useEffect(() => {
    const lastSync = localStorage.getItem(GHL_CALENDAR_SYNC_KEY);
    const isStale = !lastSync || Date.now() - parseInt(lastSync) > GHL_CALENDAR_SYNC_INTERVAL;
    
    if (isStale && !syncInProgress.current) {
      syncInProgress.current = true;
      refetch().finally(() => {
        syncInProgress.current = false;
      });
    }
  }, [refetch]);

  return {
    appointments,
    isLoading,
    error,
    refetch,
  };
}

// Hook to add GHL calendar sync to the main auto-sync
export function useGhlCalendarAutoSync() {
  const queryClient = useQueryClient();
  const syncInProgress = useRef(false);

  useEffect(() => {
    const syncCalendar = async () => {
      if (syncInProgress.current) return;
      
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      syncInProgress.current = true;
      
      try {
        console.log("[GHL Auto Sync] Syncing calendar...");
        
        // Sync current month and next month
        const now = new Date();
        const startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const endTime = new Date(now.getFullYear(), now.getMonth() + 2, 0).getTime();
        
        await supabase.functions.invoke("ghl-sync-calendar", {
          body: { startTime, endTime },
        });
        
        // Invalidate calendar queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ["ghl-calendar-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["discovery-calls-calendar"] });
        
        console.log("[GHL Auto Sync] Calendar sync completed");
      } catch (err) {
        console.error("[GHL Auto Sync] Calendar sync error:", err);
      } finally {
        syncInProgress.current = false;
      }
    };

    // Initial sync
    syncCalendar();

    // Set up interval
    const intervalId = setInterval(syncCalendar, GHL_CALENDAR_SYNC_INTERVAL);

    return () => clearInterval(intervalId);
  }, [queryClient]);
}
