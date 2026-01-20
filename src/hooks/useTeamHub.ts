import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/ProtectedRoute';

export interface TeamChannel {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  channel_type: 'public' | 'private' | 'dm';
  is_archived: boolean;
  created_at: string;
  unread_count?: number;
}

export interface TeamMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  parent_message_id: string | null;
  content: string;
  message_type: 'text' | 'file' | 'system';
  file_url: string | null;
  file_name: string | null;
  reactions: Record<string, string[]>;
  is_pinned: boolean;
  is_edited: boolean;
  edited_at: string | null;
  property_id: string | null;
  lead_id: string | null;
  work_order_id: string | null;
  owner_id: string | null;
  created_at: string;
  sender?: {
    id: string;
    first_name: string | null;
    email: string | null;
  } | null;
  reply_count?: number;
}

export interface TeamPresence {
  user_id: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  status_text: string | null;
  status_emoji: string | null;
  focus_mode_until: string | null;
  last_seen_at: string;
  user?: {
    first_name: string | null;
    email: string | null;
  } | null;
}

export function useTeamChannels() {
  return useQuery({
    queryKey: ['team-channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_channels')
        .select('*')
        .eq('is_archived', false)
        .order('name');

      if (error) throw error;
      return data as TeamChannel[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeamMessages(channelId: string | null) {
  const queryClient = useQueryClient();

  // Subscribe to real-time messages
  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`team-messages-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['team-messages', channelId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, queryClient]);

  return useQuery({
    queryKey: ['team-messages', channelId],
    queryFn: async () => {
      if (!channelId) return [];

      const { data: messages, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('channel_id', channelId)
        .is('parent_message_id', null)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      if (!messages || messages.length === 0) return [];

      // Fetch sender profiles separately with avatar_url
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, email, avatar_url')
        .in('id', senderIds);

      const profileMap = new Map<string, { id: string; first_name: string | null; email: string | null; avatar_url: string | null }>();
      profiles?.forEach(p => profileMap.set(p.id, p));

      return messages.map(msg => ({
        ...msg,
        sender: profileMap.get(msg.sender_id) || null,
      })) as TeamMessage[];
    },
    enabled: !!channelId,
    staleTime: 30 * 1000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      channelId,
      content,
      parentMessageId,
      context,
    }: {
      channelId: string;
      content: string;
      parentMessageId?: string;
      context?: {
        propertyId?: string;
        leadId?: string;
        workOrderId?: string;
        ownerId?: string;
      };
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('team_messages')
        .insert({
          channel_id: channelId,
          sender_id: user.id,
          content,
          parent_message_id: parentMessageId || null,
          property_id: context?.propertyId || null,
          lead_id: context?.leadId || null,
          work_order_id: context?.workOrderId || null,
          owner_id: context?.ownerId || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Detect @mentions and send notifications
      const mentionRegex = /@(\w+)/g;
      const mentions = content.match(mentionRegex) || [];
      
      // Send push notifications to other channel members + mentioned users
      try {
        await supabase.functions.invoke('send-team-notification', {
          body: {
            channelId,
            messageId: data.id,
            senderId: user.id,
            content,
            mentions: mentions.map(m => m.replace('@', '').toLowerCase()),
          },
        });
      } catch (e) {
        console.error('Failed to send notifications:', e);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-messages', variables.channelId] });
    },
  });
}

export function useTeamPresence() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Update own presence
  const updatePresence = useCallback(async (status: TeamPresence['status'], statusText?: string) => {
    if (!user) return;

    await supabase
      .from('team_presence')
      .upsert({
        user_id: user.id,
        status,
        status_text: statusText || null,
        last_seen_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });
  }, [user]);

  // Set up presence tracking
  useEffect(() => {
    if (!user) return;

    // Set online when component mounts
    updatePresence('online');

    // Set away on visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence('away');
      } else {
        updatePresence('online');
      }
    };

    // Set offline on beforeunload
    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/team_presence?user_id=eq.${user.id}`,
        JSON.stringify({ status: 'offline' })
      );
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      if (!document.hidden) {
        updatePresence('online');
      }
    }, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(heartbeat);
      updatePresence('offline');
    };
  }, [user, updatePresence]);

  // Subscribe to presence changes
  useEffect(() => {
    const channel = supabase
      .channel('team-presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_presence',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['team-presence'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Query all presence
  const { data: presenceData } = useQuery({
    queryKey: ['team-presence'],
    queryFn: async () => {
      const { data: presences, error } = await supabase
        .from('team_presence')
        .select('*')
        .neq('status', 'offline');

      if (error) throw error;
      if (!presences || presences.length === 0) return [];

      // Fetch user profiles separately with avatar_url and job_title
      const userIds = presences.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, email, avatar_url, job_title')
        .in('id', userIds);

      const profileMap = new Map<string, { first_name: string | null; email: string | null; avatar_url: string | null; job_title: string | null }>();
      profiles?.forEach(p => profileMap.set(p.id, { 
        first_name: p.first_name, 
        email: p.email, 
        avatar_url: p.avatar_url,
        job_title: p.job_title,
      }));

      return presences.map(p => ({
        ...p,
        user: profileMap.get(p.user_id) || null,
      })) as TeamPresence[];
    },
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });

  return {
    presence: presenceData || [],
    updatePresence,
  };
}

export function useUnreadCounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['team-unread-counts'],
    queryFn: async () => {
      if (!user) return {};

      // Get last read times for channels the user is a member of
      const { data: memberships } = await supabase
        .from('team_channel_members')
        .select('channel_id, last_read_at')
        .eq('user_id', user.id);

      if (!memberships) return {};

      const counts: Record<string, number> = {};

      for (const membership of memberships) {
        const { count } = await supabase
          .from('team_messages')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', membership.channel_id)
          .gt('created_at', membership.last_read_at);

        counts[membership.channel_id] = count || 0;
      }

      return counts;
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}

export function useMarkChannelRead(channelId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!channelId || !user) return;

      await supabase
        .from('team_channel_members')
        .upsert({
          channel_id: channelId,
          user_id: user.id,
          last_read_at: new Date().toISOString(),
        }, {
          onConflict: 'channel_id,user_id',
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-unread-counts'] });
    },
  });
}

export function useInAppNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Subscribe to notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('team-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['team-notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return useQuery({
    queryKey: ['team-notifications'],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('team_notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}
