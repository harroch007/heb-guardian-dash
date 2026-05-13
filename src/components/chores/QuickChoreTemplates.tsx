import { Plus } from "lucide-react";

export interface QuickTemplate {
  title: string;
  minutes: number;
  emoji: string;
}

export const QUICK_CHORE_TEMPLATES: QuickTemplate[] = [
  { title: "סדר את החדר", minutes: 15, emoji: "🛏️" },
  { title: "שיעורי בית", minutes: 20, emoji: "📚" },
  { title: "כלים למדיח", minutes: 10, emoji: "🍽️" },
  { title: "התארגנות בוקר", minutes: 5, emoji: "🌅" },
  { title: "לזרוק את הזבל", minutes: 10, emoji: "🗑️" },
];

interface Props {
  onPick: (title: string, minutes: number) => void | Promise<void>;
  disabled?: boolean;
  compact?: boolean;
}

export function QuickChoreTemplates({ onPick, disabled, compact }: Props) {
  return (
    <div dir="rtl" className="space-y-2">
      {!compact && (
        <p className="text-xs text-muted-foreground font-medium">
          ⚡ משימות מהירות — לחיצה אחת ליצירה
        </p>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {QUICK_CHORE_TEMPLATES.map((t) => (
          <button
            key={t.title}
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
