import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isYesterday, parseISO } from "date-fns";
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
} from "lucide-react";
import { IncomeReportEmbed } from "@/components/IncomeReportEmbed";
import { TwilioCallDialog } from "@/components/TwilioCallDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendSMSDialog } from "./SendSMSDialog";
import { SendEmailDialog } from "./SendEmailDialog";
import { ComposeEmailDialog } from "./ComposeEmailDialog";
import { AIComposeEmailDialog } from "./AIComposeEmailDialog";
import { AIWritingAssistant } from "./AIWritingAssistant";
import { AIReplyButton } from "./AIReplyButton";
import { SmartSchedulingCard, detectSchedulingIntent } from "./SmartSchedulingCard";
import { SmartTaskExtractButton } from "./SmartTaskExtractButton";
import { EmojiPicker } from "./EmojiPicker";
import { FollowUpSchedulerModal } from "./FollowUpSchedulerModal";
import { ContactInfoModal } from "./ContactInfoModal";
import { ConversationNotes } from "./ConversationNotes";
import { AdminInboxSelector } from "./AdminInboxSelector";
import { EmailActionModal } from "./EmailActionModal";
import LeadDetailModal from "@/components/leads/LeadDetailModal";
import { OwnerCommunicationDetail } from "./OwnerCommunicationDetail";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useGhlAutoSync } from "@/hooks/useGhlAutoSync";
import { useLeadRealtimeMessages } from "@/hooks/useLeadRealtimeMessages";
import { usePhoneLookup } from "@/hooks/usePhoneLookup";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  contact_type: "lead" | "owner" | "external" | "draft" | "personal" | "tenant";
  contact_id: string;
  media_urls?: string[];
  status?: string;
  sender_email?: string;
  is_draft?: boolean;
  draft_id?: string;
  is_resolved?: boolean;
  owner_id?: string;
  property_name?: string;
}

interface PhoneAssignment {
  id: string;
  phone_number: string;
  phone_type: string;
  display_name: string | null;
}

