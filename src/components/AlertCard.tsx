import { forwardRef } from "react";
import { MessageCircle, User, Clock, Lightbulb, Check, Bell, Trash2, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Alert {
  id: number;
  child_id: string | null;
  child_name?: string;
  parent_message: string | null;
  suggested_action: string | null;
  category: string | null;
  ai_risk_score: number | null;
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

const getRiskLevel = (score: number) => {
  if (score <= 30) return { label: 'הכל בסדר', color: 'success', emoji: '🟢' };
  if (score <= 60) return { label: 'שים לב', color: 'warning', emoji: '🟡' };
  if (score <= 80) return { label: 'חשוב', color: 'orange', emoji: '🟠' };
  return { label: 'דחוף', color: 'destructive', emoji: '🔴' };
};

const getCardStyles = (score: number) => {
  if (score <= 30) return 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50';
  if (score <= 60) return 'bg-yellow-500/5 border-yellow-500/30 hover:border-yellow-500/50';
  if (score <= 80) return 'bg-orange-500/5 border-orange-500/30 hover:border-orange-500/50';
  return 'bg-destructive/5 border-destructive/30 hover:border-destructive/50';
};

const getBadgeStyles = (score: number) => {
  if (score <= 30) return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
  if (score <= 60) return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
  if (score <= 80) return 'bg-orange-500/20 text-orange-600 dark:text-orange-400';
  return 'bg-destructive/20 text-destructive';
};

export const AlertCard = forwardRef<HTMLDivElement, AlertCardProps>(function AlertCard(
  { alert, onAcknowledge, onRemindLater, onDelete, index = 0 },
  ref
) {
  const riskScore = alert.ai_risk_score ?? 0;
  const riskLevel = getRiskLevel(riskScore);
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
        getCardStyles(riskScore)
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
          {/* Risk Badge */}
          <span className={cn('px-3 py-1 rounded-full text-xs font-medium', getBadgeStyles(riskScore))}>
            {riskLevel.emoji} {riskLevel.label}
          </span>
          <span className="text-xs text-muted-foreground">{riskScore}%</span>
          
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

      {/* Category */}
      {categoryLabel && (
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {categoryLabel}
          </span>
        </div>
      )}

      {/* Parent Message */}
      {alert.parent_message && (
        <div className="mb-4 p-3 rounded-lg bg-background/50">
          <p className="text-sm text-foreground leading-relaxed">{alert.parent_message}</p>
        </div>
      )}

      {/* Suggested Action */}
      {alert.suggested_action && (
        <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-primary mb-1">המלצה</p>
              <p className="text-sm text-foreground/90 leading-relaxed">{alert.suggested_action}</p>
            </div>
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
