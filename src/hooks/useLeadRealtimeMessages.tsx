import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useLeadRealtimeMessages() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to lead_communications realtime updates
    const channel = supabase
      .channel("lead-communications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lead_communications",
        },
        async (payload) => {
          console.log("New lead communication received:", payload);
          
          const newComm = payload.new as {
            id: string;
            lead_id: string;
            direction: string;
            communication_type: string;
            body: string;
            is_read?: boolean;
          };

          // Only show toast for inbound messages
          if (newComm.direction === "inbound") {
            // Fetch lead name for the toast
            const { data: lead } = await supabase
              .from("leads")
              .select("name")
              .eq("id", newComm.lead_id)
              .single();

            const leadName = lead?.name || "Lead";
            const preview = newComm.body?.slice(0, 50) + (newComm.body?.length > 50 ? "..." : "");

            toast.info(`New ${newComm.communication_type.toUpperCase()} from ${leadName}`, {
              description: preview,
              duration: 8000,
              action: {
                label: "View",
                onClick: () => {
                  // Could navigate to lead or open modal
                  queryClient.invalidateQueries({ queryKey: ["leads"] });
                },
              },
            });
          }

          // Invalidate relevant queries
          queryClient.invalidateQueries({ queryKey: ["lead-communications"] });
          queryClient.invalidateQueries({ queryKey: ["all-communications"] });
          queryClient.invalidateQueries({ queryKey: ["leads"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
