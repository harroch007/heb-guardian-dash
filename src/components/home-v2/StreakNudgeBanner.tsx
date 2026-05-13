import { useState } from "react";
import { Flame, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuickChoreTemplates } from "@/components/chores/QuickChoreTemplates";

export interface StreakNudgeChild {
  id: string;
  name: string;
  streak: number;
  needsNudge: boolean;
}

interface Props {
  children: StreakNudgeChild[];
  onAdded?: () => void;
}

export function StreakNudgeBanner({ children, onAdded }: Props) {
  const { user } = useAuth();
  const targets = children.filter((c) => c.needsNudge && c.streak >= 2);
  const [open, setOpen] = useState(false);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (targets.length === 0) return null;

  const handleOpen = (childId: string) => {
    setActiveChildId(childId);
    setOpen(true);
  };

  const handlePick = async (title: string, minutes: number) => {
    if (!activeChildId || !user?.id || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from("chores").insert({
      child_id: activeChildId,
      parent_id: user.id,
      title,
      reward_minutes: minutes,
      is_recurring: false,
      recurrence_days: null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("שגיאה בהוספת משימה");
      return;
    }
    toast.success(`המשימה "${title}" נוספה`);
    setOpen(false);
    setActiveChildId(null);
    onAdded?.();
  };

  const message =
    targets.length === 1
      ? `ל${targets[0].name} יש רצף של ${targets[0].streak} ימים 🔥 אל תיתן לזה להישבר — הוסף משימה להיום`
      : `ל${targets.map((t) => t.name).join(" ול")} יש רצף פעיל 🔥 אל תיתנו לרצף להישבר — הוסיפו משימה להיום`;

  return (
    <>
      <div
        className="rounded-2xl p-4 border border-orange-300/50 bg-gradient-to-l from-orange-500/15 via-amber-500/10 to-transparent shadow-sm"
        dir="rtl"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
            <Flame className="w-5 h-5 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug">
              {message}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {targets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleOpen(t.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {targets.length === 1 ? "הוסף משימה מהירה" : `הוסף ל${t.name}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              הוסף משימה{" "}
              {activeChildId && (
                <>
                  ל
                  {targets.find((t) => t.id === activeChildId)?.name}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {submitting ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <QuickChoreTemplates onPick={handlePick} disabled={submitting} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
