import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useChores } from "@/hooks/useChores";
import { getIsraelDate } from "@/lib/utils";
import { getFamilyParentIds } from "@/lib/familyScope";
import { ChoreForm } from "@/components/chores/ChoreForm";
import { QuickChoreTemplates } from "@/components/chores/QuickChoreTemplates";
import { ChoreList } from "@/components/chores/ChoreList";
import { RewardBankCard } from "@/components/chores/RewardBankCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgeYears, getAgeBand, getChildIcon, getChildAvatarClasses } from "@/lib/childAvatar";
import {
  AlertCircle,
  ClipboardList,
  CheckCircle2,
  Clock,
  Coins,
  Gift,
  Plus,
  Loader2,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { TopNavigationV2 } from "@/components/TopNavigationV2";

interface Child {
  id: string;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
}

export default function ChoresV2() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [todayBonus, setTodayBonus] = useState<number>(0);
  const formRef = useRef<HTMLDivElement>(null);

  // Fetch children — explicitly scoped to this family
  useEffect(() => {
    if (!user) return;
    (async () => {
      const allowedParentIds = await getFamilyParentIds(user.id);
      const { data } = await supabase
        .from("children")
        .select("id, name, date_of_birth, gender")
        .in("parent_id", allowedParentIds);
      const kids = (data || []) as Child[];
      setChildren(kids);
      if (kids.length > 0) setSelectedChildId(kids[0].id);
      setLoadingChildren(false);
    })();
  }, [user]);

  // Fetch today's bonus grants
  useEffect(() => {
    if (!selectedChildId) return;
    const today = getIsraelDate();
    supabase
      .from("bonus_time_grants")
      .select("bonus_minutes")
      .eq("child_id", selectedChildId)
      .eq("grant_date", today)
      .then(({ data }) => {
        const total = (data || []).reduce((sum: number, g: any) => sum + (g.bonus_minutes || 0), 0);
        setTodayBonus(total);
      });
  }, [selectedChildId]);

  const { chores, rewardBank, transactions, loading, addChore, approveChore, rejectChore, deleteChore } =
    useChores(selectedChildId);

  const selectedChild = children.find((c) => c.id === selectedChildId);
  const childName = selectedChild?.name || "";

  const activeCount = chores.filter((c) => c.status === "pending" || c.status === "completed_by_child").length;
  // Summary "completed" counter — last 7 days only, so the number stays meaningful
  // instead of inflating to thousands of historical rows over time.
  const weekCutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const completedCount = chores.filter((c) => {
    if (c.status !== "approved") return false;
    const ts = c.approved_at || c.completed_at;
    if (!ts) return false;
    return new Date(ts).getTime() >= weekCutoffMs;
  }).length;
  const bankBalance = rewardBank?.balance_minutes ?? 0;

  if (loadingChildren) {
    return (
      <div className="v2-dark min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="v2-dark min-h-screen bg-background" dir="rtl">
      <TopNavigationV2 />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground v2-glow-text">משימות ותגמולים</h1>
            <p className="text-sm text-muted-foreground">
              {childName ? (
                <>
                  מציג עבור <span className="text-primary font-medium">{childName}</span> · מערכת חיובית לניהול זמן מסך
                </>
              ) : (
                "מערכת חיובית לניהול זמן מסך"
              )}
            </p>
          </div>
          <div className="v2-icon-chip p-2.5">
            <ClipboardList className="w-6 h-6" />
          </div>
        </div>

        {/* Child tabs */}
        {children.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {children.map((child) => {
              const age = getAgeYears(child.date_of_birth);
              const band = getAgeBand(age);
              const Icon = getChildIcon(child.gender, band);
              const av = getChildAvatarClasses(child.gender, band);
              const isActive = child.id === selectedChildId;
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => setSelectedChildId(child.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all whitespace-nowrap flex-shrink-0 ${
                    isActive
                      ? "bg-primary/15 border-primary/40 text-primary shadow-md shadow-primary/20"
                      : "bg-card border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full ${av.bg}`}>
                    <Icon className={`w-4 h-4 ${av.text}`} />
                  </span>
                  <span className="text-sm font-medium">{child.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="v2-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/15 border border-warning/30">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              <p className="text-xs text-muted-foreground">משימות פעילות</p>
            </div>
          </div>

          <div className="v2-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/15 border border-success/30">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{completedCount}</p>
              <p className="text-xs text-muted-foreground">הושלמו ואושרו</p>
            </div>
          </div>

          <div className="v2-card p-4 flex items-center gap-3">
            <div className="v2-icon-chip p-2">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground v2-glow-text">{bankBalance}</p>
              <p className="text-xs text-muted-foreground">דק׳ בבנק</p>
            </div>
          </div>

          <div className="v2-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/15 border border-accent/30">
              <Gift className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{todayBonus}</p>
              <p className="text-xs text-muted-foreground">בונוס היום (דק׳)</p>
            </div>
          </div>
        </div>

        {/* Quick templates — one click to create a chore */}
        {selectedChildId && (
          <div className="v2-card p-3">
            <QuickChoreTemplates
              gender={selectedChild?.gender}
              onPick={(title, minutes) => addChore(title, minutes, false, null)}
            />
          </div>
        )}

        {/* Accordion sections */}
        {(() => {
          const pendingApprovalChores = chores.filter((c) => c.status === "completed_by_child");
          const hasPending = pendingApprovalChores.length > 0;
          const defaultOpen: string[] = hasPending ? ["pending"] : [];

          return (
            <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-3">
              {/* 1. Pending approval — only when relevant */}
              {hasPending && (
                <AccordionItem
                  value="pending"
                  className="v2-card border-orange-500/30 px-4"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 text-orange-400">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-semibold">
                        {pendingApprovalChores.length} משימות ממתינות לאישור
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-1">
                    <ChoreList
                      chores={pendingApprovalChores}
                      onApprove={approveChore}
                      onReject={rejectChore}
                      onDelete={deleteChore}
                      childName={childName}
                    />
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* 2. All tasks — split into open / completed sub-accordions */}
              <AccordionItem value="all-tasks" className="v2-card border-border/50 px-4">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2 text-foreground">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    <span className="font-semibold">כל המשימות</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1">
                  {loading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : (() => {
                    const openChores = chores.filter(
                      (c) => c.status === "pending" || c.status === "completed_by_child"
                    );
                    // UX Clean Slate: show only approvals/rejections from the last 48h.
                    // Older history stays in the DB for streak math but is hidden from the parent.
                    const recentCutoffMs = Date.now() - 48 * 60 * 60 * 1000;
                    const doneChores = chores.filter((c) => {
                      if (c.status !== "approved" && c.status !== "rejected") return false;
                      const ts = c.approved_at || c.completed_at;
                      if (!ts) return false;
                      return new Date(ts).getTime() >= recentCutoffMs;
                    });
                    return (
                      <Accordion type="multiple" defaultValue={["open"]} className="space-y-2">
                        <AccordionItem
                          value="open"
                          className="rounded-lg border border-border/50 bg-background/40 px-3"
                        >
                          <AccordionTrigger className="hover:no-underline py-2.5">
                            <div className="flex items-center gap-2 text-sm text-foreground">
                              <Clock className="w-4 h-4 text-warning" />
                              <span className="font-medium">משימות פתוחות ({openChores.length})</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-1">
                            <ChoreList
                              chores={openChores}
                              onApprove={approveChore}
                              onReject={rejectChore}
                              onDelete={deleteChore}
                              childName={childName}
                            />
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem
                          value="done"
                          className="rounded-lg border border-border/50 bg-background/40 px-3"
                        >
                          <AccordionTrigger className="hover:no-underline py-2.5">
                            <div className="flex items-center gap-2 text-sm text-foreground">
                              <CheckCircle2 className="w-4 h-4 text-success" />
                              <span className="font-medium">הושלמו ({doneChores.length})</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-1">
                            <ChoreList
                              chores={doneChores}
                              onApprove={approveChore}
                              onReject={rejectChore}
                              onDelete={deleteChore}
                              childName={childName}
                            />
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    );
                  })()}
                </AccordionContent>
              </AccordionItem>

              {/* 3. Add new task */}
              <AccordionItem value="add-task" className="v2-card border-border/50 px-4">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2 text-foreground">
                    <Plus className="w-5 h-5 text-primary" />
                    <span className="font-semibold">הוסף משימה חדשה</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 space-y-3" ref={formRef as any}>
                  <ChoreForm onSubmit={addChore} />
                </AccordionContent>
              </AccordionItem>

              {/* 4. Reward bank & history */}
              <AccordionItem value="bank" className="v2-card border-border/50 px-4">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2 text-foreground">
                    <Coins className="w-5 h-5 text-primary" />
                    <span className="font-semibold">
                      בנק תגמולים · <span className="v2-glow-text">{bankBalance}</span> דק׳
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1">
                  <RewardBankCard balanceMinutes={bankBalance} transactions={transactions} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          );
        })()}
      </div>
      <BottomNavigationV2 />
    </div>
  );
}
