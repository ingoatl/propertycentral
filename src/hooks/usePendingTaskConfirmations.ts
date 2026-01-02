import { useEffect, useState } from "react";
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

const INGO_USER_ID = "8f7c8f43-536f-4587-99dc-5086c144a045";

export function usePendingTaskConfirmations() {
  const { user } = useAuth() as any;
  const queryClient = useQueryClient();
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);

  // Only show modal for Ingo during testing phase
  const isEligibleUser = user?.id === INGO_USER_ID;

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
          refetch();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeEnabled(true);
          console.log("Realtime subscription active for pending_task_confirmations");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isEligibleUser, refetch]);

  // Approve task mutation
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

      // Get onboarding project for this property
      const { data: project } = await supabase
        .from("onboarding_projects")
        .select("id")
        .eq("property_id", confirmation.property_id)
        .maybeSingle();

      if (!project) {
        throw new Error("No onboarding project found for this property");
      }

      // Create the onboarding task
      const phaseNumber = confirmation.phase_suggestion || 1;
      const phaseTitles: Record<number, string> = {
        1: "Property Setup",
        2: "Verification & Testing",
        3: "Owner Preferences",
        4: "Follow-up Items",
        5: "Maintenance",
      };

      const { data: newTask, error: taskError } = await supabase
        .from("onboarding_tasks")
        .insert({
          project_id: project.id,
          phase_number: phaseNumber,
          phase_title: phaseTitles[phaseNumber] || "General",
          title: editedTitle || confirmation.task_title,
          notes: (editedDescription || confirmation.task_description) +
            (confirmation.source_quote ? `\n\nSource: "${confirmation.source_quote}"` : ""),
          status: "pending",
          created_at: new Date().toISOString(),
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
      toast.success(`Task "${newTask.title}" created!`);
      queryClient.invalidateQueries({ queryKey: ["pending-task-confirmations"] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-tasks"] });
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
