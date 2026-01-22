import { format, isToday, isYesterday, parseISO } from "date-fns";
import { Mail, MessageSquare, Phone, Loader2, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SentMessage {
  id: string;
  communication_type: string;
  subject: string | null;
  body: string | null;
  created_at: string;
  sent_at: string | null;
  status: string | null;
  recipient_name: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  contact_type: "lead" | "owner" | "tenant" | "external";
  sender_name?: string;
}

interface SentMessagesListProps {
  messages: SentMessage[];
  isLoading: boolean;
  onSelectMessage?: (message: SentMessage) => void;
  selectedMessageId?: string;
}

function formatTime(dateString: string): string {
  try {
    const date = parseISO(dateString);
    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (isYesterday(date)) {
      return "Yesterday";
    } else {
      return format(date, "MMM d");
    }
  } catch {
    return "";
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case "email":
      return <Mail className="h-4 w-4 text-primary" />;
    case "sms":
      return <MessageSquare className="h-4 w-4 text-primary" />;
    case "call":
      return <Phone className="h-4 w-4 text-primary" />;
    default:
      return <Send className="h-4 w-4 text-muted-foreground" />;
  }
}

function getContactTypeBadge(contactType: string) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    lead: { label: "Lead", variant: "default" },
    owner: { label: "Owner", variant: "secondary" },
    tenant: { label: "Tenant", variant: "outline" },
    external: { label: "External", variant: "outline" },
  };
  
  const badge = config[contactType] || config.external;
  return (
    <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0">
      {badge.label}
    </Badge>
  );
}

export function SentMessagesList({ 
  messages, 
  isLoading, 
  onSelectMessage,
  selectedMessageId 
}: SentMessagesListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <Send className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-base">No sent messages</p>
        <p className="text-sm opacity-70">Messages you send will appear here</p>
      </div>
    );
  }

  // Group messages by date
  const groupedByDate = messages.reduce((acc, msg) => {
    const date = parseISO(msg.sent_at || msg.created_at);
    let label: string;
    if (isToday(date)) {
      label = "Today";
    } else if (isYesterday(date)) {
      label = "Yesterday";
    } else {
      label = format(date, "EEEE, MMMM d");
    }
    
    if (!acc[label]) {
      acc[label] = [];
    }
    acc[label].push(msg);
    return acc;
  }, {} as Record<string, SentMessage[]>);

  return (
    <ScrollArea className="flex-1">
      {Object.entries(groupedByDate).map(([dateLabel, dateMessages]) => (
        <div key={dateLabel}>
          {/* Date separator header */}
          <div className="sticky top-0 bg-background/95 backdrop-blur px-4 py-2 border-b z-10">
            <span className="text-sm font-medium text-muted-foreground">{dateLabel}</span>
          </div>
          
          {dateMessages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => onSelectMessage?.(msg)}
              className={cn(
                "group relative flex items-start gap-3 px-3 py-3 cursor-pointer border-b border-border/30",
                "transition-all duration-200 ease-out hover:bg-muted/30",
                selectedMessageId === msg.id && "bg-primary/5"
              )}
            >
              {/* Type icon */}
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                  {getTypeIcon(msg.communication_type)}
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-muted-foreground">To:</span>
                  <span className="font-medium text-sm truncate">{msg.recipient_name}</span>
                  {getContactTypeBadge(msg.contact_type)}
                </div>
                
                {/* Subject (for emails) */}
                {msg.subject && (
                  <p className="text-sm font-medium text-foreground truncate mb-0.5">
                    {msg.subject}
                  </p>
                )}
                
                {/* Body preview */}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {msg.body?.substring(0, 150) || "No content"}
                </p>
                
                {/* Sender info if available */}
                {msg.sender_name && (
                  <div className="flex items-center gap-1 mt-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Sent by {msg.sender_name}</span>
                  </div>
                )}
              </div>
              
              {/* Timestamp & Status */}
              <div className="flex-shrink-0 text-right">
                <span className="text-xs text-muted-foreground">
                  {formatTime(msg.sent_at || msg.created_at)}
                </span>
                {msg.status && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px] px-1.5 mt-1 block",
                      msg.status === "sent" && "border-primary/50 text-primary",
                      msg.status === "delivered" && "border-primary/50 text-primary",
                      msg.status === "failed" && "border-destructive/50 text-destructive"
                    )}
                  >
                    {msg.status}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </ScrollArea>
  );
}