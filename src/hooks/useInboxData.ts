import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addHours, addDays, format } from "date-fns";
import { toast } from "sonner";

// Priority detection keywords
const URGENT_KEYWORDS = ["urgent", "emergency", "asap", "immediately", "broken", "not working", "help", "problem", "issue", "leak", "flood", "fire", "locked out", "no heat", "no ac", "no water"];
const IMPORTANT_KEYWORDS = ["interested", "inquiry", "booking", "schedule", "call me", "call back", "question", "property", "rent", "lease", "tour", "viewing", "price", "rate", "available"];

export type ConversationPriority = "urgent" | "important" | "normal" | "low";
export type ConversationStatusType = "open" | "snoozed" | "done" | "archived" | "awaiting";

export interface ConversationStatusRecord {
  id: string;
  contact_phone?: string;
  contact_email?: string;
  status: ConversationStatusType;
  priority: ConversationPriority;
  snoozed_until?: string;
  updated_at?: string;
}

export interface PhoneAssignment {
  id: string;
  phone_number: string;
  phone_type: string;
  display_name: string | null;
}

// Detect priority from message content
export function detectPriority(body: string, direction: string, contactType: string): ConversationPriority {
  if (!body) return "normal";
  const lowerBody = body.toLowerCase();
  
  if (URGENT_KEYWORDS.some(kw => lowerBody.includes(kw))) {
    return "urgent";
  }
  
  if (IMPORTANT_KEYWORDS.some(kw => lowerBody.includes(kw))) {
    return "important";
  }
  
  if (contactType === "owner" && direction === "inbound") {
    return "important";
  }
  
  return "normal";
}

// Normalize phone number for comparison
export const normalizePhone = (phone: string): string => {
  return phone.replace(/[^\d]/g, '').slice(-10);
};

