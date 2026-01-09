import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/components/ProtectedRoute";
import { toast } from "sonner";

export interface PendingCallRecap {
  id: string;
  communication_id: string | null;
  owner_id: string | null;
  lead_id: string | null;
  property_id: string | null;
  recipient_name: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  recipient_type: string;
  call_date: string;
  call_duration: number | null;
  caller_user_id: string | null;
  subject: string;
  email_body: string;
  key_topics: string[];
  action_items: Array<{
    title: string;
    description: string;
    priority: string;
    category: string;
    source_quote?: string;
  }>;
  transcript_summary: string | null;
  sentiment: string | null;
  status: string;
  sent_at: string | null;
  sent_by: string | null;
  dismissed_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  owner?: {
    name: string;
    email: string;
  } | null;
  lead?: {
    name: string;
    email: string;
  } | null;
  property?: {
    name: string;
  } | null;
}

export function usePendingCallRecaps() {
  const queryClient = useQueryClient();
  const { user } = useAuth() as any;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch pending recaps - user-specific filtering
  const {
    data: pendingRecaps = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["pending-call-recaps", user?.id],
    queryFn: async () => {
      // First get all pending recaps
      const { data: allRecaps, error } = await supabase
        .from("pending_call_recaps")
        .select(`
          *,
          owner:property_owners(name, email),
          lead:leads(name, email),
          property:properties(name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching pending call recaps:", error);
        throw error;
      }

      if (!allRecaps) return [];

      // Sort by user relevance:
      // 1. User's own calls (caller_user_id matches)
      // 2. Calls without a caller assigned (team-wide)
      // 3. Other users' calls (still visible but lower priority)
      const sorted = [...allRecaps].sort((a, b) => {
        const aIsUserCall = a.caller_user_id === user?.id;
        const bIsUserCall = b.caller_user_id === user?.id;
        const aIsUnassigned = !a.caller_user_id;
        const bIsUnassigned = !b.caller_user_id;

        if (aIsUserCall && !bIsUserCall) return -1;
        if (!aIsUserCall && bIsUserCall) return 1;
        if (aIsUnassigned && !bIsUnassigned) return -1;
        if (!aIsUnassigned && bIsUnassigned) return 1;
        
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return sorted as PendingCallRecap[];
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Debounced refetch
  const debouncedRefetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      refetch();
    }, 500);
  }, [refetch]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    channelRef.current = supabase
      .channel("pending-call-recaps-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pending_call_recaps",
        },
        () => {
          debouncedRefetch();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [user, debouncedRefetch]);

  // Send recap mutation
  const sendRecapMutation = useMutation({
    mutationFn: async ({
      recapId,
      subject,
      emailBody,
    }: {
      recapId: string;
      subject?: string;
      emailBody?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-call-recap-email", {
        body: { recapId, subject, emailBody },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-call-recaps"] });
      toast.success("Recap email sent successfully!");
    },
    onError: (error) => {
      console.error("Error sending recap:", error);
      toast.error("Failed to send recap email");
    },
  });

  // Dismiss recap mutation
  const dismissRecapMutation = useMutation({
    mutationFn: async ({
      recapId,
      reason,
    }: {
      recapId: string;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from("pending_call_recaps")
        .update({
          status: "dismissed",
          dismissed_reason: reason || "User dismissed",
        })
        .eq("id", recapId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-call-recaps"] });
      toast.success("Recap dismissed");
    },
    onError: (error) => {
      console.error("Error dismissing recap:", error);
      toast.error("Failed to dismiss recap");
    },
  });

  // Update recap mutation (save edits without sending)
  const updateRecapMutation = useMutation({
    mutationFn: async ({
      recapId,
      subject,
      emailBody,
    }: {
      recapId: string;
      subject?: string;
      emailBody?: string;
    }) => {
      const updates: Record<string, unknown> = {};
      if (subject !== undefined) updates.subject = subject;
      if (emailBody !== undefined) updates.email_body = emailBody;

      const { error } = await supabase
        .from("pending_call_recaps")
        .update(updates)
        .eq("id", recapId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-call-recaps"] });
    },
    onError: (error) => {
      console.error("Error updating recap:", error);
      toast.error("Failed to save recap changes");
    },
  });

  // Categorize recaps for UI
  const userRecaps = pendingRecaps.filter((r) => r.caller_user_id === user?.id);
  const teamRecaps = pendingRecaps.filter((r) => !r.caller_user_id || r.caller_user_id !== user?.id);

  return {
    pendingRecaps,
    userRecaps,
    teamRecaps,
    isLoading,
    sendRecap: sendRecapMutation.mutate,
    dismissRecap: dismissRecapMutation.mutate,
    updateRecap: updateRecapMutation.mutate,
    isSending: sendRecapMutation.isPending,
    isDismissing: dismissRecapMutation.isPending,
    isUpdating: updateRecapMutation.isPending,
    refetch,
    currentUserId: user?.id,
  };
}
