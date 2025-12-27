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
  Smile,
  Paperclip,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendSMSDialog } from "./SendSMSDialog";
import { SendEmailDialog } from "./SendEmailDialog";
import { ComposeEmailDialog } from "./ComposeEmailDialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
}

interface PhoneAssignment {
  id: string;
  phone_number: string;
  phone_type: string;
  display_name: string | null;
}

type TabType = "chats" | "calls";
type FilterType = "all" | "open" | "unread" | "unresponded";

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get current user and their phone assignment
  useEffect(() => {
    const fetchUserAndPhone = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        
        // Fetch user's phone assignment
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
    onError: (error: any) => {
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
    onError: (error: any) => {
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
    onError: (error: any) => {
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

  const { data: communications = [], isLoading } = useQuery({
    queryKey: ["all-communications", search, activeTab, activeFilter, currentUserId],
    refetchInterval: 10000,
    staleTime: 5000,
    enabled: !!currentUserId,
    queryFn: async () => {
      const results: CommunicationItem[] = [];

      // Determine what to fetch based on tab
      const fetchCalls = activeTab === "calls";
      const fetchMessages = activeTab === "chats";

      if (fetchMessages) {
        // Fetch lead communications (SMS, Email)
        let query = supabase
          .from("lead_communications")
          .select(`
            id,
            communication_type,
            direction,
            body,
            subject,
            created_at,
            status,
            lead_id,
            leads!inner(id, name, phone, email)
          `)
          .in("communication_type", ["sms", "email"])
          .order("created_at", { ascending: false })
          .limit(50);

        const { data: leadComms } = await query;

        if (leadComms) {
          for (const comm of leadComms) {
            const lead = comm.leads as any;
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
              contact_id: comm.lead_id,
              status: comm.status || undefined,
            };

            if (search) {
              const searchLower = search.toLowerCase();
              if (
                !item.contact_name.toLowerCase().includes(searchLower) &&
                !item.body.toLowerCase().includes(searchLower)
              ) {
                continue;
              }
            }

            results.push(item);
          }
        }

        // Fetch email insights (Gmail inbox emails)
        const { data: emailInsights } = await supabase
          .from("email_insights")
          .select(`
            id,
            subject,
            summary,
            sender_email,
            email_date,
            category,
            priority
          `)
          .order("email_date", { ascending: false })
          .limit(10);

        if (emailInsights && emailInsights.length > 0) {
          for (const email of emailInsights) {
            const senderName = email.sender_email?.split("@")[0] || "Unknown";
            const item: CommunicationItem = {
              id: email.id,
              type: "gmail",
              direction: "inbound",
              body: email.summary || "No summary available",
              subject: email.subject || "No subject",
              created_at: email.email_date,
              contact_name: senderName,
              contact_email: email.sender_email,
              contact_type: "external",
              contact_id: email.id,
              status: email.category,
              sender_email: email.sender_email,
            };

            if (search) {
              const searchLower = search.toLowerCase();
              if (
                !item.contact_name.toLowerCase().includes(searchLower) &&
                !item.body.toLowerCase().includes(searchLower) &&
                !(item.subject?.toLowerCase().includes(searchLower))
              ) {
                continue;
              }
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

        if (drafts && drafts.length > 0) {
          for (const draft of drafts) {
            const item: CommunicationItem = {
              id: draft.id,
              type: "draft",
              direction: "outbound",
              body: draft.body,
              subject: draft.subject,
              created_at: draft.created_at,
              contact_name: draft.to_name || draft.to_email?.split("@")[0] || "Unknown",
              contact_email: draft.to_email,
              contact_type: "draft",
              contact_id: draft.id,
              status: draft.ai_generated ? "AI Draft" : "Draft",
              is_draft: true,
              draft_id: draft.id,
            };

            if (search) {
              const searchLower = search.toLowerCase();
              if (
                !item.contact_name.toLowerCase().includes(searchLower) &&
                !item.body.toLowerCase().includes(searchLower) &&
                !(item.subject?.toLowerCase().includes(searchLower))
              ) {
                continue;
              }
            }

            results.push(item);
          }
        }

        // Fetch user's personal phone messages
        if (currentUserId) {
          const { data: personalMessages } = await supabase
            .from("user_phone_messages")
            .select("*")
            .eq("user_id", currentUserId)
            .order("created_at", { ascending: false })
            .limit(50);

          if (personalMessages) {
            for (const msg of personalMessages) {
              const contactNumber = msg.direction === "inbound" ? msg.from_number : msg.to_number;
              const item: CommunicationItem = {
                id: msg.id,
                type: "personal_sms",
                direction: msg.direction as "inbound" | "outbound",
                body: msg.body || "",
                created_at: msg.created_at,
                contact_name: contactNumber,
                contact_phone: contactNumber,
                contact_type: "personal",
                contact_id: msg.id,
                status: msg.status || undefined,
              };

              if (search) {
                const searchLower = search.toLowerCase();
                if (
                  !item.contact_name.toLowerCase().includes(searchLower) &&
                  !item.body.toLowerCase().includes(searchLower)
                ) {
                  continue;
                }
              }

              results.push(item);
            }
          }
        }
      }

      if (fetchCalls) {
        // Fetch call communications
        const { data: callComms } = await supabase
          .from("lead_communications")
          .select(`
            id,
            communication_type,
            direction,
            body,
            subject,
            created_at,
            status,
            lead_id,
            leads!inner(id, name, phone, email)
          `)
          .eq("communication_type", "call")
          .order("created_at", { ascending: false })
          .limit(50);

        if (callComms) {
          for (const comm of callComms) {
            const lead = comm.leads as any;
            const item: CommunicationItem = {
              id: comm.id,
              type: "call",
              direction: comm.direction as "inbound" | "outbound",
              body: comm.body || "Call",
              created_at: comm.created_at,
              contact_name: lead?.name || "Unknown",
              contact_phone: lead?.phone || undefined,
              contact_email: lead?.email || undefined,
              contact_type: "lead",
              contact_id: comm.lead_id,
              status: comm.status || undefined,
            };

            if (search) {
              const searchLower = search.toLowerCase();
              if (!item.contact_name.toLowerCase().includes(searchLower)) {
                continue;
              }
            }

            results.push(item);
          }
        }

        // Fetch user's personal phone calls
        if (currentUserId) {
          const { data: personalCalls } = await supabase
            .from("user_phone_calls")
            .select("*")
            .eq("user_id", currentUserId)
            .order("started_at", { ascending: false })
            .limit(50);

          if (personalCalls) {
            for (const call of personalCalls) {
              const contactNumber = call.direction === "inbound" ? call.from_number : call.to_number;
              const item: CommunicationItem = {
                id: call.id,
                type: "personal_call",
                direction: call.direction as "inbound" | "outbound",
                body: call.transcription || (call.direction === "inbound" ? "Incoming call" : "Outgoing call"),
                created_at: call.started_at,
                contact_name: contactNumber,
                contact_phone: contactNumber,
                contact_type: "personal",
                contact_id: call.id,
                status: call.status || undefined,
              };

              if (search) {
                const searchLower = search.toLowerCase();
                if (!item.contact_name.toLowerCase().includes(searchLower)) {
                  continue;
                }
              }

              results.push(item);
            }
          }
        }
      }

      // Sort by date descending
      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return results;
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getMessagePreview = (comm: CommunicationItem) => {
    if (comm.type === "call") {
      return comm.direction === "inbound" ? "Incoming call" : "Outgoing call";
    }
    if (comm.type === "draft") {
      return `Draft: ${comm.subject || "No subject"}`;
    }
    return comm.body?.slice(0, 50) + (comm.body?.length > 50 ? "..." : "");
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-background rounded-lg border overflow-hidden">
      {/* Left Panel - Conversation List */}
      <div className="w-80 border-r flex flex-col">
        {/* Header with tabs */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-4 mb-4">
            {/* Tab buttons */}
            <button
              onClick={() => setActiveTab("chats")}
              className={`flex items-center gap-2 pb-2 border-b-2 transition-colors ${
                activeTab === "chats"
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Chats</span>
            </button>
            <button
              onClick={() => setActiveTab("calls")}
              className={`flex items-center gap-2 pb-2 border-b-2 transition-colors ${
                activeTab === "calls"
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Phone className="h-4 w-4" />
              <span>Calls</span>
            </button>
            <div className="flex-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>

          {/* User's assigned phone number */}
          {userPhoneAssignment && (
            <div className="mb-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  My Number: {userPhoneAssignment.phone_number}
                </span>
              </div>
            </div>
          )}

          {/* Filter chips */}
          <div className="flex items-center gap-2">
            {(["all", "open", "unread", "unresponded"] as FilterType[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activeFilter === filter
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
            <button className="p-1.5 rounded-full border border-border hover:border-primary/50 transition-colors">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-muted/50 border-0"
            />
          </div>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading...</p>
            </div>
          ) : communications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No conversations</p>
            </div>
          ) : (
            <div>
              {communications.map((comm) => (
                <div
                  key={comm.id}
                  onClick={() => setSelectedMessage(comm)}
                  className={`flex items-start gap-3 p-3 cursor-pointer transition-colors border-l-2 ${
                    selectedMessage?.id === comm.id
                      ? "bg-muted/70 border-l-primary"
                      : "hover:bg-muted/30 border-l-transparent"
                  }`}
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-white">
                      {getInitials(comm.contact_name)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">
                        {comm.contact_name}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(comm.created_at), "MMM d")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {getMessagePreview(comm)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Compose button */}
        <div className="p-3 border-t">
          <Button onClick={() => setShowComposeEmail(true)} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>
      </div>

      {/* Right Panel - Conversation Detail */}
      <div className="flex-1 flex flex-col">
        {selectedMessage ? (
          <>
            {/* Header */}
            <div className="p-4 border-b flex items-center gap-4">
              <div className="h-11 w-11 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-white">
                  {getInitials(selectedMessage.contact_name)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base">{selectedMessage.contact_name}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {selectedMessage.sender_email || selectedMessage.contact_email || selectedMessage.contact_phone || "No contact info"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <PhoneCall className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <CheckCircle className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <FileText className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Info className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl mx-auto">
                {/* Draft editing mode */}
                {selectedMessage.is_draft && isEditingDraft && editedDraft ? (
                  <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <label className="text-sm font-medium">To Email</label>
                      <Input
                        value={editedDraft.to_email}
                        onChange={(e) => setEditedDraft({ ...editedDraft, to_email: e.target.value })}
                        placeholder="recipient@example.com"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">To Name</label>
                      <Input
                        value={editedDraft.to_name}
                        onChange={(e) => setEditedDraft({ ...editedDraft, to_name: e.target.value })}
                        placeholder="Recipient Name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Subject</label>
                      <Input
                        value={editedDraft.subject}
                        onChange={(e) => setEditedDraft({ ...editedDraft, subject: e.target.value })}
                        placeholder="Email subject"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Message</label>
                      <textarea
                        value={editedDraft.body}
                        onChange={(e) => setEditedDraft({ ...editedDraft, body: e.target.value })}
                        rows={8}
                        className="w-full mt-1 p-3 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                        placeholder="Email body..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveDraftMutation.mutate({ 
                          draftId: selectedMessage.draft_id!, 
                          updates: editedDraft 
                        })}
                        disabled={saveDraftMutation.isPending}
                        className="flex-1"
                      >
                        {saveDraftMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Draft
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelEditing}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Show message as chat bubble */}
                    <div className={`flex ${selectedMessage.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[75%]">
                        {selectedMessage.direction === "inbound" && (
                          <div className="text-xs text-muted-foreground mb-1 ml-1">
                            {selectedMessage.contact_name}
                          </div>
                        )}
                        <div
                          className={`rounded-2xl px-4 py-2.5 ${
                            selectedMessage.direction === "outbound"
                              ? "bg-gradient-to-br from-violet-500 to-violet-600 text-white"
                              : "bg-muted"
                          }`}
                        >
                          {selectedMessage.subject && (
                            <p className={`text-sm font-medium mb-1 ${selectedMessage.direction === "outbound" ? "text-white/90" : ""}`}>
                              {selectedMessage.subject}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{selectedMessage.body}</p>
                        </div>
                        {selectedMessage.direction === "outbound" && (
                          <div className="flex items-center justify-end gap-1 mt-1 mr-1">
                            <span className="text-[10px] text-muted-foreground">PeachHaus</span>
                          </div>
                        )}
                        <div className={`text-xs text-muted-foreground mt-1 ${selectedMessage.direction === "outbound" ? "text-right mr-1" : "ml-1"}`}>
                          {format(new Date(selectedMessage.created_at), "h:mm a")}
                        </div>
                      </div>
                    </div>

                    {/* Draft actions */}
                    {selectedMessage.is_draft && selectedMessage.draft_id && (
                      <div className="flex justify-center gap-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditingDraft(selectedMessage)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => sendDraftMutation.mutate(selectedMessage.draft_id!)}
                          disabled={sendDraftMutation.isPending}
                        >
                          {sendDraftMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          Send Email
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => discardDraftMutation.mutate(selectedMessage.draft_id!)}
                          disabled={discardDraftMutation.isPending}
                        >
                          {discardDraftMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Non-draft action buttons */}
                    {!selectedMessage.is_draft && (
                      <div className="flex justify-center gap-2 pt-4">
                        {selectedMessage.contact_phone && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSmsReply(true)}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Reply SMS
                          </Button>
                        )}
                        {(selectedMessage.contact_email || selectedMessage.sender_email) && selectedMessage.contact_type !== "external" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowEmailReply(true)}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Reply Email
                          </Button>
                        )}
                        {selectedMessage.contact_id && selectedMessage.contact_type !== "draft" && selectedMessage.contact_type !== "external" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(selectedMessage.contact_type === "lead" ? "/leads" : "/property-owners")}
                          >
                            <ArrowUpRight className="h-4 w-4 mr-2" />
                            View {selectedMessage.contact_type}
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Message input area */}
            {!selectedMessage.is_draft && (
              <div className="p-4 border-t">
                <div className="flex items-center gap-2 max-w-3xl mx-auto">
                  <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Input
                      placeholder="Write a message..."
                      className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0 h-8"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                      <Smile className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <Button size="icon" className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700">
                    <Send className="h-4 w-4 text-white" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm">Choose from your existing conversations or start a new one</p>
          </div>
        )}
      </div>

      {/* SMS Reply Dialog */}
      {selectedMessage && selectedMessage.contact_phone && (
        <SendSMSDialog
          open={showSmsReply}
          onOpenChange={setShowSmsReply}
          contactName={selectedMessage.contact_name}
          contactPhone={selectedMessage.contact_phone}
          contactType={selectedMessage.contact_type === "external" || selectedMessage.contact_type === "draft" || selectedMessage.contact_type === "personal" ? "lead" : selectedMessage.contact_type}
          contactId={selectedMessage.contact_id}
        />
      )}

      {/* Email Reply Dialog */}
      {selectedMessage && (selectedMessage.contact_email || selectedMessage.sender_email) && selectedMessage.contact_type !== "external" as any && (
        <SendEmailDialog
          open={showEmailReply}
          onOpenChange={setShowEmailReply}
          contactName={selectedMessage.contact_name}
          contactEmail={selectedMessage.contact_email || selectedMessage.sender_email || ""}
          contactType={selectedMessage.contact_type as "lead" | "owner"}
          contactId={selectedMessage.contact_id}
        />
      )}

      {/* Compose Email Dialog */}
      <ComposeEmailDialog
        open={showComposeEmail}
        onOpenChange={setShowComposeEmail}
      />
    </div>
  );
}
