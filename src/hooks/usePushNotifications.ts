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

      // Get VAPID public key from edge function
      const { data: vapidData, error: vapidError } = await supabase.functions.invoke('get-vapid-key');
      
      if (vapidError || !vapidData?.publicKey) {
        // Use a fallback or generate keys
        console.warn('Could not get VAPID key, using fallback subscription method');
        throw new Error('VAPID key not configured');
      }

      // Subscribe to push notifications
      const keyArray = urlBase64ToUint8Array(vapidData.publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray.buffer,
      });

      // Save subscription to database
      const subscriptionJson = subscription.toJSON();
      const { error: saveError } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subscriptionJson.endpoint!,
        p256dh: subscriptionJson.keys!.p256dh,
        auth_key: subscriptionJson.keys!.auth,
        user_agent: navigator.userAgent,
      }, {
        onConflict: 'endpoint',
      });

      if (saveError) {
        throw saveError;
      }

      setState(prev => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
      }));

      return subscription;
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

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
