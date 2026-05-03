import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useChat } from "@/hooks/useChat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Send,
  Paperclip,
  Loader2,
  Mic,
  Gamepad2,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = {
  bg: "#0B141A",
  header: "#202C33",
  inputBg: "#2A3942",
  mine: "#005C4B",
  text: "#E9EDEF",
  textMuted: "#8696A0",
  accent: "#39D2FF",
  fab: "#00A884",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function ChatImage({ path, isViewOnce }: { path: string; isViewOnce: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(!isViewOnce);

  useEffect(() => {
    if (!revealed) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase.storage
        .from("chat-media")
        .createSignedUrl(path, 3600);
      if (!cancel && data?.signedUrl) setUrl(data.signedUrl);
    })();
    return () => {
      cancel = true;
    };
  }, [path, revealed]);

  if (!revealed) {
    return (
      <button
        onClick={() => setRevealed(true)}
        className="text-sm font-medium underline-offset-2 hover:underline"
        style={{ color: COLORS.accent }}
      >
        🖼️ תמונה (לחץ לצפייה)
      </button>
    );
  }
  if (!url)
    return (
      <div
        className="h-40 w-40 animate-pulse rounded-lg"
        style={{ backgroundColor: COLORS.inputBg }}
      />
    );
  return <img src={url} alt="תמונה" className="max-h-64 rounded-lg" />;
}

export default function ChatRoomV2() {
  const navigate = useNavigate();
  const { friendshipId } = useParams<{ friendshipId: string }>();
  const { messages, peer, loading, sending, sendText, sendImage, parentId } =
    useChat(friendshipId);

  const [text, setText] = useState("");
  const [viewOnce, setViewOnce] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim()) return;
    const t = text;
    setText("");
    const wasViewOnce = viewOnce;
    setViewOnce(false);
    await sendText(t, wasViewOnce);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const wasViewOnce = viewOnce;
    setViewOnce(false);
    await sendImage(file, wasViewOnce);
    if (fileRef.current) fileRef.current.value = "";
  };

  const hasText = text.trim().length > 0;
  const peerInitial = peer?.name?.trim()?.charAt(0) || "?";

  return (
    <div
      className="chat-dark flex h-[100dvh] justify-center"
      dir="rtl"
      style={{ backgroundColor: COLORS.bg }}
    >
      <div className="flex h-full w-full max-w-[560px] flex-col md:border-x md:border-[#202C33]">
      {/* Header */}
      <header
        className="flex items-center gap-3 px-3"
        style={{ backgroundColor: COLORS.header, height: 64 }}
      >
        <button
          onClick={() => navigate("/chat-v2")}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ color: COLORS.textMuted }}
          aria-label="חזור"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white"
          style={{ backgroundColor: COLORS.fab }}
        >
          {peerInitial}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[18px] font-bold leading-tight"
            style={{ color: COLORS.text }}
          >
            {peer?.name ?? "טוען..."}
          </p>
          <p className="text-[13px]" style={{ color: COLORS.textMuted }}>
            {peer?.type === "child" ? "ילד/ה" : "הורה"}
          </p>
        </div>
        <button
          onClick={() => toast({ title: "משחקים בקרוב 🎮" })}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          aria-label="משחק"
        >
          <Gamepad2 className="h-5 w-5" style={{ color: COLORS.fab }} />
        </button>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 py-3"
        style={{ backgroundColor: COLORS.bg }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2
              className="h-6 w-6 animate-spin"
              style={{ color: COLORS.fab }}
            />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm" style={{ color: COLORS.text }}>
              אין הודעות עדיין
            </p>
            <p className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>
              שלח/י הודעה כדי להתחיל
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {messages.map((m) => {
              const mine = m.sender_id === parentId;
              return (
                <div
                  key={m.id}
                  className={cn("flex px-1", mine ? "justify-start" : "justify-end")}
                >
                  <div
                    className="max-w-[80%] px-2.5 py-1.5 shadow-sm"
                    style={{
                      backgroundColor: mine ? COLORS.mine : COLORS.header,
                      color: COLORS.text,
                      borderRadius: 12,
                      // "Speech tail" — flatten one top corner
                      borderTopRightRadius: mine ? 0 : 12,
                      borderTopLeftRadius: mine ? 12 : 0,
                    }}
                  >
                    {m.message_type === "image" ? (
                      <ChatImage path={m.content} isViewOnce={m.is_view_once} />
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
                        {m.content}
                      </p>
                    )}
                    <div
                      className="mt-1 flex items-center justify-end gap-1 text-[10px]"
                      style={{ color: COLORS.textMuted }}
                    >
                      {m.is_view_once && <Eye className="h-3 w-3" />}
                      <span>{formatTime(m.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <div
        className="flex items-center gap-2 px-2 py-2"
        style={{ backgroundColor: COLORS.bg }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />

        {/* Pill input with embedded actions */}
        <div
          className="flex flex-1 items-center gap-1 rounded-full px-3 py-1.5"
          style={{ backgroundColor: COLORS.inputBg }}
        >
          <button
            onClick={() => setViewOnce((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full"
            title="הודעה לצפייה חד-פעמית"
            disabled={sending}
          >
            {viewOnce ? (
              <Eye className="h-5 w-5" style={{ color: COLORS.accent }} />
            ) : (
              <EyeOff className="h-5 w-5" style={{ color: COLORS.textMuted }} />
            )}
          </button>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={viewOnce ? "צפייה חד-פעמית..." : "הודעה..."}
            disabled={sending}
            className="flex-1 border-0 bg-transparent text-[15px] outline-none"
            style={{ color: COLORS.text }}
            dir="rtl"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-8 w-8 items-center justify-center rounded-full"
            disabled={sending}
            aria-label="צרף תמונה"
          >
            <Paperclip className="h-5 w-5" style={{ color: COLORS.textMuted }} />
          </button>
        </div>

        {/* FAB */}
        <button
          onClick={() => {
            if (hasText) handleSend();
            else toast({ title: "הקלטה קולית בקרוב 🎙️" });
          }}
          disabled={sending}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md active:scale-95"
          style={{ backgroundColor: COLORS.fab }}
          aria-label={hasText ? "שלח" : "הקלט"}
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : hasText ? (
            <Send className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}
