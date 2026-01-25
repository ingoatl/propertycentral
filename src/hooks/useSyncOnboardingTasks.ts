import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useSyncOnboardingTasks = () => {
  const [isSyncing, setIsSyncing] = useState(false);

  const syncTasks = async (projectId: string, propertyId: string) => {
    if (!projectId || !propertyId) {
      toast.error("Missing project or property information");
      return { success: false, synced: 0 };
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-onboarding-tasks", {
        body: { projectId, propertyId },
      });

      if (error) throw error;

      const syncedCount = data?.syncedCount || 0;
      if (syncedCount > 0) {
        toast.success(`Synced ${syncedCount} task${syncedCount > 1 ? "s" : ""} from existing data`);
      } else {
        toast.info("No additional data found to sync");
      }

      return { success: true, synced: syncedCount };
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error(error.message || "Failed to sync tasks");
      return { success: false, synced: 0 };
    } finally {
      setIsSyncing(false);
    }
  };

  return { syncTasks, isSyncing };
};
