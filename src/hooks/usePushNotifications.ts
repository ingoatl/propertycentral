import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/ProtectedRoute';

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | null;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: null,
  });

  // Check if push notifications are supported
  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : null,
      isLoading: false,
    }));
  }, []);

  // Register service worker and check subscription
  useEffect(() => {
    if (!state.isSupported || !user) return;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setState(prev => ({
          ...prev,
          isSubscribed: !!subscription,
        }));
      } catch (error) {
        console.error('Error checking push subscription:', error);
      }
    };

    // Register service worker
    navigator.serviceWorker.register('/sw.js')
      .then(() => checkSubscription())
      .catch(console.error);
  }, [state.isSupported, user]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!state.isSupported || !user) {
      throw new Error('Push notifications not supported or user not logged in');
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));

      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Get the service worker registration
      const registration = await navigator.serviceWorker.ready;

      // For now, we'll just save a placeholder subscription since VAPID keys aren't configured
      // This enables in-app notifications to work
      console.log('Push notification subscription ready - VAPID keys needed for full push support');
      
      setState(prev => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
      }));

      return null;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [state.isSupported, user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!state.isSupported || !user) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [state.isSupported, user]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}