export function useCurrentUser() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userPhoneAssignment, setUserPhoneAssignment] = useState<PhoneAssignment | null>(null);

  useEffect(() => {
    const fetchUserAndPhone = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        
        const { data: assignment } = await supabase
          .from('user_phone_assignments')
          .select('id, phone_number, phone_type, display_name')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .eq('phone_type', 'personal')
          .maybeSingle();
        
        if (assignment) {
          setUserPhoneAssignment(assignment);
        }
      }
    };
    fetchUserAndPhone();
  }, []);

  const { data: currentUserProfile } = useQuery({
    queryKey: ["current-user-profile", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("id", currentUserId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!currentUserId,
  });

  return {
    currentUserId,
    currentUserProfile,
    userPhoneAssignment,
  };
}

export function useConversationStatuses(currentUserId: string | null) {
  const queryClient = useQueryClient();

  const { data: conversationStatuses = [] } = useQuery({
    queryKey: ["conversation-statuses", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];
      const { data, error } = await supabase
        .from("conversation_status")
        .select("*")
        .eq("user_id", currentUserId);
      if (error) throw error;
      return data as ConversationStatusRecord[];
    },
    enabled: !!currentUserId,
  });

  const statusLookup = useMemo(() => {
    const map = new Map<string, ConversationStatusRecord>();
    for (const status of conversationStatuses) {
      if (status.contact_phone) {
        map.set(normalizePhone(status.contact_phone), status);
      }
      if (status.contact_email) {
        map.set(status.contact_email.toLowerCase(), status);
      }
    }
    return map;
  }, [conversationStatuses]);

  const [localStatusOverrides, setLocalStatusOverrides] = useState<Record<string, ConversationStatusType>>({});

  const updateConversationStatus = useMutation({
    mutationFn: async ({ 
      contactPhone, 
      contactEmail, 
      status, 
      snoozedUntil 
    }: { 
      contactPhone?: string; 
      contactEmail?: string; 
      status: ConversationStatusType; 
      snoozedUntil?: Date;
    }) => {
      if (!currentUserId) throw new Error("Not authenticated");
      
      const key = contactPhone ? normalizePhone(contactPhone) : contactEmail?.toLowerCase();
      const existing = key ? statusLookup.get(key) : null;
      
      if (existing) {
        const { error } = await supabase
          .from("conversation_status")
          .update({ 
            status, 
            snoozed_until: snoozedUntil?.toISOString() || null,
            updated_at: new Date().toISOString()
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("conversation_status")
          .insert({
            contact_phone: contactPhone || null,
            contact_email: contactEmail || null,
            status,
            snoozed_until: snoozedUntil?.toISOString() || null,
            user_id: currentUserId,
          });
        if (error) throw error;
      }
      
      return { contactPhone, contactEmail, status };
    },
    onMutate: async (variables) => {
      const key = variables.contactPhone 
        ? normalizePhone(variables.contactPhone) 
        : variables.contactEmail?.toLowerCase();
      
      if (key) {
        setLocalStatusOverrides(prev => ({
          ...prev,
          [key]: variables.status
        }));
      }
    },
    onSuccess: (_, variables) => {
      const statusLabels: Record<ConversationStatusType, string> = {
        open: "Reopened",
        done: "Marked as done",
        snoozed: `Snoozed until ${variables.snoozedUntil ? format(variables.snoozedUntil, "MMM d, h:mm a") : "later"}`,
        archived: "Archived",
        awaiting: "Marked as awaiting response",
      };
      toast.success(statusLabels[variables.status]);
      queryClient.invalidateQueries({ queryKey: ["conversation-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
    },
    onError: (error: Error, variables) => {
      const key = variables.contactPhone 
        ? normalizePhone(variables.contactPhone) 
        : variables.contactEmail?.toLowerCase();
      
      if (key) {
        setLocalStatusOverrides(prev => {
          const { [key]: _, ...rest } = prev;
          return rest;
        });
      }
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  return {
    conversationStatuses,
    statusLookup,
    localStatusOverrides,
    updateConversationStatus,
  };
}

export interface CommunicationItem {
  id: string;
  type: "sms" | "email" | "call" | "gmail" | "draft" | "personal_sms" | "personal_call";
  direction: "inbound" | "outbound";
  body: string;
  subject?: string;
  created_at: string;
  contact_name: string;
  contact_phone?: string;
  contact_email?: string;
  contact_type: "lead" | "owner" | "external" | "draft" | "personal" | "tenant" | "email";
  contact_id: string;
  media_urls?: string[];
  status?: string;
  sender_email?: string;
  is_draft?: boolean;
  draft_id?: string;
  is_resolved?: boolean;
  owner_id?: string;
  property_name?: string;
  priority?: ConversationPriority;
  conversation_status?: ConversationStatusType;
  snoozed_until?: string;
  gmail_email?: any;
}

export function useInboxMutations(
  onSmsSuccess?: () => void,
  onSmsError?: (error: Error) => void
) {
  const queryClient = useQueryClient();

  const sendSmsMutation = useMutation({
    mutationFn: async ({ to, message, contactType, contactId }: { to: string; message: string; contactType?: string; contactId?: string }) => {
      const { data, error } = await supabase.functions.invoke("ghl-send-sms", {
        body: { 
          leadId: contactType === "lead" ? contactId : undefined,
          ownerId: contactType === "owner" ? contactId : undefined,
          phone: to, 
          message, 
          fromNumber: "+14048005932" 
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send SMS");
      return data;
    },
    onSuccess: () => {
      toast.success("SMS sent!");
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
      queryClient.invalidateQueries({ queryKey: ["conversation-thread"] });
      onSmsSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(`Failed to send SMS: ${error.message}`);
      onSmsError?.(error);
    },
  });

  const markResolvedMutation = useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const { error } = await supabase
        .from("user_phone_messages")
        .update({ is_resolved: resolved })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.resolved ? "Marked as resolved" : "Marked as open");
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async ({ name, phone, email }: { name: string; phone?: string; email?: string }) => {
      const { data, error } = await supabase
        .from("leads")
        .insert([{
          name,
          phone: phone || null,
          email: email || null,
          stage: "new_lead",
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Lead created!");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create lead: ${error.message}`);
    },
  });

  return {
    sendSmsMutation,
    markResolvedMutation,
    createLeadMutation,
  };
}

export function useConversationActions(
  updateConversationStatus: ReturnType<typeof useConversationStatuses>["updateConversationStatus"]
) {
  const handleMarkDone = useCallback((comm: CommunicationItem) => {
    updateConversationStatus.mutate({
      contactPhone: comm.contact_phone,
      contactEmail: comm.contact_email,
      status: "done",
    });
  }, [updateConversationStatus]);

  const handleSnooze = useCallback((comm: CommunicationItem, hours: number) => {
    const snoozedUntil = hours === 24 ? addDays(new Date(), 1) : addHours(new Date(), hours);
    updateConversationStatus.mutate({
      contactPhone: comm.contact_phone,
      contactEmail: comm.contact_email,
      status: "snoozed",
      snoozedUntil,
    });
  }, [updateConversationStatus]);

  const handleReopen = useCallback((comm: CommunicationItem) => {
    updateConversationStatus.mutate({
      contactPhone: comm.contact_phone,
      contactEmail: comm.contact_email,
      status: "open",
    });
  }, [updateConversationStatus]);

  const handleMarkAwaiting = useCallback((comm: CommunicationItem) => {
    updateConversationStatus.mutate({
      contactPhone: comm.contact_phone,
      contactEmail: comm.contact_email,
      status: "awaiting",
    });
  }, [updateConversationStatus]);

  return {
    handleMarkDone,
    handleSnooze,
    handleReopen,
    handleMarkAwaiting,
  };
}
