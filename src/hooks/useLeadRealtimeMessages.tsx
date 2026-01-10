import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useLeadRealtimeMessages() {
  const queryClient = useQueryClient();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced query invalidation to prevent rapid re-fetches
  const debouncedInvalidate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["lead-communications"] });
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
      queryClient.invalidateQueries({ queryKey: ["conversation-thread"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    }, 150); // Reduced debounce for faster updates
  }, [queryClient]);

  useEffect(() => {
    // Subscribe to lead_communications realtime updates - both INSERT and UPDATE
    const channel = supabase
      .channel("lead-communications-realtime")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "lead_communications",
        },
        async (payload) => {
          console.log("Lead communication change received:", payload.eventType, payload);
          
          // Handle INSERT events
          if (payload.eventType === "INSERT") {
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
                    queryClient.invalidateQueries({ queryKey: ["leads"] });
                  },
                },
              });
            }
          }

          // Debounced invalidation for all events
          debouncedInvalidate();
        }
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [queryClient, debouncedInvalidate]);
}
