import { useState, useMemo, useCallback, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { MessageSquare, Send, RefreshCw, Clock, CheckCircle2, XCircle, Zap, Building2, User, Users, Hash, AtSign } from 'lucide-react';
import { format } from 'date-fns';

interface TeamSlackPanelProps {
  propertyId?: string;
  leadId?: string;
  ownerId?: string;
  propertyName?: string;
  leadName?: string;
  ownerName?: string;
  compact?: boolean;
}

interface SlackChannel {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_member?: boolean;
  num_members?: number;
}

interface SlackMessage {
  id: string;
  channel: string;
  message: string;
  sender_name: string | null;
  status: string;
  created_at: string;
  template_used: string | null;
}

// Team members with their Slack user IDs - defined outside component to prevent recreation
const TEAM_MEMBERS = [
  { id: 'alex', name: 'Alex', slackId: 'U_ALEX' },
  { id: 'anja', name: 'Anja', slackId: 'U_ANJA' },
  { id: 'catherine', name: 'Catherine', slackId: 'U_CATHERINE' },
  { id: 'chris', name: 'Chris', slackId: 'U_CHRIS' },
  { id: 'ingo', name: 'Ingo', slackId: 'U_INGO' },
] as const;

const QUICK_TEMPLATES = [
  { id: 'update', label: 'Property Update', icon: Building2, prefix: '📍 Update: ' },
  { id: 'help', label: 'Need Help', icon: Users, prefix: '🆘 Need help: ' },
  { id: 'blocker', label: 'Blocker', icon: XCircle, prefix: '⚠️ BLOCKER: ' },
  { id: 'win', label: 'Win!', icon: CheckCircle2, prefix: '🎉 ' },
] as const;

// Memoized status icon component
const StatusIcon = memo(({ status }: { status: string }) => {
  switch (status) {
    case 'sent':
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case 'failed':
      return <XCircle className="h-3 w-3 text-red-500" />;
    default:
      return <Clock className="h-3 w-3 text-muted-foreground" />;
  }
});
StatusIcon.displayName = 'StatusIcon';

// Memoized message item
const MessageItem = memo(({ msg }: { msg: SlackMessage }) => (
  <div className="bg-muted/30 rounded-lg p-2 text-xs space-y-1">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] h-5">
          {msg.channel?.startsWith('@') ? msg.channel : `#${msg.channel}`}
        </Badge>
        <StatusIcon status={msg.status} />
      </div>
      <span className="text-muted-foreground text-[10px]">
        {format(new Date(msg.created_at), 'MMM d, h:mm a')}
      </span>
    </div>
    <p className="text-muted-foreground line-clamp-2">
      {msg.message.replace(/\*.*?\*\n/, '').substring(0, 100)}...
    </p>
    {msg.sender_name && (
      <p className="text-[10px] text-muted-foreground">
        by {msg.sender_name}
      </p>
    )}
  </div>
));
MessageItem.displayName = 'MessageItem';

