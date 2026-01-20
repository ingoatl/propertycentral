import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Users, Plus, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Team members for group creation
const TEAM_MEMBERS = [
  { id: 'alex', name: 'Alex', email: 'alex@peachhausgroup.com', role: 'Property Manager' },
  { id: 'anja', name: 'Anja', email: 'anja@peachhausgroup.com', role: 'Operations Manager' },
  { id: 'catherine', name: 'Catherine', email: 'catherine@peachhausgroup.com', role: 'Guest Relations' },
  { id: 'chris', name: 'Chris', email: 'chris@peachhausgroup.com', role: 'Maintenance Coordinator' },
  { id: 'ingo', name: 'Ingo', email: 'ingo@peachhausgroup.com', role: 'Owner / CEO' },
];

interface CreateGroupDMProps {
  onGroupCreated?: (channelId: string) => void;
}

export function CreateGroupDM({ onGroupCreated }: CreateGroupDMProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  const createGroup = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      if (selectedMembers.length < 1) throw new Error('Select at least 1 team member');

      // Generate channel name from selected members if not provided
      const selectedNames = TEAM_MEMBERS
        .filter(m => selectedMembers.includes(m.id))
        .map(m => m.name);
      
      const channelName = groupName.trim() || selectedNames.join(', ');
      const channelSlug = `dm-${selectedMembers.sort().join('-')}-${Date.now()}`;

      // Create the DM channel
      const { data: channel, error } = await supabase
        .from('team_channels')
        .insert({
          name: channelSlug,
          display_name: channelName,
          channel_type: 'dm',
          description: `Group DM with ${selectedNames.join(', ')}`,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add all selected members to the channel
      const memberEmails = TEAM_MEMBERS
        .filter(m => selectedMembers.includes(m.id))
        .map(m => m.email);

      // Get user IDs for the selected members (by email)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', memberEmails);

      // Add members to channel
      if (profiles && profiles.length > 0) {
        const memberships = profiles.map(p => ({
          channel_id: channel.id,
          user_id: p.id,
        }));

        // Also add current user
        memberships.push({
          channel_id: channel.id,
          user_id: user.id,
        });

        await supabase
          .from('team_channel_members')
          .insert(memberships);
      }

      return channel;
    },
    onSuccess: (channel) => {
      toast.success('Group created!');
      queryClient.invalidateQueries({ queryKey: ['team-channels'] });
      setOpen(false);
      setSelectedMembers([]);
      setGroupName('');
      onGroupCreated?.(channel.id);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const selectedNames = TEAM_MEMBERS
    .filter(m => selectedMembers.includes(m.id))
    .map(m => m.name);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <Plus className="h-4 w-4" />
          New Group DM
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Create Group Message
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected Members Preview */}
          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedNames.map((name, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {name}
                  <button
                    onClick={() => {
                      const member = TEAM_MEMBERS.find(m => m.name === name);
                      if (member) toggleMember(member.id);
                    }}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Optional Group Name */}
          <div className="space-y-2">
            <Label htmlFor="groupName">Group Name (optional)</Label>
            <Input
              id="groupName"
              placeholder={selectedNames.length > 0 ? selectedNames.join(', ') : 'e.g., Property Updates'}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          {/* Team Members List */}
          <div className="space-y-2">
            <Label>Select Team Members</Label>
            <div className="space-y-1 max-h-60 overflow-y-auto border rounded-lg p-2">
              {TEAM_MEMBERS.map((member) => {
                const isSelected = selectedMembers.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMember(member.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-lg transition-colors",
                      isSelected ? "bg-primary/10" : "hover:bg-muted"
                    )}
                  >
                    <Checkbox checked={isSelected} className="pointer-events-none" />
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={isSelected ? "bg-primary text-primary-foreground" : ""}>
                        {member.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createGroup.mutate()}
            disabled={selectedMembers.length < 1 || createGroup.isPending}
          >
            {createGroup.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Users className="h-4 w-4 mr-2" />
            )}
            Create Group ({selectedMembers.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
