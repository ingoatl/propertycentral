import { memo } from 'react';
import { Hash, Lock, Users, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TeamChannel } from '@/hooks/useTeamHub';

interface ChannelSidebarProps {
  channels: TeamChannel[];
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  unreadCounts: Record<string, number>;
  isLoading?: boolean;
}

export const ChannelSidebar = memo(function ChannelSidebar({
  channels,
  selectedChannelId,
  onSelectChannel,
  unreadCounts,
  isLoading,
}: ChannelSidebarProps) {
  const publicChannels = channels.filter(c => c.channel_type === 'public');
  const privateChannels = channels.filter(c => c.channel_type === 'private');
  const dmChannels = channels.filter(c => c.channel_type === 'dm');

  const renderChannel = (channel: TeamChannel) => {
    const unreadCount = unreadCounts[channel.id] || 0;
    const isSelected = selectedChannelId === channel.id;

    return (
      <button
        key={channel.id}
        onClick={() => onSelectChannel(channel.id)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isSelected && 'bg-accent text-accent-foreground font-medium',
          !isSelected && unreadCount > 0 && 'font-semibold'
        )}
      >
        {channel.channel_type === 'private' ? (
          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : channel.channel_type === 'dm' ? (
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate flex-1 text-left">{channel.display_name}</span>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </button>
    );
  };

  if (isLoading) {
    return (
      <div className="w-64 border-r bg-muted/30 p-4">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Team Hub
        </h2>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {/* Public Channels */}
          {publicChannels.length > 0 && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 w-full hover:text-foreground">
                <ChevronDown className="h-3 w-3" />
                Channels
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 mt-1">
                {publicChannels.map(renderChannel)}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Private Channels */}
          {privateChannels.length > 0 && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 w-full hover:text-foreground">
                <ChevronDown className="h-3 w-3" />
                Private Channels
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 mt-1">
                {privateChannels.map(renderChannel)}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Direct Messages */}
          {dmChannels.length > 0 && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 w-full hover:text-foreground">
                <ChevronDown className="h-3 w-3" />
                Direct Messages
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 mt-1">
                {dmChannels.map(renderChannel)}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});
