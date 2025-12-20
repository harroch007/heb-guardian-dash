import { Trash2, AlertTriangle, User, Clock } from "lucide-react";
import { Alert } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface AlertCardProps {
  alert: Alert;
  onDelete: (id: string) => void;
  index?: number;
}

export function AlertCard({ alert, onDelete, index = 0 }: AlertCardProps) {
  const isHighRisk = alert.risk_score > 80;
  
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
      minute: '2-digit'
    });
  };

  return (
    <div
      className={cn(
        "p-4 rounded-xl border transition-all duration-300 animate-slide-in-right opacity-0",
        isHighRisk
          ? "bg-destructive/5 border-destructive/30 hover:border-destructive/60"
          : "bg-warning/5 border-warning/30 hover:border-warning/60"
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className={cn(
              "p-1.5 rounded-lg",
              isHighRisk ? "bg-destructive/20" : "bg-warning/20"
            )}>
              <AlertTriangle className={cn(
                "w-4 h-4",
                isHighRisk ? "text-destructive" : "text-warning"
              )} />
            </div>
            
            {/* Risk Badge */}
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium",
              isHighRisk
                ? "bg-destructive/20 text-destructive glow-destructive"
                : "bg-warning/20 text-warning glow-warning"
            )}>
              {isHighRisk ? 'סיכון גבוה' : 'סיכון בינוני'}
            </span>

            <span className="text-xs text-muted-foreground">
              {alert.risk_score}%
            </span>
          </div>

          {/* Sender */}
          <div className="flex items-center gap-2 mb-2">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{alert.sender}</span>
          </div>

          {/* Content */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            {alert.content}
          </p>

          {/* Time */}
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-primary">{formatTime(alert.created_at)}</span>
          </div>
        </div>

        {/* Delete Button */}
        <button
          onClick={() => onDelete(alert.id)}
          className="p-2 rounded-lg bg-muted/50 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all duration-200 group"
          title="מחק התראה"
        >
          <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </div>
  );
}
