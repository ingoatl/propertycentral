import { memo, useRef, useEffect } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { Building2, User, Briefcase, Users, Pin, FileIcon, Download, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TeamMessage } from '@/hooks/useTeamHub';

interface SlackStyleMessageThreadProps {
  messages: TeamMessage[];
  currentUserId: string | null;
  isLoading?: boolean;
}

interface MessageGroup {
  date: Date;
  messages: TeamMessage[];
}

const DateDivider = memo(function DateDivider({ date }: { date: Date }) {
  const formatDateLabel = (d: Date) => {
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'EEEE, MMMM d');
  };

  return (
    <div className="flex items-center gap-3 py-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs font-medium text-muted-foreground px-2">
        {formatDateLabel(date)}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
});

const MessageAttachment = memo(function MessageAttachment({ 
  attachment 
}: { 
  attachment: { url: string; name: string; type: string } 
}) {
  const isImage = attachment.type?.startsWith('image/');

  if (isImage) {
    return (
      <a 
        href={attachment.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="block mt-2 max-w-sm"
      >
        <img
          src={attachment.url}
          alt={attachment.name}
          className="rounded-lg border max-h-64 object-cover hover:opacity-90 transition-opacity"
        />
      </a>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 mt-2 px-3 py-2 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
    >
      <FileIcon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium truncate max-w-[200px]">{attachment.name}</span>
      <Download className="h-4 w-4 text-muted-foreground" />
    </a>
  );
});

const SlackStyleMessage = memo(function SlackStyleMessage({ 
  message,
  showAvatar,
  showName,
}: { 
  message: TeamMessage;
  showAvatar: boolean;
  showName: boolean;
}) {
  const senderName = message.sender?.first_name || message.sender?.email?.split('@')[0] || 'Unknown';
  const initials = senderName.substring(0, 2).toUpperCase();
  
  const formatTime = (dateString: string) => format(new Date(dateString), 'h:mm a');

  const hasContext = message.property_id || message.lead_id || message.work_order_id || message.owner_id;
  
  // Parse attachments from message
  const attachments = (() => {
    try {
      if (typeof message.file_url === 'string' && message.file_url) {
        return [{ url: message.file_url, name: message.file_name || 'file', type: 'application/octet-stream' }];
      }
      return [];
    } catch {
      return [];
    }
  })();

  // Parse @mentions in content
  const renderContent = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="text-primary font-medium bg-primary/10 px-1 rounded">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={cn(
      'flex gap-3 group hover:bg-accent/30 px-4 py-1 -mx-4 transition-colors',
      !showAvatar && 'pl-14'
    )}>
      {showAvatar ? (
        <Avatar className="h-9 w-9 shrink-0 mt-0.5">
          <AvatarImage src={(message.sender as any)?.avatar_url} alt={senderName} />
          <AvatarFallback className="text-xs font-medium bg-primary/10">
            {initials}
          </AvatarFallback>
        </Avatar>
      ) : (
        <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity w-10 text-right shrink-0">
          {formatTime(message.created_at)}
        </span>
      )}
      
      <div className="flex-1 min-w-0">
        {showName && (
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm">{senderName}</span>
            <span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span>
            {message.is_pinned && <Pin className="h-3 w-3 text-amber-500" />}
            {message.is_edited && <span className="text-xs text-muted-foreground">(edited)</span>}
          </div>
        )}
        
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {renderContent(message.content)}
        </p>

        {/* Attachments */}
        {attachments.map((attachment, i) => (
          <MessageAttachment key={i} attachment={attachment} />
        ))}

        {/* Context badges */}
        {hasContext && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.property_id && (
              <Badge variant="outline" className="text-xs gap-1 bg-background">
                <Building2 className="h-3 w-3" />
                Property
              </Badge>
            )}
            {message.lead_id && (
              <Badge variant="outline" className="text-xs gap-1 bg-background">
                <User className="h-3 w-3" />
                Lead
              </Badge>
            )}
            {message.work_order_id && (
              <Badge variant="outline" className="text-xs gap-1 bg-background">
                <Briefcase className="h-3 w-3" />
                Work Order
              </Badge>
            )}
            {message.owner_id && (
              <Badge variant="outline" className="text-xs gap-1 bg-background">
                <Users className="h-3 w-3" />
                Owner
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export const SlackStyleMessageThread = memo(function SlackStyleMessageThread({
  messages,
  currentUserId,
  isLoading,
}: SlackStyleMessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 p-4">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-4 w-full max-w-md bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No messages yet</p>
          <p className="text-sm">Be the first to start the conversation!</p>
        </div>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  messages.forEach((message) => {
    const messageDate = new Date(message.created_at);
    
    if (!currentGroup || !isSameDay(messageDate, currentGroup.date)) {
      currentGroup = { date: messageDate, messages: [] };
      groupedMessages.push(currentGroup);
    }
    currentGroup.messages.push(message);
  });

  // Determine if we should show avatar and name (for consecutive messages from same sender)
  const shouldShowHeader = (message: TeamMessage, index: number, groupMessages: TeamMessage[]) => {
    if (index === 0) return true;
    const prevMessage = groupMessages[index - 1];
    if (prevMessage.sender_id !== message.sender_id) return true;
    
    // Show header if more than 5 minutes between messages
    const timeDiff = new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime();
    return timeDiff > 5 * 60 * 1000;
  };

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="py-4">
        {groupedMessages.map((group, groupIndex) => (
          <div key={groupIndex}>
            <DateDivider date={group.date} />
            {group.messages.map((message, messageIndex) => {
              const showHeader = shouldShowHeader(message, messageIndex, group.messages);
              return (
                <SlackStyleMessage
                  key={message.id}
                  message={message}
                  showAvatar={showHeader}
                  showName={showHeader}
                />
              );
            })}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
});
