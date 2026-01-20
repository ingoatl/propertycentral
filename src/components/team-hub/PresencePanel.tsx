import { memo } from 'react';
import { Circle, Moon, MinusCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TeamPresence } from '@/hooks/useTeamHub';
import { formatDistanceToNow } from 'date-fns';

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

const PresenceItem = memo(function PresenceItem({
  presence,
}: {
  presence: TeamPresence;
}) {
  const name = presence.user?.first_name || presence.user?.email?.split('@')[0] || 'Unknown';
  const initials = name.substring(0, 2).toUpperCase();
  
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
        <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors">
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5">
              <StatusIndicator status={presence.status} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{name}</p>
            {presence.status_text ? (
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
        </div>
      </TooltipTrigger>
      <TooltipContent side="left">
        <div className="text-xs">
          <p className="font-medium">{name}</p>
          <p className="text-muted-foreground">
            Last seen {formatDistanceToNow(new Date(presence.last_seen_at), { addSuffix: true })}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

export const PresencePanel = memo(function PresencePanel({
  presence,
  isLoading,
}: PresencePanelProps) {
  const onlineUsers = presence.filter(p => p.status === 'online');
  const awayUsers = presence.filter(p => p.status === 'away');
  const dndUsers = presence.filter(p => p.status === 'dnd');

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
                <PresenceItem key={p.user_id} presence={p} />
              ))}
            </div>
          )}

          {awayUsers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1">
                Away — {awayUsers.length}
              </p>
              {awayUsers.map((p) => (
                <PresenceItem key={p.user_id} presence={p} />
              ))}
            </div>
          )}

          {dndUsers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1">
                Do Not Disturb — {dndUsers.length}
              </p>
              {dndUsers.map((p) => (
                <PresenceItem key={p.user_id} presence={p} />
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
  );
});
