import { useState, useCallback, useEffect } from 'react';
import { Hash, Settings, Moon, Focus, Menu, X, Users } from 'lucide-react';
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
import { SlackStyleMessageThread } from '@/components/team-hub/SlackStyleMessageThread';
import { EnhancedMessageComposer } from '@/components/team-hub/EnhancedMessageComposer';
import { PresencePanel } from '@/components/team-hub/PresencePanel';
import { NotificationBell } from '@/components/team-hub/NotificationBell';
import { NotificationPreferencesPanel } from '@/components/team-hub/NotificationPreferencesPanel';
import { TeamHubAdmin } from '@/components/team-hub/TeamHubAdmin';
import { ProfileAvatarUpload } from '@/components/team-hub/ProfileAvatarUpload';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function TeamHub() {
  const { user } = useAuth();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showPresence, setShowPresence] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
    setShowMobileSidebar(false);
  };

  // Calculate total unread
  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-background sticky top-0 z-10">
        <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Menu className="h-5 w-5" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <ChannelSidebar
              channels={channels}
              selectedChannelId={selectedChannelId}
              onSelectChannel={handleSelectChannel}
              unreadCounts={unreadCounts}
              isLoading={channelsLoading}
            />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 flex-1 justify-center">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold truncate">{selectedChannel?.display_name || 'Team Hub'}</h2>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setShowPresence(!showPresence)}>
            <Users className="h-5 w-5" />
          </Button>
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Team Hub Settings</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="preferences">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="preferences">Notifications</TabsTrigger>
                  <TabsTrigger value="admin">Team Invites</TabsTrigger>
                </TabsList>
                <TabsContent value="preferences" className="mt-4">
                  <NotificationPreferencesPanel />
                </TabsContent>
                <TabsContent value="admin" className="mt-4">
                  <TeamHubAdmin />
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Mobile Team Panel (slide-up) */}
      {showPresence && (
        <div className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-background border-t rounded-t-xl shadow-lg max-h-[50vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background">
            <h3 className="font-semibold">Team Online</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowPresence(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <PresencePanel presence={presence} />
        </div>
      )}

      {/* Desktop Channel Sidebar */}
      <div className="hidden md:block">
        <ChannelSidebar
          channels={channels}
          selectedChannelId={selectedChannelId}
          onSelectChannel={setSelectedChannelId}
          unreadCounts={unreadCounts}
          isLoading={channelsLoading}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Channel Header */}
        <div className="hidden md:flex h-14 border-b items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">{selectedChannel?.display_name || 'Select a channel'}</h2>
            {selectedChannel?.description && (
              <span className="text-sm text-muted-foreground hidden lg:block">
                — {selectedChannel.description}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            
            {/* Settings Dialog */}
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Team Hub Settings</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="preferences">
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="preferences">Notifications</TabsTrigger>
                    <TabsTrigger value="admin">Team Invites</TabsTrigger>
                    <TabsTrigger value="status">Status</TabsTrigger>
                  </TabsList>
                  <TabsContent value="preferences" className="mt-4">
                    <NotificationPreferencesPanel />
                  </TabsContent>
                  <TabsContent value="admin" className="mt-4">
                    <TeamHubAdmin />
                  </TabsContent>
                  <TabsContent value="status" className="mt-4 space-y-6">
                    {/* Profile Picture Upload */}
                    <div className="space-y-3">
                      <h4 className="font-medium">Your Profile Picture</h4>
                      <ProfileAvatarUpload size="lg" />
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium">Set Your Status</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <Button variant="outline" onClick={() => handleSetStatus('online')} className="gap-2">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          Online
                        </Button>
                        <Button variant="outline" onClick={() => handleSetStatus('away')} className="gap-2">
                          <Moon className="h-4 w-4" />
                          Away
                        </Button>
                        <Button variant="outline" onClick={() => handleSetStatus('dnd')} className="gap-2">
                          <Focus className="h-4 w-4" />
                          DND
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
            
            {/* Desktop Presence Toggle */}
            <Button variant="ghost" size="icon" onClick={() => setShowPresence(!showPresence)}>
              <Users className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages - Slack Style */}
        <SlackStyleMessageThread
          messages={messages}
          currentUserId={user?.id || null}
          isLoading={messagesLoading}
        />

        {/* Enhanced Composer with emoji, files, @mentions */}
        {selectedChannelId && (
          <EnhancedMessageComposer
            onSend={handleSendMessage}
            isLoading={sendMessage.isPending}
            channelName={selectedChannel?.name}
          />
        )}
      </div>

      {/* Desktop Presence Panel */}
      {showPresence && (
        <div className="hidden md:block">
          <PresencePanel presence={presence} />
        </div>
      )}
    </div>
  );
}
