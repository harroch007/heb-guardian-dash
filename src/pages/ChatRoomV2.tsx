import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useChat } from "@/hooks/useChat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Send,
  Image as ImageIcon,
  Loader2,
  User,
  Baby,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function ChatImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.storage.from("chat-media").createSignedUrl(path, 3600);
      if (!cancel && data?.signedUrl) setUrl(data.signedUrl);
    })();
    return () => {
      cancel = true;
    };
  }, [path]);
  if (!url) return <div className="h-40 w-40 animate-pulse rounded-lg bg-muted" />;
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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
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

  return (
    <div className="homev2-light flex h-[100dvh] flex-col bg-background" dir="rtl">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/chat-v2")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          {peer?.type === "child" ? <Baby className="h-5 w-5" /> : <User className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{peer?.name ?? "טוען..."}</p>
          <p className="text-xs text-muted-foreground">
            {peer?.type === "child" ? "ילד/ה" : "הורה"}
          </p>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <p className="text-sm">אין הודעות עדיין</p>
            <p className="mt-1 text-xs">שלח/י הודעה כדי להתחיל</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => {
              const mine = m.sender_id === parentId;
              return (
                <div
                  key={m.id}
                  className={cn("flex", mine ? "justify-start" : "justify-end")}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 shadow-sm",
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border"
                    )}
                  >
                    {m.message_type === "image" ? (
                      <ChatImage path={m.content} />
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                    )}
                    <div
                      className={cn(
                        "mt-1 flex items-center gap-1 text-[10px]",
                        mine ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}
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
      <div className="border-t border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileRef.current?.click()}
            disabled={sending}
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Button
            variant={viewOnce ? "default" : "ghost"}
            size="icon"
            onClick={() => setViewOnce((v) => !v)}
            title="הודעה לצפייה חד-פעמית"
            disabled={sending}
          >
            {viewOnce ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </Button>
          <div dir="rtl" className="flex-1">
            <Input
              placeholder={viewOnce ? "צפייה חד-פעמית..." : "כתוב/י הודעה..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={sending}
            />
          </div>
          <Button onClick={handleSend} disabled={sending || !text.trim()} size="icon">
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
