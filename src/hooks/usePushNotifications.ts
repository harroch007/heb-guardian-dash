import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// VAPID public key (base64url encoded) - derived from JWK
// x: t1b0xINBsWZcVCkn_ZJfO-z11SdCTgxrA-nCjKZtyWQ
// y: 6kdfcz8jn3A_tIpfr2QPvxZRFjdDznln8Me_owX9efA
// Format: 0x04 || x || y (uncompressed point)
const VAPID_PUBLIC_KEY = 'BLdW9MSDQbFmXFQpJ_2SXzvs9dUnQk4MawPpwoymbbFk6kdfcz8jn3A_tIpfr2QPvxZRFjdDznln8Me_owX9efA';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
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

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Check if push is supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 
                      'PushManager' in window && 
                      'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check existing subscription when user changes
  const checkExistingSubscription = useCallback(async () => {
    if (!isSupported || !user) {
      setIsLoading(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Check if this subscription is in our database
        const { data } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('parent_id', user.id)
          .eq('endpoint', subscription.endpoint)
          .single();
        
        setIsSubscribed(!!data);
      } else {
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user]);

  useEffect(() => {
    checkExistingSubscription();
  }, [checkExistingSubscription]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !user) {
      console.error('Push not supported or user not logged in');
      return false;
    }

    try {
      // Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      
      if (permissionResult !== 'granted') {
        console.log('Notification permission denied');
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Check for existing subscription first
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        });
      }

      // Extract subscription details
      const subscriptionJson = subscription.toJSON();
      const endpoint = subscription.endpoint;
      const p256dh = subscriptionJson.keys?.p256dh || '';
      const auth = subscriptionJson.keys?.auth || '';

      // Save to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          parent_id: user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'parent_id,endpoint'
        });

      if (error) {
        console.error('Error saving subscription:', error);
        throw error;
      }

      console.log('Push subscription saved successfully');
      setIsSubscribed(true);
      return true;

    } catch (error) {
      console.error('Error subscribing to push:', error);
      return false;
    }
  }, [isSupported, user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !user) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();
        
        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('parent_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      setIsSubscribed(false);
      return true;

    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      return false;
    }
  }, [isSupported, user]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
  };
}
