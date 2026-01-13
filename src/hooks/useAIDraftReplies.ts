import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AIDraftReply {
  id: string;
  communication_id: string | null;
  lead_id: string | null;
  owner_id: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  draft_content: string;
  message_type: string;
  confidence_score: number | null;
  status: string;
  created_at: string;
}

// Normalize phone for matching
const normalizePhone = (phone: string): string => {
  return phone.replace(/[^\d]/g, '').slice(-10);
};

export function useAIDraftReplies(contactPhone?: string, contactEmail?: string, leadId?: string, ownerId?: string) {
  const queryClient = useQueryClient();

  // Fetch pending draft for this contact
  const { data: pendingDraft, isLoading } = useQuery({
    queryKey: ["ai-draft-reply", contactPhone, contactEmail, leadId, ownerId],
    queryFn: async () => {
      let query = supabase
        .from("ai_draft_replies")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      // Match by lead_id, owner_id, or phone/email
      if (leadId) {
        query = query.eq("lead_id", leadId);
      } else if (ownerId) {
        query = query.eq("owner_id", ownerId);
      } else if (contactPhone) {
        // For phone matching, we need to be flexible
        const normalized = normalizePhone(contactPhone);
        query = query.or(`contact_phone.ilike.%${normalized}%,contact_phone.ilike.%${contactPhone}%`);
      } else if (contactEmail) {
        query = query.eq("contact_email", contactEmail);
      } else {
        return null;
      }

      const { data, error } = await query.maybeSingle();
      if (error) {
        console.error("Error fetching draft:", error);
        return null;
      }
      return data as AIDraftReply | null;
    },
    enabled: !!(contactPhone || contactEmail || leadId || ownerId),
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds to pick up new drafts
  });

  // Generate a new draft
  const generateDraftMutation = useMutation({
    mutationFn: async ({ 
      communicationId, 
      messageType = "sms" 
    }: { 
      communicationId?: string; 
      messageType?: "sms" | "email";
    }) => {
      const { data, error } = await supabase.functions.invoke("generate-draft-reply", {
        body: {
          communicationId,
          leadId,
          ownerId,
          contactPhone,
          contactEmail,
          messageType,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-draft-reply"] });
    },
    onError: (error: Error) => {
      console.error("Error generating draft:", error);
      // Don't show toast for rate limits - just log
      if (!error.message.includes("Rate limit")) {
        toast.error("Failed to generate AI draft");
      }
    },
  });

  // Dismiss a draft
  const dismissDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase
        .from("ai_draft_replies")
        .update({ 
          status: "dismissed",
          dismissed_at: new Date().toISOString(),
        })
        .eq("id", draftId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-draft-reply"] });
    },
  });

  return {
    pendingDraft,
    isLoading,
    generateDraft: generateDraftMutation.mutate,
    isGenerating: generateDraftMutation.isPending,
    dismissDraft: dismissDraftMutation.mutate,
    isDismissing: dismissDraftMutation.isPending,
  };
}

// Hook to check if any conversations have pending drafts (for badges in list view)
export function useAIDraftCount() {
  const { data: draftCount = 0 } = useQuery({
    queryKey: ["ai-draft-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ai_draft_replies")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      if (error) {
        console.error("Error fetching draft count:", error);
        return 0;
      }
      return count || 0;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  return draftCount;
}

// Hook to get all pending drafts for list view badges
export function usePendingDrafts() {
  const { data: pendingDrafts = [] } = useQuery({
    queryKey: ["pending-drafts-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_draft_replies")
        .select("id, lead_id, owner_id, contact_phone, contact_email, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching pending drafts:", error);
        return [];
      }
      return data;
    },
    staleTime: 15000,
    refetchInterval: 30000,
  });

  // Create lookup sets for quick checking
  const draftsByLeadId = new Set(pendingDrafts.filter(d => d.lead_id).map(d => d.lead_id));
  const draftsByOwnerId = new Set(pendingDrafts.filter(d => d.owner_id).map(d => d.owner_id));
  const draftsByPhone = new Set(
    pendingDrafts
      .filter(d => d.contact_phone)
      .map(d => normalizePhone(d.contact_phone!))
  );

  const hasDraftForContact = (leadId?: string, ownerId?: string, phone?: string): boolean => {
    if (leadId && draftsByLeadId.has(leadId)) return true;
    if (ownerId && draftsByOwnerId.has(ownerId)) return true;
    if (phone && draftsByPhone.has(normalizePhone(phone))) return true;
    return false;
  };

  return {
    pendingDrafts,
    hasDraftForContact,
    draftCount: pendingDrafts.length,
  };
}
