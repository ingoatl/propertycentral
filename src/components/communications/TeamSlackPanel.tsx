import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  channel_name: string;
  display_name: string;
  description: string | null;
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

// Team members with their Slack user IDs
const TEAM_MEMBERS = [
  { id: 'alex', name: 'Alex', slackId: 'U_ALEX' },
  { id: 'anja', name: 'Anja', slackId: 'U_ANJA' },
  { id: 'catherine', name: 'Catherine', slackId: 'U_CATHERINE' },
  { id: 'chris', name: 'Chris', slackId: 'U_CHRIS' },
  { id: 'ingo', name: 'Ingo', slackId: 'U_INGO' },
];

const QUICK_TEMPLATES = [
  { id: 'update', label: 'Property Update', icon: Building2, prefix: '📍 Update: ' },
  { id: 'help', label: 'Need Help', icon: Users, prefix: '🆘 Need help: ' },
  { id: 'blocker', label: 'Blocker', icon: XCircle, prefix: '⚠️ BLOCKER: ' },
  { id: 'win', label: 'Win!', icon: CheckCircle2, prefix: '🎉 ' },
];

export function TeamSlackPanel({ 
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

  // Fetch available channels
  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ['slack-channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('slack_channel_config')
        .select('*')
        .eq('is_active', true)
        .order('display_name');
      
      if (error) throw error;
      return data as SlackChannel[];
    }
  });

  // Fetch recent messages
  const { data: recentMessages, isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['slack-messages', propertyId, leadId, ownerId],
    queryFn: async () => {
      let query = supabase
        .from('slack_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (propertyId) query = query.eq('property_id', propertyId);
      else if (leadId) query = query.eq('lead_id', leadId);
      else if (ownerId) query = query.eq('owner_id', ownerId);
      
      const { data, error } = await query;
      if (error) throw error;
      return data as SlackMessage[];
    }
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('send-team-slack', {
        body: {
          channel: messageMode === 'channel' ? selectedChannel : undefined,
          directMessage: messageMode === 'dm',
          recipientUserId: messageMode === 'dm' ? selectedMember : undefined,
          message,
          template: selectedTemplate,
          context: {
            propertyId,
            leadId,
            ownerId
          }
        }
      });

      if (response.error) throw response.error;
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
    onError: (error) => {
      console.error('Slack send error:', error);
      toast.error('Failed to send message to Slack');
    }
  });

  const handleTemplateClick = (template: typeof QUICK_TEMPLATES[0]) => {
    setSelectedTemplate(template.id);
    setMessage(template.prefix);
  };

  const handleSend = () => {
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
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  // Context display
  const hasContext = propertyName || leadName || ownerName;

  if (compact) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Quick Slack</span>
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
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  {channels?.map((ch) => (
                    <SelectItem key={ch.id} value={ch.channel_name} className="text-xs">
                      #{ch.channel_name}
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
                      @{member.name}
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
              disabled={sendMessage.isPending || !message.trim() || 
                (messageMode === 'channel' && !selectedChannel) ||
                (messageMode === 'dm' && !selectedMember)}
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
            onClick={() => refetchMessages()}
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
                <SelectValue placeholder="Select a channel" />
              </SelectTrigger>
              <SelectContent>
                {channelsLoading ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : (
                  channels?.map((ch) => (
                    <SelectItem key={ch.id} value={ch.channel_name}>
                      <div className="flex flex-col">
                        <span>#{ch.channel_name}</span>
                        {ch.description && (
                          <span className="text-xs text-muted-foreground">{ch.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))
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
            onChange={(e) => setMessage(e.target.value)}
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
            disabled={sendMessage.isPending || !message.trim() ||
              (messageMode === 'channel' && !selectedChannel) ||
              (messageMode === 'dm' && !selectedMember)}
          >
            <Send className="h-4 w-4 mr-2" />
            {sendMessage.isPending ? 'Sending...' : 
              messageMode === 'channel' ? 'Send to Channel' : 'Send Direct Message'}
          </Button>
        </div>

        {/* Recent Messages */}
        {recentMessages && recentMessages.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Recent Messages
            </div>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {recentMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className="bg-muted/30 rounded-lg p-2 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] h-5">
                          {msg.channel?.startsWith('@') ? msg.channel : `#${msg.channel}`}
                        </Badge>
                        {getStatusIcon(msg.status)}
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
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}