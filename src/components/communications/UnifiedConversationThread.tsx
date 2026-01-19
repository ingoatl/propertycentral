import { useRef, useEffect } from "react";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { Phone, Mail, MessageSquare, Play, Paperclip, FileIcon, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ThreadMessage {
  id: string;
  type: "sms" | "call" | "email";
  direction: "inbound" | "outbound";
  body: string;
  subject?: string;
  created_at: string;
  media_urls?: string[];
  attachments?: { name: string; url: string; type?: string }[];
  call_duration?: number;
  call_recording_url?: string;
  status?: string;
}

interface UnifiedConversationThreadProps {
  messages: ThreadMessage[];
  contactName: string;
  onImageClick: (url: string) => void;
}

export function UnifiedConversationThread({
  messages,
  contactName,
  onImageClick,
}: UnifiedConversationThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest message when thread loads or updates
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      // Use setTimeout to ensure DOM has rendered
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages]);

  // Format date header
  const formatDateHeader = (date: Date): string => {
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "EEEE, MMM d");
  };

  // Get icon for message type
  const getTypeIcon = (type: string, isOutbound: boolean) => {
    switch (type) {
      case "call":
        return <Phone className="h-3 w-3" />;
      case "email":
        return <Mail className="h-3 w-3" />;
      default:
        return null;
    }
  };

  // Format call duration
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-12">
        <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">No messages yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="px-4 py-4 md:px-5 md:py-5 max-w-3xl mx-auto space-y-1.5">
        {messages.map((msg, idx) => {
          const isOutbound = msg.direction === "outbound";
          const msgDate = parseISO(msg.created_at);
          const showDateSeparator =
            idx === 0 ||
            format(msgDate, "yyyy-MM-dd") !==
              format(parseISO(messages[idx - 1].created_at), "yyyy-MM-dd");

          // Check if this message should be grouped with previous
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const isGrouped = prevMsg && 
            prevMsg.direction === msg.direction && 
            format(msgDate, "yyyy-MM-dd HH:mm") === format(parseISO(prevMsg.created_at), "yyyy-MM-dd HH:mm");

          return (
            <div key={msg.id}>
              {/* Date separator */}
              {showDateSeparator && (
                <div className="flex items-center justify-center py-4">
                  <span className="text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full font-medium">
                    {formatDateHeader(msgDate)}
                  </span>
                </div>
              )}

              {/* Message bubble - enhanced with larger padding and rounded corners */}
              <div className={`flex ${isOutbound ? "justify-end" : "justify-start"} ${isGrouped ? "mt-0.5" : "mt-2"}`}>
                <div className="max-w-[85%] md:max-w-[75%]">
                  <div
                    className={cn(
                      "rounded-3xl px-4 py-3 transition-all duration-200",
                      isOutbound
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {/* Call indicator */}
                    {msg.type === "call" && (
                      <div
                        className={`flex items-center gap-2 text-xs mb-2 ${
                          isOutbound ? "opacity-85" : "text-muted-foreground"
                        }`}
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span className="font-medium">{isOutbound ? "Outgoing call" : "Incoming call"}</span>
                        {msg.call_duration && (
                          <span>· {formatDuration(msg.call_duration)}</span>
                        )}
                        {msg.call_recording_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 ml-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(msg.call_recording_url, "_blank");
                            }}
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Email indicator */}
                    {msg.type === "email" && msg.subject && (
                      <div
                        className={`flex items-center gap-1.5 text-sm font-medium mb-1.5 ${
                          isOutbound ? "opacity-90" : ""
                        }`}
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {msg.subject}
                      </div>
                    )}

                    {/* MMS/SMS Images */}
                    {msg.media_urls && msg.media_urls.length > 0 && (
                      <div
                        className={`mb-2.5 grid gap-2 ${
                          msg.media_urls.length === 1
                            ? "grid-cols-1"
                            : "grid-cols-2"
                        }`}
                      >
                        {msg.media_urls.map((url, imgIdx) => (
                          <div
                            key={imgIdx}
                            className={`relative overflow-hidden rounded-xl cursor-pointer hover:opacity-90 transition-opacity ${
                              msg.media_urls!.length === 1
                                ? "aspect-auto max-h-72"
                                : "aspect-square"
                            }`}
                            onClick={() => onImageClick(url)}
                          >
                            <img
                              src={url}
                              alt="MMS attachment"
                              className={`w-full h-full ${
                                msg.media_urls!.length === 1
                                  ? "object-contain"
                                  : "object-cover"
                              }`}
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Email Attachments */}
                    {msg.type === "email" && msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-2.5 space-y-1.5">
                        {msg.attachments.map((att, attIdx) => {
                          const isImage = att.type?.startsWith("image/") || 
                            /\.(jpg|jpeg|png|gif|webp)$/i.test(att.name);
                          
                          if (isImage) {
                            return (
                              <div
                                key={attIdx}
                                className="relative overflow-hidden rounded-xl cursor-pointer hover:opacity-90 transition-opacity max-h-72"
                                onClick={() => onImageClick(att.url)}
                              >
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  className="w-full h-full object-contain"
                                  loading="lazy"
                                />
                              </div>
                            );
                          }
                          
                          return (
                            <a
                              key={attIdx}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:opacity-80 transition-opacity ${
                                isOutbound 
                                  ? "bg-primary-foreground/10" 
                                  : "bg-background"
                              }`}
                            >
                              <Paperclip className="h-4 w-4 shrink-0" />
                              <span className="truncate max-w-[200px]">{att.name}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}

                    {/* Message body - enhanced font size */}
                    <p className="text-base md:text-[15px] whitespace-pre-wrap leading-relaxed">
                      {msg.body}
                    </p>
                  </div>

                  {/* Timestamp - enhanced */}
                  <div
                    className={`text-xs text-muted-foreground mt-1 px-2 ${
                      isOutbound ? "text-right" : ""
                    }`}
                  >
                    {format(msgDate, "h:mm a")}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
