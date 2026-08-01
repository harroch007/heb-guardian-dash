/* eslint-disable @typescript-eslint/no-explicit-any -- Frozen legacy donor surface; migrate types before reactivation. */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, ClipboardCheck, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import type { ChildWithData } from "@/pages/HomeV2";

interface PendingChore {
  id: string;
  child_id: string;
  title: string;
  reward_minutes: number;
  completed_at: string | null;
  proof_photo_base64: string | null;
}

interface Props {
  childrenData: ChildWithData[];
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}

export const HomePendingChoreApprovals = ({ childrenData }: Props) => {
  const [chores, setChores] = useState<PendingChore[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const childIds = childrenData.map((c) => c.id);
  const childIdsKey = childIds.join(",");
  const nameById = new Map(childrenData.map((c) => [c.id, c.name]));

  const fetchPending = async () => {
    if (childIds.length === 0) {
      setChores([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("chores")
      .select("id, child_id, title, reward_minutes, completed_at, proof_photo_base64")
      .in("child_id", childIds)
      .eq("status", "completed_by_child")
      .order("completed_at", { ascending: false });

    setChores((data || []) as PendingChore[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
    if (childIds.length === 0) return;
    const channel = supabase
      .channel("home-pending-chores")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chores" },
        () => fetchPending()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childIdsKey]);

  const decide = async (chore: PendingChore, approve: boolean) => {
    setActing(chore.id);
    const { data, error } = approve
      ? await supabase.rpc("approve_chore", { p_chore_id: chore.id })
      : await supabase.rpc("reject_chore", { p_chore_id: chore.id });

    if (error || (approve && !(data as any)?.success)) {
      toast.error(approve ? "לא ניתן לאשר את המשימה" : "לא ניתן לדחות את המשימה");
    } else {
      toast.success(
        approve
          ? `אושר! ${(data as any)?.reward_minutes ?? chore.reward_minutes} דק׳ נוספו לבנק`
          : "המשימה נדחתה"
      );
      setChores((prev) => prev.filter((c) => c.id !== chore.id));
    }
    setActing(null);
  };

  if (loading || chores.length === 0) return null;

  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
          <ClipboardCheck className="w-4 h-4" />
          <span>משימות שממתינות לאישורך</span>
        </div>
        {chores.map((chore) => {
          const childName = nameById.get(chore.child_id) || "";
          const hasPhoto = !!chore.proof_photo_base64;
          return (
            <div
              key={chore.id}
              className="flex items-center justify-between gap-2 bg-card rounded-lg px-3 py-2 border border-border/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">
                  <span className="font-medium">{childName}</span>
                  {" · "}
                  {chore.title}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{timeAgo(chore.completed_at)}</span>
                  <span className="text-primary font-medium">{chore.reward_minutes} דק׳</span>
                  {hasPhoto && (
                    <span className="flex items-center gap-0.5 text-primary/70">
                      <Camera className="w-3 h-3" />
                      תמונה
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => decide(chore, false)}
                  disabled={acting === chore.id}
                  aria-label="דחה"
                >
                  {acting === chore.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-success hover:bg-success/10"
                  onClick={() => decide(chore, true)}
                  disabled={acting === chore.id}
                  aria-label="אשר"
                >
                  {acting === chore.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
