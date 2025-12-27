import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  MessageSquare,
  Phone,
  Mail,
  User,
  Search,
  Filter,
  ArrowUpRight,
  Plus,
  Send,
  Trash2,
  Loader2,
  Sparkles,
  Pencil,
  X,
  Save,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SendSMSDialog } from "./SendSMSDialog";
import { SendEmailDialog } from "./SendEmailDialog";
import { ComposeEmailDialog } from "./ComposeEmailDialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface CommunicationItem {
  id: string;
  type: "sms" | "email" | "call" | "gmail" | "draft";
  direction: "inbound" | "outbound";
  body: string;
  subject?: string;
  created_at: string;
  contact_name: string;
  contact_phone?: string;
  contact_email?: string;
  contact_type: "lead" | "owner" | "external" | "draft";
  contact_id: string;
  status?: string;
  sender_email?: string;
  is_draft?: boolean;
  draft_id?: string;
}

export function InboxView() {
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Send draft mutation
  const sendDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      // Get the draft
      const { data: draft, error: fetchError } = await supabase
        .from("email_drafts")
        .select("*")
        .eq("id", draftId)
        .single();
      
      if (fetchError || !draft) throw new Error("Draft not found");

      // Send the email using send-lead-email function
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

      // Mark draft as sent
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

  // Start editing a draft
  const startEditingDraft = (message: CommunicationItem) => {
    setEditedDraft({
      to_email: message.contact_email || "",
      to_name: message.contact_name || "",
      subject: message.subject || "",
      body: message.body || ""
    });
    setIsEditingDraft(true);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditingDraft(false);
    setEditedDraft(null);
  };

  const { data: communications = [], isLoading, refetch } = useQuery({
    queryKey: ["all-communications", search, channelFilter, typeFilter],
    refetchInterval: 10000, // Refetch every 10 seconds to catch new drafts
    staleTime: 5000, // Consider data stale after 5 seconds
    queryFn: async () => {
      const results: CommunicationItem[] = [];

      // Fetch lead communications (SMS, Email, Call)
      if (channelFilter === "all" || channelFilter === "sms" || channelFilter === "email" || channelFilter === "call") {
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
          .order("created_at", { ascending: false })
          .limit(50);

        if (channelFilter !== "all" && !["gmail"].includes(channelFilter)) {
          query = query.eq("communication_type", channelFilter);
        }

        const { data: leadComms } = await query;

        if (leadComms) {
          for (const comm of leadComms) {
            const lead = comm.leads as any;
            const item: CommunicationItem = {
              id: comm.id,
              type: comm.communication_type as "sms" | "email" | "call",
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

            // Apply search filter
            if (search) {
              const searchLower = search.toLowerCase();
              if (
                !item.contact_name.toLowerCase().includes(searchLower) &&
                !item.body.toLowerCase().includes(searchLower)
              ) {
                continue;
              }
            }

            // Apply type filter
            if (typeFilter !== "all" && item.contact_type !== typeFilter) {
              continue;
            }

            results.push(item);
          }
        }
      }

      // Fetch email insights (Gmail inbox emails) - latest 10
      if (channelFilter === "all" || channelFilter === "gmail") {
        const { data: emailInsights, error: emailError } = await supabase
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

        console.log("Email insights fetched:", emailInsights?.length, "Error:", emailError);

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

            // Apply search filter
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

            // Apply type filter (skip for gmail since they are external)
            if (typeFilter !== "all" && typeFilter !== "external" && item.contact_type !== typeFilter) {
              continue;
            }

            results.push(item);
          }
        }
      }

      // Fetch email drafts (AI-generated drafts)
      if (channelFilter === "all" || channelFilter === "draft") {
        const { data: drafts, error: draftsError } = await supabase
          .from("email_drafts")
          .select("*")
          .eq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(20);

        console.log("Email drafts fetched:", drafts?.length, "Error:", draftsError);

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

            // Apply search filter
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
      }

      // Sort by date descending
      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return results;
    },
  });

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "sms":
        return <MessageSquare className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "gmail":
        return <Mail className="h-4 w-4" />;
      case "call":
        return <Phone className="h-4 w-4" />;
      case "draft":
        return <Mail className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getChannelColor = (type: string) => {
    switch (type) {
      case "sms":
        return "bg-blue-100 text-blue-700";
      case "email":
        return "bg-purple-100 text-purple-700";
      case "gmail":
        return "bg-orange-100 text-orange-700";
      case "call":
        return "bg-green-100 text-green-700";
      case "draft":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getChannelLabel = (type: string) => {
    switch (type) {
      case "gmail":
        return "GMAIL";
      case "draft":
        return "DRAFT";
      default:
        return type.toUpperCase();
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="email">Sent Emails</SelectItem>
              <SelectItem value="gmail">Gmail Inbox</SelectItem>
              <SelectItem value="call">Calls</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px]">
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="lead">Leads</SelectItem>
              <SelectItem value="owner">Owners</SelectItem>
              <SelectItem value="external">External</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <Loader2 className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowComposeEmail(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Compose Email
          </Button>
        </div>
      </div>

      {/* Messages List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Message List */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>All Communications</span>
              <Badge variant="secondary">{communications.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading communications...
                </div>
              ) : communications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No communications found</p>
                </div>
              ) : (
                <div className="divide-y">
                  {communications.map((comm) => (
                    <div
                      key={comm.id}
                      onClick={() => setSelectedMessage(comm)}
                      className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                        selectedMessage?.id === comm.id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-full ${getChannelColor(
                            comm.type
                          )}`}
                        >
                          {getChannelIcon(comm.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {comm.contact_name}
                              </span>
                              <Badge
                                variant={
                                  comm.contact_type === "lead"
                                    ? "default"
                                    : comm.contact_type === "owner"
                                    ? "secondary"
                                    : "outline"
                                }
                                className="text-xs"
                              >
                                {comm.contact_type}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(comm.created_at), "MMM d, h:mm a")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                comm.direction === "inbound"
                                  ? "border-green-500 text-green-600"
                                  : "border-blue-500 text-blue-600"
                              }`}
                            >
                              {comm.direction === "inbound" ? "Received" : "Sent"}
                            </Badge>
                            <Badge variant="outline" className={`text-xs ${getChannelColor(comm.type)}`}>
                              {getChannelLabel(comm.type)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {comm.subject ? `${comm.subject}: ` : ""}
                            {comm.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message Detail */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Message Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedMessage ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-3 rounded-full ${getChannelColor(
                      selectedMessage.type
                    )}`}
                  >
                    {getChannelIcon(selectedMessage.type)}
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedMessage.contact_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedMessage.sender_email || selectedMessage.contact_email || selectedMessage.contact_phone || "No contact info"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Channel</span>
                    <Badge className={getChannelColor(selectedMessage.type)}>
                      {getChannelLabel(selectedMessage.type)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Direction</span>
                    <Badge variant="outline">
                      {selectedMessage.direction === "inbound" ? "Received" : "Sent"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <span>
                      {format(
                        new Date(selectedMessage.created_at),
                        "MMM d, yyyy h:mm a"
                      )}
                    </span>
                  </div>
                  {selectedMessage.status && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status/Category</span>
                      <Badge variant="secondary">{selectedMessage.status}</Badge>
                    </div>
                  )}
                </div>

                {/* Editable draft fields */}
                {selectedMessage.is_draft && isEditingDraft && editedDraft ? (
                  <div className="space-y-3">
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
                        className="w-full mt-1 p-3 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
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
                    {selectedMessage.subject && (
                      <div>
                        <label className="text-sm font-medium">Subject</label>
                        <p className="text-sm mt-1">{selectedMessage.subject}</p>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium">Message</label>
                      <p className="text-sm mt-1 p-3 bg-muted rounded-md whitespace-pre-wrap">
                        {selectedMessage.body}
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2 flex-wrap">
                      {/* Draft actions */}
                      {selectedMessage.is_draft && selectedMessage.draft_id && (
                        <>
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
                            className="flex-1"
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
                        </>
                      )}
                    </div>
                  </>
                )}
                
                {/* Non-draft action buttons */}
                {!selectedMessage.is_draft && (
                  <div className="flex gap-2 pt-2 flex-wrap">
                    {selectedMessage.contact_phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSmsReply(true)}
                        className="flex-1"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        SMS
                      </Button>
                    )}
                    {(selectedMessage.contact_email || selectedMessage.sender_email) && selectedMessage.contact_type !== "external" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowEmailReply(true)}
                        className="flex-1"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Email
                      </Button>
                    )}
                    {selectedMessage.contact_id && selectedMessage.contact_type !== "draft" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(selectedMessage.contact_type === "lead" ? "/leads" : "/property-owners")}
                        className="flex-1"
                      >
                        <ArrowUpRight className="h-4 w-4 mr-2" />
                        View {selectedMessage.contact_type}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a message to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SMS Reply Dialog */}
      {selectedMessage && selectedMessage.contact_phone && (
        <SendSMSDialog
          open={showSmsReply}
          onOpenChange={setShowSmsReply}
          contactName={selectedMessage.contact_name}
          contactPhone={selectedMessage.contact_phone}
          contactType={selectedMessage.contact_type === "external" || selectedMessage.contact_type === "draft" ? "lead" : selectedMessage.contact_type}
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
