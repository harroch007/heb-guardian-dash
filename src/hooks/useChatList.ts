import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export interface ChatListItem {
  friendshipId: string;
  peerId: string;
  peerName: string;
  peerType: "child" | "parent";
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageType: string | null;
  unreadCount: number;
}

export function useChatList() {
  const { user } = useAuth();
  const parentId = user?.id;

  const query = useQuery<ChatListItem[]>({
    queryKey: ["chat-list", parentId],
    enabled: !!parentId,
    queryFn: async () => {
      if (!parentId) return [];

      // 1. Get all friendships involving this parent
      const { data: friendships, error: fErr } = await supabase
        .from("friendships")
        .select("id, requester_id, receiver_id, status, created_at")
        .or(`requester_id.eq.${parentId},receiver_id.eq.${parentId}`)
        .eq("status", "accepted");

      if (fErr) throw fErr;
      if (!friendships || friendships.length === 0) return [];

      const peerIds = friendships.map((f) =>
        f.requester_id === parentId ? f.receiver_id : f.requester_id
      );
      const friendshipIds = friendships.map((f) => f.id);

      // 2. Resolve peer display names from chat_participants view
      const { data: participants } = await supabase
        .from("chat_participants" as any)
        .select("participant_id, participant_type, display_name")
        .in("participant_id", peerIds);

      const peerMap = new Map<string, { name: string; type: "child" | "parent" }>();
      (participants ?? []).forEach((p: any) => {
        peerMap.set(p.participant_id, {
          name: p.display_name,
          type: p.participant_type,
        });
      });

      // 3. Last message per friendship
      const { data: messages } = await supabase
        .from("chat_messages")
        .select("friendship_id, content, message_type, created_at, sender_id")
        .in("friendship_id", friendshipIds)
        .order("created_at", { ascending: false });

      const lastMsgMap = new Map<string, any>();
      (messages ?? []).forEach((m) => {
        if (!lastMsgMap.has(m.friendship_id)) lastMsgMap.set(m.friendship_id, m);
      });

      // 4. Read receipts
      const { data: receipts } = await supabase
        .from("chat_read_receipts" as any)
        .select("friendship_id, last_read_at")
        .eq("participant_id", parentId)
        .in("friendship_id", friendshipIds);

      const receiptMap = new Map<string, string>();
      (receipts ?? []).forEach((r: any) => {
        receiptMap.set(r.friendship_id, r.last_read_at);
      });

      // 5. Build list
      const items: ChatListItem[] = friendships.map((f) => {
        const peerId = f.requester_id === parentId ? f.receiver_id : f.requester_id;
        const peer = peerMap.get(peerId);
        const lastMsg = lastMsgMap.get(f.id);
        const lastReadAt = receiptMap.get(f.id);

        // Count unread messages (sent by peer, after lastReadAt)
        const unread = (messages ?? []).filter(
          (m) =>
            m.friendship_id === f.id &&
            m.sender_id !== parentId &&
            (!lastReadAt || new Date(m.created_at) > new Date(lastReadAt))
        ).length;

        return {
          friendshipId: f.id,
          peerId,
          peerName: peer?.name ?? "משתמש",
          peerType: peer?.type ?? "child",
          lastMessage: lastMsg?.content ?? null,
          lastMessageAt: lastMsg?.created_at ?? null,
          lastMessageType: lastMsg?.message_type ?? null,
          unreadCount: unread,
        };
      });

      // Sort by last message time desc
      items.sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      });

      return items;
    },
  });

  // Realtime: refetch on any new message in our friendships
  useEffect(() => {
    if (!parentId) return;
    const channel = supabase
      .channel(`chat-list-${parentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => query.refetch()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friendships" },
        () => query.refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [parentId]);

  return query;
}
