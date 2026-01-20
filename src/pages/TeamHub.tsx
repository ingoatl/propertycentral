import { useState, useCallback, useEffect } from 'react';
import { Hash, Settings, Bell, Moon, Focus } from 'lucide-react';
import { useAuth } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { 
  useTeamChannels, 
  useTeamMessages, 
  useSendMessage, 
  useTeamPresence,
  useUnreadCounts,
  useMarkChannelRead 
} from '@/hooks/useTeamHub';
import { ChannelSidebar } from '@/components/team-hub/ChannelSidebar';
import { MessageThread } from '@/components/team-hub/MessageThread';
import { MessageComposer } from '@/components/team-hub/MessageComposer';
import { PresencePanel } from '@/components/team-hub/PresencePanel';
import { NotificationBell } from '@/components/team-hub/NotificationBell';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export default function TeamHub() {
  const { user } = useAuth();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showPresence, setShowPresence] = useState(true);

  // Data hooks
  const { data: channels = [], isLoading: channelsLoading } = useTeamChannels();
  const { data: messages = [], isLoading: messagesLoading } = useTeamMessages(selectedChannelId);
  const { data: unreadCounts = {} } = useUnreadCounts();
  const { presence, updatePresence } = useTeamPresence();
  const sendMessage = useSendMessage();
  const markRead = useMarkChannelRead(selectedChannelId);

  // Auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  // Mark channel as read when selected
  useEffect(() => {
    if (selectedChannelId) {
      markRead.mutate();
    }
  }, [selectedChannelId]);

  const selectedChannel = channels.find(c => c.id === selectedChannelId);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!selectedChannelId) return;
    
    try {
      await sendMessage.mutateAsync({
        channelId: selectedChannelId,
        content,
      });
    } catch (error) {
      toast.error('Failed to send message');
      throw error;
    }
  }, [selectedChannelId, sendMessage]);

  const handleSetStatus = useCallback((status: 'online' | 'away' | 'dnd') => {
    updatePresence(status);
    toast.success(`Status set to ${status === 'dnd' ? 'Do Not Disturb' : status}`);
  }, [updatePresence]);

  return (
    <div className="h-[calc(100vh-80px)] flex bg-background">
      {/* Channel Sidebar */}
      <ChannelSidebar
        channels={channels}
        selectedChannelId={selectedChannelId}
        onSelectChannel={setSelectedChannelId}
        unreadCounts={unreadCounts}
        isLoading={channelsLoading}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel Header */}
        <div className="h-14 border-b flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">{selectedChannel?.display_name || 'Select a channel'}</h2>
            {selectedChannel?.description && (
              <span className="text-sm text-muted-foreground hidden md:block">
                — {selectedChannel.description}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            
            {/* Status Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSetStatus('online')}>
                  <span className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                  Set as Online
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetStatus('away')}>
                  <Moon className="h-4 w-4 mr-2" />
                  Set as Away
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetStatus('dnd')}>
                  <Focus className="h-4 w-4 mr-2" />
                  Do Not Disturb
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowPresence(!showPresence)}>
                  {showPresence ? 'Hide' : 'Show'} Team Panel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Messages */}
        <MessageThread
          messages={messages}
          currentUserId={user?.id || null}
          isLoading={messagesLoading}
        />

        {/* Composer */}
        {selectedChannelId && (
          <MessageComposer
            onSend={handleSendMessage}
            isLoading={sendMessage.isPending}
            channelName={selectedChannel?.name}
          />
        )}
      </div>

      {/* Presence Panel */}
      {showPresence && (
        <PresencePanel
          presence={presence}
        />
      )}
    </div>
  );
}
