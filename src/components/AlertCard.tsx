import { forwardRef, useState } from "react";
import { Trash2, AlertTriangle, User, Clock, RefreshCw, Bot, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Alert {
  id: number;
  sender: string | null;
  content: string | null;
  risk_score: number | null;
  created_at: string;
  ai_summary?: string | null;
  ai_recommendation?: string | null;
  is_processed?: boolean;
}

interface AlertCardProps {
  alert: Alert;
  onDelete: (id: number) => void;
  onReanalyze?: (id: number) => void;
  index?: number;
}

export const AlertCard = forwardRef<HTMLDivElement, AlertCardProps>(function AlertCard({ alert, onDelete, onReanalyze, index = 0 }, ref) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const riskScore = alert.risk_score ?? 0;
  const isHighRisk = riskScore > 80;
  
  const handleReanalyze = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-alert', {
        body: { alert_id: alert.id }
      });
      
      if (error) throw error;
      
      toast.success('הניתוח הושלם בהצלחה');
      onReanalyze?.(alert.id);
    } catch (err: any) {
      console.error('Re-analyze error:', err);
      toast.error('שגיאה בניתוח: ' + (err.message || 'נסה שוב'));
    } finally {
      setIsAnalyzing(false);
    }
  };
  
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
      ref={ref}
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
              {riskScore}%
            </span>
          </div>

          {/* Sender */}
          <div className="flex items-center gap-2 mb-2">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{alert.sender || 'לא ידוע'}</span>
          </div>

          {/* Content */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            {alert.content || 'אין תוכן'}
          </p>

          {/* Time */}
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-primary">{formatTime(alert.created_at)}</span>
          </div>

          {/* AI Analysis Section */}
          {alert.is_processed && (alert.ai_summary || alert.ai_recommendation) && (
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
              {alert.ai_summary && (
                <div className="flex items-start gap-2">
                  <Bot className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">{alert.ai_summary}</p>
                </div>
              )}
              {alert.ai_recommendation && (
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-foreground/80 leading-relaxed">{alert.ai_recommendation}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {/* Re-analyze Button */}
          <button
            onClick={handleReanalyze}
            disabled={isAnalyzing}
            className={cn(
              "p-2 rounded-lg bg-muted/50 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all duration-200 group",
              isAnalyzing && "opacity-50 cursor-not-allowed"
            )}
            title="נתח מחדש"
          >
            <RefreshCw className={cn(
              "w-4 h-4 group-hover:scale-110 transition-transform",
              isAnalyzing && "animate-spin"
            )} />
          </button>
          
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
    </div>
  );
});

AlertCard.displayName = "AlertCard";
