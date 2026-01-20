import { useState, useMemo, useCallback, memo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { MessageSquare, Send, Building2, User, Users, Hash, AtSign, ExternalLink } from 'lucide-react';
import { useTeamChannels, useSendMessage, useTeamPresence } from '@/hooks/useTeamHub';
import { useNavigate } from 'react-router-dom';

interface TeamHubPanelProps {
  propertyId?: string;
  leadId?: string;
  ownerId?: string;
  workOrderId?: string;
  propertyName?: string;
  leadName?: string;
  ownerName?: string;
  compact?: boolean;
}

// Team members for DMs
const TEAM_MEMBERS = [
  { id: 'alex', name: 'Alex' },
  { id: 'anja', name: 'Anja' },
  { id: 'catherine', name: 'Catherine' },
  { id: 'chris', name: 'Chris' },
  { id: 'ingo', name: 'Ingo' },
] as const;

export const TeamHubPanel = memo(function TeamHubPanel({ 
  propertyId, 
  leadId, 
  ownerId,
  workOrderId,
  propertyName,
  leadName,
  ownerName,
  compact = false 
}: TeamHubPanelProps) {
  const [messageMode, setMessageMode] = useState<'channel' | 'dm'>('channel');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: channels = [], isLoading: channelsLoading } = useTeamChannels();
  const { presence } = useTeamPresence();
  const sendMessage = useSendMessage();

  // Memoized context check
  const hasContext = useMemo(
    () => !!(propertyName || leadName || ownerName),
    [propertyName, leadName, ownerName]
  );

  const handleSend = useCallback(async () => {
    if (messageMode === 'channel' && !selectedChannelId) {
      toast.error('Please select a channel');
      return;
    }
    if (messageMode === 'dm' && !selectedMember) {
      toast.error('Please select a team member');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      await sendMessage.mutateAsync({
        channelId: selectedChannelId,
        content: message,
        context: {
          propertyId,
          leadId,
          ownerId,
          workOrderId,
        },
      });
      
      const target = messageMode === 'channel' 
        ? channels.find(c => c.id === selectedChannelId)?.display_name 
        : TEAM_MEMBERS.find(m => m.id === selectedMember)?.name;
      toast.success(`Message sent to ${target}!`);
      setMessage('');
    } catch (error) {
      toast.error('Failed to send message');
    }
  }, [messageMode, selectedChannelId, selectedMember, message, sendMessage, channels, propertyId, leadId, ownerId, workOrderId]);

  const isSendDisabled = useMemo(
    () => sendMessage.isPending || !message.trim() ||
      (messageMode === 'channel' && !selectedChannelId) ||
      (messageMode === 'dm' && !selectedMember),
    [sendMessage.isPending, message, messageMode, selectedChannelId, selectedMember]
  );

  // Get online team members for status dots
  const getOnlineStatus = (memberId: string) => {
    const member = presence.find(p => {
      const profile = (p as any).profile;
      return profile?.first_name?.toLowerCase() === memberId;
    });
    if (!member) return 'offline';
    return member.status;
  };

  if (compact) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Team Hub</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/team-hub')}
              className="h-6 text-xs"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open
            </Button>
          </div>
          
          <div className="space-y-2">
            <Tabs value={messageMode} onValueChange={(v) => setMessageMode(v as 'channel' | 'dm')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="channel" className="text-xs h-6">
                  <Hash className="h-3 w-3 mr-1" />
                  Channel
                </TabsTrigger>
                <TabsTrigger value="dm" className="text-xs h-6">
                  <AtSign className="h-3 w-3 mr-1" />
                  DM
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {messageMode === 'channel' ? (
              <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={channelsLoading ? "Loading..." : "Select channel"} />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id} className="text-xs">
                      #{ch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_MEMBERS.map((member) => (
                    <SelectItem key={member.id} value={member.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${
                          getOnlineStatus(member.id) === 'online' ? 'bg-green-500' :
                          getOnlineStatus(member.id) === 'away' ? 'bg-yellow-500' :
                          getOnlineStatus(member.id) === 'dnd' ? 'bg-red-500' : 'bg-gray-400'
                        }`} />
                        @{member.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <Textarea
              placeholder="Type message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[60px] text-xs resize-none"
            />
            
            <Button 
              size="sm" 
              className="w-full h-7 text-xs"
              onClick={handleSend}
              disabled={isSendDisabled}
            >
              <Send className="h-3 w-3 mr-1" />
              {sendMessage.isPending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Team Hub
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/team-hub')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Team Hub
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Context Display */}
        {hasContext && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Context (auto-attached):</p>
            <div className="flex flex-wrap gap-2">
              {propertyName && (
                <Badge variant="secondary" className="text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  {propertyName}
                </Badge>
              )}
              {leadName && (
                <Badge variant="secondary" className="text-xs">
                  <User className="h-3 w-3 mr-1" />
                  {leadName}
                </Badge>
              )}
              {ownerName && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {ownerName}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Send Message Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Send Message</span>
          </div>

          {/* Channel vs DM Toggle */}
          <Tabs value={messageMode} onValueChange={(v) => setMessageMode(v as 'channel' | 'dm')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="channel" className="gap-2">
                <Hash className="h-4 w-4" />
                Channel
              </TabsTrigger>
              <TabsTrigger value="dm" className="gap-2">
                <AtSign className="h-4 w-4" />
                Direct Message
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {messageMode === 'channel' ? (
            <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
              <SelectTrigger>
                <SelectValue placeholder={channelsLoading ? "Loading channels..." : "Select a channel"} />
              </SelectTrigger>
              <SelectContent>
                {channels.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    <div className="flex flex-col">
                      <span>#{ch.name}</span>
                      {ch.description && (
                        <span className="text-xs text-muted-foreground">{ch.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {TEAM_MEMBERS.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        getOnlineStatus(member.id) === 'online' ? 'bg-green-500' :
                        getOnlineStatus(member.id) === 'away' ? 'bg-yellow-500' :
                        getOnlineStatus(member.id) === 'dnd' ? 'bg-red-500' : 'bg-gray-400'
                      }`} />
                      @{member.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Textarea
            placeholder={`Message ${messageMode === 'channel' && selectedChannelId 
              ? `#${channels.find(c => c.id === selectedChannelId)?.name || ''}` 
              : selectedMember ? `@${TEAM_MEMBERS.find(m => m.id === selectedMember)?.name}` : '...'}`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[80px] resize-none"
          />
          
          <Button 
            className="w-full"
            onClick={handleSend}
            disabled={isSendDisabled}
          >
            <Send className="h-4 w-4 mr-2" />
            {sendMessage.isPending ? 'Sending...' : 'Send Message'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
