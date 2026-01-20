import { useState, memo } from 'react';
import { MessageSquarePlus, Send, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/ProtectedRoute';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  email: string;
  first_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
}

interface NewDirectMessageProps {
  onDMCreated?: (channelId: string) => void;
}

export const NewDirectMessage = memo(function NewDirectMessage({ onDMCreated }: NewDirectMessageProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-dm'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, avatar_url, job_title')
        .not('id', 'eq', user?.id || '');
      
      if (error) throw error;
      return (data || []) as TeamMember[];
    },
    enabled: open,
  });

  const handleSelectMember = (member: TeamMember) => {
    setSelectedMember(member);
  };

  const handleSendMessage = async () => {
    if (!selectedMember || !message.trim() || !user) return;

    setSending(true);
    try {
      // Check if DM channel already exists
      const { data: existingChannels } = await supabase
        .from('team_channels')
        .select(`
          id,
          team_channel_members!inner(user_id)
        `)
        .eq('channel_type', 'dm');

      let dmChannelId: string | null = null;

      // Find existing DM between these two users
      if (existingChannels) {
        for (const channel of existingChannels) {
          const memberIds = (channel.team_channel_members as any[]).map(m => m.user_id);
          if (memberIds.length === 2 && 
              memberIds.includes(user.id) && 
              memberIds.includes(selectedMember.id)) {
            dmChannelId = channel.id;
            break;
          }
        }
      }

      // Create new DM channel if doesn't exist
      if (!dmChannelId) {
        const displayName = `DM: ${selectedMember.first_name || selectedMember.email.split('@')[0]}`;
        
        const { data: newChannel, error: channelError } = await supabase
          .from('team_channels')
          .insert({
            name: `dm-${user.id}-${selectedMember.id}`,
            display_name: displayName,
            channel_type: 'dm',
            created_by: user.id,
          })
          .select('id')
          .single();

        if (channelError) throw channelError;
        dmChannelId = newChannel.id;

        // Add both users as members
        await supabase.from('team_channel_members').insert([
          { channel_id: dmChannelId, user_id: user.id },
          { channel_id: dmChannelId, user_id: selectedMember.id },
        ]);
      }

      // Send the message
      const { error: messageError } = await supabase
        .from('team_messages')
        .insert({
          channel_id: dmChannelId,
          sender_id: user.id,
          content: message.trim(),
        });

      if (messageError) throw messageError;

      toast.success(`Message sent to ${selectedMember.first_name || selectedMember.email.split('@')[0]}`);
      
      // Reset and close
      setMessage('');
      setSelectedMember(null);
      setOpen(false);
      
      // Navigate to the DM channel
      if (onDMCreated && dmChannelId) {
        onDMCreated(dmChannelId);
      }
    } catch (error: any) {
      console.error('Failed to send DM:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const getMemberDisplayName = (member: TeamMember) => {
    return member.first_name || member.email.split('@')[0];
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground min-h-[44px]"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New Message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Direct Message</DialogTitle>
        </DialogHeader>

        {!selectedMember ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Select a team member to message:</p>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-1">
                {teamMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleSelectMember(member)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
                      'hover:bg-accent text-left'
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar_url || ''} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {(member.first_name?.[0] || member.email[0]).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{getMemberDisplayName(member)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.job_title || member.email}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selected member header */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedMember.avatar_url || ''} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {(selectedMember.first_name?.[0] || selectedMember.email[0]).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{getMemberDisplayName(selectedMember)}</p>
                <p className="text-xs text-muted-foreground">{selectedMember.job_title || selectedMember.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedMember(null)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Message input */}
            <Textarea
              placeholder={`Message ${getMemberDisplayName(selectedMember)}...`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />

            {/* Send button */}
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">⌘+Enter to send</p>
              <Button
                onClick={handleSendMessage}
                disabled={!message.trim() || sending}
                className="gap-2"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Message
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});
