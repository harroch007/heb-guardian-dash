import { ChevronLeft } from "lucide-react";

interface SettingsAlert {
  id: number;
  chat_name: string | null;
  parent_message: string | null;
  created_at: string;
}

interface SettingsAlertPreviewProps {
  alerts: SettingsAlert[];
  onAlertClick?: (id: number) => void;
  onViewAll?: () => void;
}

const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const alertTime = new Date(timestamp);
  const diffMs = now.getTime() - alertTime.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "עכשיו";
  if (diffMinutes < 60) return `לפני ${diffMinutes} דקות`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `לפני ${diffHours} שעות`;

  const diffDays = Math.floor(diffHours / 24);
  return `לפני ${diffDays} ימים`;
};

const truncateMessage = (message: string | null, maxLength: number = 60): string => {
  if (!message) return "אין תוכן זמין";
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength).trim() + "...";
};

export function SettingsAlertPreview({ alerts, onAlertClick, onViewAll }: SettingsAlertPreviewProps) {
  const displayAlerts = alerts.slice(0, 5);

  if (displayAlerts.length === 0) {
    return;




  }

  return (
    <div className="space-y-0">
      {displayAlerts.map((alert, index) =>
      <div
        key={alert.id}
        onClick={() => onAlertClick?.(alert.id)}
        className={`p-3 cursor-pointer hover:bg-muted/30 transition-colors ${
        index < displayAlerts.length - 1 ? "border-b border-border/30" : ""}`
        }>

          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-sm font-medium text-foreground">
              {alert.chat_name || "שיחה"}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTimeAgo(alert.created_at)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {truncateMessage(alert.parent_message)}
          </p>
        </div>
      )}

      {onViewAll &&
      <button
        onClick={onViewAll}
        className="w-full flex items-center justify-center gap-1 py-3 text-sm text-primary hover:text-primary/80 transition-colors">

          צפייה בכל ההתראות
          <ChevronLeft className="w-4 h-4" />
        </button>
      }
    </div>);

}