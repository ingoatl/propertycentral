import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendSMSDialog } from "./SendSMSDialog";
import { SendEmailDialog } from "./SendEmailDialog";
import { ComposeEmailDialog } from "./ComposeEmailDialog";
import { AIWritingAssistant } from "./AIWritingAssistant";
import { EmojiPicker } from "./EmojiPicker";
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
  contact_type: "lead" | "owner" | "external" | "draft" | "personal";
  contact_id: string;
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

type TabType = "chats" | "calls" | "emails";
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

export function InboxView() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("chats");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedMessage, setSelectedMessage] = useState<CommunicationItem | null>(null);
  const [showSmsReply, setShowSmsReply] = useState(false);
  const [showEmailReply, setShowEmailReply] = useState(false);
  const [showComposeEmail, setShowComposeEmail] = useState(false);
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
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAdminCheck();
  
  // Auto-sync GHL data in background
  useGhlAutoSync();

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

  // Send SMS mutation
  const sendSmsMutation = useMutation({
    mutationFn: async ({ to, message }: { to: string; message: string }) => {
      const { data, error } = await supabase.functions.invoke("telnyx-send-sms", {
        body: { to, message },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("SMS sent!");
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
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
      sendSmsMutation.mutate({ to: selectedMessage.contact_phone, message: newMessage });
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

  // Determine which inbox to show based on selected user
  const [selectedEmailInbox, setSelectedEmailInbox] = useState<"ingo" | "anja">("ingo");

  // Fetch Gmail inbox emails for both Ingo and Anja
  const { data: gmailEmails = [], isLoading: isLoadingGmail } = useQuery({
    queryKey: ["gmail-inbox", activeTab],
    queryFn: async () => {
      if (activeTab !== "emails") return [];
      
      const { data, error } = await supabase.functions.invoke("fetch-gmail-inbox", {
        body: { daysBack: 3 }
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
      const fetchCalls = activeTab === "calls";
      const fetchMessages = activeTab === "chats";
      const targetUserId = viewAllInboxes ? null : (selectedInboxUserId || currentUserId);

      if (fetchMessages) {
        // Fetch lead communications (with leads)
        const { data: leadComms } = await supabase
          .from("lead_communications")
          .select(`id, communication_type, direction, body, subject, created_at, status, lead_id, owner_id, leads(id, name, phone, email)`)
          .in("communication_type", ["sms", "email"])
          .not("lead_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);

        if (leadComms) {
          for (const comm of leadComms) {
            const lead = comm.leads as { id: string; name: string; phone: string | null; email: string | null } | null;
            const item: CommunicationItem = {
              id: comm.id,
              type: comm.communication_type as "sms" | "email",
              direction: comm.direction as "inbound" | "outbound",
              body: comm.body,
              subject: comm.subject || undefined,
              created_at: comm.created_at,
              contact_name: lead?.name || "Unknown",
              contact_phone: lead?.phone || undefined,
              contact_email: lead?.email || undefined,
              contact_type: "lead",
              contact_id: comm.lead_id || "",
              status: comm.status || undefined,
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
          for (const msg of personalMessages) {
            const contactNumber = msg.direction === "inbound" ? msg.from_number : msg.to_number;
            const item: CommunicationItem = {
              id: msg.id, type: "personal_sms", direction: msg.direction as "inbound" | "outbound",
              body: msg.body || "", created_at: msg.created_at, contact_name: contactNumber,
              contact_phone: contactNumber, contact_type: "personal", contact_id: msg.id,
              status: msg.status || undefined, is_resolved: msg.is_resolved || false,
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
          .select(`id, communication_type, direction, body, subject, created_at, status, lead_id, owner_id, leads(id, name, phone, email)`)
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
          .select(`id, communication_type, direction, body, subject, created_at, status, owner_id, property_owners(id, name, email, phone)`)
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

  // Selected Gmail email state
  const [selectedGmailEmail, setSelectedGmailEmail] = useState<GmailEmail | null>(null);

  // Mark email as read when selected (local only - Gmail modify scope not available)
  const handleSelectGmailEmail = (email: GmailEmail) => {
    setSelectedGmailEmail(email);
    setShowEmailActionModal(true); // Show action modal when email is clicked
    
    // Update local state to remove UNREAD label (visual only)
    if (email.labelIds?.includes('UNREAD')) {
      queryClient.setQueryData(['gmail-inbox', activeTab], (old: GmailEmail[] | undefined) => {
        if (!old) return old;
        return old.map(e => 
          e.id === email.id 
            ? { ...e, labelIds: e.labelIds?.filter(l => l !== 'UNREAD') || [] }
            : e
        );
      });
    }
  };

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const getMessagePreview = (comm: CommunicationItem) => {
    if (comm.type === "call") return comm.direction === "inbound" ? "Incoming call" : "Outgoing call";
    if (comm.type === "draft") return `Draft: ${comm.subject || "No subject"}`;
    return comm.body?.slice(0, 50) + (comm.body?.length > 50 ? "..." : "");
  };

  // Mobile: show list or detail based on selection
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  
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
    <div className="flex h-[calc(100vh-12rem)] md:h-[calc(100vh-12rem)] bg-background rounded-lg border overflow-hidden">
      {/* Left Panel - Message List (Hidden on mobile when viewing detail) */}
      <div className={`w-full md:w-80 border-r flex flex-col ${showMobileDetail ? 'hidden md:flex' : 'flex'}`}>
        {/* Mobile-optimized tabs - Gmail style */}
        <div className="p-3 md:p-4 border-b">
          <div className="flex items-center gap-1 md:gap-4 mb-3 md:mb-4 overflow-x-auto scrollbar-hide">
            <button 
              onClick={() => { setActiveTab("chats"); setSelectedGmailEmail(null); setShowMobileDetail(false); }} 
              className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-0 py-2 md:py-0 md:pb-2 rounded-full md:rounded-none md:border-b-2 transition-colors whitespace-nowrap ${activeTab === "chats" ? "bg-primary/10 md:bg-transparent md:border-primary text-foreground font-medium" : "md:border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <MessageSquare className="h-4 w-4" /><span className="text-sm">Chats</span>
            </button>
            <button 
              onClick={() => { setActiveTab("calls"); setSelectedGmailEmail(null); setShowMobileDetail(false); }} 
              className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-0 py-2 md:py-0 md:pb-2 rounded-full md:rounded-none md:border-b-2 transition-colors whitespace-nowrap ${activeTab === "calls" ? "bg-primary/10 md:bg-transparent md:border-primary text-foreground font-medium" : "md:border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Phone className="h-4 w-4" /><span className="text-sm">Calls</span>
            </button>
            <button 
              onClick={() => { setActiveTab("emails"); setSelectedMessage(null); setShowMobileDetail(false); }} 
              className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-0 py-2 md:py-0 md:pb-2 rounded-full md:rounded-none md:border-b-2 transition-colors whitespace-nowrap ${activeTab === "emails" ? "bg-primary/10 md:bg-transparent md:border-primary text-foreground font-medium" : "md:border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Mail className="h-4 w-4" /><span className="text-sm">Emails</span>
            </button>
          </div>

          {/* My Inbox selector - own row for Chats/Calls tabs */}
          {activeTab !== "emails" && isAdmin && (
            <div className="mb-2">
              <AdminInboxSelector selectedUserId={selectedInboxUserId} onUserChange={handleInboxChange} currentUserId={currentUserId} />
            </div>
          )}

          {/* Email inbox selector for Emails tab */}
          {activeTab === "emails" && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
              <button 
                onClick={() => setSelectedEmailInbox("ingo")} 
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${selectedEmailInbox === "ingo" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}
              >
                Ingo's Inbox
              </button>
              <button 
                onClick={() => setSelectedEmailInbox("anja")} 
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${selectedEmailInbox === "anja" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}
              >
                Anja's Inbox
              </button>
            </div>
          )}

          {/* Only show filters for Chats/Calls tabs */}
          {activeTab !== "emails" && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
              {(["all", "owners", "open", "unread", "unresponded"] as FilterType[]).map((filter) => (
                <button 
                  key={filter} 
                  onClick={() => setActiveFilter(filter)} 
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                    activeFilter === filter 
                      ? filter === "owners" 
                        ? "bg-purple-500 text-white border-purple-500" 
                        : "bg-primary text-primary-foreground border-primary" 
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {filter === "owners" ? "Owners" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search - larger touch target on mobile */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 md:h-9 pl-9 bg-muted/50 border-0" />
          </div>
        </div>

        {/* Message List - Gmail-style cards */}
        <ScrollArea className="flex-1">
          {activeTab === "emails" ? (
            // Gmail Inbox View - Enhanced mobile styling
            isLoadingGmail ? (
              <div className="p-4 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /><p className="text-sm">Loading emails...</p></div>
            ) : filteredGmailEmails.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground"><Mail className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="text-sm">No emails in {selectedEmailInbox === "ingo" ? "Ingo's" : "Anja's"} inbox</p></div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredGmailEmails.filter(email => !search || email.subject.toLowerCase().includes(search.toLowerCase()) || email.fromName.toLowerCase().includes(search.toLowerCase())).map((email) => {
                  const isUnread = email.labelIds?.includes('UNREAD');
                  return (
                    <div 
                      key={email.id} 
                      onClick={() => handleSelectGmailEmailMobile(email)} 
                      className={`flex items-start gap-3 p-3 md:p-3 cursor-pointer transition-colors active:bg-muted/70 ${selectedGmailEmail?.id === email.id ? "bg-muted/70" : "hover:bg-muted/30"} ${isUnread ? "bg-primary/5" : ""}`}
                    >
                      {/* Avatar - Gmail style */}
                      <div className="h-11 w-11 md:h-10 md:w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-sm font-semibold text-white">{getInitials(email.fromName)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm truncate ${isUnread ? 'font-bold text-foreground' : 'font-medium text-foreground/80'}`}>{email.fromName}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{format(new Date(email.date), "MMM d")}</span>
                        </div>
                        <p className={`text-sm truncate ${isUnread ? 'font-semibold text-foreground' : 'text-foreground/70'}`}>{email.subject}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{email.snippet}</p>
                      </div>
                      {isUnread && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
                    </div>
                  );
                })}
              </div>
            )
          ) : isLoading ? (
            <div className="p-4 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /><p className="text-sm">Loading...</p></div>
          ) : communications.filter(c => activeFilter !== "owners" || c.contact_type === "owner").length === 0 ? (
            <div className="p-8 text-center text-muted-foreground"><MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="text-sm">{activeFilter === "owners" ? "No owner conversations" : "No conversations"}</p></div>
          ) : (
            <div className="divide-y divide-border/50">
              {communications
                .filter(c => activeFilter !== "owners" || c.contact_type === "owner")
                .map((comm) => (
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
                  className={`flex items-start gap-3 p-4 cursor-pointer transition-colors active:bg-muted/70 ${selectedMessage?.id === comm.id ? "bg-muted/70" : "hover:bg-muted/30"}`}
                >
                  {/* Avatar with status indicator */}
                  <div className="relative">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                      comm.contact_type === "owner" 
                        ? "bg-gradient-to-br from-purple-500 to-purple-600" 
                        : "bg-gradient-to-br from-emerald-500 to-emerald-600"
                    }`}>
                      <span className="text-sm font-semibold text-white">{getInitials(comm.contact_name)}</span>
                    </div>
                    {comm.is_resolved && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                        <CheckCircle className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm truncate">{comm.contact_name}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{format(new Date(comm.created_at), "MMM d")}</span>
                    </div>
                    {/* Type badges - more prominent on mobile */}
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      {comm.contact_type === "owner" && (
                        <Badge className="text-xs h-5 px-2 bg-purple-500 text-white border-0">Owner</Badge>
                      )}
                      {comm.contact_type === "lead" && comm.type !== "draft" && (
                        <Badge className="text-xs h-5 px-2 bg-emerald-500 text-white border-0">Lead</Badge>
                      )}
                      {comm.type === "draft" && (
                        <Badge className="text-xs h-5 px-2 bg-amber-500 text-white border-0">Draft</Badge>
                      )}
                      {comm.type === "personal_sms" && (
                        <Badge variant="outline" className="text-xs h-5 px-2">SMS</Badge>
                      )}
                      {comm.type === "call" && (
                        <Badge variant="outline" className="text-xs h-5 px-2">
                          <Phone className="h-3 w-3 mr-1" />Call
                        </Badge>
                      )}
                      {comm.direction === "inbound" && !comm.is_resolved && (
                        <Badge className="text-xs h-5 px-2 bg-blue-500 text-white border-0">New</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{getMessagePreview(comm)}</p>
                  </div>
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
      <div className={`flex-1 flex flex-col ${showMobileDetail ? 'flex' : 'hidden md:flex'}`}>
        {activeTab === "emails" && selectedGmailEmail ? (
          // Gmail Email Detail View - Mobile optimized
          <>
            {/* Mobile back button */}
            <div className="md:hidden p-3 border-b flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={handleBackToList}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="font-medium truncate">{selectedGmailEmail.fromName}</span>
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

            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="bg-background rounded-lg border overflow-hidden">
                  <div className="p-4 border-b bg-muted/30">
                    <h2 className="font-semibold text-lg mb-2">{selectedGmailEmail.subject}</h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>From: <strong>{selectedGmailEmail.fromName}</strong> &lt;{selectedGmailEmail.from}&gt;</span>
                    </div>
                  </div>
                  {selectedGmailEmail.bodyHtml ? (
                    <div 
                      className="p-4 email-content prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: selectedGmailEmail.bodyHtml }}
                      style={{ 
                        fontSize: '14px',
                        lineHeight: '1.6',
                      }}
                    />
                  ) : (
                    <div className="p-4 text-sm whitespace-pre-wrap">
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
            {/* Mobile back header */}
            <div className="md:hidden p-3 border-b flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={handleBackToList}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="font-medium truncate">{selectedMessage.contact_name}</span>
            </div>
            
            {/* Desktop header */}
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
                    {selectedMessage.contact_type === "lead" ? (
                      <DropdownMenuItem onClick={() => setSelectedLeadId(selectedMessage.contact_id)}>
                        <User className="h-4 w-4 mr-2" />View Lead
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => navigate("/property-owners")}>View Contact</DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setShowNotes(true)}>Add Note</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl mx-auto">
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
                  <>
                    <div className={`flex ${selectedMessage.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[75%]">
                        {selectedMessage.direction === "inbound" && <div className="text-xs text-muted-foreground mb-1 ml-1">{selectedMessage.contact_name}</div>}
                        <div className={`rounded-2xl px-4 py-2.5 ${selectedMessage.direction === "outbound" ? "bg-gradient-to-br from-violet-500 to-violet-600 text-white" : "bg-muted"}`}>
                          {selectedMessage.subject && <p className={`text-sm font-medium mb-1 ${selectedMessage.direction === "outbound" ? "text-white/90" : ""}`}>{selectedMessage.subject}</p>}
                          <p className="text-sm whitespace-pre-wrap">{selectedMessage.body}</p>
                        </div>
                        <div className={`text-xs text-muted-foreground mt-1 ${selectedMessage.direction === "outbound" ? "text-right mr-1" : "ml-1"}`}>{format(new Date(selectedMessage.created_at), "h:mm a")}</div>
                      </div>
                    </div>

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
                      <div className="flex justify-center gap-2 pt-4">
                        {selectedMessage.contact_phone && <Button variant="outline" size="sm" onClick={() => setShowSmsReply(true)}><MessageSquare className="h-4 w-4 mr-2" />Reply SMS</Button>}
                        {(selectedMessage.contact_email || selectedMessage.sender_email) && selectedMessage.contact_type !== "external" && <Button variant="outline" size="sm" onClick={() => setShowEmailReply(true)}><Mail className="h-4 w-4 mr-2" />Reply Email</Button>}
                        {selectedMessage.contact_id && selectedMessage.contact_type === "lead" && (
                          <Button variant="outline" size="sm" onClick={() => setSelectedLeadId(selectedMessage.contact_id)}><User className="h-4 w-4 mr-2" />View Lead</Button>
                        )}
                        {selectedMessage.contact_id && selectedMessage.contact_type === "owner" && (
                          <Button variant="outline" size="sm" onClick={() => navigate("/property-owners")}><ArrowUpRight className="h-4 w-4 mr-2" />View Owner</Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>

            {!selectedMessage.is_draft && (
              <div className="p-4 border-t">
                <div className="flex items-center gap-2 max-w-3xl mx-auto">
                  <div className="flex items-center gap-1 mr-2">
                    <Button variant={selectedChannel === "sms" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setSelectedChannel("sms")} disabled={!selectedMessage.contact_phone}><MessageSquare className="h-3.5 w-3.5" /></Button>
                    <Button variant={selectedChannel === "email" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setSelectedChannel("email")} disabled={!selectedMessage.contact_email}><Mail className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2">
                    <AIWritingAssistant currentMessage={newMessage} onMessageGenerated={handleAIMessage} contactName={selectedMessage.contact_name} messageType={selectedChannel} />
                    <Input placeholder="Write a message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()} className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0 h-8" />
                    <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                  </div>
                  <Button size="icon" className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700" onClick={handleSendMessage} disabled={!newMessage.trim() || sendSmsMutation.isPending}>
                    {sendSmsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Send className="h-4 w-4 text-white" />}
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

      {selectedMessage && selectedMessage.contact_phone && <SendSMSDialog open={showSmsReply} onOpenChange={setShowSmsReply} contactName={selectedMessage.contact_name} contactPhone={selectedMessage.contact_phone} contactType={selectedMessage.contact_type === "external" || selectedMessage.contact_type === "draft" || selectedMessage.contact_type === "personal" ? "lead" : selectedMessage.contact_type} contactId={selectedMessage.contact_id} />}
      {selectedMessage && (selectedMessage.contact_email || selectedMessage.sender_email) && selectedMessage.contact_type !== "external" && <SendEmailDialog open={showEmailReply} onOpenChange={setShowEmailReply} contactName={selectedMessage.contact_name} contactEmail={selectedMessage.contact_email || selectedMessage.sender_email || ""} contactType={selectedMessage.contact_type as "lead" | "owner"} contactId={selectedMessage.contact_id} replyToSubject={selectedMessage.subject} replyToBody={selectedMessage.body} />}
      <ComposeEmailDialog open={showComposeEmail} onOpenChange={setShowComposeEmail} />
      {selectedMessage && <ContactInfoModal open={showContactInfo} onOpenChange={setShowContactInfo} contactId={selectedMessage.contact_id} contactType={selectedMessage.contact_type} contactName={selectedMessage.contact_name} contactPhone={selectedMessage.contact_phone} contactEmail={selectedMessage.contact_email} />}
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
    </div>
  );
}
