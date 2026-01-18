import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Alert {
  id: number;
  sender_display: string | null;
  chat_name: string | null;
  parent_message: string | null;
  created_at: string;
}

interface AlertListViewProps {
  alerts: Alert[];
  onSelect: (id: number) => void;
}

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'עכשיו';
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays < 7) return `לפני ${diffDays} ימים`;

  return date.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
  });
};

const truncateMessage = (message: string | null, maxLength: number = 60): string => {
  if (!message) return '';
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength) + '...';
};

const getContactName = (alert: Alert): string => {
  if (alert.chat_name) return alert.chat_name;
  if (alert.sender_display) return alert.sender_display;
  return 'התראה';
};

export const AlertListView = ({ alerts, onSelect }: AlertListViewProps) => {
  return (
    <Card className="divide-y divide-border/50 overflow-hidden">
      {alerts.map((alert, index) => (
        <button
          key={alert.id}
          onClick={() => onSelect(alert.id)}
          className="w-full p-4 text-right hover:bg-muted/50 transition-colors focus:outline-none focus:bg-muted/50 animate-slide-in-right opacity-0"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">
                {getContactName(alert)}
              </p>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                {truncateMessage(alert.parent_message)}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Clock className="w-3 h-3" />
              <span>{formatTime(alert.created_at)}</span>
            </div>
          </div>
        </button>
      ))}
    </Card>
  );
};
