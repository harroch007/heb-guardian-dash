import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useCallback } from "react";

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
  const qc = useQueryClient();

  const query = useQuery<ChatListItem[]>({
    queryKey: ["chat-list", parentId],
    enabled: !!parentId,
    queryFn: async () => {
      if (!parentId) return [];

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

      const { data: messages } = await supabase
        .from("chat_messages")
        .select("friendship_id, content, message_type, created_at, sender_id")
        .in("friendship_id", friendshipIds)
        .order("created_at", { ascending: false });

      const lastMsgMap = new Map<string, any>();
      (messages ?? []).forEach((m) => {
        if (!lastMsgMap.has(m.friendship_id)) lastMsgMap.set(m.friendship_id, m);
      });

      const { data: receipts } = await supabase
        .from("chat_read_receipts" as any)
        .select("friendship_id, last_read_at")
        .eq("participant_id", parentId)
        .in("friendship_id", friendshipIds);

      const receiptMap = new Map<string, string>();
      (receipts ?? []).forEach((r: any) => {
        receiptMap.set(r.friendship_id, r.last_read_at);
      });

      // Hidden (per-user soft-deleted) threads
      const { data: hides } = await supabase
        .from("chat_thread_hides" as any)
        .select("friendship_id, hidden_at")
        .eq("participant_id", parentId)
        .in("friendship_id", friendshipIds);
      const hideMap = new Map<string, string>();
      (hides ?? []).forEach((h: any) =>
        hideMap.set(h.friendship_id, h.hidden_at)
      );

      const items: ChatListItem[] = [];
      for (const f of friendships) {
        const peerId = f.requester_id === parentId ? f.receiver_id : f.requester_id;
        const peer = peerMap.get(peerId);
        const lastMsg = lastMsgMap.get(f.id);
        const lastReadAt = receiptMap.get(f.id);
        const hiddenAt = hideMap.get(f.id);

        // Skip if hidden and no newer message
        if (hiddenAt) {
          if (!lastMsg || new Date(lastMsg.created_at) <= new Date(hiddenAt)) {
            continue;
          }
        }

        const unread = (messages ?? []).filter((m) => {
          if (m.friendship_id !== f.id) return false;
          if (m.sender_id === parentId) return false;
          const created = new Date(m.created_at).getTime();
          if (lastReadAt && created <= new Date(lastReadAt).getTime()) return false;
          if (hiddenAt && created <= new Date(hiddenAt).getTime()) return false;
          return true;
        }).length;

        items.push({
          friendshipId: f.id,
          peerId,
          peerName: peer?.name ?? "משתמש",
          peerType: peer?.type ?? "child",
          lastMessage: lastMsg?.content ?? null,
          lastMessageAt: lastMsg?.created_at ?? null,
          lastMessageType: lastMsg?.message_type ?? null,
          unreadCount: unread,
        });
      }

      items.sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      });

      return items;
    },
  });

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

  const deleteChat = useCallback(
    async (friendshipId: string) => {
      // Optimistic remove
      const prev = qc.getQueryData<ChatListItem[]>(["chat-list", parentId]);
      qc.setQueryData<ChatListItem[]>(["chat-list", parentId], (old) =>
        (old ?? []).filter((c) => c.friendshipId !== friendshipId)
      );
      const { error } = await supabase.rpc("hide_chat_thread" as any, {
        p_friendship_id: friendshipId,
      });
      if (error) {
        // rollback
        qc.setQueryData(["chat-list", parentId], prev);
        throw error;
      }
      qc.invalidateQueries({ queryKey: ["unread-chat-total", parentId] });
    },
    [parentId, qc]
  );

  return { ...query, deleteChat };
}
