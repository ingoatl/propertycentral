import { memo, useState } from 'react';
import { Hash, Lock, Users, ChevronDown, ChevronRight, Plus, MessageSquarePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { TeamChannel } from '@/hooks/useTeamHub';
import { CreateGroupDM } from './CreateGroupDM';
import { NewDirectMessage } from './NewDirectMessage';
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
  const [openSections, setOpenSections] = useState({
    public: true,
    private: true,
    dm: true,
  });

  const publicChannels = channels.filter(c => c.channel_type === 'public');
  const privateChannels = channels.filter(c => c.channel_type === 'private');
  const dmChannels = channels.filter(c => c.channel_type === 'dm');

  const toggleSection = (section: 'public' | 'private' | 'dm') => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const renderChannel = (channel: TeamChannel) => {
    const unreadCount = unreadCounts[channel.id] || 0;
    const isSelected = selectedChannelId === channel.id;

    return (
      <button
        key={channel.id}
        onClick={() => onSelectChannel(channel.id)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground active:scale-[0.98]',
          'min-h-[44px]', // Mobile touch target
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

  const renderSection = (
    title: string,
    channels: TeamChannel[],
    section: 'public' | 'private' | 'dm'
  ) => {
    if (channels.length === 0) return null;

    const totalUnread = channels.reduce((sum, c) => sum + (unreadCounts[c.id] || 0), 0);

    return (
      <Collapsible open={openSections[section]} onOpenChange={() => toggleSection(section)}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-2 w-full hover:text-foreground min-h-[40px]">
          {openSections[section] ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <span className="flex-1 text-left">{title}</span>
          {totalUnread > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {totalUnread}
            </Badge>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-0.5 mt-1">
          {channels.map(renderChannel)}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  if (isLoading) {
    return (
      <div className="w-full md:w-64 border-r bg-muted/30 p-4 h-full">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full md:w-64 border-r bg-muted/30 flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Team Hub
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {channels.length} channels
        </p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* New Message Button - prominent placement */}
          <NewDirectMessage onDMCreated={onSelectChannel} />
          
          {renderSection('Channels', publicChannels, 'public')}
          {renderSection('Private Channels', privateChannels, 'private')}
          
          {/* DM Section with Create Group Button */}
          <div className="space-y-1">
            <Collapsible open={openSections.dm} onOpenChange={() => toggleSection('dm')}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-2 w-full hover:text-foreground min-h-[40px]">
                {openSections.dm ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span className="flex-1 text-left">Direct Messages</span>
                {dmChannels.reduce((sum, c) => sum + (unreadCounts[c.id] || 0), 0) > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {dmChannels.reduce((sum, c) => sum + (unreadCounts[c.id] || 0), 0)}
                  </Badge>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 mt-1">
                {dmChannels.map(renderChannel)}
                <CreateGroupDM onGroupCreated={onSelectChannel} />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
});
