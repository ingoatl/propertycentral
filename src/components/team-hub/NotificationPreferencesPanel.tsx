import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Bell, Moon, Volume2, VolumeX, Save, Loader2 } from 'lucide-react';
import { useTeamChannels } from '@/hooks/useTeamHub';

interface NotificationPreferences {
  id: string;
  user_id: string;
  push_enabled: boolean;
  push_all_messages: boolean;
  push_mentions_only: boolean;
  push_dms_only: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  muted_channels: string[];
  show_desktop_notifications: boolean;
  notification_sound: boolean;
}

export function NotificationPreferencesPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: channels = [] } = useTeamChannels();

  const [localPrefs, setLocalPrefs] = useState<Partial<NotificationPreferences>>({
    push_enabled: true,
    push_all_messages: false,
    push_mentions_only: true,
    push_dms_only: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    muted_channels: [],
    show_desktop_notifications: true,
    notification_sound: true,
  });

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['team-notification-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('team_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as NotificationPreferences | null;
    },
    enabled: !!user?.id,
  });

  // Sync local state with fetched preferences
  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);

  const saveMutation = useMutation({
    mutationFn: async (prefs: Partial<NotificationPreferences>) => {
      if (!user?.id) throw new Error('Not authenticated');

      const payload = {
        user_id: user.id,
        ...prefs,
      };

      if (preferences?.id) {
        const { error } = await supabase
          .from('team_notification_preferences')
          .update(payload)
          .eq('id', preferences.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('team_notification_preferences')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Preferences saved!');
      queryClient.invalidateQueries({ queryKey: ['team-notification-preferences'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleSave = () => {
    saveMutation.mutate(localPrefs);
  };

  const toggleMutedChannel = (channelId: string) => {
    setLocalPrefs(prev => {
      const muted = prev.muted_channels || [];
      if (muted.includes(channelId)) {
        return { ...prev, muted_channels: muted.filter(id => id !== channelId) };
      } else {
        return { ...prev, muted_channels: [...muted, channelId] };
      }
    });
  };

  const getPushNotificationType = () => {
    if (localPrefs.push_all_messages) return 'all';
    if (localPrefs.push_dms_only && !localPrefs.push_mentions_only) return 'dms';
    return 'mentions';
  };

  const setPushNotificationType = (type: string) => {
    setLocalPrefs(prev => ({
      ...prev,
      push_all_messages: type === 'all',
      push_mentions_only: type === 'mentions',
      push_dms_only: type === 'dms' || type === 'mentions',
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Push Notifications */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive notifications on your phone</p>
            </div>
            <Switch
              checked={localPrefs.push_enabled}
              onCheckedChange={(checked) => setLocalPrefs(prev => ({ ...prev, push_enabled: checked }))}
            />
          </div>

          {localPrefs.push_enabled && (
            <RadioGroup 
              value={getPushNotificationType()} 
              onValueChange={setPushNotificationType}
              className="pl-4 space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="font-normal">All messages</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mentions" id="mentions" />
                <Label htmlFor="mentions" className="font-normal">Mentions & DMs only</Label>
                <Badge variant="secondary" className="text-xs">Recommended</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dms" id="dms" />
                <Label htmlFor="dms" className="font-normal">DMs only</Label>
              </div>
            </RadioGroup>
          )}
        </div>

        {/* Quiet Hours */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium flex items-center gap-2">
                <Moon className="h-4 w-4" />
                Quiet Hours
              </Label>
              <p className="text-sm text-muted-foreground">Pause notifications during these hours</p>
            </div>
            <Switch
              checked={localPrefs.quiet_hours_enabled}
              onCheckedChange={(checked) => setLocalPrefs(prev => ({ ...prev, quiet_hours_enabled: checked }))}
            />
          </div>

          {localPrefs.quiet_hours_enabled && (
            <div className="flex items-center gap-4 pl-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm">From:</Label>
                <Input
                  type="time"
                  value={localPrefs.quiet_hours_start || '22:00'}
                  onChange={(e) => setLocalPrefs(prev => ({ ...prev, quiet_hours_start: e.target.value }))}
                  className="w-28"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">To:</Label>
                <Input
                  type="time"
                  value={localPrefs.quiet_hours_end || '08:00'}
                  onChange={(e) => setLocalPrefs(prev => ({ ...prev, quiet_hours_end: e.target.value }))}
                  className="w-28"
                />
              </div>
            </div>
          )}
        </div>

        {/* Desktop Notifications & Sound */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Desktop Notifications</Label>
              <p className="text-sm text-muted-foreground">Show notifications in browser</p>
            </div>
            <Switch
              checked={localPrefs.show_desktop_notifications}
              onCheckedChange={(checked) => setLocalPrefs(prev => ({ ...prev, show_desktop_notifications: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium flex items-center gap-2">
                {localPrefs.notification_sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                Notification Sound
              </Label>
              <p className="text-sm text-muted-foreground">Play sound for new messages</p>
            </div>
            <Switch
              checked={localPrefs.notification_sound}
              onCheckedChange={(checked) => setLocalPrefs(prev => ({ ...prev, notification_sound: checked }))}
            />
          </div>
        </div>

        {/* Channel Settings */}
        <div className="space-y-4 pt-4 border-t">
          <Label className="font-medium">Channel Settings</Label>
          <div className="space-y-2">
            {channels.map((channel) => (
              <div key={channel.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                <span className="text-sm">#{channel.name}</span>
                <Button
                  variant={localPrefs.muted_channels?.includes(channel.id) ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => toggleMutedChannel(channel.id)}
                >
                  {localPrefs.muted_channels?.includes(channel.id) ? 'Unmute' : 'Mute'}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <Button 
          className="w-full" 
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
}
