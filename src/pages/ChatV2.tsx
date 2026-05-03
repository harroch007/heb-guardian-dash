import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { useChatList } from "@/hooks/useChatList";
import { MessageCircle, Loader2, ArrowRight, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

function Avatar({ name }: { name: string }) {
  const letter = name?.trim()?.charAt(0) || "?";
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
      style={{ backgroundColor: "#00A884" }}
    >
      {letter}
    </div>
  );
}

export default function ChatV2() {
  const navigate = useNavigate();
  const { data: chats, isLoading } = useChatList();
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

  return (
    <div
      className="chat-dark min-h-screen pb-20"
      dir="rtl"
      style={{ backgroundColor: "#0B141A" }}
    >
      {/* Header */}
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
        <MessageCircle className="h-5 w-5" style={{ color: "#8696A0" }} />
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
              <li
                key={chat.friendshipId}
                onClick={() => navigate(`/chat-v2/${chat.friendshipId}`)}
                className="flex cursor-pointer items-center gap-3 px-3 py-3 active:opacity-70"
              >
                <div className="relative">
                  <Avatar name={chat.peerName} />
                  {chat.unreadCount > 0 && (
                    <span
                      className="absolute -top-0.5 -left-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                      style={{ backgroundColor: "#00A884" }}
                    >
                      {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className="truncate text-base font-semibold"
                      style={{ color: "#E9EDEF" }}
                    >
                      {chat.peerName}
                    </span>
                    <span
                      className="shrink-0 text-xs"
                      style={{
                        color: chat.unreadCount > 0 ? "#00A884" : "#8696A0",
                      }}
                    >
                      {formatRelativeTime(chat.lastMessageAt)}
                    </span>
                  </div>
                  <p
                    className="truncate text-sm"
                    style={{
                      color: chat.unreadCount > 0 ? "#E9EDEF" : "#8696A0",
                      fontWeight: chat.unreadCount > 0 ? 500 : 400,
                    }}
                  >
                    {chat.lastMessage
                      ? previewText(chat.lastMessage, chat.lastMessageType)
                      : "אין עדיין הודעות — שלח/י את הראשונה"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <BottomNavigationV2 />
    </div>
  );
}
