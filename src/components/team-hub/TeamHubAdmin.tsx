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

// Complete team member information for invites
const TEAM_MEMBERS = [
  { name: 'Alex', email: 'alex@peachhausgroup.com', role: 'Property Manager' },
  { name: 'Anja', email: 'anja@peachhausgroup.com', role: 'Operations Manager' },
  { name: 'Catherine', email: 'catherine@peachhausgroup.com', role: 'Guest Relations' },
  { name: 'Chris', email: 'chris@peachhausgroup.com', role: 'Maintenance Coordinator' },
  { name: 'Ingo', email: 'ingo@peachhausgroup.com', role: 'Owner / CEO' },
];

const TEAM_EMAILS = TEAM_MEMBERS.map(m => m.email);

// Recommended channels based on property management workflow
const SUGGESTED_CHANNELS = [
  { name: 'general', description: 'Company-wide announcements and updates' },
  { name: 'maintenance', description: 'Work orders, repairs, vendor coordination' },
  { name: 'owner-urgent', description: 'Time-sensitive owner communications' },
  { name: 'guest-relations', description: 'Guest inquiries, check-ins, reviews' },
  { name: 'leads', description: 'New lead alerts and sales pipeline' },
  { name: 'operations', description: 'Daily ops, scheduling, property visits' },
  { name: 'financials', description: 'Expenses, invoices, payment tracking' },
  { name: 'random', description: 'Non-work banter and team bonding' },
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
          Team Hub Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Team Members Directory */}
        <div className="space-y-3">
          <h4 className="font-medium">Team Members</h4>
          <div className="grid gap-2">
            {TEAM_MEMBERS.map((member) => {
              const invite = invites.find(i => i.invitee_email === member.email);
              const hasAccepted = invite?.status === 'accepted';
              const hasPending = invite && invite.status !== 'accepted' && new Date(invite.expires_at) > new Date();
              
              return (
                <div
                  key={member.email}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{member.name}</span>
                    <span className="text-xs text-muted-foreground">{member.role}</span>
                    <span className="text-xs text-muted-foreground">{member.email}</span>
                  </div>
                  {hasAccepted ? (
                    <Badge variant="default" className="bg-primary">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  ) : hasPending ? (
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => sendInvite.mutate(member.email)}
                      disabled={sendInvite.isPending}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Invite
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Quick Invite All */}
          <Button 
            onClick={() => sendAllInvites.mutate()}
            disabled={sendAllInvites.isPending}
            variant="secondary"
            className="w-full"
          >
            {sendAllInvites.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Invite All Team Members
          </Button>
        </div>

        {/* Individual Invite */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-medium">Invite by Email</h4>
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

        {/* Suggested Channels */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-medium">Recommended Channels</h4>
          <p className="text-xs text-muted-foreground">
            Based on your property management workflow:
          </p>
          <div className="grid gap-2">
            {SUGGESTED_CHANNELS.map((channel) => (
              <div
                key={channel.name}
                className="flex items-start gap-3 py-2 px-3 rounded-lg bg-muted/30"
              >
                <span className="text-sm font-medium text-primary">#{channel.name}</span>
                <span className="text-xs text-muted-foreground flex-1">{channel.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Invite History */}
        {invites.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-medium">Invite History</h4>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
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
        )}
      </CardContent>
    </Card>
  );
}
