import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/ProtectedRoute";

export interface PendingAction {
  id: string;
  owner_id: string | null;
  lead_id: string | null;
  property_id: string | null;
  communication_id: string | null;
  action_type: string; // 'callback', 'task', 'alert', 'escalation', 'payment_reminder'
  title: string;
  description: string | null;
  urgency: string; // 'critical', 'high', 'normal', 'low'
  suggested_response: string | null;
  channel: string | null; // 'call', 'sms', 'email'
  detected_intent: string | null;
  sentiment_score: number | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  dismissed_reason: string | null;
  created_at: string;
  updated_at: string;
  owner?: {
    name: string;
    email: string | null;
  };
  lead?: {
    name: string;
    email: string | null;
  };
  property?: {
    name: string;
    address: string;
  };
}

export function usePendingActions() {
  const { user } = useAuth() as any;
  const queryClient = useQueryClient();
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);

  const isEligibleUser = !!user?.id;

  // Fetch pending actions
  const { data: pendingActions = [], isLoading, refetch } = useQuery({
    queryKey: ["pending-actions"],
    queryFn: async () => {
      if (!isEligibleUser) return [];

      const { data, error } = await supabase
        .from("pending_actions")
        .select(`
          *,
          owner:property_owners(name, email),
          lead:leads(name, email),
          property:properties(name, address)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching pending actions:", error);
        throw error;
      }

      return (data || []) as PendingAction[];
    },
    enabled: isEligibleUser,
    refetchInterval: 30000,
  });

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedRefetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      refetchRef.current();
    }, 300);
  }, []);

  // Set up realtime subscription
  useEffect(() => {
    if (!isEligibleUser) return;

    const channel = supabase
      .channel("pending-actions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pending_actions",
        },
        (payload) => {
          console.log("Realtime pending action update:", payload);
          debouncedRefetch();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeEnabled(true);
        }
      });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [isEligibleUser, debouncedRefetch]);

  // Approve action mutation
  const approveMutation = useMutation({
    mutationFn: async ({
      actionId,
      customResponse,
    }: {
      actionId: string;
      customResponse?: string;
    }) => {
      const action = pendingActions.find((a) => a.id === actionId);
      if (!action) throw new Error("Action not found");

      // Handle based on action type
      if (action.action_type === "callback") {
        // Create a follow-up task
        // For now, just mark as approved
      } else if (action.action_type === "task") {
        // Create an actual task
      }

      // Update action status
      const { error } = await supabase
        .from("pending_actions")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", actionId);

      if (error) throw error;

      return action;
    },
    onSuccess: (action) => {
      toast.success(`Action "${action.title}" approved!`);
      queryClient.invalidateQueries({ queryKey: ["pending-actions"] });
    },
    onError: (error) => {
      console.error("Error approving action:", error);
      toast.error("Failed to approve action");
    },
  });

  // Dismiss action mutation
  const dismissMutation = useMutation({
    mutationFn: async ({
      actionId,
      reason,
    }: {
      actionId: string;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from("pending_actions")
        .update({
          status: "dismissed",
          dismissed_reason: reason || "Dismissed by user",
          updated_at: new Date().toISOString(),
        })
        .eq("id", actionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Action dismissed");
      queryClient.invalidateQueries({ queryKey: ["pending-actions"] });
    },
    onError: (error) => {
      console.error("Error dismissing action:", error);
      toast.error("Failed to dismiss action");
    },
  });

  // Get actions grouped by urgency
  const criticalActions = pendingActions.filter((a) => a.urgency === "critical");
  const highActions = pendingActions.filter((a) => a.urgency === "high");
  const normalActions = pendingActions.filter((a) => a.urgency === "normal" || a.urgency === "low");

  return {
    pendingActions,
    criticalActions,
    highActions,
    normalActions,
    isLoading,
    isEligibleUser,
    realtimeEnabled,
    approveAction: approveMutation.mutate,
    dismissAction: dismissMutation.mutate,
    isApproving: approveMutation.isPending,
    isDismissing: dismissMutation.isPending,
    refetch,
  };
}