export const TeamSlackPanel = memo(function TeamSlackPanel({ 
  propertyId, 
  leadId, 
  ownerId,
  propertyName,
  leadName,
  ownerName,
  compact = false 
}: TeamSlackPanelProps) {
  const [messageMode, setMessageMode] = useState<'channel' | 'dm'>('channel');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch available channels - try API first, fallback to database
  const { data: channels = [], isLoading: channelsLoading, error: channelsError } = useQuery({
    queryKey: ['slack-channels-live'],
    queryFn: async () => {
      console.log('[Slack Channels] Fetching channels from Slack API...');
      
      try {
        const { data, error } = await supabase.functions.invoke('fetch-slack-channels');
        
        if (error) {
          console.error('[Slack Channels] Edge function error:', error);
          throw error;
        }
        
        if (!data?.success) {
          console.error('[Slack Channels] API error:', data?.error);
          throw new Error(data?.error || 'Failed to fetch channels');
        }
        
        console.log('[Slack Channels] Loaded:', data.channels?.length || 0, 'channels from Slack');
        return data.channels as SlackChannel[];
      } catch (apiError) {
        // Fallback to database if API fails
        console.log('[Slack Channels] API failed, falling back to database...');
        const { data: dbData, error: dbError } = await supabase
          .from('slack_channel_config')
          .select('id, channel_name, display_name, description')
          .eq('is_active', true)
          .order('display_name');
        
        if (dbError) {
          console.error('[Slack Channels] DB fallback failed:', dbError);
          throw dbError;
        }
        
        // Map database format to API format
        return (dbData || []).map(ch => ({
          id: ch.id,
          name: ch.channel_name,
          display_name: ch.display_name,
          description: ch.description,
        })) as SlackChannel[];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1, // Only retry once
  });

  // Fetch recent messages - memoized query key
  const messagesQueryKey = useMemo(
    () => ['slack-messages', propertyId, leadId, ownerId],
    [propertyId, leadId, ownerId]
  );

  const { data: recentMessages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: messagesQueryKey,
    queryFn: async () => {
      let query = supabase
        .from('slack_messages')
        .select('id, channel, message, sender_name, status, created_at, template_used')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (propertyId) query = query.eq('property_id', propertyId);
      else if (leadId) query = query.eq('lead_id', leadId);
      else if (ownerId) query = query.eq('owner_id', ownerId);
      
      const { data, error } = await query;
      if (error) {
        console.error('Failed to load Slack messages:', error);
        throw error;
      }
      return data as SlackMessage[];
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!(propertyId || leadId || ownerId),
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Find the actual channel ID if sending to a channel
      const selectedChannelData = messageMode === 'channel' 
        ? channels.find(ch => ch.name === selectedChannel || ch.id === selectedChannel)
        : null;

      const payload = {
        channel: messageMode === 'channel' ? selectedChannel : undefined,
        channelId: selectedChannelData?.id, // Send the actual Slack channel ID
        directMessage: messageMode === 'dm',
        recipientUserId: messageMode === 'dm' ? selectedMember : undefined,
        message,
        template: selectedTemplate,
        context: {
          propertyId: propertyId || undefined,
          leadId: leadId || undefined,
          ownerId: ownerId || undefined,
        }
      };

      console.log('[Slack] Sending message:', payload);

      const response = await supabase.functions.invoke('send-team-slack', {
        body: payload
      });

      if (response.error) {
        console.error('[Slack] Function error:', response.error);
        throw new Error(response.error.message || 'Failed to send message');
      }
      
      if (!response.data?.success) {
        console.error('[Slack] Response error:', response.data);
        throw new Error(response.data?.error || 'Failed to send message');
      }
      
      return response.data;
    },
    onSuccess: () => {
      const target = messageMode === 'channel' 
        ? `#${selectedChannel}` 
        : TEAM_MEMBERS.find(m => m.id === selectedMember)?.name || 'team member';
      toast.success(`Message sent to ${target}!`);
      setMessage('');
      setSelectedTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['slack-messages'] });
    },
    onError: (error: Error) => {
      console.error('[Slack] Send error:', error);
      toast.error(`Failed to send: ${error.message}`);
    }
  });

  // Memoized handlers
  const handleTemplateClick = useCallback((template: typeof QUICK_TEMPLATES[number]) => {
    setSelectedTemplate(template.id);
    setMessage(template.prefix);
  }, []);

  const handleSend = useCallback(() => {
    if (messageMode === 'channel' && !selectedChannel) {
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
    sendMessage.mutate();
  }, [messageMode, selectedChannel, selectedMember, message, sendMessage]);

  const handleRefresh = useCallback(() => {
    refetchMessages();
  }, [refetchMessages]);

  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  }, []);

  // Memoized context check
  const hasContext = useMemo(
    () => !!(propertyName || leadName || ownerName),
    [propertyName, leadName, ownerName]
  );

  // Memoized send button disabled state
  const isSendDisabled = useMemo(
    () => sendMessage.isPending || !message.trim() ||
      (messageMode === 'channel' && !selectedChannel) ||
      (messageMode === 'dm' && !selectedMember),
    [sendMessage.isPending, message, messageMode, selectedChannel, selectedMember]
  );

  if (compact) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Quick Slack</span>
            {channelsError && (
              <Badge variant="destructive" className="text-[10px]">Error loading channels</Badge>
            )}
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
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={channelsLoading ? "Loading..." : "Select channel"} />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.name} className="text-xs">
                      #{ch.name}
                    </SelectItem>
                  ))}
                  {channels.length === 0 && !channelsLoading && (
                    <div className="p-2 text-xs text-muted-foreground">No channels available</div>
                  )}
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
                      @{member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <Textarea
              placeholder="Type message..."
              value={message}
              onChange={handleMessageChange}
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
            Team Slack
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleRefresh}
            disabled={messagesLoading}
          >
            <RefreshCw className={`h-4 w-4 ${messagesLoading ? 'animate-spin' : ''}`} />
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
            {channelsError && (
              <Badge variant="destructive" className="text-xs">Error loading channels</Badge>
            )}
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
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger>
                <SelectValue placeholder={channelsLoading ? "Loading channels..." : "Select a channel"} />
              </SelectTrigger>
              <SelectContent>
                {channels.map((ch) => (
                  <SelectItem key={ch.id} value={ch.name}>
                    <div className="flex flex-col">
                      <span>#{ch.name}</span>
                      {ch.description && (
                        <span className="text-xs text-muted-foreground">{ch.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
                {channels.length === 0 && !channelsLoading && (
                  <div className="p-2 text-sm text-muted-foreground">No channels found in Slack</div>
                )}
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
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-xs font-medium">{member.name[0]}</span>
                      </div>
                      <span>@{member.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Textarea
            placeholder={messageMode === 'channel' 
              ? "Type your message to the channel..." 
              : `Type your direct message...`}
            value={message}
            onChange={handleMessageChange}
            className="min-h-[80px] resize-none"
          />

          {/* Quick Templates */}
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              Quick Templates:
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_TEMPLATES.map((template) => (
                <Button
                  key={template.id}
                  variant={selectedTemplate === template.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleTemplateClick(template)}
                >
                  <template.icon className="h-3 w-3 mr-1" />
                  {template.label}
                </Button>
              ))}
            </div>
          </div>

          <Button 
            className="w-full"
            onClick={handleSend}
            disabled={isSendDisabled}
          >
            <Send className="h-4 w-4 mr-2" />
            {sendMessage.isPending ? 'Sending...' : 
              messageMode === 'channel' ? 'Send to Channel' : 'Send Direct Message'}
          </Button>
        </div>

        {/* Recent Messages */}
        {recentMessages.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Recent Messages
            </div>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {recentMessages.map((msg) => (
                  <MessageItem key={msg.id} msg={msg} />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
