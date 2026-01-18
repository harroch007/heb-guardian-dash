import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Alert {
  id: number;
  child_name?: string;
  chat_type?: string | null;
  sender_display: string | null;
  chat_name: string | null;
  parent_message: string | null;
  created_at: string;
}

interface AlertListViewProps {
  alerts: Alert[];
  onSelect: (id: number) => void;
  childCount?: number;
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

const getChatDisplay = (alert: Alert): string => {
  if (alert.chat_type === 'private') {
    const contactName = alert.sender_display || alert.chat_name || 'איש קשר';
    return `שיחה פרטית עם ${contactName}`;
  }
  return `קבוצה: ${alert.chat_name || 'קבוצה'}`;
};

export const AlertListView = ({ alerts, onSelect, childCount = 1 }: AlertListViewProps) => {
  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => (
        <Card
          key={alert.id}
          className="overflow-hidden animate-slide-in-right opacity-0"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <button
            onClick={() => onSelect(alert.id)}
            className="w-full p-4 text-right hover:bg-muted/50 transition-colors focus:outline-none focus:bg-muted/50"
          >
            <div className="space-y-2">
              {/* Child name - only if multiple children */}
              {childCount > 1 && alert.child_name && (
                <p className="text-xs font-medium text-primary">
                  {alert.child_name}
                </p>
              )}
              
              {/* Chat type and name */}
              <p className="font-semibold text-foreground">
                {getChatDisplay(alert)}
              </p>
              
              {/* Message - up to 2 lines */}
              {alert.parent_message && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {alert.parent_message}
                </p>
              )}
              
              {/* Timestamp at bottom */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                <Clock className="w-3 h-3" />
                <span>{formatTime(alert.created_at)}</span>
              </div>
            </div>
          </button>
        </Card>
      ))}
    </div>
  );
};
