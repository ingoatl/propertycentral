import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/ProtectedRoute";

export interface PendingTaskConfirmation {
  id: string;
  source_type: string;
  source_id: string | null;
  property_id: string | null;
  owner_id: string | null;
  task_title: string;
  task_description: string | null;
  task_category: string | null;
  phase_suggestion: number | null;
  priority: string;
  source_quote: string | null;
  status: string;
  assigned_to_user_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_task_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  property?: {
    name: string;
    address: string;
  };
  owner?: {
    name: string;
  };
}

export function usePendingTaskConfirmations() {
  const { user } = useAuth() as any;
  const queryClient = useQueryClient();
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);

  // Show modal for all authenticated users
  const isEligibleUser = !!user?.id;

  // Fetch pending confirmations
  const { data: pendingConfirmations = [], isLoading, refetch } = useQuery({
    queryKey: ["pending-task-confirmations"],
    queryFn: async () => {
      if (!isEligibleUser) return [];

      const { data, error } = await supabase
        .from("pending_task_confirmations")
        .select(`
          *,
          property:properties(name, address),
          owner:property_owners(name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching pending confirmations:", error);
        throw error;
      }

      return (data || []) as PendingTaskConfirmation[];
    },
    enabled: isEligibleUser,
    refetchInterval: 30000, // Refetch every 30 seconds as backup
  });

  // Use ref to store refetch to avoid dependency issues
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced refetch to prevent rapid re-fetches
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
      .channel("pending-task-confirmations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pending_task_confirmations",
        },
        (payload) => {
          console.log("Realtime update:", payload);
          debouncedRefetch();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeEnabled(true);
          console.log("Realtime subscription active for pending_task_confirmations");
        }
      });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [isEligibleUser, debouncedRefetch]);

  // Approve task mutation - creates tasks in owner_conversation_actions (Initial Setup Tasks)
  const approveMutation = useMutation({
    mutationFn: async ({
      confirmationId,
      editedTitle,
      editedDescription,
    }: {
      confirmationId: string;
      editedTitle?: string;
      editedDescription?: string;
    }) => {
      // Get the confirmation details
      const confirmation = pendingConfirmations.find((c) => c.id === confirmationId);
      if (!confirmation) throw new Error("Confirmation not found");

      // Get or create owner_conversation for this property
      let conversationId: string;
      
      const { data: existingConversation } = await supabase
        .from("owner_conversations")
        .select("id")
        .eq("property_id", confirmation.property_id)
        .limit(1)
        .maybeSingle();

      if (existingConversation) {
        conversationId = existingConversation.id;
      } else {
        // Create a new conversation for this property
        const { data: newConversation, error: convError } = await supabase
          .from("owner_conversations")
          .insert({
            property_id: confirmation.property_id,
            title: "Setup Tasks",
            ai_summary: "Tasks extracted from pending confirmations",
            conversation_date: new Date().toISOString().split('T')[0],
          })
          .select()
          .single();
        
        if (convError) throw convError;
        conversationId = newConversation.id;
      }

      // Create the task in owner_conversation_actions (Initial Setup Tasks)
      const { data: newTask, error: taskError } = await supabase
        .from("owner_conversation_actions")
        .insert({
          conversation_id: conversationId,
          action_type: "task",
          title: editedTitle || confirmation.task_title,
          description: (editedDescription || confirmation.task_description || "") +
            (confirmation.source_quote ? `\n\nSource: "${confirmation.source_quote}"` : ""),
          category: confirmation.task_category || "General",
          priority: confirmation.priority || "medium",
          status: "created",
          assigned_to: "peachhaus",
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Update confirmation status
      const { error: updateError } = await supabase
        .from("pending_task_confirmations")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          created_task_id: newTask.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", confirmationId);

      if (updateError) throw updateError;

      return newTask;
    },
    onSuccess: (newTask) => {
      toast.success(`Task "${newTask.title}" added to Initial Setup Tasks!`);
      queryClient.invalidateQueries({ queryKey: ["pending-task-confirmations"] });
      queryClient.invalidateQueries({ queryKey: ["owner-conversation-actions"] });
    },
    onError: (error) => {
      console.error("Error approving task:", error);
      toast.error("Failed to approve task");
    },
  });

  // Reject task mutation
  const rejectMutation = useMutation({
    mutationFn: async ({
      confirmationId,
      reason,
    }: {
      confirmationId: string;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from("pending_task_confirmations")
        .update({
          status: "rejected",
          rejection_reason: reason || "Rejected by user",
          updated_at: new Date().toISOString(),
        })
        .eq("id", confirmationId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task rejected");
      queryClient.invalidateQueries({ queryKey: ["pending-task-confirmations"] });
    },
    onError: (error) => {
      console.error("Error rejecting task:", error);
      toast.error("Failed to reject task");
    },
  });

  // Approve all tasks mutation
  const approveAllMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      for (const confirmation of pendingConfirmations) {
        try {
          const result = await approveMutation.mutateAsync({
            confirmationId: confirmation.id,
          });
          results.push(result);
        } catch (error) {
          console.error(`Failed to approve ${confirmation.task_title}:`, error);
        }
      }
      return results;
    },
    onSuccess: (results) => {
      toast.success(`${results.length} tasks created!`);
    },
  });

  return {
    pendingConfirmations,
    isLoading,
    isEligibleUser,
    realtimeEnabled,
    approveTask: approveMutation.mutate,
    rejectTask: rejectMutation.mutate,
    approveAllTasks: approveAllMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isApprovingAll: approveAllMutation.isPending,
    refetch,
  };
}
