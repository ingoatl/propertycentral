import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Loader2, Upload, MessageSquare, Users, Bell, Home, FileText, Sparkles, CheckCircle, ArrowRight } from 'lucide-react';

export default function TeamHubInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'loading' | 'welcome' | 'profile' | 'success'>('loading');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    async function validateInvite() {
      if (!token) {
        setError('Invalid invite link');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('team_hub_invites')
        .select('*')
        .eq('invite_token', token)
        .single();

      if (fetchError || !data) {
        setError('This invite link is invalid or has expired');
        setLoading(false);
        return;
      }

      if (data.status === 'accepted') {
        setStep('success');
        setLoading(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError('This invite has expired. Please request a new invitation.');
        setLoading(false);
        return;
      }

      setInvite(data);
      setDisplayName(data.invitee_email.split('@')[0]);
      setStep('welcome');
      setLoading(false);
    }

    validateInvite();
  }, [token]);

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${invite.invitee_email.replace('@', '_at_')}_${Date.now()}.${fileExt}`;
      const filePath = `team-avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      toast.success('Avatar uploaded!');
    } catch (err: any) {
      toast.error('Failed to upload avatar');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleAcceptInvite = async () => {
    setAccepting(true);
    try {
      // Update invite status
      const { error: updateError } = await supabase
        .from('team_hub_invites')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invite.id);

      if (updateError) throw updateError;

      toast.success('Welcome to Team Hub!');
      setStep('success');
    } catch (err: any) {
      toast.error('Failed to accept invite');
      console.error(err);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/50">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Invite Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/auth')} variant="outline">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const features = [
    { icon: MessageSquare, title: 'Real-time Messaging', description: 'Organized channels for team communication' },
    { icon: Home, title: 'Context Linking', description: 'Tag messages with properties, leads & work orders' },
    { icon: FileText, title: 'File Sharing', description: 'Share documents, images, and files instantly' },
    { icon: Bell, title: '@Mentions', description: 'Get notified when someone needs your attention' },
    { icon: Sparkles, title: 'Focus Mode', description: 'Block notifications during deep work' },
    { icon: Users, title: 'Team Presence', description: 'See who\'s online and available' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {step === 'welcome' && (
          <Card className="border-border/50 bg-card/95 backdrop-blur">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-3xl">👋</span>
              </div>
              <CardTitle className="text-3xl font-bold">
                Welcome to <span className="text-primary">Team Hub</span>
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                PeachHaus Group's new internal communication platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Slack replacement notice */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-center">
                <p className="text-amber-200 text-sm">
                  <strong>📢 Important:</strong> Team Hub is replacing Slack for all internal communications. 
                  We're phasing out Slack over the next few weeks.
                </p>
              </div>

              {/* Features grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {features.map((feature) => (
                  <div key={feature.title} className="bg-muted/30 rounded-lg p-4 text-center">
                    <feature.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <h4 className="font-semibold text-sm">{feature.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{feature.description}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-center pt-4">
                <Button size="lg" onClick={() => setStep('profile')} className="gap-2">
                  Continue to Setup <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'profile' && (
          <Card className="border-border/50 bg-card/95 backdrop-blur max-w-lg mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Set Up Your Profile</CardTitle>
              <CardDescription>
                Help your team recognize you with a profile picture
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar upload */}
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-24 w-24 border-4 border-primary/20">
                  <AvatarImage src={avatarUrl || ''} />
                  <AvatarFallback className="text-2xl bg-muted">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 text-sm text-primary hover:text-primary/80">
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {avatarUrl ? 'Change Photo' : 'Upload Photo'}
                  </div>
                  <Input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadAvatar}
                    disabled={uploading}
                  />
                </Label>
              </div>

              {/* Display name */}
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep('welcome')} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleAcceptInvite} disabled={accepting} className="flex-1 gap-2">
                  {accepting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Join Team Hub
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'success' && (
          <Card className="border-border/50 bg-card/95 backdrop-blur max-w-lg mx-auto text-center">
            <CardHeader>
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle className="text-2xl font-bold">You're All Set!</CardTitle>
              <CardDescription>
                Welcome to Team Hub. You can now access all channels and start collaborating.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Next steps:</strong>
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• Log in to Property Central</li>
                  <li>• Navigate to Team Hub</li>
                  <li>• Join #general and say hello! 👋</li>
                </ul>
              </div>
              
              <Button onClick={() => navigate('/auth')} className="w-full gap-2">
                Go to Login <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}