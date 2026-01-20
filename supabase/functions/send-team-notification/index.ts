import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  channelId: string;
  messageId: string;
  senderId: string;
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotificationRequest = await req.json();
    const { channelId, messageId, senderId, content } = body;

    console.log('[send-team-notification] Processing notification for message:', messageId);

    // Get channel info
    const { data: channel } = await supabase
      .from('team_channels')
      .select('name, display_name')
      .eq('id', channelId)
      .single();

    // Get sender info
    const { data: sender } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', senderId)
      .single();

    const senderName = sender 
      ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || sender.email 
      : 'Someone';

    // Get all channel members except the sender
    const { data: members } = await supabase
      .from('team_channel_members')
      .select('user_id, notifications_muted')
      .eq('channel_id', channelId)
      .neq('user_id', senderId);

    // For public channels, also include users without explicit membership
    let targetUserIds: string[] = [];
    
    if (channel) {
      const { data: channelData } = await supabase
        .from('team_channels')
        .select('channel_type')
        .eq('id', channelId)
        .single();

      if (channelData?.channel_type === 'public') {
        // For public channels, notify all users with push subscriptions
        const { data: allSubscriptions } = await supabase
          .from('push_subscriptions')
          .select('user_id')
          .neq('user_id', senderId);

        targetUserIds = [...new Set(allSubscriptions?.map(s => s.user_id) || [])];
      } else {
        // For private channels, only notify members
        targetUserIds = members?.filter(m => !m.notifications_muted).map(m => m.user_id) || [];
      }
    }

    // Check presence - don't notify users in focus mode
    const { data: presenceData } = await supabase
      .from('team_presence')
      .select('user_id, status, focus_mode_until')
      .in('user_id', targetUserIds);

    const now = new Date();
    const usersToNotify = targetUserIds.filter(userId => {
      const presence = presenceData?.find(p => p.user_id === userId);
      if (!presence) return true; // No presence record = notify
      if (presence.status === 'dnd') return false;
      if (presence.focus_mode_until && new Date(presence.focus_mode_until) > now) return false;
      return true;
    });

    console.log(`[send-team-notification] Notifying ${usersToNotify.length} users`);

    // Create in-app notifications
    const notifications = usersToNotify.map(userId => ({
      user_id: userId,
      type: 'message' as const,
      title: `#${channel?.display_name || 'channel'}`,
      body: `${senderName}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
      message_id: messageId,
      channel_id: channelId,
    }));

    if (notifications.length > 0) {
      await supabase.from('team_notifications').insert(notifications);
    }

    // Get push subscriptions for users to notify
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', usersToNotify);

    // Send push notifications (if VAPID keys are configured)
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (vapidPublicKey && vapidPrivateKey && subscriptions && subscriptions.length > 0) {
      console.log(`[send-team-notification] Sending ${subscriptions.length} push notifications`);
      
      // Note: In production, you'd use web-push library here
      // For now, we rely on in-app notifications and can add web-push later
    }

    return new Response(JSON.stringify({ 
      success: true,
      notifiedCount: usersToNotify.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[send-team-notification] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
