import { Plus } from "lucide-react";
import { getQuickChoreTemplates } from "@/lib/genderText";

// Backwards-compatible re-export (some callers/tests import this constant).
// Prefer using <QuickChoreTemplates gender={...} /> which handles gender.
export interface QuickTemplate {
  title: string;
  minutes: number;
  emoji: string;
}

export const QUICK_CHORE_TEMPLATES: QuickTemplate[] = getQuickChoreTemplates(null).map(
  ({ title, minutes, emoji }) => ({ title, minutes, emoji })
);

interface Props {
  onPick: (title: string, minutes: number) => void | Promise<void>;
  disabled?: boolean;
  compact?: boolean;
  /** Child's gender — adapts the imperative form (e.g. "סדר" → "סדרי"). */
  gender?: string | null;
}

export function QuickChoreTemplates({ onPick, disabled, compact, gender }: Props) {
  const templates = getQuickChoreTemplates(gender);
  return (
    <div dir="rtl" className="space-y-2">
      {!compact && (
        <p className="text-xs text-muted-foreground font-medium">
          ⚡ משימות מהירות — לחיצה אחת ליצירה
        </p>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {templates.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={disabled}
            onClick={() => onPick(t.title, t.minutes)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 text-foreground text-xs font-medium whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
          >
            <span>{t.emoji}</span>
            <span>{t.title}</span>
            <span className="text-[10px] text-muted-foreground">· {t.minutes} דק׳</span>
            <Plus className="w-3 h-3 text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
}
