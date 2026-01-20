import { memo, useState } from 'react';
import { Circle, Moon, MinusCircle, Clock, MessageSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { TeamPresence } from '@/hooks/useTeamHub';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/components/ProtectedRoute';

interface PresencePanelProps {
  presence: TeamPresence[];
  isLoading?: boolean;
}

const StatusIndicator = memo(function StatusIndicator({ 
  status 
}: { 
  status: TeamPresence['status'];
}) {
  switch (status) {
    case 'online':
      return <Circle className="h-3 w-3 fill-green-500 text-green-500" />;
    case 'away':
      return <Moon className="h-3 w-3 fill-amber-500 text-amber-500" />;
    case 'dnd':
      return <MinusCircle className="h-3 w-3 fill-red-500 text-red-500" />;
    default:
      return <Circle className="h-3 w-3 text-muted-foreground" />;
  }
});

interface PresenceItemProps {
  presence: TeamPresence;
  onClickDM: (userId: string, userName: string) => void;
}

const PresenceItem = memo(function PresenceItem({
  presence,
  onClickDM,
}: PresenceItemProps) {
  const name = presence.user?.first_name || presence.user?.email?.split('@')[0] || 'Unknown';
  const initials = name.substring(0, 2).toUpperCase();
  const avatarUrl = (presence as any).user?.avatar_url;
  const jobTitle = (presence as any).user?.job_title;
  
  const statusLabel = {
    online: 'Online',
    away: 'Away',
    dnd: 'Do Not Disturb',
    offline: 'Offline',
  }[presence.status];

  const isFocusMode = presence.focus_mode_until && new Date(presence.focus_mode_until) > new Date();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer group"
          onClick={() => onClickDM(presence.user_id, name)}
        >
          <div className="relative">
            <Avatar className="h-8 w-8">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5">
              <StatusIndicator status={presence.status} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{name}</p>
            {jobTitle ? (
              <p className="text-xs text-muted-foreground truncate">{jobTitle}</p>
            ) : presence.status_text ? (
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                {presence.status_emoji && <span>{presence.status_emoji}</span>}
                {presence.status_text}
              </p>
            ) : isFocusMode ? (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Focus mode
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{statusLabel}</p>
            )}
          </div>
          <MessageSquare className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="left">
        <div className="text-xs">
          <p className="font-medium">{name}</p>
          {jobTitle && <p className="text-muted-foreground">{jobTitle}</p>}
          <p className="text-muted-foreground">
            Click to send a direct message
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

interface DirectMessageModalProps {
  open: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
}

function DirectMessageModal({ open, onClose, recipientId, recipientName }: DirectMessageModalProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || !user) return;

    setSending(true);
    try {
      // Find or create a DM channel between these two users
      const dmChannelName = [user.id, recipientId].sort().join('_');
      
      // Check if DM channel exists
      let { data: channel } = await supabase
        .from('team_channels')
        .select('id')
        .eq('name', dmChannelName)
        .eq('channel_type', 'dm')
        .single();

      // Create DM channel if it doesn't exist
      if (!channel) {
        const { data: newChannel, error: createError } = await supabase
          .from('team_channels')
          .insert({
            name: dmChannelName,
            display_name: `DM: ${recipientName}`,
            channel_type: 'dm',
            created_by: user.id,
          })
          .select()
          .single();

        if (createError) throw createError;
        channel = newChannel;

        // Add both users as members
        await supabase.from('team_channel_members').insert([
          { channel_id: channel.id, user_id: user.id },
          { channel_id: channel.id, user_id: recipientId },
        ]);
      }

      // Send the message
      const { error: messageError } = await supabase
        .from('team_messages')
        .insert({
          channel_id: channel.id,
          sender_id: user.id,
          content: message,
        });

      if (messageError) throw messageError;

      toast.success(`Message sent to ${recipientName}!`);
      setMessage('');
      onClose();
    } catch (error: any) {
      console.error('Failed to send DM:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Message {recipientName}
          </DialogTitle>
          <DialogDescription>
            Send a direct message to {recipientName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder={`Message ${recipientName}...`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSend();
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending || !message.trim()}>
              {sending ? 'Sending...' : 'Send Message'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Press ⌘+Enter to send
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const PresencePanel = memo(function PresencePanel({
  presence,
  isLoading,
}: PresencePanelProps) {
  const [dmModal, setDmModal] = useState<{ open: boolean; userId: string; userName: string }>({
    open: false,
    userId: '',
    userName: '',
  });
  const { user: currentUser } = useAuth();

  const onlineUsers = presence.filter(p => p.status === 'online');
  const awayUsers = presence.filter(p => p.status === 'away');
  const dndUsers = presence.filter(p => p.status === 'dnd');

  const handleClickDM = (userId: string, userName: string) => {
    // Don't open DM modal for yourself
    if (userId === currentUser?.id) return;
    setDmModal({ open: true, userId, userName });
  };

  if (isLoading) {
    return (
      <div className="w-56 border-l bg-muted/30 p-4">
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-56 border-l bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Team ({presence.length})</h3>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-4">
            {onlineUsers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1">
                  Online — {onlineUsers.length}
                </p>
                {onlineUsers.map((p) => (
                  <PresenceItem key={p.user_id} presence={p} onClickDM={handleClickDM} />
                ))}
              </div>
            )}

            {awayUsers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1">
                  Away — {awayUsers.length}
                </p>
                {awayUsers.map((p) => (
                  <PresenceItem key={p.user_id} presence={p} onClickDM={handleClickDM} />
                ))}
              </div>
            )}

            {dndUsers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1">
                  Do Not Disturb — {dndUsers.length}
                </p>
                {dndUsers.map((p) => (
                  <PresenceItem key={p.user_id} presence={p} onClickDM={handleClickDM} />
                ))}
              </div>
            )}

            {presence.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No team members online</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <DirectMessageModal
        open={dmModal.open}
        onClose={() => setDmModal({ open: false, userId: '', userName: '' })}
        recipientId={dmModal.userId}
        recipientName={dmModal.userName}
      />
    </>
  );
});