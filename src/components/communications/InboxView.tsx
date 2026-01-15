import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isYesterday, parseISO, addHours, addDays, isBefore } from "date-fns";
import {
  MessageSquare,
  Phone,
  Mail,
  Search,
  Filter,
  ArrowUpRight,
  Plus,
  Send,
  Trash2,
  Loader2,
  Pencil,
  X,
  Save,
  PhoneCall,
  CheckCircle,
  FileText,
  Info,
  MoreHorizontal,
  User,
  ChevronLeft,
  PhoneOutgoing,
  UserPlus,
  Inbox,
  Play,
  TrendingUp,
  Clock,
  AlertCircle,
  Zap,
  Archive,
  CheckCheck,
  Bot,
  RotateCcw,
  Volume2,
  Sparkles,
  Keyboard,
  Home,
} from "lucide-react";
import { IncomeReportButton } from "@/components/IncomeReportEmbed";
import { cn } from "@/lib/utils";
import { formatPhoneForDisplay } from "@/lib/phoneUtils";
import { decodeHtmlEntities } from "@/lib/html-utils";
import { TwilioCallDialog } from "@/components/TwilioCallDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendSMSDialog } from "./SendSMSDialog";
import { SendEmailDialog } from "./SendEmailDialog";
import { UnifiedComposeDialog } from "./UnifiedComposeDialog";
import { AIDraftReplySection } from "./AIDraftReplySection";
import { AIWritingAssistant } from "./AIWritingAssistant";
import { AIReplyButton } from "./AIReplyButton";
import { AIDraftReplyCard } from "./AIDraftReplyCard";
import { SmartSchedulingCard, detectSchedulingIntent } from "./SmartSchedulingCard";
import { SmartTaskExtractButton } from "./SmartTaskExtractButton";
import { EmojiPicker } from "./EmojiPicker";
import { FollowUpSchedulerModal } from "./FollowUpSchedulerModal";
import { ContactInfoModal } from "./ContactInfoModal";
import { ConversationNotes } from "./ConversationNotes";
// AdminInboxSelector removed - using EnhancedInboxSelector for all tabs
import { EmailActionModal } from "./EmailActionModal";
import { InboxZeroGuide } from "./InboxZeroGuide";
import { ConversationQuickActions } from "./ConversationQuickActions";
import { PriorityBadge } from "./PriorityBadge";
import { VoiceAIBadge, isVoiceAITranscript, extractCallerPhoneFromTranscript, extractAgentNameFromTranscript, extractCallSummaryFromTranscript, extractCallerNameFromTranscript, extractMentionedTeamMember } from "./VoiceAIBadge";
import { CallRecordingPlayer } from "./CallRecordingPlayer";
import LeadDetailModal from "@/components/leads/LeadDetailModal";

import { ConversationSummary } from "./ConversationSummary";
import { TeamAssignmentDropdown } from "./TeamAssignmentDropdown";
import { TeamNotificationBell } from "./TeamNotificationBell";
import { EmailCategoryBadge } from "./EmailCategoryBadge";
import { EmailCategoryFilter } from "./EmailCategoryFilter";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { useInboxKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { EnhancedInboxSelector, type InboxView as InboxViewType } from "./EnhancedInboxSelector";
import { WorkStatusBadge, WorkStatusDot, type WorkStatus } from "./WorkStatusBadge";
import { LabelBadges } from "./MessageLabels";
import { BatchActions } from "./BatchActions";
import { QuickAssignButton } from "./QuickAssignButton";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useGhlAutoSync } from "@/hooks/useGhlAutoSync";
import { useLeadRealtimeMessages } from "@/hooks/useLeadRealtimeMessages";
import { usePhoneLookup } from "@/hooks/usePhoneLookup";
import { useAIDraftReplies, usePendingDrafts } from "@/hooks/useAIDraftReplies";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CommunicationItem {
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
  // New Inbox Zero fields
  priority?: ConversationPriority;
  conversation_status?: ConversationStatusType;
  snoozed_until?: string;
  // Gmail email reference for rendering in All tab
  gmail_email?: GmailEmail;
}

interface ConversationStatusRecord {
  id: string;
  contact_phone?: string;
  contact_email?: string;
  status: ConversationStatusType;
  priority: ConversationPriority;
  snoozed_until?: string;
  updated_at?: string;
}

interface PhoneAssignment {
  id: string;
  phone_number: string;
  phone_type: string;
  display_name: string | null;
}

type TabType = "all" | "chats" | "calls" | "emails";
type FilterType = "all" | "open" | "unread" | "snoozed" | "done" | "urgent" | "owners" | "awaiting";
type MessageChannel = "sms" | "email";
type ConversationPriority = "urgent" | "important" | "normal" | "low";
type ConversationStatusType = "open" | "snoozed" | "done" | "archived" | "awaiting";

// Priority detection keywords
const URGENT_KEYWORDS = ["urgent", "emergency", "asap", "immediately", "broken", "not working", "help", "problem", "issue", "leak", "flood", "fire", "locked out", "no heat", "no ac", "no water"];
const IMPORTANT_KEYWORDS = ["interested", "inquiry", "booking", "schedule", "call me", "call back", "question", "property", "rent", "lease", "tour", "viewing", "price", "rate", "available"];

// Detect priority from message content
function detectPriority(body: string, direction: string, contactType: string): ConversationPriority {
  if (!body) return "normal";
  const lowerBody = body.toLowerCase();
  
  // Urgent: emergency keywords or owner messages that need response
  if (URGENT_KEYWORDS.some(kw => lowerBody.includes(kw))) {
    return "urgent";
  }
  
  // Important: scheduling or business inquiry keywords
  if (IMPORTANT_KEYWORDS.some(kw => lowerBody.includes(kw))) {
    return "important";
  }
  
  // Owner inbound messages are always at least important
  if (contactType === "owner" && direction === "inbound") {
    return "important";
  }
  
  return "normal";
}

interface GmailEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromName: string;
  to: string;
  targetInbox?: string;
  date: string;
  body: string;
  bodyHtml?: string;
  snippet: string;
  labelIds: string[];
}

// Normalize phone number to last 10 digits for comparison - strips ALL non-digit characters including Unicode
const normalizePhone = (phone: string): string => {
  // Remove ALL non-digit characters including invisible Unicode formatting
  return phone.replace(/[^\d]/g, '').slice(-10);
};

