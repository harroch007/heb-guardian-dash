import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { v2Supabase } from "@/integrations/supabase/v2-client";

const INSTALLATION_KEY = "kippy:v2:guardian-push-installation-id";
const FALLBACK_VAPID_PUBLIC_KEY =
  "BLdW9MSDQbFmXFQpJ_2SXzvs9dUnQk4MawPpwoymbclk6kdfcz8jn3A_tIpfr2QPvxZRFjdDznln8Me_owX9efA";

const vapidPublicKey =
  import.meta.env.VITE_V2_VAPID_PUBLIC_KEY || FALLBACK_VAPID_PUBLIC_KEY;

const installationId = () => {
  const existing = localStorage.getItem(INSTALLATION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(INSTALLATION_KEY, created);
  return created;
};

const decodeApplicationServerKey = (value: string): Uint8Array => {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
};

export function useV2PushNotifications() {
  const { user } = useAuth();
  const supported = useMemo(
    () =>
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window,
    [],
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : "default",
  );

  const refresh = useCallback(async () => {
    if (!supported || !user) {
      setIsSubscribed(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const browserSubscription =
        await registration.pushManager.getSubscription();
      const { data, error } = await v2Supabase.rpc(
        "v2_get_guardian_push_state",
        { target_installation_id: installationId() },
      );
      if (error) throw error;
      setIsSubscribed(
        Boolean(browserSubscription && data?.[0]?.is_subscribed),
      );
      setPermission(Notification.permission);
    } catch (error) {
      console.error("[push-v2] Failed to read subscription state", error);
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, [supported, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!supported || !user) return false;
    setIsLoading(true);
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") return false;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const key = decodeApplicationServerKey(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key.buffer as ArrayBuffer,
        });
      }

      const serialized = subscription.toJSON();
      const { error } = await v2Supabase.rpc(
        "v2_register_guardian_push_endpoint",
        {
          target_installation_id: installationId(),
          target_endpoint: subscription.endpoint,
          target_p256dh: serialized.keys?.p256dh ?? "",
          target_auth_secret: serialized.keys?.auth ?? "",
          target_user_agent: navigator.userAgent,
          target_locale: navigator.language || "he-IL",
        },
      );
      if (error) throw error;
      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error("[push-v2] Registration failed", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [supported, user]);

  const unsubscribe = useCallback(async () => {
    if (!supported || !user) return false;
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const { error } = await v2Supabase.rpc(
        "v2_revoke_guardian_push_endpoint",
        {
          target_installation_id: installationId(),
          target_permission_state:
            Notification.permission === "denied" ? "denied" : "prompt",
        },
      );
      if (error) throw error;
      if (subscription) await subscription.unsubscribe();
      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error("[push-v2] Revocation failed", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [supported, user]);

  return {
    isSupported: supported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    refresh,
  };
}
