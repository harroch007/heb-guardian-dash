import { forwardRef } from "react";
import { MessageCircle, User, Clock, Lightbulb, Check, Bell, Trash2, Tag, MessageSquare, Loader2 } from "lucide-react";
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
  onRemindLater: (id: number) => void;
  onDelete: (id: number) => void;
  index?: number;
}

const categoryLabels: Record<string, string> = {
  'bullying': 'בריונות',
  'emotional_distress': 'מצוקה רגשית',
  'inappropriate_content': 'תוכן לא הולם',
  'stranger_danger': 'זר חשוד',
  'cyberbullying': 'בריונות ברשת',
  'self_harm': 'פגיעה עצמית',
  'violence': 'אלימות',
  'sexual_content': 'תוכן מיני',
  'drugs': 'סמים',
  'safe': 'בטוח',
};

// New verdict-based display function (using lowercase values)
const getVerdictDisplay = (verdict: string | null) => {
  switch (verdict) {
    case 'safe':
      return { label: 'בטוח', emoji: '🟢', bg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' };
    case 'monitor':
      return { label: 'במעקב', emoji: '🟡', bg: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' };
    case 'review':
      return { label: 'לבדיקה', emoji: '🟠', bg: 'bg-orange-500/20 text-orange-600 dark:text-orange-400' };
    case 'notify':
      return { label: 'דחוף', emoji: '🔴', bg: 'bg-destructive/20 text-destructive' };
    default:
      return { label: 'בניתוח...', emoji: '⏳', bg: 'bg-muted/30 text-muted-foreground' };
  }
};

const getCardStylesByVerdict = (verdict: string | null, isProcessed: boolean) => {
  if (!isProcessed) return 'bg-muted/5 border-muted/30 hover:border-muted/50';
  switch (verdict) {
    case 'safe':
      return 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50';
    case 'monitor':
      return 'bg-yellow-500/5 border-yellow-500/30 hover:border-yellow-500/50';
    case 'review':
      return 'bg-orange-500/5 border-orange-500/30 hover:border-orange-500/50';
    case 'notify':
      return 'bg-destructive/5 border-destructive/30 hover:border-destructive/50';
    default:
      return 'bg-muted/5 border-muted/30 hover:border-muted/50';
  }
};

const normalizeName = (value?: string | null) => {
  if (!value) return 'לא ידוע';
  return value
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/^~\s*/, '')
    .trim();
};

const getChatDisplayName = (alert: Alert) => {
  const name = normalizeName(alert.chat_name);

  if (alert.chat_type === 'GROUP') {
    return `בקבוצת "${name}"`;
  }

  return `בשיחה עם ${name}`;
};

export const AlertCard = forwardRef<HTMLDivElement, AlertCardProps>(function AlertCard(
  { alert, onAcknowledge, onRemindLater, onDelete, index = 0 },
  ref
) {
  const riskScore = alert.ai_risk_score ?? 0;
  const verdictDisplay = getVerdictDisplay(alert.ai_verdict);
  const categoryLabel = alert.category ? categoryLabels[alert.category] || alert.category : null;
  const formatTime = (timestamp: string) => {
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      ref={ref}
      className={cn(
        'p-5 rounded-xl border transition-all duration-300 animate-slide-in-right opacity-0',
        getCardStylesByVerdict(alert.ai_verdict, alert.is_processed)
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">עדכון מ-Kippy 💬</h3>
            <div className="flex items-center gap-2 mt-1">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{alert.child_name || 'לא ידוע'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Verdict Badge */}
          {alert.is_processed ? (
            <span className={cn('px-3 py-1 rounded-full text-xs font-medium', verdictDisplay.bg)}>
              {verdictDisplay.emoji} {verdictDisplay.label}<span className="hidden"> {riskScore}%</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted/30 text-muted-foreground">
              ⏳ ממתין...
            </span>
          )}
          
          {/* Delete Button */}
          <button
            onClick={() => onDelete(alert.id)}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="מחק"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contact Name (sender) */}
      {(alert.chat_name || alert.sender) && (
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {getChatDisplayName(alert)}
          </span>
        </div>
      )}

      {/* Category */}
      {alert.is_processed && categoryLabel && (
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {categoryLabel}
          </span>
        </div>
      )}

      {/* Content - conditional based on is_processed */}
      {alert.is_processed ? (
        <>
          {/* AI Summary (main message) */}
          {(alert.ai_summary || alert.parent_message) && (
            <div className="mb-4 p-3 rounded-lg bg-background/50">
              <p className="text-sm text-foreground leading-relaxed">
                {alert.ai_summary || alert.parent_message}
              </p>
            </div>
          )}

          {/* AI Recommendation */}
          {alert.ai_recommendation && (
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-primary mb-1">המלצה:</p>
                  <p className="text-sm text-foreground/90 leading-relaxed">{alert.ai_recommendation}</p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-muted/50">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">⏳ ממתין לניתוח...</span>
          </div>
        </div>
      )}

      {/* Time */}
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{formatTime(alert.created_at)}</span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-3 border-t border-border/50">
        <Button
          onClick={() => onAcknowledge(alert.id)}
          variant="default"
          size="sm"
          className="flex-1"
        >
          <Check className="w-4 h-4 ml-2" />
          הבנתי
        </Button>
        <Button
          onClick={() => onRemindLater(alert.id)}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          <Bell className="w-4 h-4 ml-2" />
          תזכיר מאוחר יותר
        </Button>
      </div>
    </div>
  );
});

AlertCard.displayName = 'AlertCard';
