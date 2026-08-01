/* eslint-disable @typescript-eslint/no-explicit-any -- Frozen legacy donor surface; migrate types before reactivation. */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface ChatMessage {
  id: string;
  friendship_id: string;
  sender_id: string;
  content: string;
  message_type: "text" | "image" | "voice" | string;
  is_view_once: boolean;
  created_at: string;
}

export interface ChatPeer {
  id: string;
  name: string;
  type: "child" | "parent";
}

export function useChat(friendshipId: string | undefined) {
  const { user } = useAuth();
  const parentId = user?.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peer, setPeer] = useState<ChatPeer | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!friendshipId || !parentId) return;
    setLoading(true);
    try {
      // Fetch friendship to determine peer
      const { data: f, error: fErr } = await supabase
        .from("friendships")
        .select("requester_id, receiver_id")
        .eq("id", friendshipId)
        .maybeSingle();
      if (fErr) throw fErr;
      if (!f) {
        toast({ title: "צ'אט לא נמצא", variant: "destructive" });
        setLoading(false);
        return;
      }

      const peerId = f.requester_id === parentId ? f.receiver_id : f.requester_id;
      const { data: p } = await supabase
        .from("chat_participants" as any)
        .select("participant_id, participant_type, display_name")
        .eq("participant_id", peerId)
        .maybeSingle();

      if (p) {
        setPeer({
          id: (p as any).participant_id,
          name: (p as any).display_name,
          type: (p as any).participant_type,
        });
      }

      const { data: msgs, error: mErr } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("friendship_id", friendshipId)
        .order("created_at", { ascending: true });

      if (mErr) throw mErr;
      setMessages((msgs ?? []) as ChatMessage[]);

      // Mark as read
      await supabase.from("chat_read_receipts" as any).upsert(
        {
          friendship_id: friendshipId,
          participant_id: parentId,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "friendship_id,participant_id" }
      );
    } catch (err: any) {
      toast({ title: "שגיאה בטעינת הצ'אט", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [friendshipId, parentId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime
  useEffect(() => {
    if (!friendshipId) return;
    const channel = supabase
      .channel(`chat-${friendshipId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `friendship_id=eq.${friendshipId}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === (payload.new as any).id)) return prev;
            return [...prev, payload.new as ChatMessage];
          });
          // Update read receipt
          if (parentId) {
            supabase
              .from("chat_read_receipts" as any)
              .upsert(
                {
                  friendship_id: friendshipId,
                  participant_id: parentId,
                  last_read_at: new Date().toISOString(),
                },
                { onConflict: "friendship_id,participant_id" }
              );
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [friendshipId, parentId]);

  const sendText = useCallback(
    async (text: string, isViewOnce = false) => {
      if (!friendshipId || !parentId || !text.trim()) return;
      setSending(true);
      try {
        const { error } = await supabase.rpc("send_chat_message" as any, {
          p_friendship_id: friendshipId,
          p_content: text.trim(),
          p_message_type: "text",
          p_is_view_once: isViewOnce,
        });
        if (error) throw error;
      } catch (err: any) {
        toast({ title: "שליחה נכשלה", description: err.message, variant: "destructive" });
      } finally {
        setSending(false);
      }
    },
    [friendshipId, parentId]
  );

  const sendImage = useCallback(
    async (file: File, isViewOnce = false) => {
      if (!friendshipId || !parentId) return;
      setSending(true);
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${friendshipId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-media")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;

        const { error } = await supabase.rpc("send_chat_message" as any, {
          p_friendship_id: friendshipId,
          p_content: path,
          p_message_type: "image",
          p_is_view_once: isViewOnce,
        });
        if (error) throw error;
      } catch (err: any) {
        toast({ title: "העלאת תמונה נכשלה", description: err.message, variant: "destructive" });
      } finally {
        setSending(false);
      }
    },
    [friendshipId, parentId]
  );

  return { messages, peer, loading, sending, sendText, sendImage, parentId, refetch: loadMessages };
}
