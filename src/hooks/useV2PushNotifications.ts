import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { v2Supabase } from "@/integrations/supabase/v2-client";
import {
  applicationServerKeysMatch,
  decodeVapidApplicationServerKey,
  normalizeV2PushRuntimeConfig,
} from "@/lib/v2/pushConfigContract";

const INSTALLATION_KEY = "kippy:v2:guardian-push-installation-id";

const installationId = () => {
  const existing = localStorage.getItem(INSTALLATION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(INSTALLATION_KEY, created);
  return created;
};

const loadPushRuntimeConfig = async () => {
  const { data, error } = await v2Supabase.functions.invoke(
    "v2-get-push-config",
    { body: {} },
  );
  if (error) throw error;
  return normalizeV2PushRuntimeConfig(data);
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
      const browserSubscription = await registration.pushManager
        .getSubscription();
      const runtimeConfig = await loadPushRuntimeConfig();
      const applicationServerKey = decodeVapidApplicationServerKey(
        runtimeConfig.application_server_key,
      );
      const { data, error } = await v2Supabase.rpc(
        "v2_get_guardian_push_state",
        { target_installation_id: installationId() },
      );
      if (error) throw error;
      setIsSubscribed(
        Boolean(
          browserSubscription &&
            applicationServerKeysMatch(
              browserSubscription.options.applicationServerKey,
              applicationServerKey,
            ) &&
            data?.[0]?.is_subscribed,
        ),
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
      const runtimeConfig = await loadPushRuntimeConfig();
      const applicationServerKey = decodeVapidApplicationServerKey(
        runtimeConfig.application_server_key,
      );
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") return false;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (
        subscription &&
        !applicationServerKeysMatch(
          subscription.options.applicationServerKey,
          applicationServerKey,
        )
      ) {
        const { error } = await v2Supabase.rpc(
          "v2_revoke_guardian_push_endpoint",
          {
            target_installation_id: installationId(),
            target_permission_state: "prompt",
          },
        );
        if (error) throw error;
        if (!await subscription.unsubscribe()) {
          throw new Error("push_subscription_rotation_failed");
        }
        subscription = null;
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
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
          target_permission_state: Notification.permission === "denied"
            ? "denied"
            : "prompt",
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
