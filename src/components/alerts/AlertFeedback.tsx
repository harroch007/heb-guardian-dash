import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type FeedbackType = 'important' | 'not_relevant';

interface AlertFeedbackProps {
  alertId: number;
  parentId: string;
  existingFeedback?: FeedbackType | null;
  onFeedbackChange?: (alertId: number, feedback: FeedbackType) => void;
}

export function AlertFeedback({ alertId, parentId, existingFeedback, onFeedbackChange }: AlertFeedbackProps) {
  const [selected, setSelected] = useState<FeedbackType | null>(existingFeedback ?? null);
  const [loading, setLoading] = useState(false);

  const handleFeedback = async (type: FeedbackType) => {
    if (loading) return;
    setLoading(true);

    // Optimistic update
    const prev = selected;
    setSelected(type);

    try {
      // Upsert: insert or update on conflict (alert_id, parent_id)
      const { error } = await supabase
        .from('alert_feedback' as any)
        .upsert(
          { alert_id: alertId, parent_id: parentId, feedback_type: type },
          { onConflict: 'alert_id,parent_id' }
        );

      if (error) throw error;
      onFeedbackChange?.(alertId, type);
    } catch (err: any) {
      // Rollback
      setSelected(prev);
      toast({
        title: "שגיאה",
        description: "לא ניתן לשמור משוב",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-xs text-muted-foreground ml-1">המשוב שלך:</span>
      <button
        onClick={() => handleFeedback('important')}
        disabled={loading}
        className={cn(
          "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
          selected === 'important'
            ? "bg-success/20 text-success"
            : "bg-muted/50 text-muted-foreground hover:bg-muted"
        )}
      >
        <ThumbsUp className="w-3.5 h-3.5" />
        רלוונטי
      </button>
      <button
        onClick={() => handleFeedback('not_relevant')}
        disabled={loading}
        className={cn(
          "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
          selected === 'not_relevant'
            ? "bg-destructive/20 text-destructive"
            : "bg-muted/50 text-muted-foreground hover:bg-muted"
        )}
      >
        <ThumbsDown className="w-3.5 h-3.5" />
        לא רלוונטי
      </button>
    </div>
  );
}
