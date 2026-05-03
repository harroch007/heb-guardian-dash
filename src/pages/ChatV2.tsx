import { useNavigate } from "react-router-dom";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { TopNavigationV2 } from "@/components/TopNavigationV2";
import { useChatList } from "@/hooks/useChatList";
import { Card } from "@/components/ui/card";
import { MessageCircle, Image as ImageIcon, User, Baby, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק'`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע'`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `לפני ${days} ימים`;
  return d.toLocaleDateString("he-IL");
}

function previewText(content: string | null, type: string | null): string {
  if (!content) return "";
  if (type === "image") return "📷 תמונה";
  if (type === "voice") return "🎤 הודעה קולית";
  return content.length > 60 ? content.slice(0, 60) + "…" : content;
}

export default function ChatV2() {
  const navigate = useNavigate();
  const { data: chats, isLoading } = useChatList();

  return (
    <div className="homev2-light min-h-screen bg-background pb-20" dir="rtl">
      <TopNavigationV2 />

      <main className="container mx-auto max-w-2xl px-4 pt-4">
        <header className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3">
            <MessageCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">צ'אט</h1>
            <p className="text-sm text-muted-foreground">
              שיחות עם הילדים והמשפחה שלך
            </p>
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !chats || chats.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">אין צ'אטים פעילים</p>
            <p className="mt-1 text-sm text-muted-foreground">
              הוסף ילד כדי שיופיע כאן אוטומטית
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => (
              <Card
                key={chat.friendshipId}
                className="cursor-pointer p-3 transition-all hover:shadow-md active:scale-[0.99]"
                onClick={() => navigate(`/chat-v2/${chat.friendshipId}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                      {chat.peerType === "child" ? (
                        <Baby className="h-6 w-6" />
                      ) : (
                        <User className="h-6 w-6" />
                      )}
                    </div>
                    {chat.unreadCount > 0 && (
                      <Badge className="absolute -top-1 -left-1 h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                        {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
                      </Badge>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">
                        {chat.peerName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(chat.lastMessageAt)}
                      </span>
                    </div>
                    <p
                      className={`truncate text-sm ${
                        chat.unreadCount > 0
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {chat.lastMessage
                        ? previewText(chat.lastMessage, chat.lastMessageType)
                        : "אין עדיין הודעות — שלח/י את הראשונה"}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNavigationV2 />
    </div>
  );
}
