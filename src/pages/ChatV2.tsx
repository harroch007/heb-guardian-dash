import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { useChatList, type ChatListItem } from "@/hooks/useChatList";
import { MessageCircle, Loader2, ArrowRight, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `${mins} דק'`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} שע'`;
  const days = Math.floor(hours / 60);
  if (days < 7) return `${days} ימים`;
  return d.toLocaleDateString("he-IL");
}

function previewText(content: string | null, type: string | null): string {
  if (!content) return "";
  if (type === "image") return "📷 תמונה";
  if (type === "voice") return "🎤 הודעה קולית";
  return content.length > 60 ? content.slice(0, 60) + "…" : content;
}

function Avatar({ name, unread }: { name: string; unread: boolean }) {
  const letter = name?.trim()?.charAt(0) || "?";
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
      style={{ backgroundColor: unread ? "#00A884" : "#3a4b54" }}
    >
      {letter}
    </div>
  );
}

const ACTION_WIDTH = 80;

function SwipeableChatRow({
  chat,
  onOpen,
  onDelete,
}: {
  chat: ChatListItem;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
  const moved = useRef(false);

  const unread = chat.unreadCount > 0;

  // Close when clicking elsewhere
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-fid="${chat.friendshipId}"]`)) {
        setOpen(false);
        setOffset(0);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open, chat.friendshipId]);

  const onPointerDown = (clientX: number) => {
    startX.current = clientX;
    startOffset.current = offset;
    moved.current = false;
  };
  const onPointerMove = (clientX: number) => {
    if (startX.current === null) return;
    const dx = clientX - startX.current;
    if (Math.abs(dx) > 5) moved.current = true;
    // In RTL, swiping LEFT (negative dx) reveals action on the LEFT side.
    // We track positive offset = how much the row is shifted to the right (revealing left action area).
    let next = startOffset.current - dx;
    if (next < 0) next = 0;
    if (next > ACTION_WIDTH * 1.5) next = ACTION_WIDTH * 1.5;
    setOffset(next);
  };
  const onPointerUp = () => {
    if (startX.current === null) return;
    startX.current = null;
    if (offset > ACTION_WIDTH / 2) {
      setOffset(ACTION_WIDTH);
      setOpen(true);
    } else {
      setOffset(0);
      setOpen(false);
    }
  };

  const handleClick = () => {
    if (moved.current) return;
    if (open) {
      setOpen(false);
      setOffset(0);
      return;
    }
    onOpen();
  };

  const handleDelete = () => {
    if (!confirm(`למחוק את הצ'אט עם ${chat.peerName}?`)) {
      setOpen(false);
      setOffset(0);
      return;
    }
    onDelete();
  };

  return (
    <li
      data-fid={chat.friendshipId}
      className="relative overflow-hidden"
      style={{ borderTop: unread ? "none" : undefined }}
    >
      {/* Action layer (revealed on swipe) — positioned on LEFT side in RTL */}
      <button
        onClick={handleDelete}
        className="absolute inset-y-0 left-0 flex items-center justify-center text-white"
        style={{ width: ACTION_WIDTH, backgroundColor: "#DC2626" }}
        aria-label="מחק צ'אט"
        tabIndex={open ? 0 : -1}
      >
        <Trash2 className="h-6 w-6" />
      </button>

      {/* Swipeable row */}
      <div
        onClick={handleClick}
        onTouchStart={(e) => onPointerDown(e.touches[0].clientX)}
        onTouchMove={(e) => onPointerMove(e.touches[0].clientX)}
        onTouchEnd={onPointerUp}
        onMouseDown={(e) => onPointerDown(e.clientX)}
        onMouseMove={(e) => {
          if (e.buttons === 1) onPointerMove(e.clientX);
        }}
        onMouseUp={onPointerUp}
        onMouseLeave={() => {
          if (startX.current !== null) onPointerUp();
        }}
        className="relative flex cursor-pointer items-center gap-3 px-3 py-3 active:opacity-80 transition-transform"
        style={{
          transform: `translateX(${offset}px)`,
          backgroundColor: unread ? "#0F1B22" : "#0B141A",
          borderRight: unread ? "3px solid #00A884" : "3px solid transparent",
          transition: startX.current === null ? "transform 0.2s ease" : "none",
        }}
      >
        <div className="relative">
          <Avatar name={chat.peerName} unread={unread} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className="truncate text-base"
              style={{
                color: unread ? "#FFFFFF" : "#E9EDEF",
                fontWeight: unread ? 700 : 600,
              }}
            >
              {chat.peerName}
            </span>
            <span
              className="shrink-0 text-xs"
              style={{
                color: unread ? "#00A884" : "#8696A0",
                fontWeight: unread ? 700 : 400,
              }}
            >
              {formatRelativeTime(chat.lastMessageAt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p
              className="truncate text-sm flex-1"
              style={{
                color: unread ? "#E9EDEF" : "#8696A0",
                fontWeight: unread ? 500 : 400,
              }}
            >
              {chat.lastMessage
                ? previewText(chat.lastMessage, chat.lastMessageType)
                : "אין עדיין הודעות — שלח/י את הראשונה"}
            </p>
            {unread && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white shrink-0"
                style={{ backgroundColor: "#00A884" }}
              >
                {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function ChatV2() {
  const navigate = useNavigate();
  const { data: chats, isLoading, deleteChat } = useChatList();
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-chat-invite");
      if (error || !data?.success) {
        toast.error("שגיאה ביצירת הזמנה. ודא חיבור תקין");
        return;
      }
      const shareUrl = `https://wa.me/?text=${encodeURIComponent(data.share_text)}`;
      window.open(shareUrl, "_blank");
    } catch {
      toast.error("שגיאה ביצירת הזמנה");
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async (friendshipId: string) => {
    try {
      await deleteChat(friendshipId);
      toast.success("הצ'אט נמחק");
    } catch (err: any) {
      toast.error("מחיקה נכשלה", { description: err.message });
    }
  };

  return (
    <div
      className="chat-dark min-h-screen pb-20"
      dir="rtl"
      style={{ backgroundColor: "#0B141A" }}
    >
      <div className="mx-auto w-full max-w-[560px] md:min-h-screen md:border-x md:border-[#202C33]">
        <header
          className="sticky top-0 z-30 flex items-center gap-3 px-4 py-4"
          style={{ backgroundColor: "#202C33" }}
        >
          <button
            onClick={() => navigate("/home-v2")}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: "#8696A0" }}
            aria-label="חזור"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-xl font-bold" style={{ color: "#E9EDEF" }}>
            צ'אטים
          </h1>
          <button
            onClick={handleInvite}
            disabled={inviting}
            className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "#00A884", color: "#fff" }}
            aria-label="הזמן חבר"
          >
            {inviting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            הזמן חבר
          </button>
        </header>

        <main className="px-2 pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#00A884" }} />
            </div>
          ) : !chats || chats.length === 0 ? (
            <div className="mt-16 px-6 text-center">
              <MessageCircle
                className="mx-auto mb-3 h-10 w-10"
                style={{ color: "#8696A0" }}
              />
              <p className="font-medium" style={{ color: "#E9EDEF" }}>
                אין צ'אטים פעילים
              </p>
              <p className="mt-1 text-sm" style={{ color: "#8696A0" }}>
                הוסף ילד כדי שיופיע כאן אוטומטית
              </p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "#202C33" }}>
              {chats.map((chat) => (
                <SwipeableChatRow
                  key={chat.friendshipId}
                  chat={chat}
                  onOpen={() => navigate(`/chat-v2/${chat.friendshipId}`)}
                  onDelete={() => handleDelete(chat.friendshipId)}
                />
              ))}
            </ul>
          )}
        </main>
      </div>

      <BottomNavigationV2 />
    </div>
  );
}