export function InboxView() {
  const [search, setSearch] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedMessage, setSelectedMessage] = useState<CommunicationItem | null>(null);
  const [showSmsReply, setShowSmsReply] = useState(false);
  const [showEmailReply, setShowEmailReply] = useState(false);
  const [showComposeEmail, setShowComposeEmail] = useState(false);
  const [showAIComposeEmail, setShowAIComposeEmail] = useState(false);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editedDraft, setEditedDraft] = useState<{
    to_email: string;
    to_name: string;
    subject: string;
    body: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userPhoneAssignment, setUserPhoneAssignment] = useState<PhoneAssignment | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel>("sms");
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [selectedInboxUserId, setSelectedInboxUserId] = useState<string | null>(null);
  const [viewAllInboxes, setViewAllInboxes] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showEmailActionModal, setShowEmailActionModal] = useState(false);
  
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [voiceAICallerPhone, setVoiceAICallerPhone] = useState<string | null>(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  // Income report now opens directly in new tab via IncomeReportButton
  const [lastSentMessage, setLastSentMessage] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // New Phase 2-3 enhancements: category filter, keyboard navigation
  const [selectedEmailCategory, setSelectedEmailCategory] = useState<string | null>(null);
  const [selectedGmailIndex, setSelectedGmailIndex] = useState<number>(0);
  const [selectedCommIndex, setSelectedCommIndex] = useState<number>(0);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAdminCheck();
  
  // Auto-sync GHL data in background
  useGhlAutoSync();
  
  // Real-time subscription for lead communications
  useLeadRealtimeMessages();
  
  // Phone lookup for unknown contacts
  const { getNameForPhone, lookupPhones, lookupCache } = usePhoneLookup();

  // Get current user and their phone assignment
  useEffect(() => {
    const fetchUserAndPhone = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setSelectedInboxUserId(user.id);
        
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

  // Fetch current user's profile for name display
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

  // Send SMS mutation - ALWAYS use GHL for unified A2P compliant sending
  const sendSmsMutation = useMutation({
    mutationFn: async ({ to, message, contactType, contactId }: { to: string; message: string; contactType?: string; contactId?: string }) => {
      // Store the message for follow-up context
      setLastSentMessage(message);
      
      // Always use GHL for SMS - ensures messages sync to GHL conversations
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
      setNewMessage("");
      // Invalidate both the main list AND the conversation thread for real-time updates
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
      queryClient.invalidateQueries({ queryKey: ["conversation-thread"] });
      
      // Show follow-up scheduler modal after sending - but only for inbound conversations
      // Check if this is a response to an inbound message
      if (selectedMessage && selectedMessage.direction === "inbound") {
        // Small delay to let the success toast show first
        setTimeout(() => {
          setShowFollowUpModal(true);
        }, 500);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to send SMS: ${error.message}`);
    },
  });

  // Mark resolved mutation
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

  // Fetch conversation statuses for Inbox Zero workflow
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

  // Map conversation statuses by contact key for quick lookup
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

  // Local state for optimistic updates
  // Using plain object instead of Map for better React reactivity
  const [localStatusOverrides, setLocalStatusOverrides] = useState<Record<string, ConversationStatusType>>({});

  // Update conversation status mutation with optimistic updates
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
        // Update existing record
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
        // Insert new record
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
      // Optimistic update - immediately update local state with plain object spread
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
      // Revert optimistic update on error - remove key from object
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

  // Helper to mark conversation as done
  const handleMarkDone = useCallback((comm: CommunicationItem) => {
    updateConversationStatus.mutate({
      contactPhone: comm.contact_phone,
      contactEmail: comm.contact_email,
      status: "done",
    });
  }, [updateConversationStatus]);

  // Helper to snooze conversation
  const handleSnooze = useCallback((comm: CommunicationItem, hours: number) => {
    const snoozedUntil = hours === 24 ? addDays(new Date(), 1) : addHours(new Date(), hours);
    updateConversationStatus.mutate({
      contactPhone: comm.contact_phone,
      contactEmail: comm.contact_email,
      status: "snoozed",
      snoozedUntil,
    });
  }, [updateConversationStatus]);

  // Helper to reopen conversation
  const handleReopen = useCallback((comm: CommunicationItem) => {
    updateConversationStatus.mutate({
      contactPhone: comm.contact_phone,
      contactEmail: comm.contact_email,
      status: "open",
    });
  }, [updateConversationStatus]);

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async ({ id, table }: { id: string; table: 'lead_communications' | 'user_phone_messages' }) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message deleted");
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
      setSelectedMessage(null);
    },
    onError: (err: Error) => toast.error(`Failed to delete: ${err.message}`),
  });

  // Mark as read/unread mutation
  const markReadMutation = useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) => {
      const { error } = await supabase.from('lead_communications').update({ is_read: isRead }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-communications"] }),
  });

  // Auto-mark inbound messages as read when selected
  useEffect(() => {
    if (selectedMessage && selectedMessage.direction === 'inbound' && selectedMessage.type !== 'draft') {
      markReadMutation.mutate({ id: selectedMessage.id, isRead: true });
    }
  }, [selectedMessage?.id]);

  // Send draft mutation
  const sendDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const { data: draft, error: fetchError } = await supabase
        .from("email_drafts")
        .select("*")
        .eq("id", draftId)
        .single();
      
      if (fetchError || !draft) throw new Error("Draft not found");

      const { data, error } = await supabase.functions.invoke("send-lead-email", {
        body: {
          to: draft.to_email,
          toName: draft.to_name || "",
          subject: draft.subject,
          body: draft.body,
          contactType: draft.contact_type || "other",
          contactId: draft.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await supabase
        .from("email_drafts")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", draftId);

      return data;
    },
    onSuccess: () => {
      toast.success("Email sent successfully!");
      setSelectedMessage(null);
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to send email: ${error.message}`);
    },
  });

  // Discard draft mutation
  const discardDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase
        .from("email_drafts")
        .update({ status: "discarded" })
        .eq("id", draftId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Draft discarded");
      setSelectedMessage(null);
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to discard draft: ${error.message}`);
    },
  });

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async ({ draftId, updates }: { draftId: string; updates: { to_email: string; to_name: string; subject: string; body: string } }) => {
      const { error } = await supabase
        .from("email_drafts")
        .update({
          to_email: updates.to_email,
          to_name: updates.to_name,
          subject: updates.subject,
          body: updates.body,
          updated_at: new Date().toISOString()
        })
        .eq("id", draftId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Draft saved");
      setIsEditingDraft(false);
      setEditedDraft(null);
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to save draft: ${error.message}`);
    },
  });

  const startEditingDraft = (message: CommunicationItem) => {
    setEditedDraft({
      to_email: message.contact_email || "",
      to_name: message.contact_name || "",
      subject: message.subject || "",
      body: message.body || ""
    });
    setIsEditingDraft(true);
  };

  const cancelEditing = () => {
    setIsEditingDraft(false);
    setEditedDraft(null);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedMessage) return;

    if (selectedChannel === "sms" && selectedMessage.contact_phone) {
      sendSmsMutation.mutate({ 
        to: selectedMessage.contact_phone, 
        message: newMessage,
        contactType: selectedMessage.contact_type,
        contactId: selectedMessage.contact_id,
      });
    } else if (selectedChannel === "email") {
      setShowEmailReply(true);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
  };

  const handleAIMessage = (message: string) => {
    setNewMessage(message);
  };

  const handleInboxChange = (userId: string | null, viewAll: boolean) => {
    setSelectedInboxUserId(userId);
    setViewAllInboxes(viewAll);
  };

  // Fetch lead data when a lead is selected for the modal
  const { data: selectedLead } = useQuery({
    queryKey: ["lead-for-modal", selectedLeadId],
    queryFn: async () => {
      if (!selectedLeadId) return null;
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", selectedLeadId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLeadId,
  });

  // Create lead from communication mutation
  const createLeadMutation = useMutation({
    mutationFn: async (contact: { name: string; phone?: string; email?: string }) => {
      // Insert new lead
      const { data: newLead, error: leadError } = await supabase
        .from("leads")
        .insert({
          name: contact.name,
          phone: contact.phone || null,
          email: contact.email || null,
          source: "communication_hub" as const,
          stage: "new_lead" as const,
        })
        .select()
        .single();
      
      if (leadError) throw leadError;

      // Add timeline entry
      await supabase.from("lead_timeline").insert({
        lead_id: newLead.id,
        action: "Lead created from Communications Hub",
        metadata: { source: "communication_hub", phone: contact.phone, email: contact.email },
      });

      return newLead;
    },
    onSuccess: (newLead) => {
      toast.success(`Lead "${newLead.name}" created!`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
      setSelectedLeadId(newLead.id);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create lead: ${error.message}`);
    },
  });

  // Enhanced inbox selector state - default to user's own inbox, not all
  const [selectedEmailInboxView, setSelectedEmailInboxView] = useState<InboxViewType>("my-inbox");

  // Fetch Gmail inbox emails for ALL team members - always fetch for All and Emails tabs
  const { data: gmailEmails = [], isLoading: isLoadingGmail } = useQuery({
    queryKey: ["gmail-inbox"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-gmail-inbox", {
        body: { daysBack: 14 } // Extended to 14 days to find older emails
      });
      
      if (error) {
        console.error("Failed to fetch Gmail inbox:", error);
        return [];
      }
      
      return (data?.emails || []) as GmailEmail[];
    },
    enabled: activeTab === "emails" || activeTab === "all", // Fetch for both All and Emails tabs
    staleTime: 30000,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch user gmail labels for mapping
  const { data: userGmailLabels = [] } = useQuery({
    queryKey: ["user-gmail-labels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_gmail_labels")
        .select("user_id, label_name, email_address")
        .eq("is_active", true);
      
      if (error) {
        console.error("Failed to fetch user gmail labels:", error);
        return [];
      }
      return data || [];
    },
    enabled: activeTab === "emails" || activeTab === "all",
  });

  // Fetch user phone assignments for SMS routing
  const { data: userPhoneAssignments = [] } = useQuery({
    queryKey: ["user-phone-assignments-for-routing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_phone_assignments")
        .select("user_id, phone_number, phone_type, display_name")
        .eq("is_active", true);
      
      if (error) {
        console.error("Failed to fetch user phone assignments:", error);
        return [];
      }
      return data || [];
    },
    enabled: activeTab === "all",
  });

  // Create lookup map for user labels
  const userLabelMap = useMemo(() => {
    const map = new Map<string, { user_id: string; label_name: string; email_address: string | null }>();
    userGmailLabels.forEach(label => {
      if (label.label_name) {
        map.set(label.label_name.toLowerCase(), label);
      }
      if (label.email_address) {
        map.set(label.email_address.toLowerCase(), label);
      }
    });
    return map;
  }, [userGmailLabels]);

  // Create lookup map for phone assignments (personal phones only for user routing)
  const userPhoneMap = useMemo(() => {
    const map = new Map<string, { user_id: string; phone_number: string; phone_type: string }>();
    userPhoneAssignments.forEach(assignment => {
      if (assignment.phone_number) {
        map.set(normalizePhone(assignment.phone_number), {
          user_id: assignment.user_id,
          phone_number: assignment.phone_number,
          phone_type: assignment.phone_type
        });
      }
    });
    return map;
  }, [userPhoneAssignments]);

  // Fetch email insights for AI categorization badges
  const { data: emailInsights = [] } = useQuery({
    queryKey: ["email-insights-for-inbox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_insights")
        .select("gmail_message_id, category, sentiment, priority, action_required, property_id, owner_id")
        .not("gmail_message_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      
      if (error) {
        console.error("Failed to fetch email insights:", error);
        return [];
      }
      return data || [];
    },
    enabled: activeTab === "emails" || activeTab === "all",
    staleTime: 60000,
  });

  // Create a lookup map for email insights by gmail_message_id
  const emailInsightsMap = useMemo(() => {
    const map = new Map<string, typeof emailInsights[0]>();
    emailInsights.forEach(insight => {
      if (insight.gmail_message_id) {
        map.set(insight.gmail_message_id, insight);
      }
    });
    return map;
  }, [emailInsights]);

  // Filter emails based on selected inbox view AND category filter
  const filteredGmailEmails = useMemo(() => {
    let filtered = gmailEmails;
    
    // Filter by inbox view
    if (selectedEmailInboxView === "all") {
      // Show all emails - no filtering
      filtered = gmailEmails;
    } else if (selectedEmailInboxView === "my-inbox" && currentUserId) {
      // Show only emails for current user
      const currentUserLabel = userGmailLabels.find(l => l.user_id === currentUserId);
      if (currentUserLabel) {
        filtered = gmailEmails.filter(email => {
          const targetInbox = email.targetInbox?.toLowerCase() || '';
          return targetInbox.includes(currentUserLabel.label_name.toLowerCase());
        });
      }
    } else if (selectedEmailInboxView === "unassigned") {
      // Show emails that don't match any user's label
      filtered = gmailEmails.filter(email => {
        const targetInbox = email.targetInbox?.toLowerCase() || '';
        // Check if this email matches any user's label
        const matchesAnyUser = userGmailLabels.some(label => 
          targetInbox.includes(label.label_name.toLowerCase())
        );
        return !matchesAnyUser || !email.targetInbox;
      });
    } else {
      // Specific user selected - find their label and filter
      const selectedUserLabel = userGmailLabels.find(l => l.user_id === selectedEmailInboxView);
      if (selectedUserLabel) {
        filtered = gmailEmails.filter(email => {
          const targetInbox = email.targetInbox?.toLowerCase() || '';
          return targetInbox.includes(selectedUserLabel.label_name.toLowerCase());
        });
      }
    }

    // Apply category filter if selected
    if (selectedEmailCategory) {
      filtered = filtered.filter(email => {
        const insight = emailInsightsMap.get(email.id);
        return insight?.category === selectedEmailCategory;
      });
    }

    return filtered;
  }, [gmailEmails, selectedEmailInboxView, currentUserId, userGmailLabels, selectedEmailCategory, emailInsightsMap]);

  const { data: communications = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["all-communications", search, activeTab, activeFilter, selectedInboxUserId, viewAllInboxes],
    refetchInterval: 10000,
    staleTime: 5000,
    enabled: !!currentUserId && activeTab !== "emails",
    queryFn: async () => {
      const results: CommunicationItem[] = [];
      const fetchAll = activeTab === "all";
      const fetchCalls = activeTab === "calls" || fetchAll;
      const fetchMessages = activeTab === "chats" || fetchAll;
      const targetUserId = viewAllInboxes ? null : (selectedInboxUserId || currentUserId);

      if (fetchMessages) {
        // Fetch lead communications - filter by user assignment for non-admin users
        // Include received_on_number for proper phone-based filtering
        let commsQuery = supabase
          .from("lead_communications")
          .select(`id, communication_type, direction, body, subject, created_at, status, lead_id, owner_id, metadata, media_urls, assigned_to, recipient_user_id, assigned_user_id, received_on_number, leads(id, name, phone, email)`)
          .in("communication_type", ["sms", "email"])
          .order("created_at", { ascending: false })
          .limit(100);
        
        // For admin "all" view, fetch everything without filtering
        // For personal inboxes, we'll filter post-query to include:
        // 1. Messages explicitly assigned to the user (assigned_to, recipient_user_id, assigned_user_id)
        // 2. Messages received on the user's personal phone number (received_on_number match)
        // 3. Messages from company lines (visible to all team members)
        // We fetch all and filter in JS because we need to cross-reference with userPhoneMap
        
        const { data: allComms } = await commsQuery;

        if (allComms) {
          // Lookup tenants for matching
          const { data: allTenants } = await supabase
            .from("mid_term_bookings")
            .select("id, tenant_name, tenant_phone, tenant_email");
          
          const tenantMap = new Map<string, { id: string; name: string; phone: string; email: string | null }>();
          allTenants?.forEach(t => {
            if (t.tenant_phone) {
              const normalized = normalizePhone(t.tenant_phone);
              tenantMap.set(normalized, { id: t.id, name: t.tenant_name, phone: t.tenant_phone, email: t.tenant_email });
            }
          });
          
          // Fetch all active phone assignments for proper inbox routing
          const { data: allPhoneAssignments } = await supabase
            .from("user_phone_assignments")
            .select("user_id, phone_number, phone_type")
            .eq("is_active", true);
          
          // Create lookup maps for phone-based filtering
          const phoneToUserMap = new Map<string, { user_id: string; phone_type: string }>();
          const userPersonalPhones = new Map<string, string[]>(); // user_id -> list of personal phone numbers
          
          allPhoneAssignments?.forEach(a => {
            if (a.phone_number) {
              const normalized = normalizePhone(a.phone_number);
              phoneToUserMap.set(normalized, { user_id: a.user_id, phone_type: a.phone_type });
              
              // Track personal phones per user
              if (a.phone_type === "personal") {
                const existing = userPersonalPhones.get(a.user_id) || [];
                existing.push(normalized);
                userPersonalPhones.set(a.user_id, existing);
              }
            }
          });
          
          // Team member name to ID mapping for Voice AI routing
          const teamMemberIds: Record<string, string> = {
            'alex': 'fbd13e57-3a59-4c53-bb3b-14ab354b3420',
            'anja': 'b2f495ac-2062-446e-bfa0-2197a82114c1',
            'ingo': '8f7c8f43-536f-4587-99dc-5086c144a045',
            'chris': 'c4d6b107-70cd-487f-884c-0400edaf9f6f',
            'christian': 'c4d6b107-70cd-487f-884c-0400edaf9f6f',
            'catherine': '925a186d-ed85-42a2-9388-7032c315f239',
          };
          
          // Reverse lookup: ID to name
          const idToName: Record<string, string> = {
            'fbd13e57-3a59-4c53-bb3b-14ab354b3420': 'alex',
            'b2f495ac-2062-446e-bfa0-2197a82114c1': 'anja',
            '8f7c8f43-536f-4587-99dc-5086c144a045': 'ingo',
            'c4d6b107-70cd-487f-884c-0400edaf9f6f': 'chris',
            '925a186d-ed85-42a2-9388-7032c315f239': 'catherine',
          };

          for (const comm of allComms) {
            // === CRITICAL: Inbox filtering logic ===
            // For personal inboxes (not admin "all" view), only show messages that belong to this user:
            // 1. Explicitly assigned to this user (assigned_to, recipient_user_id, assigned_user_id)
            // 2. Received on the user's personal phone number (received_on_number matches)
            // 3. Messages from company lines are visible to all team members
            if (!viewAllInboxes && targetUserId) {
              const isExplicitlyAssigned = 
                comm.assigned_to === targetUserId || 
                comm.recipient_user_id === targetUserId || 
                comm.assigned_user_id === targetUserId;
              
              // Check if message was received on a phone number assigned to another user
              let isReceivedOnOtherPersonalLine = false;
              let isReceivedOnUserPersonalLine = false;
              let isReceivedOnCompanyLine = false;
              
              if (comm.received_on_number) {
                const normalizedReceivedOn = normalizePhone(comm.received_on_number);
                const phoneOwner = phoneToUserMap.get(normalizedReceivedOn);
                
                if (phoneOwner) {
                  if (phoneOwner.phone_type === "company") {
                    // Company line - visible to all team members
                    isReceivedOnCompanyLine = true;
                  } else if (phoneOwner.user_id === targetUserId) {
                    // Personal line belonging to this user
                    isReceivedOnUserPersonalLine = true;
                  } else {
                    // Personal line belonging to ANOTHER user - skip this message
                    isReceivedOnOtherPersonalLine = true;
                  }
                }
              }
              
              // Skip if received on another user's personal line
              if (isReceivedOnOtherPersonalLine) {
                continue;
              }
              
              // Include message if:
              // - Explicitly assigned to this user, OR
              // - Received on user's personal line, OR
              // - Received on company line (visible to all), OR
              // - Has no routing info (legacy messages - visible to all for now)
              const hasNoRoutingInfo = !comm.received_on_number && !comm.assigned_to && !comm.recipient_user_id && !comm.assigned_user_id;
              const shouldInclude = isExplicitlyAssigned || isReceivedOnUserPersonalLine || isReceivedOnCompanyLine || hasNoRoutingInfo;
              
              if (!shouldInclude) {
                continue;
              }
            }
            
            const lead = comm.leads as { id: string; name: string; phone: string | null; email: string | null } | null;
            const metadata = comm.metadata as { 
              unmatched_phone?: string; 
              contact_name?: string; 
              tenant_id?: string; 
              tenant_name?: string; 
              tenant_phone?: string;
              ghl_data?: { contactPhone?: string; contactName?: string; contactEmail?: string };
            } | null;
            
            let contactName = "Unknown";
            let contactPhone: string | undefined;
            let contactEmail: string | undefined;
            let contactType: CommunicationItem["contact_type"] = "external";
            let contactId = comm.id;

            // Check for Voice AI transcript FIRST - before other matching logic
            if (isVoiceAITranscript(comm.body)) {
              const callerPhone = extractCallerPhoneFromTranscript(comm.body);
              // Extract the caller's actual name from the transcript conversation
              const callerName = extractCallerNameFromTranscript(comm.body);
              // Check if a specific team member was mentioned in the call
              const mentionedMember = extractMentionedTeamMember(comm.body);
              
              // Filter by team member mention when viewing a specific user's inbox
              if (!viewAllInboxes && targetUserId) {
                const targetMemberName = idToName[targetUserId]?.toLowerCase();
                if (mentionedMember) {
                  // Only include if the mentioned member matches the target user
                  if (mentionedMember.toLowerCase() !== targetMemberName) {
                    continue; // Skip this item - it's for a different team member
                  }
                }
              }
              
              // Use the caller's name if found, otherwise use "PeachHaus Receptionist" to indicate it was AI-handled
              contactName = callerName || "PeachHaus Receptionist";
              contactPhone = callerPhone || metadata?.unmatched_phone || metadata?.ghl_data?.contactPhone;
              contactType = "external";
            } else if (comm.lead_id && lead) {
              // Has a linked lead
              contactName = lead.name;
              contactPhone = lead.phone || undefined;
              contactEmail = lead.email || undefined;
              contactType = "lead";
              contactId = comm.lead_id;
            } else if (comm.owner_id) {
              // Skip owner comms here - they're fetched separately
              continue;
            } else if (metadata?.tenant_id) {
              // Tenant match from metadata
              contactName = metadata.tenant_name || "Tenant";
              contactPhone = metadata.tenant_phone;
              contactType = "tenant";
              contactId = metadata.tenant_id;
            } else if (metadata?.unmatched_phone || metadata?.ghl_data?.contactPhone) {
              // External/unmatched contact - try to match to tenant
              const phone = metadata.unmatched_phone || metadata.ghl_data?.contactPhone;
              const normalizedPhone = phone ? normalizePhone(phone) : "";
              const matchedTenant = tenantMap.get(normalizedPhone);
              
              if (matchedTenant) {
                contactName = matchedTenant.name;
                contactPhone = matchedTenant.phone;
                contactEmail = matchedTenant.email || undefined;
                contactType = "tenant";
                contactId = matchedTenant.id;
              } else {
                // Use GHL data for name and email - prioritize actual name over phone
                const ghlName = metadata.ghl_data?.contactName;
                const ghlEmail = metadata.ghl_data?.contactEmail;
                contactName = (ghlName && ghlName !== "Contact") ? ghlName : (metadata.contact_name || "Unknown");
                contactPhone = phone;
                contactEmail = ghlEmail || undefined;
                contactType = "external";
              }
            }
            
            const item: CommunicationItem = {
              id: comm.id,
              type: comm.communication_type as "sms" | "email",
              direction: comm.direction as "inbound" | "outbound",
              body: comm.body,
              subject: comm.subject || undefined,
              created_at: comm.created_at,
              contact_name: contactName,
              contact_phone: contactPhone,
              contact_email: contactEmail,
              contact_type: contactType,
              contact_id: contactId,
              status: comm.status || undefined,
              media_urls: Array.isArray(comm.media_urls) ? comm.media_urls as string[] : undefined,
            };

            if (search) {
              const searchLower = search.toLowerCase();
              if (!item.contact_name.toLowerCase().includes(searchLower) && !item.body.toLowerCase().includes(searchLower)) continue;
            }
            results.push(item);
          }
        }

        // Fetch owner communications - filter by user assignment for non-admin users
        let ownerCommsQuery = supabase
          .from("lead_communications")
          .select(`id, communication_type, direction, body, subject, created_at, status, owner_id, assigned_to, recipient_user_id, property_owners(id, name, email, phone)`)
          .in("communication_type", ["sms", "email"])
          .not("owner_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);
        
        // Filter by user assignment unless viewing all inboxes
        if (!viewAllInboxes && targetUserId) {
          ownerCommsQuery = ownerCommsQuery.or(`assigned_to.eq.${targetUserId},recipient_user_id.eq.${targetUserId},assigned_to.is.null`);
        }
        
        const { data: ownerComms } = await ownerCommsQuery;

        if (ownerComms) {
          for (const comm of ownerComms) {
            const owner = comm.property_owners as { id: string; name: string; email: string | null; phone: string | null } | null;
            const item: CommunicationItem = {
              id: comm.id,
              type: comm.communication_type as "sms" | "email",
              direction: comm.direction as "inbound" | "outbound",
              body: comm.body,
              subject: comm.subject || undefined,
              created_at: comm.created_at,
              contact_name: owner?.name || "Unknown Owner",
              contact_phone: owner?.phone || undefined,
              contact_email: owner?.email || undefined,
              contact_type: "owner",
              contact_id: comm.owner_id || "",
              status: comm.status || undefined,
              owner_id: comm.owner_id || undefined,
            };

            if (search) {
              const searchLower = search.toLowerCase();
              if (!item.contact_name.toLowerCase().includes(searchLower) && !item.body.toLowerCase().includes(searchLower)) continue;
            }
            results.push(item);
          }
        }

        // Fetch email drafts
        const { data: drafts } = await supabase
          .from("email_drafts")
          .select("*")
          .eq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(20);

        if (drafts) {
          for (const draft of drafts) {
            const item: CommunicationItem = {
              id: draft.id, type: "draft", direction: "outbound", body: draft.body, subject: draft.subject,
              created_at: draft.created_at, contact_name: draft.to_name || draft.to_email?.split("@")[0] || "Unknown",
              contact_email: draft.to_email, contact_type: "draft", contact_id: draft.id,
              status: draft.ai_generated ? "AI Draft" : "Draft", is_draft: true, draft_id: draft.id,
            };
            if (search && !item.contact_name.toLowerCase().includes(search.toLowerCase()) && !item.body.toLowerCase().includes(search.toLowerCase())) continue;
            results.push(item);
          }
        }

        // Fetch personal phone messages
        let messagesQuery = supabase.from("user_phone_messages").select("*").order("created_at", { ascending: false }).limit(50);
        if (targetUserId) messagesQuery = messagesQuery.eq("user_id", targetUserId);

        const { data: personalMessages } = await messagesQuery;
        if (personalMessages) {
          // Get all unique phone numbers to look up contacts
          const uniquePhones = new Set<string>();
          personalMessages.forEach(msg => {
            const phone = msg.direction === "inbound" ? msg.from_number : msg.to_number;
            if (phone) uniquePhones.add(phone);
          });
          
          // Lookup leads, owners, and tenants by phone numbers (using normalized comparison)
          const phoneContactMap: Record<string, { name: string; type: 'lead' | 'owner' | 'tenant'; id: string; email?: string | null }> = {};
          
          if (uniquePhones.size > 0) {
            const phoneArray = Array.from(uniquePhones);
            const normalizedPhoneArray = phoneArray.map(p => normalizePhone(p));
            
            // Lookup leads
            const { data: matchedLeads } = await supabase
              .from("leads")
              .select("id, name, phone, email")
              .not("phone", "is", null);
            
            if (matchedLeads) {
              matchedLeads.forEach(lead => {
                if (lead.phone) {
                  const normalizedLeadPhone = normalizePhone(lead.phone);
                  // Check if any of our phone numbers match (normalized)
                  phoneArray.forEach(originalPhone => {
                    if (normalizePhone(originalPhone) === normalizedLeadPhone) {
                      phoneContactMap[originalPhone] = { name: lead.name, type: 'lead', id: lead.id, email: lead.email };
                    }
                  });
                }
              });
            }
            
            // Lookup owners
            const { data: matchedOwners } = await supabase
              .from("property_owners")
              .select("id, name, phone, email")
              .not("phone", "is", null);
            
            if (matchedOwners) {
              matchedOwners.forEach(owner => {
                if (owner.phone) {
                  const normalizedOwnerPhone = normalizePhone(owner.phone);
                  phoneArray.forEach(originalPhone => {
                    if (normalizePhone(originalPhone) === normalizedOwnerPhone && !phoneContactMap[originalPhone]) {
                      phoneContactMap[originalPhone] = { name: owner.name, type: 'owner', id: owner.id, email: owner.email };
                    }
                  });
                }
              });
            }
            
            // Lookup mid-term booking tenants
            const { data: matchedTenants } = await supabase
              .from("mid_term_bookings")
              .select("id, tenant_name, tenant_phone, tenant_email")
              .not("tenant_phone", "is", null);
            
            if (matchedTenants) {
              matchedTenants.forEach(tenant => {
                if (tenant.tenant_phone) {
                  const normalizedTenantPhone = normalizePhone(tenant.tenant_phone);
                  phoneArray.forEach(originalPhone => {
                    if (normalizePhone(originalPhone) === normalizedTenantPhone && !phoneContactMap[originalPhone]) {
                      phoneContactMap[originalPhone] = { name: tenant.tenant_name, type: 'tenant', id: tenant.id, email: tenant.tenant_email };
                    }
                  });
                }
              });
            }
          }
          
          for (const msg of personalMessages) {
            const contactNumber = msg.direction === "inbound" ? msg.from_number : msg.to_number;
            const matchedContact = contactNumber ? phoneContactMap[contactNumber] : null;
            
            const item: CommunicationItem = {
              id: msg.id, 
              type: "personal_sms", 
              direction: msg.direction as "inbound" | "outbound",
              body: msg.body || "", 
              created_at: msg.created_at, 
              contact_name: matchedContact?.name || contactNumber || "Unknown",
              contact_phone: contactNumber || undefined, 
              contact_email: matchedContact?.email || undefined,
              contact_type: matchedContact ? matchedContact.type : "personal", 
              contact_id: matchedContact ? matchedContact.id : msg.id,
              status: msg.status || undefined, 
              is_resolved: msg.is_resolved || false,
              owner_id: matchedContact?.type === 'owner' ? matchedContact.id : undefined,
            };
            if (search && !item.contact_name.toLowerCase().includes(search.toLowerCase()) && !item.body.toLowerCase().includes(search.toLowerCase())) continue;
            results.push(item);
          }
        }
      }

      if (fetchCalls) {
        // Fetch lead call communications
        const { data: callComms } = await supabase
          .from("lead_communications")
          .select(`id, communication_type, direction, body, subject, created_at, status, lead_id, owner_id, ghl_contact_id, metadata, leads(id, name, phone, email)`)
          .eq("communication_type", "call")
          .not("lead_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);

        if (callComms) {
          for (const comm of callComms) {
            const lead = comm.leads as { id: string; name: string; phone: string | null; email: string | null } | null;
            results.push({
              id: comm.id, type: "call", direction: comm.direction as "inbound" | "outbound",
              body: comm.body || "Call", created_at: comm.created_at, contact_name: lead?.name || "Unknown",
              contact_phone: lead?.phone || undefined, contact_email: lead?.email || undefined,
              contact_type: "lead", contact_id: comm.lead_id || "", status: comm.status || undefined,
            });
          }
        }

        // Fetch owner call communications
        const { data: ownerCallComms } = await supabase
          .from("lead_communications")
          .select(`id, communication_type, direction, body, subject, created_at, status, owner_id, ghl_contact_id, metadata, property_owners(id, name, email, phone)`)
          .eq("communication_type", "call")
          .not("owner_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);

        if (ownerCallComms) {
          for (const comm of ownerCallComms) {
            const owner = comm.property_owners as { id: string; name: string; email: string | null; phone: string | null } | null;
            results.push({
              id: comm.id, type: "call", direction: comm.direction as "inbound" | "outbound",
              body: comm.body || "Call", created_at: comm.created_at, contact_name: owner?.name || "Unknown Owner",
              contact_phone: owner?.phone || undefined, contact_email: owner?.email || undefined,
              contact_type: "owner", contact_id: comm.owner_id || "", status: comm.status || undefined,
              owner_id: comm.owner_id || undefined,
            });
          }
        }

        // Fetch UNMATCHED calls (no lead_id or owner_id) - these are synced from GHL but not matched yet
        const { data: unmatchedCallComms } = await supabase
          .from("lead_communications")
          .select(`id, communication_type, direction, body, subject, created_at, status, ghl_contact_id, metadata`)
          .eq("communication_type", "call")
          .is("lead_id", null)
          .is("owner_id", null)
          .order("created_at", { ascending: false })
          .limit(50);

        if (unmatchedCallComms) {
          for (const comm of unmatchedCallComms) {
            // Extract contact name from metadata if available - check matchedName first (from GHL sync)
            const metadata = comm.metadata as { 
              ghl_data?: { 
                contactName?: string; 
                contactPhone?: string;
                matchedName?: string;
                fromNumber?: string;
              } 
            } | null;
            const body = comm.body || "";
            
            // Check if this is a Voice AI / PeachHaus Receptionist call (uses bot:/human: format)
            const isVoiceAI = body.includes("bot:") && body.includes("human:");
            
            // Priority for name extraction:
            // 1. matchedName from GHL metadata (most reliable - GHL's own matching)
            // 2. Extract from transcript (human:Name pattern)
            // 3. contactName from GHL metadata
            // 4. Fallback based on whether it's Voice AI or not
            let contactName = "";
            
            // Check matchedName from GHL first (most reliable source)
            const matchedName = metadata?.ghl_data?.matchedName;
            if (matchedName && matchedName !== "Unknown" && matchedName !== "Contact" && 
                !matchedName.match(/^[\d\s\-\(\)\+\.]+$/) && 
                matchedName.toLowerCase() !== "just connect" &&
                matchedName.toLowerCase() !== "sure") {
              contactName = matchedName;
            }
            
            // If no matchedName, try extracting from transcript
            if (!contactName && isVoiceAI) {
              const extractedName = extractCallerNameFromTranscript(body);
              if (extractedName) {
                contactName = extractedName;
              }
            }
            
            // If still no name, try contactName from metadata
            if (!contactName && metadata?.ghl_data?.contactName && 
                metadata.ghl_data.contactName !== "Unknown" && 
                metadata.ghl_data.contactName !== "Contact") {
              contactName = metadata.ghl_data.contactName;
            }
            
            // Final fallback
            if (!contactName) {
              contactName = isVoiceAI ? "AI Call" : "Caller";
            }
            
            const contactPhone = metadata?.ghl_data?.contactPhone || metadata?.ghl_data?.fromNumber || undefined;
            
            results.push({
              id: comm.id, type: "call", direction: comm.direction as "inbound" | "outbound",
              body: body || "Call", created_at: comm.created_at, contact_name: contactName,
              contact_phone: contactPhone, contact_type: "external", contact_id: comm.id, 
              status: comm.status || undefined,
            });
          }
        }

        let callsQuery = supabase.from("user_phone_calls").select("*").order("started_at", { ascending: false }).limit(50);
        if (targetUserId) callsQuery = callsQuery.eq("user_id", targetUserId);

        const { data: personalCalls } = await callsQuery;
        if (personalCalls) {
          for (const call of personalCalls) {
            const contactNumber = call.direction === "inbound" ? call.from_number : call.to_number;
            results.push({
              id: call.id, type: "personal_call", direction: call.direction as "inbound" | "outbound",
              body: call.transcription || (call.direction === "inbound" ? "Incoming call" : "Outgoing call"),
              created_at: call.started_at, contact_name: contactNumber, contact_phone: contactNumber,
              contact_type: "personal", contact_id: call.id, status: call.status || undefined,
            });
          }
        }
      }

      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return results;
    },
  });

  // Trigger phone lookups for unknown contacts - more aggressive matching
  useEffect(() => {
    if (!communications || communications.length === 0) return;
    
    // Find contacts that need name lookup
    const unknownPhones = communications
      .filter(comm => {
        if (!comm.contact_phone) return false;
        
        const name = comm.contact_name?.trim() || "";
        
        // Check if we should look up this contact:
        // 1. Name is "Unknown" or similar generic fallback
        // 2. Name looks like a phone number
        // 3. Name is very short (likely first name only like "Hector")
        // 4. Name starts with a "+" (phone number format)
        const isUnknown = !name || 
          name === "Unknown" || 
          name === "Unknown Caller" ||
          name === "Unknown Contact" ||
          name === "AI Call" ||
          name === "Caller" ||
          name.toLowerCase() === "unknown";
          
        const isPhoneFormat = name.match(/^[\d\s\-\(\)\+\.]+$/) || 
          name.startsWith("+");
          
        // Single word names under 15 chars might be first name only
        const isSingleName = name.split(" ").length === 1 && 
          name.length < 15 && 
          !name.includes("@");
        
        return isUnknown || isPhoneFormat || isSingleName;
      })
      .map(comm => comm.contact_phone!)
      .filter((phone, index, self) => self.indexOf(phone) === index); // Unique

    if (unknownPhones.length > 0) {
      console.log(`[InboxView] Found ${unknownPhones.length} contacts needing lookup`);
      // Trigger batch lookup (limited to 10)
      lookupPhones(unknownPhones.slice(0, 10));
    }
  }, [communications, lookupPhones]);

  // Enhance communications with looked up names, emails, priority, and status
  const enhancedCommunications = useMemo(() => {
    return communications.map(comm => {
      let enhanced = { ...comm };
      
      // Enhance with looked up name and email from phone lookup
      if (comm.contact_phone) {
        const normalized = normalizePhone(comm.contact_phone);
        const lookedUpData = lookupCache[normalized];
        
        if (lookedUpData) {
          // Enhance name
          if (lookedUpData.name || lookedUpData.callerName) {
            const lookedUpName = lookedUpData.name || lookedUpData.callerName;
            const currentName = comm.contact_name?.trim() || "";
            
            // Replace if current name is unknown, a phone number, or a generic fallback
            const shouldReplace = 
              !currentName ||
              currentName === "Unknown" || 
              currentName === "Unknown Caller" ||
              currentName === "AI Call" ||
              currentName === "Caller" ||
              currentName.match(/^[\d\s\-\(\)\+\.]+$/) ||
              currentName.startsWith("+") ||
              // Also replace single word names with full names from lookup
              (currentName.split(" ").length === 1 && lookedUpName && lookedUpName.split(" ").length > 1);
            
            if (shouldReplace && lookedUpName) {
              enhanced.contact_name = lookedUpName;
            }
          }
          
          // Enhance email if not present
          if (!enhanced.contact_email && lookedUpData.email) {
            enhanced.contact_email = lookedUpData.email;
          }
        }
      }
      
      // Add priority detection
      enhanced.priority = detectPriority(comm.body, comm.direction, comm.contact_type);
      
      // Add conversation status from lookup OR local optimistic override
      const key = comm.contact_phone 
        ? normalizePhone(comm.contact_phone) 
        : comm.contact_email?.toLowerCase();
      
      // Check local optimistic override first (for instant UI updates)
      const localOverride = key ? localStatusOverrides[key] : undefined;
      const statusRecord = key ? statusLookup.get(key) : null;
      
      if (localOverride) {
        // Use optimistic local state
        enhanced.conversation_status = localOverride;
      } else if (statusRecord) {
        enhanced.conversation_status = statusRecord.status;
        enhanced.snoozed_until = statusRecord.snoozed_until;
        
        // Check if snooze has expired
        if (statusRecord.status === "snoozed" && statusRecord.snoozed_until) {
          if (isBefore(new Date(statusRecord.snoozed_until), new Date())) {
            enhanced.conversation_status = "open";
          }
        }
        
        // IMPORTANT: If conversation was marked as done but we have a NEW inbound message,
        // automatically reopen it. This handles cases where someone responds after we marked done.
        if (statusRecord.status === "done" && comm.direction === "inbound" && statusRecord.updated_at) {
          // Compare message timestamp to when the conversation was last updated
          const messageTime = new Date(comm.created_at);
          const statusUpdatedTime = new Date(statusRecord.updated_at);
          if (messageTime > statusUpdatedTime) {
            // This inbound message came AFTER the conversation was marked done - reopen it
            enhanced.conversation_status = "open";
          }
        }
      } else {
        // Default to open if inbound and not resolved, otherwise done
        enhanced.conversation_status = (comm.direction === "inbound" && !comm.is_resolved) ? "open" : "done";
      }
      
      return enhanced;
    });
  }, [communications, lookupCache, statusLookup, localStatusOverrides]);

  // Selected Gmail email state
  const [selectedGmailEmail, setSelectedGmailEmail] = useState<GmailEmail | null>(null);
  
  // Track read emails in localStorage (persists across refetches)
  const [readGmailIds, setReadGmailIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('readGmailIds');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Fetch email statuses from database
  const { data: gmailEmailStatuses = [] } = useQuery({
    queryKey: ["gmail-email-statuses", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];
      const { data, error } = await supabase
        .from("gmail_email_status")
        .select("*")
        .eq("user_id", currentUserId);
      if (error) throw error;
      return data;
    },
    enabled: !!currentUserId,
  });

  // Create lookup maps for email statuses
  const doneGmailIds = useMemo(() => {
    const set = new Set<string>();
    gmailEmailStatuses.forEach(status => {
      if (status.status === "done") set.add(status.gmail_message_id);
    });
    return set;
  }, [gmailEmailStatuses]);

  const snoozedGmailEmails = useMemo(() => {
    const map = new Map<string, string>();
    gmailEmailStatuses.forEach(status => {
      if (status.status === "snoozed" && status.snoozed_until) {
        // Only count as snoozed if snooze time hasn't passed
        if (new Date(status.snoozed_until) > new Date()) {
          map.set(status.gmail_message_id, status.snoozed_until);
        }
      }
    });
    return map;
  }, [gmailEmailStatuses]);

  // Mutation for updating email status in database
  const updateGmailStatusMutation = useMutation({
    mutationFn: async ({ 
      emailId, 
      status, 
      snoozedUntil 
    }: { 
      emailId: string; 
      status: "open" | "done" | "snoozed"; 
      snoozedUntil?: Date;
    }) => {
      if (!currentUserId) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("gmail_email_status")
        .upsert({
          gmail_message_id: emailId,
          user_id: currentUserId,
          status,
          snoozed_until: snoozedUntil?.toISOString() || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'gmail_message_id,user_id'
        });
      
      if (error) throw error;
      return { emailId, status };
    },
    onSuccess: (_, variables) => {
      const labels: Record<string, string> = {
        done: "Email marked as done",
        open: "Email reopened",
        snoozed: `Email snoozed until ${variables.snoozedUntil ? format(variables.snoozedUntil, "MMM d, h:mm a") : "later"}`,
      };
      toast.success(labels[variables.status]);
      queryClient.invalidateQueries({ queryKey: ["gmail-email-statuses"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update email: ${error.message}`);
    },
  });

  // Mark email as done/handled
  const markEmailAsDone = useCallback((emailId: string) => {
    updateGmailStatusMutation.mutate({ emailId, status: "done" });
  }, [updateGmailStatusMutation]);

  // Unmark email as done (reopen)
  const unmarkEmailAsDone = useCallback((emailId: string) => {
    updateGmailStatusMutation.mutate({ emailId, status: "open" });
  }, [updateGmailStatusMutation]);

  // Snooze email
  const handleGmailSnooze = useCallback((emailId: string, hours: number) => {
    const snoozedUntil = hours === 24 ? addDays(new Date(), 1) : addHours(new Date(), hours);
    updateGmailStatusMutation.mutate({ emailId, status: "snoozed", snoozedUntil });
  }, [updateGmailStatusMutation]);

  // Mark email as read when selected - persists to localStorage
  const handleSelectGmailEmail = (email: GmailEmail) => {
    // Add to localStorage read set
    setReadGmailIds(prev => {
      const updated = new Set(prev);
      updated.add(email.id);
      try {
        localStorage.setItem('readGmailIds', JSON.stringify([...updated]));
      } catch {
        // localStorage full, ignore
      }
      return updated;
    });
    setSelectedGmailEmail(email);
  };

  // Keyboard navigation helpers
  const sortedEmails = useMemo(() => {
    return [...filteredGmailEmails]
      .filter(email => !search || search === " " || email.subject.toLowerCase().includes(search.toLowerCase()) || email.fromName.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredGmailEmails, search]);

  const handleKeyNavigateUp = useCallback(() => {
    if (activeTab === "emails") {
      setSelectedGmailIndex(prev => Math.max(0, prev - 1));
      const email = sortedEmails[Math.max(0, selectedGmailIndex - 1)];
      if (email) setSelectedGmailEmail(email);
    } else {
      setSelectedCommIndex(prev => Math.max(0, prev - 1));
    }
  }, [activeTab, sortedEmails, selectedGmailIndex]);

  const handleKeyNavigateDown = useCallback(() => {
    if (activeTab === "emails") {
      const maxIdx = sortedEmails.length - 1;
      setSelectedGmailIndex(prev => Math.min(maxIdx, prev + 1));
      const email = sortedEmails[Math.min(maxIdx, selectedGmailIndex + 1)];
      if (email) setSelectedGmailEmail(email);
    } else {
      setSelectedCommIndex(prev => Math.min(99, prev + 1)); // Max 100 items
    }
  }, [activeTab, sortedEmails, selectedGmailIndex]);

  const handleKeyOpen = useCallback(() => {
    if (activeTab === "emails" && selectedGmailEmail) {
      // Already selected, just ensure it's visible
      setShowMobileDetail(true);
    } else if (selectedMessage) {
      setShowMobileDetail(true);
    }
  }, [activeTab, selectedGmailEmail, selectedMessage]);

  const handleKeyReply = useCallback(() => {
    if (activeTab === "emails" && selectedGmailEmail) {
      setShowEmailActionModal(true);
    } else if (selectedMessage?.contact_phone) {
      setShowSmsReply(true);
    }
  }, [activeTab, selectedGmailEmail, selectedMessage]);

  const handleKeyMarkDone = useCallback(() => {
    if (activeTab === "emails" && selectedGmailEmail) {
      if (doneGmailIds.has(selectedGmailEmail.id)) {
        unmarkEmailAsDone(selectedGmailEmail.id);
      } else {
        markEmailAsDone(selectedGmailEmail.id);
      }
    } else if (selectedMessage) {
      handleMarkDone(selectedMessage);
    }
  }, [activeTab, selectedGmailEmail, selectedMessage, doneGmailIds, markEmailAsDone, unmarkEmailAsDone, handleMarkDone]);

  const handleKeySnooze = useCallback(() => {
    if (activeTab === "emails" && selectedGmailEmail) {
      handleGmailSnooze(selectedGmailEmail.id, 1); // Snooze 1 hour by default
    } else if (selectedMessage) {
      handleSnooze(selectedMessage, 1); // Snooze 1 hour by default
    }
  }, [activeTab, selectedGmailEmail, selectedMessage, handleGmailSnooze, handleSnooze]);

  const handleKeyNotes = useCallback(() => {
    if (selectedMessage) {
      setShowNotes(true);
    }
  }, [selectedMessage]);

  const handleKeyAssign = useCallback(() => {
    // Assignment is handled via dropdown, just focus the message
    if (selectedMessage) {
      setShowMobileDetail(true);
    }
  }, [selectedMessage]);

  const handleKeyClose = useCallback(() => {
    setSelectedMessage(null);
    setSelectedGmailEmail(null);
    setShowMobileDetail(false);
  }, []);

  const handleKeySearch = useCallback(() => {
    setSearch(" "); // Trigger search bar to open
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  // Register keyboard shortcuts
  const keyboardShortcuts = useInboxKeyboardShortcuts({
    onNavigateUp: handleKeyNavigateUp,
    onNavigateDown: handleKeyNavigateDown,
    onOpen: handleKeyOpen,
    onReply: handleKeyReply,
    onMarkDone: handleKeyMarkDone,
    onSnooze: handleKeySnooze,
    onNotes: handleKeyNotes,
    onAssign: handleKeyAssign,
    onClose: handleKeyClose,
    onSearch: handleKeySearch,
    selectedIndex: activeTab === "emails" ? selectedGmailIndex : selectedCommIndex,
    itemCount: activeTab === "emails" ? sortedEmails.length : 100,
    hasSelection: activeTab === "emails" ? !!selectedGmailEmail : !!selectedMessage,
    enabled: !showSmsReply && !showEmailReply && !showNotes && !showContactInfo && !isEditingDraft,
  });

  // Listen for ? key to show keyboard help
  useEffect(() => {
    const handleQuestionMark = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && !target.isContentEditable) {
          e.preventDefault();
          setShowKeyboardHelp(prev => !prev);
        }
      }
    };
    document.addEventListener("keydown", handleQuestionMark);
    return () => document.removeEventListener("keydown", handleQuestionMark);
  }, []);

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const getMessagePreview = (comm: CommunicationItem) => {
    // Check for Voice AI transcripts first - show summary instead of full transcript
    if (isVoiceAITranscript(comm.body)) {
      const summary = extractCallSummaryFromTranscript(comm.body);
      if (summary) {
        return "🤖 " + decodeHtmlEntities(summary.slice(0, 100)) + (summary.length > 100 ? "..." : "");
      }
      return "🤖 Voice AI transcript received";
    }
    // For calls, show transcript or direction with icon prefix
    if (comm.type === "call" || comm.type === "personal_call") {
      if (comm.body && comm.body.length > 10 && comm.body !== "Call" && !comm.body.startsWith("Phone call") && !comm.body.startsWith("Incoming call") && !comm.body.startsWith("Outgoing call")) {
        return "📞 " + decodeHtmlEntities(comm.body.slice(0, 100)) + (comm.body.length > 100 ? "..." : "");
      }
      return comm.direction === "inbound" ? "📞 Incoming call" : "📞 Outgoing call";
    }
    // For emails, show subject with icon - decode HTML entities
    if (comm.type === "email" && comm.subject) {
      return "📧 " + decodeHtmlEntities(comm.subject);
    }
    if (comm.type === "draft") return `📝 Draft: ${decodeHtmlEntities(comm.subject) || "No subject"}`;
    // For SMS with images but no/empty text
    if ((!comm.body || comm.body === "SMS message" || comm.body.trim().length === 0) && comm.media_urls?.length) {
      return `📷 Image message (${comm.media_urls.length} attachment${comm.media_urls.length > 1 ? 's' : ''})`;
    }
    // Handle empty or placeholder SMS bodies
    if (!comm.body || comm.body === "SMS message" || comm.body.trim().length === 0) {
      return comm.direction === "inbound" ? "Received message" : "Sent message";
    }
    // Decode HTML entities in message body preview
    return decodeHtmlEntities(comm.body.slice(0, 120)) + (comm.body.length > 120 ? "..." : "");
  };

  // Mobile: show list or detail based on selection
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  
  // Fetch conversation thread for selected contact (all SMS messages from same contact)
  const { data: conversationThread = [] } = useQuery({
    queryKey: ["conversation-thread", selectedMessage?.id, selectedMessage?.contact_id, selectedMessage?.contact_phone, selectedMessage?.contact_type, selectedMessage?.owner_id],
    queryFn: async () => {
      if (!selectedMessage) return [];
      
      // For leads, fetch all communications for the same lead_id AND user_phone_messages by phone
      if (selectedMessage.contact_type === "lead" && selectedMessage.contact_id) {
        // Always fetch all types for unified view
        const commTypes = ["sms", "call", "email"];
        
        // Fetch from lead_communications
        const { data: leadComms, error } = await supabase
          .from("lead_communications")
          .select("id, communication_type, direction, body, subject, created_at, status, media_urls, call_duration, call_recording_url")
          .eq("lead_id", selectedMessage.contact_id)
          .in("communication_type", commTypes)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        
        const leadMessages = (leadComms || []).map(comm => {
          let body = comm.body;
          if (!body || body.trim().length === 0 || body === "SMS message") {
            body = comm.direction === "inbound" ? "(Received message)" : "(Sent message)";
          }
          return {
            id: comm.id,
            type: comm.communication_type,
            direction: comm.direction,
            body,
            subject: comm.subject,
            created_at: comm.created_at,
            media_urls: comm.media_urls || [],
            call_duration: comm.call_duration,
            call_recording_url: comm.call_recording_url,
          };
        });
        
        // Also fetch from user_phone_messages if we have a phone number
        let userMessages: { id: string; type: string; direction: string; body: string; created_at: string; media_urls: string[] }[] = [];
        if (selectedMessage.contact_phone) {
          const phone = selectedMessage.contact_phone;
          const { data: userMsgs } = await supabase
            .from("user_phone_messages")
            .select("id, direction, body, created_at, media_urls")
            .or(`from_number.eq.${phone},to_number.eq.${phone}`)
            .order("created_at", { ascending: false });
          
          if (userMsgs) {
            userMessages = userMsgs.map(msg => ({
              id: msg.id,
              type: "sms",
              direction: msg.direction,
              body: msg.body || "(No content)",
              created_at: msg.created_at,
              media_urls: (Array.isArray(msg.media_urls) ? msg.media_urls : []) as string[],
            }));
          }
        }
        
        // Combine and deduplicate
        const allMsgs = [...leadMessages, ...userMessages];
        allMsgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        // Deduplicate messages within 5 seconds with same body
        const deduped: typeof allMsgs = [];
        for (const msg of allMsgs) {
          const isDuplicate = deduped.some(existing => {
            const timeDiff = Math.abs(new Date(existing.created_at).getTime() - new Date(msg.created_at).getTime());
            return timeDiff < 5000 && existing.body === msg.body && existing.direction === msg.direction;
          });
          if (!isDuplicate) {
            deduped.push(msg);
          }
        }
        
        return deduped;
      }
      
      // For owners, fetch all communications for the same owner_id
      if (selectedMessage.contact_type === "owner" && selectedMessage.owner_id) {
        const { data, error } = await supabase
          .from("lead_communications")
          .select("id, communication_type, direction, body, subject, created_at, status, media_urls")
          .eq("owner_id", selectedMessage.owner_id)
          .in("communication_type", ["sms", "call", "email"])
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        return (data || []).map(comm => {
          // Only use placeholder if body is truly empty or the exact placeholder text
          const body = (!comm.body || comm.body.trim().length === 0 || comm.body === "SMS message")
            ? (comm.direction === "inbound" ? "(Received message)" : "(Sent message)")
            : comm.body;
          return {
            id: comm.id,
            type: comm.communication_type,
            direction: comm.direction,
            body,
            created_at: comm.created_at,
            media_urls: (Array.isArray(comm.media_urls) ? comm.media_urls : []) as string[],
          };
        });
      }
      
      // For personal SMS, tenants, or external contacts - fetch by phone number
      if (selectedMessage.contact_phone || selectedMessage.contact_type === "tenant" || selectedMessage.contact_type === "external") {
        const phone = selectedMessage.contact_phone;
        const normalizedPhone = phone ? normalizePhone(phone) : "";
        const tenantId = selectedMessage.contact_type === "tenant" ? selectedMessage.contact_id : null;
        
        // Fetch from user_phone_messages using normalized phone matching
        const { data: userMsgs } = phone ? await supabase
          .from("user_phone_messages")
          .select("id, direction, body, created_at, media_urls, from_number, to_number")
          .order("created_at", { ascending: false }) : { data: [] };
        
        // Filter by normalized phone
        const filteredUserMsgs = (userMsgs || []).filter(msg => {
          const fromNorm = msg.from_number ? normalizePhone(msg.from_number) : "";
          const toNorm = msg.to_number ? normalizePhone(msg.to_number) : "";
          return fromNorm === normalizedPhone || toNorm === normalizedPhone;
        });
        
        // Also fetch from lead_communications by searching in metadata for this phone/tenant
        // Include ALL communication types for unified thread
        const { data: leadComms } = await supabase
          .from("lead_communications")
          .select("id, communication_type, direction, body, subject, created_at, media_urls, metadata, ghl_contact_id, call_duration, call_recording_url")
          .in("communication_type", ["sms", "call", "email"])
          .order("created_at", { ascending: false });
        
        // Check metadata for phone or tenant_id matching
        const filteredLeadComms = (leadComms || []).filter(comm => {
          if (selectedMessage.contact_type === "lead" && selectedMessage.contact_id) {
            // For leads, we already fetched above, so skip here
            return false;
          }
          // Check if metadata contains this phone number or tenant_id
          const metadata = comm.metadata as { 
            unmatched_phone?: string; 
            tenant_phone?: string; 
            tenant_id?: string;
            contact_name?: string;
            ghl_data?: { contactPhone?: string; contactName?: string } 
          } | null;
          
          // Match by tenant_id if we have one
          if (tenantId && metadata?.tenant_id === tenantId) {
            return true;
          }
          
          // Match by phone number in metadata - check all possible phone locations
          if (normalizedPhone) {
            const phonesToCheck = [
              metadata?.unmatched_phone,
              metadata?.tenant_phone,
              metadata?.ghl_data?.contactPhone,
            ].filter(Boolean).map(p => p!.replace(/[^\d]/g, "").slice(-10));
            
            if (phonesToCheck.includes(normalizedPhone)) {
              return true;
            }
          }
          return false;
        });
        
        // Combine all messages
        const allMsgs = [
          ...filteredUserMsgs.map(msg => ({
            id: msg.id,
            type: "sms" as const,
            direction: msg.direction as "inbound" | "outbound",
            body: msg.body || "(No content)",
            created_at: msg.created_at,
            media_urls: (Array.isArray(msg.media_urls) ? msg.media_urls : []) as string[],
          })),
          ...filteredLeadComms.map(msg => ({
            id: msg.id,
            type: msg.communication_type as "sms" | "call" | "email",
            direction: msg.direction as "inbound" | "outbound",
            body: msg.body || "(No content)",
            subject: msg.subject || undefined,
            created_at: msg.created_at,
            media_urls: (Array.isArray(msg.media_urls) ? msg.media_urls : []) as string[],
            call_duration: msg.call_duration,
            call_recording_url: msg.call_recording_url,
          })),
        ];
        
        // Sort by timestamp
        allMsgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        // Deduplicate messages that are within 5 seconds and have the same body
        const deduped: typeof allMsgs = [];
        for (const msg of allMsgs) {
          const isDuplicate = deduped.some(existing => {
            const timeDiff = Math.abs(new Date(existing.created_at).getTime() - new Date(msg.created_at).getTime());
            return timeDiff < 5000 && existing.body === msg.body && existing.direction === msg.direction;
          });
          if (!isDuplicate) {
            deduped.push(msg);
          }
        }
        
        return deduped;
      }
      
      // Fallback: just show the selected message
      return [{
        id: selectedMessage.id,
        type: selectedMessage.type,
        direction: selectedMessage.direction,
        body: selectedMessage.body || "(No content)",
        created_at: selectedMessage.created_at,
      }];
    },
    enabled: !!selectedMessage,
  });


  // No auto-scroll needed - newest messages are at the top now

  // Group communications by contact (for "All" tab - show only latest message per contact)
  // Then group those by date for date separators
  // Now includes Gmail emails merged with SMS/Calls, filtered by selectedEmailInboxView
  const groupedByContact = useMemo(() => {
    if (activeTab !== "all") return null;
    
    const contactMap = new Map<string, CommunicationItem[]>();
    
    // Determine which user ID to filter for based on selectedEmailInboxView
    let filterUserId: string | null = null;
    if (selectedEmailInboxView === "my-inbox" && currentUserId) {
      filterUserId = currentUserId;
    } else if (selectedEmailInboxView !== "all" && selectedEmailInboxView !== "unassigned") {
      // Specific user ID selected
      filterUserId = selectedEmailInboxView;
    }
    
    // Get the personal phone numbers for the selected user
    const selectedUserPhones = filterUserId 
      ? userPhoneAssignments
          .filter(a => a.user_id === filterUserId && a.phone_type === "personal")
          .map(a => normalizePhone(a.phone_number))
      : [];
    
    // Get all company phone numbers (shared across users)
    const companyPhones = userPhoneAssignments
      .filter(a => a.phone_type === "company")
      .map(a => normalizePhone(a.phone_number));
    
    // Apply filter based on active filter AND inbox view
    const filteredComms = enhancedCommunications.filter(c => {
      // Filter by contact type
      if (activeFilter === "owners" && c.contact_type !== "owner") return false;
      
      // Filter by conversation status
      if (activeFilter === "open" && c.conversation_status !== "open") return false;
      if (activeFilter === "snoozed" && c.conversation_status !== "snoozed") return false;
      if (activeFilter === "done" && c.conversation_status !== "done") return false;
      if (activeFilter === "awaiting" && c.conversation_status !== "awaiting") return false;
      
      // Filter by priority
      if (activeFilter === "urgent" && c.priority !== "urgent" && c.priority !== "important") return false;
      
      // Filter by unread (inbound + not resolved)
      if (activeFilter === "unread" && (c.direction !== "inbound" || c.is_resolved)) return false;
      
      // Filter SMS by inbox view (personal phone assignments)
      // For "all" view (admin only), show everything
      // For specific user or "my-inbox", show company line messages + personal line messages for that user
      if (selectedEmailInboxView !== "all" && filterUserId) {
        // This is SMS/call from lead_communications - show for all users since it's the shared line
        // Personal phone messages are already filtered in the query
        // For the shared business line, show to all users
        // The filtering is done by type: personal_sms/personal_call are user-specific
        if (c.type === "personal_sms" || c.type === "personal_call") {
          // Personal messages are already filtered by user in the query (line 1037)
          // They should show only for the user who owns them
          // This is already handled, but let's double-check by matching the phone
          // For now, include all personal messages since query already filters by user
        }
        // Company SMS (type: "sms" or "call") go to everyone
      }
      
      return true;
    });
    
    // Add SMS/Call communications
    for (const comm of filteredComms) {
      // Create unique key based on contact phone, email, or id
      const key = comm.contact_phone ? normalizePhone(comm.contact_phone) : 
                  comm.contact_email || comm.contact_id;
      const existing = contactMap.get(key) || [];
      existing.push(comm);
      contactMap.set(key, existing);
    }
    
    // Convert Gmail emails to CommunicationItem format and add to the map
    // Only include if filter allows (skip for owner filter, status filters that don't match)
    if (activeFilter === "all" || activeFilter === "open" || activeFilter === "unread") {
      const filteredEmails = filteredGmailEmails.filter(email => {
        // Skip done emails if filtering for open
        if (activeFilter === "open" && doneGmailIds.has(email.id)) return false;
        // For unread filter, only show unread emails
        if (activeFilter === "unread" && (!email.labelIds?.includes('UNREAD') || readGmailIds.has(email.id))) return false;
        return true;
      });
      
      for (const email of filteredEmails) {
        const isDone = doneGmailIds.has(email.id);
        const isUnread = email.labelIds?.includes('UNREAD') && !readGmailIds.has(email.id);
        
        // Get AI insights for this email
        const insight = emailInsightsMap.get(email.id);
        const isPromotional = insight?.category === "promotional" || insight?.category === "newsletter";
        const isActionRequired = insight?.action_required === true;
        const aiPriority = insight?.priority as string | undefined;
        
        // Determine priority based on AI insights
        let emailPriority: ConversationPriority = "normal";
        if (isActionRequired || aiPriority === "urgent" || aiPriority === "high") {
          emailPriority = "urgent";
        } else if (aiPriority === "important") {
          emailPriority = "important";
        } else if (isPromotional) {
          emailPriority = "low";
        }
        
        // Promotional emails should automatically appear as "done" (green + faded)
        // This declutters the inbox by visually de-emphasizing marketing emails
        const effectiveStatus: ConversationStatusType = isDone ? "done" : (isPromotional ? "done" : "open");
        
        const emailAsComm: CommunicationItem = {
          id: `email-${email.id}`,
          type: "email",
          direction: "inbound",
          body: email.snippet || "",
          subject: email.subject,
          created_at: email.date,
          contact_name: email.fromName || email.from?.split('@')[0] || "Unknown",
          contact_email: email.from,
          contact_type: "email",
          contact_id: email.id,
          is_resolved: !isUnread,
          conversation_status: effectiveStatus,
          priority: emailPriority,
          gmail_email: email, // Store reference to original email for rendering
        };
        
        // Use email address as key for grouping
        const key = email.from?.toLowerCase() || email.id;
        const existing = contactMap.get(key) || [];
        existing.push(emailAsComm);
        contactMap.set(key, existing);
      }
    }
    
    // Return only the latest message per contact, sorted by priority then date
    const sorted = Array.from(contactMap.values())
      .map(messages => messages.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]);
    
    // Sort: open/awaiting at top (unfaded), then snoozed/done at bottom (faded)
    // Within each group, sort by priority then by date
    // Promotional/low priority items sink to bottom within their status group
    const priorityOrder: Record<ConversationPriority, number> = { urgent: 0, important: 1, normal: 2, low: 4 };
    const statusOrder: Record<string, number> = { open: 0, awaiting: 1, snoozed: 2, done: 3, archived: 4 };
    return sorted.sort((a, b) => {
      // First sort by status (open/awaiting at top, snoozed/done at bottom)
      const aStatus = statusOrder[a.conversation_status || "open"] ?? 2;
      const bStatus = statusOrder[b.conversation_status || "open"] ?? 2;
      if (aStatus !== bStatus) return aStatus - bStatus;
      
      // Then by priority (urgent at top, low/promotional at bottom)
      const aPriority = priorityOrder[a.priority || "normal"];
      const bPriority = priorityOrder[b.priority || "normal"];
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      // Finally by date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [enhancedCommunications, activeFilter, activeTab, filteredGmailEmails, doneGmailIds, readGmailIds, selectedEmailInboxView, currentUserId, userPhoneAssignments, emailInsightsMap]);

  // Group "All" tab contacts by date for date separators
  const groupedByContactWithDates = useMemo(() => {
    if (!groupedByContact) return null;
    
    const dateGroups = new Map<string, CommunicationItem[]>();
    for (const comm of groupedByContact) {
      const dateKey = format(parseISO(comm.created_at), "yyyy-MM-dd");
      const existing = dateGroups.get(dateKey) || [];
      existing.push(comm);
      dateGroups.set(dateKey, existing);
    }
    
    return Array.from(dateGroups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, comms]) => ({
        date,
        label: isToday(parseISO(date)) ? "Today" : 
               isYesterday(parseISO(date)) ? "Yesterday" : 
               format(parseISO(date), "EEEE, MMM d"),
        communications: comms,
      }));
  }, [groupedByContact]);

  // Group communications by date for the inbox list (for non-All tabs)
  // Now also groups by contact first, then by date (like "All" tab)
  const groupedCommunications = useMemo(() => {
    if (activeTab === "all") return [];
    
    const filteredComms = enhancedCommunications.filter(c => activeFilter !== "owners" || c.contact_type === "owner");
    
    // First, group by contact (phone or email) to show only latest message per contact
    const contactMap = new Map<string, CommunicationItem[]>();
    for (const comm of filteredComms) {
      // Create unique key based on contact phone, email, or id
      const key = comm.contact_phone ? normalizePhone(comm.contact_phone) : 
                  comm.contact_email || comm.contact_id;
      const existing = contactMap.get(key) || [];
      existing.push(comm);
      contactMap.set(key, existing);
    }
    
    // Get only the latest message per contact
    const latestByContact = Array.from(contactMap.values())
      .map(messages => messages.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0])
      .sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    
    // Now group these by date
    const groups: Record<string, CommunicationItem[]> = {};
    for (const comm of latestByContact) {
      const dateKey = format(parseISO(comm.created_at), "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(comm);
    }
    
    // Sort by date descending (newest first)
    const sortedEntries = Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    return sortedEntries;
  }, [enhancedCommunications, activeFilter, activeTab]);

  // Helper function to format date headers
  const formatDateHeader = (dateKey: string): string => {
    const date = parseISO(dateKey);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "EEEE, MMM d");
  };
  
  const handleSelectMessage = (comm: CommunicationItem) => {
    // Clear Gmail email selection to prevent conflicts
    setSelectedGmailEmail(null);
    setSelectedMessage(comm);
    setShowMobileDetail(true);
  };
  
  const handleSelectGmailEmailMobile = (email: GmailEmail) => {
    // Clear SMS message selection to prevent conflicts
    setSelectedMessage(null);
    handleSelectGmailEmail(email);
    setShowMobileDetail(true);
  };
  
  const handleBackToList = () => {
    setShowMobileDetail(false);
    setSelectedMessage(null);
    setSelectedGmailEmail(null);
  };

  return (
    <div className="flex h-full md:h-[calc(100vh-8rem)] bg-background md:rounded-lg md:border overflow-hidden">
      {/* Left Panel - Message List (Hidden on mobile when viewing detail) */}
      <div className={`w-full md:w-96 lg:w-[420px] md:border-r flex flex-col ${showMobileDetail ? 'hidden md:flex' : 'flex'}`}>
        {/* Compact tab bar - Gmail style */}
        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3 border-b bg-background">
          {/* Tabs */}
          <div className="flex items-center gap-0.5 sm:gap-1 flex-1 min-w-0">
            <button 
              onClick={() => { setActiveTab("all"); setSelectedGmailEmail(null); setShowMobileDetail(false); }} 
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 rounded-full text-sm font-medium transition-colors shrink-0 ${activeTab === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">All</span>
            </button>
            <button 
              onClick={() => { setActiveTab("chats"); setSelectedGmailEmail(null); setShowMobileDetail(false); }} 
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 rounded-full text-sm font-medium transition-colors shrink-0 ${activeTab === "chats" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">SMS</span>
            </button>
            <button 
              onClick={() => { setActiveTab("calls"); setSelectedGmailEmail(null); setShowMobileDetail(false); }} 
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 rounded-full text-sm font-medium transition-colors shrink-0 ${activeTab === "calls" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Phone className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Calls</span>
            </button>
            <button 
              onClick={() => { setActiveTab("emails"); setSelectedMessage(null); setShowMobileDetail(false); }} 
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 rounded-full text-sm font-medium transition-colors shrink-0 ${activeTab === "emails" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Mail className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Emails</span>
            </button>
          </div>
          
          {/* Search toggle */}
          <button 
            onClick={() => setSearch(search ? "" : " ")}
            className="p-2 rounded-full text-muted-foreground hover:bg-muted shrink-0"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>

        {/* Expanded search bar - only show when active */}
        {search !== "" && (
          <div className="px-4 py-2 border-b bg-muted/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search conversations..." 
                value={search === " " ? "" : search} 
                onChange={(e) => setSearch(e.target.value || " ")} 
                className="h-10 pl-10 pr-10 bg-background border-border" 
                autoFocus
              />
              <button 
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Filters row - compact with dropdown for filters */}
        <div className="px-2 sm:px-3 py-2 border-b">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Notification bell */}
            <TeamNotificationBell />
            
            {/* Single Inbox Selector - for all tabs */}
            <EnhancedInboxSelector
              selectedView={selectedEmailInboxView}
              onViewChange={setSelectedEmailInboxView}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
            
            {/* Compose button - only for emails tab */}
            {activeTab === "emails" && (
              <>
                <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
                <Button 
                  onClick={() => setShowAIComposeEmail(true)} 
                  size="sm"
                  className="gap-1.5 h-8"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Compose</span>
                </Button>
                <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
                {/* AI Category Filter */}
                <EmailCategoryFilter 
                  selectedCategory={selectedEmailCategory}
                  onCategoryChange={setSelectedEmailCategory}
                />
                {/* Keyboard shortcuts help */}
                <KeyboardShortcutsHelp 
                  shortcuts={keyboardShortcuts}
                  open={showKeyboardHelp}
                  onOpenChange={setShowKeyboardHelp}
                />
              </>
            )}
            
            {/* Quick filters for chats/calls - Dropdown instead of horizontal buttons */}
            {activeTab !== "emails" && (
              <>
                {/* Filter dropdown for mobile-friendly access */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8"
                    >
                      {(() => {
                        const filterConfig: Record<FilterType, { label: string; icon?: any; dotColor?: string }> = {
                          all: { label: "All", icon: Inbox },
                          open: { label: "Open", icon: MessageSquare, dotColor: "bg-blue-500" },
                          urgent: { label: "Priority", icon: Zap, dotColor: "bg-red-500" },
                          awaiting: { label: "Awaiting", icon: Clock, dotColor: "bg-cyan-500" },
                          snoozed: { label: "Snoozed", icon: Clock, dotColor: "bg-amber-500" },
                          done: { label: "Done", icon: CheckCheck, dotColor: "bg-green-500" },
                          owners: { label: "Owners", icon: User, dotColor: "bg-purple-500" },
                          unread: { label: "Unread", icon: MessageSquare },
                        };
                        const config = filterConfig[activeFilter];
                        const Icon = config.icon;
                        return (
                          <>
                            {config.dotColor && (
                              <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                            )}
                            {Icon && <Icon className="h-4 w-4" />}
                            <span>{config.label}</span>
                          </>
                        );
                      })()}
                      <Filter className="h-3.5 w-3.5 ml-1 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {(["all", "open", "urgent", "awaiting", "snoozed", "done", "owners"] as FilterType[]).map((filter) => {
                      const filterConfig: Record<FilterType, { label: string; icon?: any; dotColor?: string }> = {
                        all: { label: "All", icon: Inbox },
                        open: { label: "Open", icon: MessageSquare, dotColor: "bg-blue-500" },
                        urgent: { label: "Priority", icon: Zap, dotColor: "bg-red-500" },
                        awaiting: { label: "Awaiting", icon: Clock, dotColor: "bg-cyan-500" },
                        snoozed: { label: "Snoozed", icon: Clock, dotColor: "bg-amber-500" },
                        done: { label: "Done", icon: CheckCheck, dotColor: "bg-green-500" },
                        owners: { label: "Owners", icon: User, dotColor: "bg-purple-500" },
                        unread: { label: "Unread", icon: MessageSquare },
                      };
                      const config = filterConfig[filter];
                      const Icon = config.icon;
                      
                      return (
                        <DropdownMenuItem
                          key={filter}
                          onClick={() => setActiveFilter(filter)}
                          className={`gap-2 ${activeFilter === filter ? "bg-accent" : ""}`}
                        >
                          {config.dotColor && (
                            <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                          )}
                          {Icon && <Icon className="h-4 w-4" />}
                          <span className="flex-1">{config.label}</span>
                          {activeFilter === filter && (
                            <CheckCheck className="h-4 w-4 text-primary" />
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Inbox Zero Help Guide */}
                <InboxZeroGuide />
              </>
            )}
          </div>
        </div>

        {/* Message List - Clean, content-first cards */}
        <ScrollArea className="flex-1">
          {activeTab === "emails" ? (
            // Gmail Inbox View
            isLoadingGmail ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredGmailEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Mail className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">No emails</p>
              </div>
            ) : (
              <div>
                {filteredGmailEmails
                  .filter(email => !search || search === " " || email.subject.toLowerCase().includes(search.toLowerCase()) || email.fromName.toLowerCase().includes(search.toLowerCase()))
                  .filter(email => !snoozedGmailEmails.has(email.id)) // Hide snoozed emails
                  .sort((a, b) => {
                    const aIsDone = doneGmailIds.has(a.id);
                    const bIsDone = doneGmailIds.has(b.id);
                    const aInsight = emailInsightsMap.get(a.id);
                    const bInsight = emailInsightsMap.get(b.id);
                    const aIsLow = aInsight?.priority === 'low' || aInsight?.category === 'promotional' || aInsight?.category === 'newsletter';
                    const bIsLow = bInsight?.priority === 'low' || bInsight?.category === 'promotional' || bInsight?.category === 'newsletter';
                    const aIsUrgent = aInsight?.priority === 'urgent' || aInsight?.priority === 'high' || aInsight?.action_required;
                    const bIsUrgent = bInsight?.priority === 'urgent' || bInsight?.priority === 'high' || bInsight?.action_required;
                    
                    // Done emails sink to bottom
                    if (aIsDone !== bIsDone) return aIsDone ? 1 : -1;
                    // Low priority/promotional sink below normal
                    if (aIsLow !== bIsLow) return aIsLow ? 1 : -1;
                    // Urgent emails rise to top
                    if (aIsUrgent !== bIsUrgent) return aIsUrgent ? -1 : 1;
                    // Finally sort by date (newest first)
                    return new Date(b.date).getTime() - new Date(a.date).getTime();
                  })
                  .map((email) => {
                    const isUnread = email.labelIds?.includes('UNREAD') && !readGmailIds.has(email.id);
                    const isDone = doneGmailIds.has(email.id);
                    const isSnoozed = snoozedGmailEmails.has(email.id);
                    const insight = emailInsightsMap.get(email.id);
                    const isLowPriority = insight?.priority === 'low' || insight?.category === 'promotional' || insight?.category === 'newsletter';
                    const shouldFade = isDone || isSnoozed || isLowPriority;
                    
                    return (
                      <div 
                        key={`${email.id}-${isDone ? 'done' : isSnoozed ? 'snoozed' : 'open'}`}
                        onClick={() => handleSelectGmailEmailMobile(email)} 
                        className={`group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/30 active:bg-muted/50 
                          ${selectedGmailEmail?.id === email.id ? "bg-primary/5" : "hover:bg-muted/30"} 
                          ${isUnread ? "bg-primary/[0.03]" : ""} 
                          ${shouldFade ? "opacity-50" : ""}`}
                      >
                        {/* Status indicator line - done/snoozed/priority */}
                        {isDone ? (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-r" />
                        ) : isSnoozed ? (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-r" />
                        ) : insight?.priority === 'urgent' ? (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-r" />
                        ) : null}
                        
                        <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-white">{getInitials(email.fromName)}</span>
                          {isDone && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                              <CheckCircle className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                          {isSnoozed && !isDone && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-background flex items-center justify-center">
                              <Clock className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 py-0.5">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className={`text-sm truncate ${isUnread ? 'font-semibold' : shouldFade ? 'font-normal text-muted-foreground' : 'font-medium text-foreground/80'}`}>
                                {email.fromName}
                              </span>
                              {isDone && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[10px] font-medium">
                                  ✓ Done
                                </span>
                              )}
                              {isSnoozed && !isDone && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-medium">
                                  ⏰ Snoozed
                                </span>
                              )}
                              {/* AI Category Badge */}
                              {insight && (
                                <EmailCategoryBadge 
                                  category={insight.category}
                                  sentiment={insight.sentiment || undefined}
                                  priority={insight.priority || undefined}
                                  compact
                                />
                              )}
                              {/* Property/Owner indicator - clickable */}
                              {insight?.property_id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/properties?id=${insight.property_id}`);
                                  }}
                                  className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                                  title="View associated property"
                                >
                                  <Home className="h-3 w-3 text-amber-600" />
                                </button>
                              )}
                              {insight?.owner_id && !insight?.property_id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate("/property-owners");
                                  }}
                                  className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                                  title="View associated owner"
                                >
                                  <User className="h-3 w-3 text-purple-600" />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {/* Quick action buttons on hover */}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center gap-1">
                                <ConversationQuickActions
                                  status={isDone ? "done" : isSnoozed ? "snoozed" : "open"}
                                  onMarkDone={() => markEmailAsDone(email.id)}
                                  onSnooze={(hours) => handleGmailSnooze(email.id, hours)}
                                  onReopen={() => unmarkEmailAsDone(email.id)}
                                  isUpdating={updateGmailStatusMutation.isPending}
                                  compact
                                />
                              </div>
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                {format(new Date(email.date), "MMM d")}
                              </span>
                            </div>
                          </div>
                          <p className={`text-[13px] leading-snug ${isUnread ? 'font-medium' : shouldFade ? 'text-muted-foreground' : 'text-foreground/70'}`}>
                            {decodeHtmlEntities(email.subject)}
                          </p>
                          <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                            {decodeHtmlEntities(email.snippet)}
                          </p>
                        </div>
                        {isUnread && !isDone && !isSnoozed && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-3" />}
                      </div>
                    );
                  })}
              </div>
            )
          ) : isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-48 text-destructive">
              <AlertCircle className="h-12 w-12 mb-3 opacity-70" />
              <p className="text-sm font-medium">Failed to load messages</p>
              <p className="text-xs text-muted-foreground mb-3">{(error as Error)?.message || "Unknown error"}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RotateCcw className="h-4 w-4 mr-2" />Retry
              </Button>
            </div>
          ) : activeTab === "all" && groupedByContactWithDates ? (
            // "All" tab - grouped by contact with date separators
            groupedByContactWithDates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">{activeFilter === "owners" ? "No owner conversations" : "No conversations"}</p>
              </div>
            ) : (
              <div>
                {groupedByContactWithDates.map((group) => (
                  <div key={group.date}>
                    {/* Date separator header */}
                    <div className="sticky top-0 bg-background/95 backdrop-blur px-4 py-2 border-b z-10">
                      <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
                    </div>
                    {group.communications.map((comm) => {
                      const isDone = comm.conversation_status === "done";
                      const isSnoozed = comm.conversation_status === "snoozed";
                      const isAwaiting = comm.conversation_status === "awaiting";
                      return (
                      <div 
                        key={`${comm.id}-${comm.conversation_status}`}
                        onClick={() => {
                          if (comm.contact_type === "email" && comm.gmail_email) {
                            // Handle email click - open email detail
                            handleSelectGmailEmailMobile(comm.gmail_email);
                          } else {
                            // All other types including owners - load in right panel
                            handleSelectMessage(comm);
                          }
                        }}
                        className={cn(
                          "group relative flex items-start gap-3 px-3 py-3 cursor-pointer border-b border-border/30 active:bg-muted/50",
                          // Smooth transitions for status changes
                          "transition-all duration-300 ease-out",
                          selectedMessage?.id === comm.id ? "bg-primary/5" : "hover:bg-muted/30",
                          // Done status: green border + fade + pale green background
                          isDone && "border-l-2 border-l-green-500 opacity-50 bg-green-50/30 dark:bg-green-950/10",
                          // Snoozed status: amber border + fade + pale amber background
                          isSnoozed && "border-l-2 border-l-amber-500 opacity-50 bg-amber-50/30 dark:bg-amber-950/10",
                          // Awaiting status: cyan border
                          isAwaiting && !isDone && !isSnoozed && "border-l-2 border-l-cyan-500",
                          // Priority colors (lower precedence than status)
                          comm.priority === "urgent" && !isDone && !isSnoozed && !isAwaiting && "border-l-2 border-l-red-500",
                          comm.priority === "important" && !isDone && !isSnoozed && !isAwaiting && "border-l-2 border-l-amber-500"
                        )}
                      >
                        
                        {/* Compact avatar */}
                        <div className="relative flex-shrink-0">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            comm.contact_type === "owner" 
                              ? "bg-gradient-to-br from-purple-500 to-purple-600" 
                              : comm.contact_type === "tenant"
                              ? "bg-gradient-to-br from-blue-500 to-blue-600"
                              : comm.contact_type === "email"
                              ? "bg-gradient-to-br from-blue-500 to-blue-600"
                              : "bg-gradient-to-br from-emerald-500 to-emerald-600"
                          }`}>
                            <span className="text-xs font-semibold text-white">{getInitials(comm.contact_name)}</span>
                          </div>
                          {comm.conversation_status === "done" && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                              <CheckCircle className="h-2 w-2 text-white" />
                            </div>
                          )}
                          {comm.conversation_status === "snoozed" && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-background flex items-center justify-center">
                              <Clock className="h-2 w-2 text-white" />
                            </div>
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0 py-0.5">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="font-semibold text-sm truncate">{comm.contact_name}</span>
                              {/* Priority/Status badge */}
                              <PriorityBadge 
                                priority={comm.priority} 
                                status={comm.conversation_status}
                                compact
                              />
                              {/* Type indicator */}
                              {comm.type === "call" && (
                                <Phone className="h-3 w-3 text-orange-500 flex-shrink-0" />
                              )}
                              {comm.type === "email" && (
                                <Mail className="h-3 w-3 text-blue-500 flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {/* Quick actions - visible on hover (desktop) or touch-active (mobile) */}
                              <div className="opacity-100 md:opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex">
                                <ConversationQuickActions
                                  status={(comm.conversation_status === "awaiting" ? "open" : comm.conversation_status) as "open" | "snoozed" | "done" | "archived"}
                                  onMarkDone={() => handleMarkDone(comm)}
                                  onSnooze={(hours) => handleSnooze(comm, hours)}
                                  onReopen={() => handleReopen(comm)}
                                  isUpdating={updateConversationStatus.isPending}
                                  compact
                                />
                              </div>
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                {isToday(new Date(comm.created_at))
                                  ? format(new Date(comm.created_at), "h:mm a")
                                  : isYesterday(new Date(comm.created_at))
                                  ? "Yesterday"
                                  : format(new Date(comm.created_at), "MMM d")
                                }
                              </span>
                            </div>
                          </div>
                          
                          {/* Message preview - 2 lines */}
                          <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {getMessagePreview(comm)}
                          </p>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )
          ) : groupedCommunications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">{activeFilter === "owners" ? "No owner conversations" : "No conversations"}</p>
            </div>
          ) : (
            <div>
              {groupedCommunications.map(([dateKey, comms], groupIndex) => (
                <div key={dateKey}>
                  {/* Inline date label - not sticky, scrolls with content */}
                  <div className="px-4 py-2 bg-muted/30">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {formatDateHeader(dateKey)}
                    </span>
                  </div>
                  {/* Messages for this date */}
                  {comms.map((comm) => {
                    const isDone = comm.conversation_status === "done";
                    const isSnoozed = comm.conversation_status === "snoozed";
                    const isAwaiting = comm.conversation_status === "awaiting";
                    const isSelected = selectedMessage?.id === comm.id || 
                      (comm.gmail_email && selectedGmailEmail?.id === comm.gmail_email.id);
                    return (
                    <div 
                      key={`${comm.id}-${comm.conversation_status}`}
                      onClick={() => {
                        if (comm.gmail_email) {
                          // For Gmail emails in the All tab, select the Gmail email directly
                          handleSelectGmailEmailMobile(comm.gmail_email);
                        } else {
                          // All other types including owners - load in right panel
                          handleSelectMessage(comm);
                        }
                      }}
                      className={cn(
                        "group relative flex items-start gap-3 px-3 py-3 cursor-pointer border-b border-border/30 active:bg-muted/50",
                        // Smooth transitions for status changes
                        "transition-all duration-300 ease-out",
                        isSelected ? "bg-primary/5" : "hover:bg-muted/30",
                        // Done status: green border + fade + pale green background
                        isDone && "border-l-2 border-l-green-500 opacity-50 bg-green-50/30 dark:bg-green-950/10",
                        // Snoozed status: amber border + fade + pale amber background
                        isSnoozed && "border-l-2 border-l-amber-500 opacity-50 bg-amber-50/30 dark:bg-amber-950/10",
                        // Awaiting status: cyan border
                        isAwaiting && !isDone && !isSnoozed && "border-l-2 border-l-cyan-500",
                        // Priority colors (lower precedence than status)
                        comm.priority === "urgent" && !isDone && !isSnoozed && !isAwaiting && "border-l-2 border-l-red-500",
                        comm.priority === "important" && !isDone && !isSnoozed && !isAwaiting && "border-l-2 border-l-amber-500"
                      )}
                    >
                      
                      {/* Compact avatar */}
                      <div className="relative flex-shrink-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          comm.contact_type === "owner" 
                            ? "bg-gradient-to-br from-purple-500 to-purple-600" 
                            : "bg-gradient-to-br from-emerald-500 to-emerald-600"
                        }`}>
                          <span className="text-xs font-semibold text-white">{getInitials(comm.contact_name)}</span>
                        </div>
                        {comm.conversation_status === "done" && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                            <CheckCircle className="h-2 w-2 text-white" />
                          </div>
                        )}
                        {comm.conversation_status === "snoozed" && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-background flex items-center justify-center">
                            <Clock className="h-2 w-2 text-white" />
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="font-semibold text-sm truncate">{comm.contact_name}</span>
                            <PriorityBadge 
                              priority={comm.priority} 
                              status={comm.conversation_status}
                              compact
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="opacity-100 md:opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex">
                              <ConversationQuickActions
                                status={(comm.conversation_status === "awaiting" ? "open" : comm.conversation_status) as "open" | "snoozed" | "done" | "archived"}
                                onMarkDone={() => handleMarkDone(comm)}
                                onSnooze={(hours) => handleSnooze(comm, hours)}
                                onReopen={() => handleReopen(comm)}
                                isUpdating={updateConversationStatus.isPending}
                                compact
                              />
                            </div>
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {format(new Date(comm.created_at), "h:mm a")}
                            </span>
                          </div>
                        </div>
                        
                        {/* Message preview */}
                        <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {getMessagePreview(comm)}
                        </p>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Compose button - FAB style on mobile */}
        <div className="p-3 border-t hidden md:block">
          <Button onClick={() => setShowComposeEmail(true)} className="w-full" size="sm"><Plus className="h-4 w-4 mr-2" />Compose</Button>
        </div>
      </div>
      
      {/* Mobile FAB for compose */}
      <Button 
        onClick={() => setShowComposeEmail(true)} 
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg md:hidden z-50"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Right Panel - Detail View (Full screen on mobile when showing detail) */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${showMobileDetail ? 'flex' : 'hidden md:flex'}`}>
        {(activeTab === "emails" || activeTab === "all") && selectedGmailEmail ? (
          // Gmail Email Detail View - Mobile optimized (works for both Emails tab and All tab)
          <>
            {/* Mobile back header - minimal */}
            <div className="md:hidden flex items-center gap-2 px-2 py-2 border-b">
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={handleBackToList}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm truncate block">{selectedGmailEmail.fromName}</span>
                <span className="text-xs text-muted-foreground truncate block">{selectedGmailEmail.from}</span>
              </div>
              {/* Mobile email quick actions */}
              <ConversationQuickActions
                status={doneGmailIds.has(selectedGmailEmail.id) ? "done" : snoozedGmailEmails.has(selectedGmailEmail.id) ? "snoozed" : "open"}
                onMarkDone={() => markEmailAsDone(selectedGmailEmail.id)}
                onSnooze={(hours) => handleGmailSnooze(selectedGmailEmail.id, hours)}
                onReopen={() => unmarkEmailAsDone(selectedGmailEmail.id)}
                isUpdating={updateGmailStatusMutation.isPending}
                compact
              />
            </div>
            
            {/* Desktop email header */}
            <div className="hidden md:flex p-4 border-b items-center gap-4">
              <div className="h-11 w-11 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-white">{getInitials(selectedGmailEmail.fromName)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base">{selectedGmailEmail.fromName}</h3>
                <p className="text-sm text-muted-foreground truncate">{selectedGmailEmail.from}</p>
              </div>
              {/* Desktop email quick actions */}
              <ConversationQuickActions
                status={doneGmailIds.has(selectedGmailEmail.id) ? "done" : snoozedGmailEmails.has(selectedGmailEmail.id) ? "snoozed" : "open"}
                onMarkDone={() => markEmailAsDone(selectedGmailEmail.id)}
                onSnooze={(hours) => handleGmailSnooze(selectedGmailEmail.id, hours)}
                onReopen={() => unmarkEmailAsDone(selectedGmailEmail.id)}
                isUpdating={updateGmailStatusMutation.isPending}
              />
              <Badge variant="secondary" className="text-xs">
                {format(new Date(selectedGmailEmail.date), "MMM d, h:mm a")}
              </Badge>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4" style={{ maxWidth: '100%' }}>
                <div className="bg-background rounded-lg border overflow-hidden">
                  <div className="p-4 border-b bg-muted/30">
                    <h2 className="font-semibold text-lg mb-2 break-words">{selectedGmailEmail.subject}</h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <span>From: <strong>{selectedGmailEmail.fromName}</strong> &lt;{selectedGmailEmail.from}&gt;</span>
                    </div>
                  </div>
                  {selectedGmailEmail.bodyHtml ? (
                    <iframe
                      srcDoc={`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { 
      margin: 0; 
      padding: 16px; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      overflow-x: auto;
    }
    img { max-width: 100% !important; height: auto !important; }
    table { max-width: 100% !important; }
    * { box-sizing: border-box; }
    a { color: #2563eb; }
  </style>
</head>
<body>${selectedGmailEmail.bodyHtml}</body>
</html>`}
                      sandbox="allow-same-origin allow-popups"
                      className="w-full border-0"
                      style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}
                      title="Email content"
                    />
                  ) : (
                    <div className="p-4 text-sm whitespace-pre-wrap break-words">
                      {selectedGmailEmail.body}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              <div className="flex gap-2 max-w-3xl mx-auto">
                <Button variant="outline" size="sm" onClick={() => setShowEmailReply(true)}>
                  <Mail className="h-4 w-4 mr-2" />Reply
                </Button>
              </div>
            </div>
          
            {/* Reply dialog for Gmail emails */}
            <SendEmailDialog
              open={showEmailReply}
              onOpenChange={setShowEmailReply}
              contactName={selectedGmailEmail.fromName}
              contactEmail={selectedGmailEmail.from}
              contactType="lead"
              contactId=""
              replyToSubject={selectedGmailEmail.subject}
              replyToBody={selectedGmailEmail.body}
              gmailMessageId={selectedGmailEmail.id}
              onEmailSent={() => {
                // Auto-mark Gmail email as done after sending reply
                markEmailAsDone(selectedGmailEmail.id);
              }}
            />
          </>
        ) : selectedMessage ? (
          <>
            {/* Mobile back header - minimal */}
            <div className="md:hidden flex items-center gap-2 px-2 py-2 border-b">
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={handleBackToList}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm truncate block">{selectedMessage.contact_name}</span>
                <span className="text-xs text-muted-foreground truncate block">
                  {selectedMessage.contact_phone || selectedMessage.contact_email || ""}
                </span>
              </div>
              {/* Mobile quick actions */}
              <ConversationQuickActions
                status={selectedMessage.conversation_status}
                onMarkDone={() => handleMarkDone(selectedMessage)}
                onSnooze={(hours) => handleSnooze(selectedMessage, hours)}
                onReopen={() => handleReopen(selectedMessage)}
                isUpdating={updateConversationStatus.isPending}
                compact
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {selectedMessage.contact_phone && (
                    <DropdownMenuItem onClick={() => setShowCallDialog(true)}>
                      <PhoneOutgoing className="h-4 w-4 mr-2" />Call
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => window.open("https://www.peachhausgroup.com/embed/income-report", "_blank", "noopener,noreferrer")}>
                    <TrendingUp className="h-4 w-4 mr-2 text-orange-500" />Income Report
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowContactInfo(true)}>
                    <Info className="h-4 w-4 mr-2" />Contact Info
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowNotes(true)}>
                    <FileText className="h-4 w-4 mr-2" />Notes
                  </DropdownMenuItem>
                  {selectedMessage.contact_type === "lead" && selectedMessage.contact_id ? (
                    <DropdownMenuItem onClick={() => setSelectedLeadId(selectedMessage.contact_id)}>
                      <User className="h-4 w-4 mr-2" />View Lead
                    </DropdownMenuItem>
                  ) : selectedMessage.contact_type !== "lead" && selectedMessage.contact_type !== "owner" && (
                    <DropdownMenuItem 
                      onClick={() => createLeadMutation.mutate({
                        name: selectedMessage.contact_name,
                        phone: selectedMessage.contact_phone || undefined,
                        email: selectedMessage.contact_email || undefined,
                      })}
                      disabled={createLeadMutation.isPending}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />{createLeadMutation.isPending ? "Creating..." : "Create Lead"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => {
                      const table = selectedMessage.type === "personal_sms" || selectedMessage.type === "personal_call" 
                        ? 'user_phone_messages' as const 
                        : 'lead_communications' as const;
                      if (window.confirm("Are you sure you want to delete this message?")) {
                        deleteMessageMutation.mutate({ id: selectedMessage.id, table });
                      }
                    }}
                    disabled={deleteMessageMutation.isPending}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleteMessageMutation.isPending ? "Deleting..." : "Delete"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Desktop header - unchanged */}
            <div className="hidden md:flex p-4 border-b items-center gap-4">
              <div className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                isVoiceAITranscript(selectedMessage.body) ? "bg-violet-500" : "bg-emerald-500"
              }`}>
                {isVoiceAITranscript(selectedMessage.body) ? (
                  <Bot className="h-5 w-5 text-white" />
                ) : (
                  <span className="text-sm font-medium text-white">{getInitials(selectedMessage.contact_name)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base">{selectedMessage.contact_name}</h3>
                  {isVoiceAITranscript(selectedMessage.body) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 text-xs font-medium">
                      <Bot className="h-3 w-3" />
                      Voice AI
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {isVoiceAITranscript(selectedMessage.body) 
                    ? `Caller: ${extractCallerPhoneFromTranscript(selectedMessage.body) || "Unknown"}`
                    : (selectedMessage.sender_email || selectedMessage.contact_email || selectedMessage.contact_phone || "No contact info")
                  }
                </p>
              </div>
              <div className="flex items-center gap-1">
                {/* Team Assignment */}
                <TeamAssignmentDropdown
                  communicationId={selectedMessage.id}
                  contactName={selectedMessage.contact_name}
                  messageSubject={selectedMessage.subject}
                  messageSummary={selectedMessage.body?.substring(0, 300)}
                  messageType={selectedMessage.type}
                />
                {/* Inbox Zero Quick Actions */}
                <ConversationQuickActions
                  status={selectedMessage.conversation_status}
                  onMarkDone={() => handleMarkDone(selectedMessage)}
                  onSnooze={(hours) => handleSnooze(selectedMessage, hours)}
                  onReopen={() => handleReopen(selectedMessage)}
                  isUpdating={updateConversationStatus.isPending}
                />
                <div className="w-px h-6 bg-border mx-1" />
                {/* Call Back button for Voice AI transcripts */}
                {isVoiceAITranscript(selectedMessage.body) && extractCallerPhoneFromTranscript(selectedMessage.body) && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                    onClick={() => {
                      const callerPhone = extractCallerPhoneFromTranscript(selectedMessage.body);
                      if (callerPhone) {
                        setVoiceAICallerPhone(callerPhone);
                        setShowCallDialog(true);
                      }
                    }}
                  >
                    <PhoneOutgoing className="h-4 w-4" />
                    Call Back
                  </Button>
                )}
                {/* Income Report button in detail header */}
                <IncomeReportButton 
                  variant="ghost" 
                  size="sm"
                  className="h-9 gap-1.5 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                />
                {selectedMessage.contact_phone && !isVoiceAITranscript(selectedMessage.body) && (
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowSmsReply(true)}><PhoneCall className="h-4 w-4" /></Button>
                )}
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowNotes(true)}><FileText className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowContactInfo(true)}><Info className="h-4 w-4" /></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {selectedMessage.contact_type === "lead" && selectedMessage.contact_id ? (
                      <DropdownMenuItem onClick={() => setSelectedLeadId(selectedMessage.contact_id)}>
                        <User className="h-4 w-4 mr-2" />View Lead
                      </DropdownMenuItem>
                    ) : selectedMessage.contact_type === "owner" ? (
                      <DropdownMenuItem onClick={() => navigate("/property-owners")}>View Owner</DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem 
                        onClick={() => createLeadMutation.mutate({
                          name: selectedMessage.contact_name,
                          phone: selectedMessage.contact_phone || undefined,
                          email: selectedMessage.contact_email || undefined,
                        })}
                        disabled={createLeadMutation.isPending}
                      >
                        <Plus className="h-4 w-4 mr-2" />{createLeadMutation.isPending ? "Creating..." : "Create Lead"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setShowNotes(true)}>Add Note</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <ScrollArea className="flex-1 overflow-x-hidden">
              <div className="px-2 py-2 sm:px-3 md:px-4 md:py-4 max-w-3xl mx-auto w-full overflow-hidden">
                {selectedMessage.is_draft && isEditingDraft && editedDraft ? (
                  <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                    <div><label className="text-sm font-medium">To Email</label><Input value={editedDraft.to_email} onChange={(e) => setEditedDraft({ ...editedDraft, to_email: e.target.value })} className="mt-1" /></div>
                    <div><label className="text-sm font-medium">To Name</label><Input value={editedDraft.to_name} onChange={(e) => setEditedDraft({ ...editedDraft, to_name: e.target.value })} className="mt-1" /></div>
                    <div><label className="text-sm font-medium">Subject</label><Input value={editedDraft.subject} onChange={(e) => setEditedDraft({ ...editedDraft, subject: e.target.value })} className="mt-1" /></div>
                    <div><label className="text-sm font-medium">Message</label><textarea value={editedDraft.body} onChange={(e) => setEditedDraft({ ...editedDraft, body: e.target.value })} rows={8} className="w-full mt-1 p-3 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background" /></div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveDraftMutation.mutate({ draftId: selectedMessage.draft_id!, updates: editedDraft })} disabled={saveDraftMutation.isPending} className="flex-1">
                        {saveDraftMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save Draft
                      </Button>
                      <Button variant="outline" size="sm" onClick={cancelEditing}><X className="h-4 w-4 mr-2" />Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Smart Scheduling Card - shows when they want to schedule */}
                    {!selectedMessage.is_draft && conversationThread.length > 0 && (() => {
                      const schedulingIntent = detectSchedulingIntent(conversationThread);
                      if (schedulingIntent) {
                        return (
                          <SmartSchedulingCard
                            detectedIntent={schedulingIntent}
                            contactName={selectedMessage.contact_name}
                            contactPhone={selectedMessage.contact_phone}
                            contactEmail={selectedMessage.contact_email}
                            contactId={selectedMessage.contact_id}
                            contactType={selectedMessage.contact_type}
                            leadId={selectedMessage.contact_type === "lead" ? selectedMessage.contact_id : undefined}
                            onDismiss={() => {}}
                            onScheduled={() => queryClient.invalidateQueries({ queryKey: ["communications"] })}
                          />
                        );
                      }
                      return null;
                    })()}
                    
                    {/* AI Draft Reply Card - shows pre-generated draft if available */}
                    {!selectedMessage.is_draft && selectedMessage.contact_phone && (() => {
                      // Check for pending AI draft for this contact
                      const leadId = selectedMessage.contact_type === "lead" ? selectedMessage.contact_id : undefined;
                      const ownerId = selectedMessage.contact_type === "owner" ? selectedMessage.contact_id : undefined;
                      
                      return (
                        <AIDraftReplySection 
                          contactPhone={selectedMessage.contact_phone}
                          leadId={leadId}
                          ownerId={ownerId}
                          onSend={(message) => {
                            sendSmsMutation.mutate({
                              to: selectedMessage.contact_phone!,
                              message,
                              contactType: selectedMessage.contact_type,
                              contactId: selectedMessage.contact_id,
                            });
                          }}
                          isSending={sendSmsMutation.isPending}
                        />
                      );
                    })()}
                    
                    {/* Conversation Summary - shows for threads with 5+ messages */}
                    {!selectedMessage.is_draft && conversationThread.length >= 5 && (
                      <ConversationSummary
                        leadId={selectedMessage.contact_type === "lead" ? selectedMessage.contact_id : undefined}
                        ownerId={selectedMessage.contact_type === "owner" ? selectedMessage.contact_id : undefined}
                        contactPhone={selectedMessage.contact_phone}
                        contactEmail={selectedMessage.contact_email}
                        messageCount={conversationThread.length}
                        className="mb-3"
                      />
                    )}
                    
                    {/* AI Reply + Smart Extract buttons - compact horizontal row on mobile */}
                    {!selectedMessage.is_draft && conversationThread.length > 0 && (
                      <div className="flex items-center gap-2 pb-2 overflow-x-auto">
                        {selectedMessage.contact_phone && (
                          <AIReplyButton
                            contactName={selectedMessage.contact_name}
                            contactPhone={selectedMessage.contact_phone}
                            contactId={selectedMessage.contact_id}
                            contactType={selectedMessage.contact_type}
                            conversationThread={conversationThread.map(msg => ({
                              type: msg.type,
                              direction: msg.direction,
                              body: msg.body,
                              created_at: msg.created_at,
                              subject: msg.subject,
                            }))}
                            onSendMessage={(message) => {
                              sendSmsMutation.mutate({
                                to: selectedMessage.contact_phone!,
                                message,
                                contactType: selectedMessage.contact_type,
                                contactId: selectedMessage.contact_id,
                              });
                            }}
                            isSending={sendSmsMutation.isPending}
                          />
                        )}
                        <SmartTaskExtractButton
                          conversationThread={conversationThread.map(msg => ({
                            type: msg.type,
                            direction: msg.direction,
                            body: msg.body,
                            created_at: msg.created_at,
                            subject: msg.subject,
                          }))}
                          contactName={selectedMessage.contact_name}
                          contactPhone={selectedMessage.contact_phone}
                          contactEmail={selectedMessage.contact_email}
                          contactId={selectedMessage.contact_id}
                          contactType={selectedMessage.contact_type}
                          leadId={selectedMessage.contact_type === "lead" ? selectedMessage.contact_id : undefined}
                          onActionExecuted={() => queryClient.invalidateQueries({ queryKey: ["communications"] })}
                        />
                      </div>
                    )}
                    
                    {/* Conversation Thread - clean minimal bubbles */}
                    {conversationThread.length > 0 ? (
                      <>
                        {conversationThread.map((msg, idx) => {
                          const isOutbound = msg.direction === "outbound";
                          const showDateSeparator = idx === 0 || 
                            format(new Date(msg.created_at), "yyyy-MM-dd") !== 
                            format(new Date(conversationThread[idx - 1].created_at), "yyyy-MM-dd");
                          
                          // Format date label
                          const formatDateLabel = (date: Date) => {
                            if (isToday(date)) return "Today";
                            if (isYesterday(date)) return "Yesterday";
                            return format(date, "EEEE, MMM d");
                          };
                          
                          return (
                            <div key={msg.id}>
                              {showDateSeparator && (
                                <div className="flex items-center justify-center py-3">
                                  <span className="text-[11px] font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                                    {formatDateLabel(new Date(msg.created_at))}
                                  </span>
                                </div>
                              )}
                              <div className={`flex ${isOutbound ? "justify-end" : "justify-start"} gap-1 sm:gap-2 w-full`}>
                                {/* Show sender initials for outbound messages - hidden on very small screens */}
                                {isOutbound && currentUserProfile?.first_name && (
                                  <div className="hidden sm:flex flex-shrink-0 self-end mb-5">
                                    <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center">
                                      <span className="text-[10px] font-semibold text-primary">
                                        {currentUserProfile.first_name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              <div className="max-w-[88%] sm:max-w-[80%] min-w-0">
                                  <div className={`rounded-2xl px-3 py-2 sm:px-3.5 overflow-hidden ${
                                    isOutbound 
                                      ? "bg-primary text-primary-foreground" 
                                      : "bg-muted"
                                  }`}>
                                    {/* Call Recording Player - styled like screenshot */}
                                    {msg.type === "call" && msg.call_recording_url && (
                                      <div className="mb-2 -mx-3.5 -mt-2 px-0 pt-0">
                                        <CallRecordingPlayer
                                          recordingUrl={msg.call_recording_url}
                                          duration={msg.call_duration}
                                          transcript={msg.body}
                                          isOutbound={isOutbound}
                                        />
                                      </div>
                                    )}
                                    {/* Simple call indicator when no recording */}
                                    {msg.type === "call" && !msg.call_recording_url && (
                                      <div className={`flex items-center gap-1.5 text-[11px] mb-1.5 ${isOutbound ? "opacity-80" : "text-muted-foreground"}`}>
                                        <Phone className="h-3 w-3" />
                                        <span>{isOutbound ? "Outgoing call" : "Incoming call"}</span>
                                        {msg.call_duration && <span>· {Math.floor(msg.call_duration / 60)}m {msg.call_duration % 60}s</span>}
                                      </div>
                                    )}
                                    {msg.type === "email" && (
                                      <div className={`flex items-center gap-1 text-xs font-medium mb-1 ${isOutbound ? "opacity-90" : "text-muted-foreground"}`}>
                                        <Mail className="h-3 w-3" />
                                        {msg.subject ? msg.subject : (isOutbound ? "Email sent" : "Email received")}
                                      </div>
                                    )}
                                    {msg.type === "sms" && (
                                      <div className={`flex items-center gap-1.5 text-[11px] mb-1 ${isOutbound ? "opacity-70" : "text-muted-foreground"}`}>
                                        {isVoiceAITranscript(msg.body) ? (
                                          <>
                                            <Bot className="h-3 w-3 text-violet-500" />
                                            <span className="text-violet-600 font-medium">Voice AI Transcript</span>
                                          </>
                                        ) : (
                                          <>
                                            <MessageSquare className="h-3 w-3" />
                                            <span>{isOutbound ? "SMS sent" : "SMS received"}</span>
                                          </>
                                        )}
                                      </div>
                                    )}
                                    {/* Voice AI Call Back Action */}
                                    {isVoiceAITranscript(msg.body) && !isOutbound && (
                                      <div className="mb-2">
                                        <VoiceAIBadge
                                          callerPhone={extractCallerPhoneFromTranscript(msg.body) || undefined}
                                          agentName={extractAgentNameFromTranscript(msg.body) || undefined}
                                          onCallBack={() => {
                                            const callerPhone = extractCallerPhoneFromTranscript(msg.body);
                                            if (callerPhone) {
                                              setVoiceAICallerPhone(callerPhone);
                                              setShowCallDialog(true);
                                            }
                                          }}
                                        />
                                      </div>
                                    )}
                                    {/* MMS Images - OpenPhone style grid with lightbox */}
                                    {msg.media_urls && msg.media_urls.length > 0 && (
                                      <div className={`mb-2 grid gap-1.5 ${
                                        msg.media_urls.length === 1 ? 'grid-cols-1' : 
                                        msg.media_urls.length === 2 ? 'grid-cols-2' : 
                                        'grid-cols-2'
                                      }`}>
                                        {msg.media_urls.map((url: string, imgIdx: number) => (
                                          <div 
                                            key={imgIdx} 
                                            className={`relative overflow-hidden rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${
                                              msg.media_urls.length === 1 ? 'aspect-auto max-h-64' : 'aspect-square'
                                            }`}
                                            onClick={() => {
                                              setLightboxImage(url);
                                              setLightboxOpen(true);
                                            }}
                                          >
                                            <img 
                                              src={url} 
                                              alt="MMS attachment" 
                                              className={`w-full h-full ${msg.media_urls.length === 1 ? 'object-contain' : 'object-cover'}`}
                                              loading="lazy"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed break-words overflow-hidden">{msg.body}</p>
                                  </div>
                                  <div className={`flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 px-1 ${isOutbound ? "justify-end" : ""}`}>
                                    {isOutbound && currentUserProfile?.first_name && (
                                      <span className="font-medium">{currentUserProfile.first_name}</span>
                                    )}
                                    <span>{format(new Date(msg.created_at), "h:mm a")}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {/* Auto-scroll anchor */}
                        <div ref={messagesEndRef} />
                      </>
                    ) : (
                      /* Single message fallback */
                      <div className={`flex ${selectedMessage.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[85%]">
                          <div className={`rounded-2xl px-3.5 py-2 ${selectedMessage.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            {selectedMessage.subject && <p className={`text-sm font-medium mb-1 ${selectedMessage.direction === "outbound" ? "opacity-90" : ""}`}>{selectedMessage.subject}</p>}
                            <p className="text-sm whitespace-pre-wrap leading-relaxed break-words overflow-hidden">{selectedMessage.body}</p>
                          </div>
                          <div className={`text-[10px] text-muted-foreground mt-0.5 px-1 ${selectedMessage.direction === "outbound" ? "text-right" : ""}`}>
                            {format(new Date(selectedMessage.created_at), "h:mm a")}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedMessage.is_draft && selectedMessage.draft_id && (
                      <div className="flex justify-center gap-2 pt-4">
                        <Button variant="outline" size="sm" onClick={() => startEditingDraft(selectedMessage)}><Pencil className="h-4 w-4 mr-2" />Edit</Button>
                        <Button size="sm" onClick={() => sendDraftMutation.mutate(selectedMessage.draft_id!)} disabled={sendDraftMutation.isPending}>
                          {sendDraftMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Send Email
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => discardDraftMutation.mutate(selectedMessage.draft_id!)} disabled={discardDraftMutation.isPending}>
                          {discardDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    )}

                    {!selectedMessage.is_draft && (
                      <div className="hidden md:flex flex-wrap justify-center gap-2 pt-4">
                        {selectedMessage.contact_phone && <Button variant="outline" size="sm" onClick={() => setShowSmsReply(true)}><MessageSquare className="h-4 w-4 mr-2" />Reply SMS</Button>}
                        {selectedMessage.contact_phone && (
                          <Button variant="outline" size="sm" onClick={() => setShowCallDialog(true)}>
                            <PhoneOutgoing className="h-4 w-4 mr-2" />Call
                          </Button>
                        )}
                        {(selectedMessage.contact_email || selectedMessage.sender_email) && selectedMessage.contact_type !== "external" && <Button variant="outline" size="sm" onClick={() => setShowEmailReply(true)}><Mail className="h-4 w-4 mr-2" />Reply Email</Button>}
                        {selectedMessage.contact_type === "lead" && selectedMessage.contact_id ? (
                          <Button variant="outline" size="sm" onClick={() => setSelectedLeadId(selectedMessage.contact_id)}><User className="h-4 w-4 mr-2" />View Lead</Button>
                        ) : selectedMessage.contact_type === "owner" && selectedMessage.contact_id ? (
                          <Button variant="outline" size="sm" onClick={() => navigate("/property-owners")}><ArrowUpRight className="h-4 w-4 mr-2" />View Owner</Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => createLeadMutation.mutate({
                              name: selectedMessage.contact_name,
                              phone: selectedMessage.contact_phone || undefined,
                              email: selectedMessage.contact_email || undefined,
                            })}
                            disabled={createLeadMutation.isPending}
                          >
                            <Plus className="h-4 w-4 mr-2" />{createLeadMutation.isPending ? "Creating..." : "Create Lead"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>

            {!selectedMessage.is_draft && (
              <div className="p-3 md:p-4 border-t safe-area-bottom">
                <div className="flex items-center gap-2 max-w-3xl mx-auto">
                  <div className="hidden md:flex items-center gap-1 mr-2">
                    <Button variant={selectedChannel === "sms" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setSelectedChannel("sms")} disabled={!selectedMessage.contact_phone}><MessageSquare className="h-3.5 w-3.5" /></Button>
                    <Button variant={selectedChannel === "email" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setSelectedChannel("email")} disabled={!selectedMessage.contact_email}><Mail className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5">
                    <AIWritingAssistant currentMessage={newMessage} onMessageGenerated={handleAIMessage} contactName={selectedMessage.contact_name} messageType={selectedChannel} />
                    <Input placeholder="Message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()} className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0 h-9 text-sm" />
                    <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                  </div>
                  <Button size="icon" className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90" onClick={handleSendMessage} disabled={!newMessage.trim() || sendSmsMutation.isPending}>
                    {sendSmsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" /> : <Send className="h-4 w-4 text-primary-foreground" />}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            {activeTab === "emails" ? (
              <>
                <Mail className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">Select an email</p>
                <p className="text-sm">Choose from your inbox to view the full message</p>
              </>
            ) : (
              <>
                <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Choose from your existing conversations or start a new one</p>
              </>
            )}
          </div>
        )}
      </div>

      {selectedMessage && selectedMessage.contact_phone && <SendSMSDialog open={showSmsReply} onOpenChange={setShowSmsReply} contactName={selectedMessage.contact_name} contactPhone={selectedMessage.contact_phone} contactType={selectedMessage.contact_type === "external" || selectedMessage.contact_type === "draft" || selectedMessage.contact_type === "personal" || selectedMessage.contact_type === "tenant" || selectedMessage.contact_type === "email" ? "lead" : selectedMessage.contact_type} contactId={selectedMessage.contact_id} />}
      {selectedMessage && (selectedMessage.contact_email || selectedMessage.sender_email) && selectedMessage.contact_type !== "external" && (
        <SendEmailDialog 
          open={showEmailReply} 
          onOpenChange={setShowEmailReply} 
          contactName={selectedMessage.contact_name} 
          contactEmail={selectedMessage.contact_email || selectedMessage.sender_email || ""} 
          contactType={(selectedMessage.contact_type === "tenant" || selectedMessage.contact_type === "email" ? "lead" : selectedMessage.contact_type) as "lead" | "owner"} 
          contactId={selectedMessage.contact_id} 
          replyToSubject={selectedMessage.subject} 
          replyToBody={selectedMessage.body}
          gmailMessageId={selectedMessage.gmail_email?.id || selectedGmailEmail?.id}
          onEmailSent={() => {
            // Auto-mark email as done after sending reply
            const emailId = selectedMessage.gmail_email?.id || selectedGmailEmail?.id;
            if (emailId) {
              markEmailAsDone(emailId);
            } else if (selectedMessage.contact_type !== "email") {
              // For non-Gmail messages, mark the conversation as done
              handleMarkDone(selectedMessage);
            }
          }}
        />
      )}
      <UnifiedComposeDialog open={showComposeEmail} onOpenChange={setShowComposeEmail} />
      {selectedMessage && <ContactInfoModal open={showContactInfo} onOpenChange={setShowContactInfo} contactId={selectedMessage.contact_id} contactType={selectedMessage.contact_type === "tenant" || selectedMessage.contact_type === "email" ? "personal" : selectedMessage.contact_type} contactName={selectedMessage.contact_name} contactPhone={selectedMessage.contact_phone} contactEmail={selectedMessage.contact_email} />}
      {selectedMessage && <ConversationNotes open={showNotes} onOpenChange={setShowNotes} contactPhone={selectedMessage.contact_phone} contactEmail={selectedMessage.contact_email} contactName={selectedMessage.contact_name} />}
      
      {/* Lead Detail Modal */}
      <LeadDetailModal
        lead={selectedLead || null}
        open={!!selectedLeadId}
        onOpenChange={(open) => !open && setSelectedLeadId(null)}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["lead-for-modal", selectedLeadId] })}
      />
      
      {/* Email Action Modal */}
      <EmailActionModal
        open={showEmailActionModal}
        onClose={() => setShowEmailActionModal(false)}
        email={selectedGmailEmail}
      />
      
      
      
      
      {/* Twilio Call Dialog */}
      {/* Twilio Call Dialog - use voiceAICallerPhone for Voice AI transcripts, otherwise contact_phone */}
      {(selectedMessage?.contact_phone || voiceAICallerPhone) && (
        <TwilioCallDialog
          isOpen={showCallDialog}
          onOpenChange={(open) => {
            setShowCallDialog(open);
            if (!open) setVoiceAICallerPhone(null);
          }}
          phoneNumber={voiceAICallerPhone || selectedMessage?.contact_phone || ""}
          contactName={voiceAICallerPhone ? `Caller ${formatPhoneForDisplay(voiceAICallerPhone)}` : selectedMessage?.contact_name || "Unknown"}
          metadata={selectedMessage?.contact_type === "lead" ? { leadId: selectedMessage.contact_id } : undefined}
        />
      )}

      {/* Image Lightbox */}
      {lightboxOpen && lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="h-8 w-8" />
          </button>
          <img 
            src={lightboxImage} 
            alt="Full size" 
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Follow-Up Scheduler Modal */}
      {selectedMessage && (
        <FollowUpSchedulerModal
          open={showFollowUpModal}
          onOpenChange={setShowFollowUpModal}
          contactName={selectedMessage.contact_name}
          contactPhone={selectedMessage.contact_phone}
          contactEmail={selectedMessage.contact_email}
          contactType={selectedMessage.contact_type}
          contactId={selectedMessage.contact_id}
          leadId={selectedMessage.contact_type === "lead" ? selectedMessage.contact_id : undefined}
          conversationContext={conversationThread.map(m => `${m.direction}: ${m.body}`).join("\n")}
          lastMessageSent={lastSentMessage}
          onScheduled={() => {
            queryClient.invalidateQueries({ queryKey: ["all-communications"] });
          }}
        />
      )}

      {/* Income Report is now opened via direct button click to new tab */}
    </div>
  );
}