type TabType = "all" | "chats" | "calls" | "emails";
type FilterType = "all" | "open" | "unread" | "unresponded" | "owners";
type MessageChannel = "sms" | "email";

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
  const [selectedOwnerForDetail, setSelectedOwnerForDetail] = useState<{
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  } | null>(null);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showIncomeReport, setShowIncomeReport] = useState(false);
  const [lastSentMessage, setLastSentMessage] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
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

  // Determine which inbox to show based on selected user
  const [selectedEmailInbox, setSelectedEmailInbox] = useState<"ingo" | "anja">("ingo");

  // Fetch Gmail inbox emails for both Ingo and Anja
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
    enabled: activeTab === "emails",
    staleTime: 30000,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Filter emails based on selected inbox
  const filteredGmailEmails = gmailEmails.filter(email => {
    const targetInbox = email.targetInbox?.toLowerCase() || '';
    if (selectedEmailInbox === "ingo") {
      return targetInbox.includes("ingo") || !email.targetInbox;
    } else {
      return targetInbox.includes("anja");
    }
  });

  const { data: communications = [], isLoading } = useQuery({
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
        // Fetch ALL lead communications (including those without lead_id for tenants/external contacts)
        const { data: allComms } = await supabase
          .from("lead_communications")
          .select(`id, communication_type, direction, body, subject, created_at, status, lead_id, owner_id, metadata, media_urls, leads(id, name, phone, email)`)
          .in("communication_type", ["sms", "email"])
          .order("created_at", { ascending: false })
          .limit(100);

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

          for (const comm of allComms) {
            const lead = comm.leads as { id: string; name: string; phone: string | null; email: string | null } | null;
            const metadata = comm.metadata as { 
              unmatched_phone?: string; 
              contact_name?: string; 
              tenant_id?: string; 
              tenant_name?: string; 
              tenant_phone?: string;
              ghl_data?: { contactPhone?: string; contactName?: string };
            } | null;
            
            let contactName = "Unknown";
            let contactPhone: string | undefined;
            let contactEmail: string | undefined;
            let contactType: CommunicationItem["contact_type"] = "external";
            let contactId = comm.id;

            if (comm.lead_id && lead) {
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
                contactName = metadata.contact_name || metadata.ghl_data?.contactName || phone || "Unknown";
                contactPhone = phone;
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

        // Fetch owner communications
        const { data: ownerComms } = await supabase
          .from("lead_communications")
          .select(`id, communication_type, direction, body, subject, created_at, status, owner_id, property_owners(id, name, email, phone)`)
          .in("communication_type", ["sms", "email"])
          .not("owner_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);

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
            // Extract contact name from metadata if available
            const metadata = comm.metadata as { ghl_data?: { contactName?: string; contactPhone?: string } } | null;
            const contactName = metadata?.ghl_data?.contactName || "Unknown Caller";
            const contactPhone = metadata?.ghl_data?.contactPhone || undefined;
            
            results.push({
              id: comm.id, type: "call", direction: comm.direction as "inbound" | "outbound",
              body: comm.body || "Call", created_at: comm.created_at, contact_name: contactName,
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
        // 1. Name is "Unknown" or similar
        // 2. Name looks like a phone number
        // 3. Name is very short (likely first name only like "Hector")
        // 4. Name starts with a "+" (phone number format)
        const isUnknown = !name || 
          name === "Unknown" || 
          name === "Unknown Caller" ||
          name === "Unknown Contact" ||
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

  // Enhance communications with looked up names
  const enhancedCommunications = useMemo(() => {
    return communications.map(comm => {
      if (comm.contact_phone) {
        const lookedUpName = getNameForPhone(comm.contact_phone);
        if (lookedUpName) {
          const currentName = comm.contact_name?.trim() || "";
          
          // Replace if current name is unknown, a phone number, or just a first name
          const shouldReplace = 
            !currentName ||
            currentName === "Unknown" || 
            currentName === "Unknown Caller" ||
            currentName.match(/^[\d\s\-\(\)\+\.]+$/) ||
            currentName.startsWith("+") ||
            // If looked up name is longer/better, use it
            (currentName.split(" ").length === 1 && lookedUpName.split(" ").length > 1);
          
          if (shouldReplace) {
            return { ...comm, contact_name: lookedUpName };
          }
        }
      }
      return comm;
    });
  }, [communications, lookupCache, getNameForPhone]);

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

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const getMessagePreview = (comm: CommunicationItem) => {
    // For calls, show transcript or direction with icon prefix
    if (comm.type === "call" || comm.type === "personal_call") {
      if (comm.body && comm.body.length > 10 && comm.body !== "Call" && !comm.body.startsWith("Phone call") && !comm.body.startsWith("Incoming call") && !comm.body.startsWith("Outgoing call")) {
        return "📞 " + comm.body.slice(0, 100) + (comm.body.length > 100 ? "..." : "");
      }
      return comm.direction === "inbound" ? "📞 Incoming call" : "📞 Outgoing call";
    }
    // For emails, show subject with icon
    if (comm.type === "email" && comm.subject) {
      return "📧 " + comm.subject;
    }
    if (comm.type === "draft") return `📝 Draft: ${comm.subject || "No subject"}`;
    // For SMS with images but no/empty text
    if ((!comm.body || comm.body === "SMS message" || comm.body.trim().length === 0) && comm.media_urls?.length) {
      return `📷 Image message (${comm.media_urls.length} attachment${comm.media_urls.length > 1 ? 's' : ''})`;
    }
    // Handle empty or placeholder SMS bodies
    if (!comm.body || comm.body === "SMS message" || comm.body.trim().length === 0) {
      return comm.direction === "inbound" ? "Received message" : "Sent message";
    }
    return comm.body.slice(0, 120) + (comm.body.length > 120 ? "..." : "");
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
  const groupedByContact = useMemo(() => {
    if (activeTab !== "all") return null;
    
    const contactMap = new Map<string, CommunicationItem[]>();
    const filteredComms = communications.filter(c => activeFilter !== "owners" || c.contact_type === "owner");
    
    for (const comm of filteredComms) {
      // Create unique key based on contact phone, email, or id
      const key = comm.contact_phone ? normalizePhone(comm.contact_phone) : 
                  comm.contact_email || comm.contact_id;
      const existing = contactMap.get(key) || [];
      existing.push(comm);
      contactMap.set(key, existing);
    }
    
    // Return only the latest message per contact, sorted by date descending
    return Array.from(contactMap.values())
      .map(messages => messages.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0])
      .sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }, [communications, activeFilter, activeTab]);

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
    setSelectedMessage(comm);
    setShowMobileDetail(true);
  };
  
  const handleSelectGmailEmailMobile = (email: GmailEmail) => {
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
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-background">
          {/* Tabs */}
          <div className="flex items-center gap-1 flex-1">
            <button 
              onClick={() => { setActiveTab("all"); setSelectedGmailEmail(null); setShowMobileDetail(false); }} 
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">All</span>
            </button>
            <button 
              onClick={() => { setActiveTab("chats"); setSelectedGmailEmail(null); setShowMobileDetail(false); }} 
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === "chats" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">SMS</span>
            </button>
            <button 
              onClick={() => { setActiveTab("calls"); setSelectedGmailEmail(null); setShowMobileDetail(false); }} 
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === "calls" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Calls</span>
            </button>
            <button 
              onClick={() => { setActiveTab("emails"); setSelectedMessage(null); setShowMobileDetail(false); }} 
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === "emails" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Emails</span>
            </button>
          </div>
          
          {/* Income Report button */}
          <button 
            onClick={() => setShowIncomeReport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 transition-colors"
            title="Generate Income Report"
          >
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Income Report</span>
          </button>
          
          {/* Search toggle */}
          <button 
            onClick={() => setSearch(search ? "" : " ")}
            className="p-2 rounded-full text-muted-foreground hover:bg-muted"
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

        {/* Filters row - compact horizontal scroll */}
        <div className="px-4 py-2 border-b overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 min-w-max">
            {/* Admin inbox selector */}
            {activeTab !== "emails" && isAdmin && (
              <AdminInboxSelector selectedUserId={selectedInboxUserId} onUserChange={handleInboxChange} currentUserId={currentUserId} />
            )}
            
            {/* Email inbox selector */}
            {activeTab === "emails" && (
              <>
                <Button 
                  onClick={() => setShowAIComposeEmail(true)} 
                  size="sm"
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Compose</span>
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <button 
                  onClick={() => setSelectedEmailInbox("ingo")} 
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedEmailInbox === "ingo" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  Ingo
                </button>
                <button 
                  onClick={() => setSelectedEmailInbox("anja")} 
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedEmailInbox === "anja" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  Anja
                </button>
              </>
            )}
            
            {/* Quick filters for chats/calls */}
            {activeTab !== "emails" && (
              <>
                {(["all", "owners", "open", "unread"] as FilterType[]).map((filter) => (
                  <button 
                    key={filter} 
                    onClick={() => setActiveFilter(filter)} 
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      activeFilter === filter 
                        ? filter === "owners" 
                          ? "bg-purple-500 text-white" 
                          : "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {filter === "owners" ? "Owners" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
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
                {filteredGmailEmails.filter(email => !search || search === " " || email.subject.toLowerCase().includes(search.toLowerCase()) || email.fromName.toLowerCase().includes(search.toLowerCase())).map((email) => {
                  const isUnread = email.labelIds?.includes('UNREAD') && !readGmailIds.has(email.id);
                  return (
                    <div 
                      key={email.id} 
                      onClick={() => handleSelectGmailEmailMobile(email)} 
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/30 active:bg-muted/50 ${selectedGmailEmail?.id === email.id ? "bg-primary/5" : "hover:bg-muted/30"} ${isUnread ? "bg-primary/[0.03]" : ""}`}
                    >
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-white">{getInitials(email.fromName)}</span>
                      </div>
                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                          <span className={`text-sm truncate ${isUnread ? 'font-semibold' : 'font-medium text-foreground/80'}`}>
                            {email.fromName}
                          </span>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {format(new Date(email.date), "MMM d")}
                          </span>
                        </div>
                        <p className={`text-[13px] leading-snug ${isUnread ? 'font-medium' : 'text-foreground/70'}`}>
                          {email.subject}
                        </p>
                        <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {email.snippet}
                        </p>
                      </div>
                      {isUnread && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-3" />}
                    </div>
                  );
                })}
              </div>
            )
          ) : isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
                    {group.communications.map((comm) => (
                      <div 
                        key={comm.id} 
                        onClick={() => {
                          if (comm.contact_type === "owner" && comm.owner_id) {
                            setSelectedOwnerForDetail({
                              id: comm.owner_id,
                              name: comm.contact_name,
                              email: comm.contact_email,
                              phone: comm.contact_phone,
                            });
                          } else {
                            handleSelectMessage(comm);
                          }
                        }}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/30 active:bg-muted/50 ${selectedMessage?.id === comm.id ? "bg-primary/5" : "hover:bg-muted/30"}`}
                      >
                        {/* Compact avatar */}
                        <div className="relative flex-shrink-0">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            comm.contact_type === "owner" 
                              ? "bg-gradient-to-br from-purple-500 to-purple-600" 
                              : comm.contact_type === "tenant"
                              ? "bg-gradient-to-br from-blue-500 to-blue-600"
                              : "bg-gradient-to-br from-emerald-500 to-emerald-600"
                          }`}>
                            <span className="text-xs font-semibold text-white">{getInitials(comm.contact_name)}</span>
                          </div>
                          {comm.is_resolved && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                              <CheckCircle className="h-2 w-2 text-white" />
                            </div>
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0 py-0.5">
                          <div className="flex items-baseline justify-between gap-2 mb-0.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold text-sm truncate">{comm.contact_name}</span>
                              {/* Type indicator badges */}
                              {comm.type === "sms" && (
                                <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">
                                  <MessageSquare className="h-2.5 w-2.5" />
                                </span>
                              )}
                              {comm.type === "call" && (
                                <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600">
                                  <Phone className="h-2.5 w-2.5" />
                                </span>
                              )}
                              {comm.type === "email" && (
                                <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">
                                  <Mail className="h-2.5 w-2.5" />
                                </span>
                              )}
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
                          
                          {/* Inline badges */}
                          {(comm.type === "draft" || (comm.direction === "inbound" && !comm.is_resolved)) && (
                            <div className="flex items-center gap-1.5 mb-1">
                              {comm.type === "draft" && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">Draft</span>
                              )}
                              {comm.direction === "inbound" && !comm.is_resolved && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">New</span>
                              )}
                            </div>
                          )}
                          
                          {/* Message preview - 3 lines */}
                          <p className="text-[13px] text-muted-foreground line-clamp-3 leading-relaxed">
                            {getMessagePreview(comm)}
                          </p>
                        </div>
                      </div>
                    ))}
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
                  {comms.map((comm) => (
                    <div 
                      key={comm.id} 
                      onClick={() => {
                        if (comm.contact_type === "owner" && comm.owner_id) {
                          setSelectedOwnerForDetail({
                            id: comm.owner_id,
                            name: comm.contact_name,
                            email: comm.contact_email,
                            phone: comm.contact_phone,
                          });
                        } else {
                          handleSelectMessage(comm);
                        }
                      }}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/30 active:bg-muted/50 ${selectedMessage?.id === comm.id ? "bg-primary/5" : "hover:bg-muted/30"}`}
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
                        {comm.is_resolved && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                            <CheckCircle className="h-2 w-2 text-white" />
                          </div>
                        )}
                      </div>
                      
                      {/* Content - maximize text visibility */}
                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-sm truncate">{comm.contact_name}</span>
                            {/* Type indicator badges */}
                            {comm.type === "sms" && (
                              <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">
                                <MessageSquare className="h-2.5 w-2.5" />
                              </span>
                            )}
                            {comm.type === "call" && (
                              <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600">
                                <Phone className="h-2.5 w-2.5" />
                              </span>
                            )}
                            {comm.type === "email" && (
                              <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">
                                <Mail className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {format(new Date(comm.created_at), "h:mm a")}
                          </span>
                        </div>
                        
                        {/* Inline badges only for important states */}
                        {(comm.type === "draft" || (comm.direction === "inbound" && !comm.is_resolved)) && (
                          <div className="flex items-center gap-1.5 mb-1">
                            {comm.type === "draft" && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">Draft</span>
                            )}
                            {comm.direction === "inbound" && !comm.is_resolved && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">New</span>
                            )}
                          </div>
                        )}
                        
                        {/* Message preview - show more content */}
                        <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {getMessagePreview(comm)}
                        </p>
                      </div>
                    </div>
                  ))}
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
        {activeTab === "emails" && selectedGmailEmail ? (
          // Gmail Email Detail View - Mobile optimized
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
              {/* Minimal mobile actions */}
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
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Desktop header - unchanged */}
            <div className="hidden md:flex p-4 border-b items-center gap-4">
              <div className="h-11 w-11 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-white">{getInitials(selectedMessage.contact_name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base">{selectedMessage.contact_name}</h3>
                <p className="text-sm text-muted-foreground truncate">{selectedMessage.sender_email || selectedMessage.contact_email || selectedMessage.contact_phone || "No contact info"}</p>
              </div>
              <div className="flex items-center gap-1">
                {selectedMessage.contact_phone && (
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowSmsReply(true)}><PhoneCall className="h-4 w-4" /></Button>
                )}
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => selectedMessage.type === "personal_sms" && markResolvedMutation.mutate({ id: selectedMessage.id, resolved: !selectedMessage.is_resolved })}>
                  <CheckCircle className={`h-4 w-4 ${selectedMessage.is_resolved ? "text-green-500" : ""}`} />
                </Button>
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

            <ScrollArea className="flex-1">
              <div className="px-3 py-2 md:px-4 md:py-4 max-w-3xl mx-auto">
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
                    
                    {/* AI Reply + Smart Extract buttons */}
                    {!selectedMessage.is_draft && conversationThread.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pb-2">
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
                              <div className={`flex ${isOutbound ? "justify-end" : "justify-start"} gap-2`}>
                                {/* Show sender initials for outbound messages */}
                                {isOutbound && currentUserProfile?.first_name && (
                                  <div className="flex-shrink-0 self-end mb-5">
                                    <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center">
                                      <span className="text-[10px] font-semibold text-primary">
                                        {currentUserProfile.first_name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                <div className={`max-w-[80%]`}>
                                  <div className={`rounded-2xl px-3.5 py-2 ${
                                    isOutbound 
                                      ? "bg-primary text-primary-foreground" 
                                      : "bg-muted"
                                  }`}>
                                    {/* Type indicator for all message types */}
                                    {msg.type === "call" && (
                                      <div className={`flex items-center gap-1.5 text-[11px] mb-1.5 ${isOutbound ? "opacity-80" : "text-muted-foreground"}`}>
                                        <Phone className="h-3 w-3" />
                                        <span>{isOutbound ? "Outgoing call" : "Incoming call"}</span>
                                        {msg.call_duration && <span>· {Math.floor(msg.call_duration / 60)}m {msg.call_duration % 60}s</span>}
                                        {msg.call_recording_url && (
                                          <button onClick={(e) => { e.stopPropagation(); window.open(msg.call_recording_url, "_blank"); }} className="ml-1 hover:opacity-80">
                                            <Play className="h-3 w-3" />
                                          </button>
                                        )}
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
                                        <MessageSquare className="h-3 w-3" />
                                        <span>{isOutbound ? "SMS sent" : "SMS received"}</span>
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
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.body}</p>
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
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedMessage.body}</p>
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

      {selectedMessage && selectedMessage.contact_phone && <SendSMSDialog open={showSmsReply} onOpenChange={setShowSmsReply} contactName={selectedMessage.contact_name} contactPhone={selectedMessage.contact_phone} contactType={selectedMessage.contact_type === "external" || selectedMessage.contact_type === "draft" || selectedMessage.contact_type === "personal" || selectedMessage.contact_type === "tenant" ? "lead" : selectedMessage.contact_type} contactId={selectedMessage.contact_id} />}
      {selectedMessage && (selectedMessage.contact_email || selectedMessage.sender_email) && selectedMessage.contact_type !== "external" && <SendEmailDialog open={showEmailReply} onOpenChange={setShowEmailReply} contactName={selectedMessage.contact_name} contactEmail={selectedMessage.contact_email || selectedMessage.sender_email || ""} contactType={(selectedMessage.contact_type === "tenant" ? "lead" : selectedMessage.contact_type) as "lead" | "owner"} contactId={selectedMessage.contact_id} replyToSubject={selectedMessage.subject} replyToBody={selectedMessage.body} />}
      <ComposeEmailDialog open={showComposeEmail} onOpenChange={setShowComposeEmail} />
      {selectedMessage && <ContactInfoModal open={showContactInfo} onOpenChange={setShowContactInfo} contactId={selectedMessage.contact_id} contactType={selectedMessage.contact_type === "tenant" ? "personal" : selectedMessage.contact_type} contactName={selectedMessage.contact_name} contactPhone={selectedMessage.contact_phone} contactEmail={selectedMessage.contact_email} />}
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
      
      {/* AI Compose Email Dialog */}
      <AIComposeEmailDialog
        open={showAIComposeEmail}
        onOpenChange={setShowAIComposeEmail}
      />
      
      {/* Owner Communication Detail Modal */}
      {selectedOwnerForDetail && (
        <OwnerCommunicationDetail
          ownerId={selectedOwnerForDetail.id}
          ownerName={selectedOwnerForDetail.name}
          ownerEmail={selectedOwnerForDetail.email}
          ownerPhone={selectedOwnerForDetail.phone}
          isOpen={!!selectedOwnerForDetail}
          onClose={() => setSelectedOwnerForDetail(null)}
        />
      )}
      
      {/* Twilio Call Dialog */}
      {selectedMessage?.contact_phone && (
        <TwilioCallDialog
          isOpen={showCallDialog}
          onOpenChange={setShowCallDialog}
          phoneNumber={selectedMessage.contact_phone}
          contactName={selectedMessage.contact_name}
          metadata={selectedMessage.contact_type === "lead" ? { leadId: selectedMessage.contact_id } : undefined}
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

      {/* Income Report Modal */}
      <IncomeReportEmbed 
        open={showIncomeReport} 
        onOpenChange={setShowIncomeReport}
      />
    </div>
  );
}
