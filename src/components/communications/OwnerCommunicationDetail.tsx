import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  MessageSquare,
  Phone,
  Mail,
  X,
  Send,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal";
import { Owner360Panel } from "./Owner360Panel";
import { ConversationSummary } from "./ConversationSummary";
import { SendVoicemailButton } from "./SendVoicemailButton";

interface OwnerCommunicationDetailProps {
  ownerId: string;
  ownerName: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface Communication {
  id: string;
  communication_type: string;
  direction: string;
  body: string;
  subject?: string | null;
  created_at: string;
  status?: string | null;
}

export function OwnerCommunicationDetail({
  ownerId,
  ownerName,
  ownerEmail,
  ownerPhone,
  isOpen,
  onClose,
}: OwnerCommunicationDetailProps) {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Fetch all communications for this owner (from lead_communications AND user_phone_messages)
  const { data: communications = [], isLoading, refetch } = useQuery({
    queryKey: ["owner-communications", ownerId, ownerPhone],
    queryFn: async () => {
      // Fetch from lead_communications
      const { data: leadComms, error } = await supabase
        .from("lead_communications")
        .select("id, communication_type, direction, body, subject, created_at, status")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const leadMessages = (leadComms || []).map(comm => ({
        id: comm.id,
        communication_type: comm.communication_type,
        direction: comm.direction,
        body: comm.body,
        subject: comm.subject,
        created_at: comm.created_at,
        status: comm.status,
      }));
      
      // Also fetch from user_phone_messages if we have a phone number
      let userMessages: Communication[] = [];
      if (ownerPhone) {
        const { data: userMsgs } = await supabase
          .from("user_phone_messages")
          .select("id, direction, body, created_at, status")
          .or(`from_number.eq.${ownerPhone},to_number.eq.${ownerPhone}`)
          .order("created_at", { ascending: false });
        
        if (userMsgs) {
          userMessages = userMsgs.map(msg => ({
            id: msg.id,
            communication_type: "sms",
            direction: msg.direction,
            body: msg.body || "(No content)",
            created_at: msg.created_at,
            status: msg.status,
          }));
        }
      }
      
      // Combine and deduplicate
      const allMsgs = [...leadMessages, ...userMessages];
      allMsgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Deduplicate messages within 5 seconds with same body
      const deduped: Communication[] = [];
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
    },
    enabled: isOpen && !!ownerId,
  });

  // Fetch owner's properties
  const { data: ownerProperties = [] } = useQuery({
    queryKey: ["owner-properties", ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address")
        .eq("owner_id", ownerId);

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!ownerId,
  });

  const handleSendSMS = async () => {
    if (!newMessage.trim() || !ownerPhone) return;

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("ghl-send-sms", {
        body: { to: ownerPhone, message: newMessage },
      });

      if (error) throw error;

      toast.success("SMS sent to " + ownerName);
      setNewMessage("");
      refetch();
    } catch (error: any) {
      toast.error("Failed to send SMS: " + error.message);
    } finally {
      setSending(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sms":
        return <MessageSquare className="h-4 w-4" />;
      case "call":
        return <Phone className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "sms":
        return "bg-blue-500";
      case "call":
        return "bg-green-500";
      case "email":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  // Group communications by date
  const groupedComms: Record<string, Communication[]> = {};
  communications.forEach((comm) => {
    const dateKey = format(new Date(comm.created_at), "yyyy-MM-dd");
    if (!groupedComms[dateKey]) {
      groupedComms[dateKey] = [];
    }
    groupedComms[dateKey].push(comm);
  });

  const smsCount = communications.filter((c) => c.communication_type === "sms").length;
  const callCount = communications.filter((c) => c.communication_type === "call").length;
  const emailCount = communications.filter((c) => c.communication_type === "email").length;

  return (
    <ResponsiveModal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModalContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <ResponsiveModalHeader className="border-b pb-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <ResponsiveModalTitle className="text-lg">{ownerName}</ResponsiveModalTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  {ownerEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {ownerEmail}
                    </span>
                  )}
                  {ownerPhone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {ownerPhone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats and Voice Message Button */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <Badge variant="secondary" className="gap-1">
              <MessageSquare className="h-3 w-3" />
              {smsCount} SMS
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Phone className="h-3 w-3" />
              {callCount} Calls
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Mail className="h-3 w-3" />
              {emailCount} Emails
            </Badge>
            {ownerPhone && (
              <SendVoicemailButton
                recipientPhone={ownerPhone}
                recipientName={ownerName}
                ownerId={ownerId}
                variant="outline"
                size="sm"
              />
            )}
          </div>

          {/* Properties */}
          {ownerProperties.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {ownerProperties.map((prop) => (
                <Badge key={prop.id} variant="outline" className="gap-1">
                  <Building2 className="h-3 w-3" />
                  {prop.name}
                </Badge>
              ))}
            </div>
          )}

          {/* AI Insights Panel */}
          <Owner360Panel 
            ownerId={ownerId} 
            ownerName={ownerName}
            className="mt-4"
            defaultExpanded={false}
          />

          {/* Conversation Summary */}
          {communications.length >= 5 && (
            <ConversationSummary
              ownerId={ownerId}
              contactPhone={ownerPhone || undefined}
              contactEmail={ownerEmail || undefined}
              messageCount={communications.length}
              className="mt-3"
            />
          )}
        </ResponsiveModalHeader>

        {/* Communication List */}
        <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : communications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 opacity-30 mb-3" />
              <p>No communications yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedComms)
                .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                .map(([dateKey, comms]) => (
                  <div key={dateKey}>
                    <div className="text-xs text-muted-foreground text-center mb-3 sticky top-0 bg-background py-1">
                      {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
                    </div>
                    <div className="space-y-3">
                      {comms.map((comm) => (
                        <div
                          key={comm.id}
                          className={`flex ${
                            comm.direction === "outbound" ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg p-3 ${
                              comm.direction === "outbound"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                className={`text-xs h-5 px-1.5 ${getTypeBadgeColor(
                                  comm.communication_type
                                )} text-white border-0`}
                              >
                                {getTypeIcon(comm.communication_type)}
                              </Badge>
                              {comm.direction === "inbound" ? (
                                <ArrowDownLeft className="h-3 w-3 text-blue-500" />
                              ) : (
                                <ArrowUpRight className="h-3 w-3 text-green-500" />
                              )}
                              <span className="text-xs opacity-70">
                                {format(new Date(comm.created_at), "h:mm a")}
                              </span>
                            </div>
                            {comm.subject && (
                              <p className="text-xs font-medium mb-1 opacity-80">
                                {comm.subject}
                              </p>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{comm.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
          </div>
        </ScrollArea>

        {/* Quick Reply */}
        {ownerPhone && (
          <div className="p-4 border-t flex-shrink-0">
            <div className="flex items-center gap-2">
              <Input
                placeholder={`Message ${ownerName}...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendSMS()}
                className="flex-1"
              />
              <Button
                size="icon"
                onClick={handleSendSMS}
                disabled={!newMessage.trim() || sending}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
