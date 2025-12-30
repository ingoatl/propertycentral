import { useEffect, useRef } from "react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Phone, Mail, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Communication {
  id: string;
  communication_type: string;
  direction: string;
  body: string;
  subject?: string;
  status?: string;
  created_at: string;
  is_read?: boolean;
}

interface LeadConversationThreadProps {
  communications: Communication[];
  leadName: string;
}

export function LeadConversationThread({ communications, leadName }: LeadConversationThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [communications]);

  if (!communications || communications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">No messages yet</p>
        <p className="text-xs mt-1">Send an SMS or email to start the conversation</p>
      </div>
    );
  }

  // Sort messages chronologically (oldest first for chat view)
  const sortedMessages = [...communications].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Group messages by date
  const groupedMessages: { date: Date; messages: Communication[] }[] = [];
  sortedMessages.forEach((msg) => {
    const msgDate = new Date(msg.created_at);
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    
    if (lastGroup && isSameDay(lastGroup.date, msgDate)) {
      lastGroup.messages.push(msg);
    } else {
      groupedMessages.push({ date: msgDate, messages: [msg] });
    }
  });

  const formatDateHeader = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMMM d, yyyy");
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sms":
        return <MessageSquare className="h-3 w-3" />;
      case "email":
        return <Mail className="h-3 w-3" />;
      case "call":
      case "voice_call":
        return <Phone className="h-3 w-3" />;
      default:
        return <MessageSquare className="h-3 w-3" />;
    }
  };

  const getStatusIcon = (status: string | undefined) => {
    if (status === "delivered" || status === "sent") {
      return <CheckCheck className="h-3 w-3 text-primary" />;
    }
    if (status === "pending") {
      return <Check className="h-3 w-3 text-muted-foreground" />;
    }
    return null;
  };

  return (
    <ScrollArea className="h-[300px] pr-4" ref={scrollRef}>
      <div className="space-y-4 pb-4">
        {groupedMessages.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* Date Header */}
            <div className="flex items-center justify-center my-4">
              <span className="text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full font-medium">
                {formatDateHeader(group.date)}
              </span>
            </div>

            {/* Messages for this date */}
            <div className="space-y-3">
              {group.messages.map((comm) => {
                const isOutbound = comm.direction === "outbound";
                const isVoiceCall = comm.communication_type === "call" || comm.communication_type === "voice_call";

                return (
                  <div
                    key={comm.id}
                    className={cn(
                      "flex",
                      isOutbound ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-4 py-3 shadow-sm",
                        isOutbound
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-foreground rounded-bl-sm border border-border/50",
                        isVoiceCall && "bg-muted/80 border-2 border-dashed border-border"
                      )}
                    >
                      {/* Sender label for inbound */}
                      {!isOutbound && (
                        <p className="text-xs font-semibold text-primary mb-1">
                          {leadName}
                        </p>
                      )}

                      {/* Message Header for special types */}
                      {(comm.communication_type !== "sms" || isVoiceCall) && (
                        <div className={cn(
                          "flex items-center gap-1.5 mb-1.5",
                          isOutbound ? "text-white/80" : "text-muted-foreground"
                        )}>
                          {getTypeIcon(comm.communication_type)}
                          <span className="text-xs uppercase tracking-wide font-medium">
                            {comm.communication_type.replace("_", " ")}
                          </span>
                        </div>
                      )}

                      {/* Email Subject */}
                      {comm.communication_type === "email" && comm.subject && (
                        <p className={cn(
                          "font-semibold text-sm mb-2",
                          isOutbound ? "text-white/90" : "text-foreground"
                        )}>
                          {comm.subject}
                        </p>
                      )}

                      {/* Message Body */}
                      <p className={cn(
                        "whitespace-pre-wrap break-words text-sm leading-relaxed",
                        isOutbound ? "text-white" : "text-foreground"
                      )}>
                        {comm.body}
                      </p>

                      {/* Timestamp and Status */}
                      <div
                        className={cn(
                          "flex items-center gap-1.5 mt-2",
                          isOutbound ? "justify-end text-white/60" : "justify-start text-muted-foreground"
                        )}
                      >
                        <span className="text-[10px]">
                          {format(new Date(comm.created_at), "h:mm a")}
                        </span>
                        {isOutbound && getStatusIcon(comm.status)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
