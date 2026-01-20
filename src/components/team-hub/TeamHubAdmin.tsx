import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Send, Mail, Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface TeamHubInvite {
  id: string;
  invitee_email: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

// Team email addresses
const TEAM_EMAILS = [
  'alex@peachhausgroup.com',
  'anja@peachhausgroup.com',
  'catherine@peachhausgroup.com',
  'chris@peachhausgroup.com',
  'ingo@peachhausgroup.com',
];

export function TeamHubAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');

  // Fetch existing invites
  const { data: invites = [], isLoading } = useQuery({
    queryKey: ['team-hub-invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_hub_invites')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as TeamHubInvite[];
    },
  });

  // Send invite mutation
  const sendInvite = useMutation({
    mutationFn: async (inviteeEmail: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Check if invite already exists
      const existing = invites.find(i => i.invitee_email === inviteeEmail && i.status !== 'expired');
      if (existing) {
        throw new Error('Invite already sent to this email');
      }

      // Create invite record
      const { data: invite, error: insertError } = await supabase
        .from('team_hub_invites')
        .insert({
          inviter_id: user.id,
          invitee_email: inviteeEmail,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Send invite email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-team-hub-invite', {
        body: {
          inviteId: invite.id,
          email: inviteeEmail,
        },
      });

      if (emailError) {
        console.error('Failed to send invite email:', emailError);
        // Don't throw - invite is still created
      }

      return invite;
    },
    onSuccess: (_, email) => {
      toast.success(`Invite sent to ${email}!`);
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['team-hub-invites'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Send all invites mutation
  const sendAllInvites = useMutation({
    mutationFn: async () => {
      const results = [];
      for (const teamEmail of TEAM_EMAILS) {
        const existing = invites.find(i => i.invitee_email === teamEmail && i.status !== 'expired');
        if (!existing) {
          try {
            await sendInvite.mutateAsync(teamEmail);
            results.push({ email: teamEmail, success: true });
          } catch (error) {
            results.push({ email: teamEmail, success: false, error });
          }
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      toast.success(`Sent ${successCount} invite(s) to team members!`);
    },
  });

  const handleSendInvite = () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    sendInvite.mutate(email.trim());
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    
    if (status === 'accepted') {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Accepted
        </Badge>
      );
    }
    if (isExpired || status === 'expired') {
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Invite Team Members
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Invite All */}
        <div className="p-4 bg-muted/30 rounded-lg space-y-3">
          <div>
            <h4 className="font-medium">Quick Invite All Team Members</h4>
            <p className="text-sm text-muted-foreground">
              Send invites to all 5 team members at once
            </p>
          </div>
          <Button 
            onClick={() => sendAllInvites.mutate()}
            disabled={sendAllInvites.isPending}
            className="w-full"
          >
            {sendAllInvites.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Send Invites to All Team Members
          </Button>
        </div>

        {/* Individual Invite */}
        <div className="space-y-3">
          <h4 className="font-medium">Or invite individually:</h4>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleSendInvite}
              disabled={sendInvite.isPending}
            >
              {sendInvite.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Invite History */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-medium">Invite History</h4>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : invites.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No invites sent yet
            </p>
          ) : (
            <div className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{invite.invitee_email}</span>
                    <span className="text-xs text-muted-foreground">
                      Sent {format(new Date(invite.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {getStatusBadge(invite.status, invite.expires_at)}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
