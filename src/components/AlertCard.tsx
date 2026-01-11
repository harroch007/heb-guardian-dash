import { forwardRef } from "react";
import { User, Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Alert {
  id: number;
  child_id: string | null;
  child_name?: string;
  sender: string | null;
  sender_display: string | null;
  chat_name: string | null;
  chat_type: string | null;
  parent_message: string | null;
  suggested_action: string | null;
  category: string | null;
  ai_risk_score: number | null;
  ai_verdict: string | null;
  ai_summary: string | null;
  ai_recommendation: string | null;
  created_at: string;
  is_processed: boolean;
}

interface AlertCardProps {
  alert: Alert;
  onAcknowledge: (id: number) => void;
  index?: number;
}

// Severity display based on verdict - uses warning for medium/high, success for low
const getSeverityDisplay = (verdict: string | null) => {
  switch (verdict) {
    case 'notify':
      return { label: 'גבוה', className: 'bg-warning/20 text-warning' };
    case 'review':
      return { label: 'בינוני', className: 'bg-warning/20 text-warning' };
    case 'monitor':
      return { label: 'נמוך', className: 'bg-success/20 text-success' };
    case 'safe':
      return { label: 'נמוך', className: 'bg-success/20 text-success' };
    default:
      // TODO(DATA): verdict is missing
      return { label: 'לא ידוע*', className: 'bg-muted text-muted-foreground' };
  }
};

// Get contact name with fallbacks
const getContactName = (alert: Alert): string => {
  if (alert.sender_display) return alert.sender_display;
  if (alert.sender) return alert.sender;
  if (alert.chat_name) return alert.chat_name;
  // TODO(DATA): No contact information available
  return 'איש קשר לא ידוע*';
};

// Format relative time
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

export const AlertCard = forwardRef<HTMLDivElement, AlertCardProps>(function AlertCard(
  { alert, onAcknowledge, index = 0 },
  ref
) {
  const severity = getSeverityDisplay(alert.ai_verdict);
  const contactName = getContactName(alert);
  // TODO(DATA): child_name might be missing
  const childName = alert.child_name || 'שם הילד*';
  const mainMessage = alert.ai_summary || alert.parent_message || '';

  return (
    <div
      ref={ref}
      className={cn(
        'p-4 rounded-xl border bg-card transition-all duration-300 animate-slide-in-right opacity-0',
        'border-border/50 hover:border-border'
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Header line: Child name + Severity pill */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-foreground">{childName}</span>
        </div>
        <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', severity.className)}>
          {severity.label}
        </span>
      </div>

      {/* Main message (1-2 lines max) */}
      {mainMessage && (
        <p className="text-sm text-foreground mb-3 line-clamp-2 leading-relaxed">
          {mainMessage}
        </p>
      )}

      {/* Metadata row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
        <span>מול: {contactName}</span>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{formatTime(alert.created_at)}</span>
        </div>
      </div>

      {/* Actions row (2 actions only) */}
      <div className="flex items-center gap-2 pt-3 border-t border-border/50">
        {/* TODO(ROUTE): No detail page exists - button disabled */}
        <Button size="sm" variant="outline" disabled className="flex-1">
          לצפייה
        </Button>
        <Button 
          size="sm" 
          variant="default" 
          onClick={() => onAcknowledge(alert.id)}
          className="flex-1"
        >
          <Check className="w-4 h-4 ml-1" />
          סמן כטופל
        </Button>
      </div>
    </div>
  );
});

AlertCard.displayName = 'AlertCard';
