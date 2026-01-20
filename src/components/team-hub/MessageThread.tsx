import { memo, useRef, useEffect } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Building2, User, Briefcase, Users, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TeamMessage } from '@/hooks/useTeamHub';

interface MessageThreadProps {
  messages: TeamMessage[];
  currentUserId: string | null;
  isLoading?: boolean;
}

const MessageBubble = memo(function MessageBubble({ 
  message, 
  isOwn 
}: { 
  message: TeamMessage; 
  isOwn: boolean;
}) {
  const senderName = message.sender?.first_name || message.sender?.email?.split('@')[0] || 'Unknown';
  const initials = senderName.substring(0, 2).toUpperCase();
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'h:mm a');
    }
    if (isYesterday(date)) {
      return `Yesterday ${format(date, 'h:mm a')}`;
    }
    return format(date, 'MMM d, h:mm a');
  };

  const hasContext = message.property_id || message.lead_id || message.work_order_id || message.owner_id;

  return (
    <div className={cn('flex gap-3 group', isOwn && 'flex-row-reverse')}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn(
          'text-xs font-medium',
          isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}>
          {initials}
        </AvatarFallback>
      </Avatar>
      
      <div className={cn('flex flex-col max-w-[70%]', isOwn && 'items-end')}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{senderName}</span>
          <span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span>
          {message.is_pinned && <Pin className="h-3 w-3 text-amber-500" />}
          {message.is_edited && <span className="text-xs text-muted-foreground">(edited)</span>}
        </div>
        
        <div className={cn(
          'rounded-lg px-4 py-2',
          isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}>
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        {/* Context badges */}
        {hasContext && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.property_id && (
              <Badge variant="outline" className="text-xs gap-1">
                <Building2 className="h-3 w-3" />
                Property
              </Badge>
            )}
            {message.lead_id && (
              <Badge variant="outline" className="text-xs gap-1">
                <User className="h-3 w-3" />
                Lead
              </Badge>
            )}
            {message.work_order_id && (
              <Badge variant="outline" className="text-xs gap-1">
                <Briefcase className="h-3 w-3" />
                Work Order
              </Badge>
            )}
            {message.owner_id && (
              <Badge variant="outline" className="text-xs gap-1">
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

export const MessageThread = memo(function MessageThread({
  messages,
  currentUserId,
  isLoading,
}: MessageThreadProps) {
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
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-16 w-full max-w-md bg-muted animate-pulse rounded-lg" />
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

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.sender_id === currentUserId}
          />
        ))}
      </div>
    </ScrollArea>
  );
});
