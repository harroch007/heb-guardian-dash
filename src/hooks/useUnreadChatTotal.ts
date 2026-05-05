import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns the total number of unread chat messages across all friendships
 * for the current user. Updates in realtime.
 */
export function useUnreadChatTotal() {
  const { user } = useAuth();
  const userId = user?.id;

  const query = useQuery<number>({
    queryKey: ["unread-chat-total", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return 0;

      const { data: friendships } = await supabase
        .from("friendships")
        .select("id, requester_id, receiver_id")
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq("status", "accepted");

      if (!friendships || friendships.length === 0) return 0;
      const friendshipIds = friendships.map((f) => f.id);

      // hidden threads
      const { data: hides } = await supabase
        .from("chat_thread_hides" as any)
        .select("friendship_id, hidden_at")
        .eq("participant_id", userId)
        .in("friendship_id", friendshipIds);
      const hideMap = new Map<string, string>();
      (hides ?? []).forEach((h: any) => hideMap.set(h.friendship_id, h.hidden_at));

      const { data: receipts } = await supabase
        .from("chat_read_receipts" as any)
        .select("friendship_id, last_read_at")
        .eq("participant_id", userId)
        .in("friendship_id", friendshipIds);
      const receiptMap = new Map<string, string>();
      (receipts ?? []).forEach((r: any) =>
        receiptMap.set(r.friendship_id, r.last_read_at)
      );

      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("friendship_id, sender_id, created_at")
        .in("friendship_id", friendshipIds)
        .neq("sender_id", userId);

      let total = 0;
      (msgs ?? []).forEach((m: any) => {
        const lastRead = receiptMap.get(m.friendship_id);
        const hiddenAt = hideMap.get(m.friendship_id);
        const created = new Date(m.created_at).getTime();
        if (lastRead && created <= new Date(lastRead).getTime()) return;
        if (hiddenAt && created <= new Date(hiddenAt).getTime()) return;
        total += 1;
      });

      return total;
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`unread-total-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => query.refetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_read_receipts" },
        () => query.refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return query.data ?? 0;
}
