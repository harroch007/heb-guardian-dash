import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useChores } from "@/hooks/useChores";
import { getIsraelDate } from "@/lib/utils";
import { ChoreForm } from "@/components/chores/ChoreForm";
import { ChoreList } from "@/components/chores/ChoreList";
import { RewardBankCard } from "@/components/chores/RewardBankCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  ClipboardList,
  CheckCircle2,
  Clock,
  Coins,
  Gift,
  Plus,
  Settings,
  Loader2,
} from "lucide-react";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";

interface Child {
  id: string;
  name: string;
}

export default function ChoresV2() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [todayBonus, setTodayBonus] = useState<number>(0);
  const formRef = useRef<HTMLDivElement>(null);

  // Fetch children
  useEffect(() => {
    if (!user) return;
    supabase
      .from("children")
      .select("id, name")
      .then(({ data }) => {
        const kids = (data || []) as Child[];
        setChildren(kids);
        if (kids.length > 0) setSelectedChildId(kids[0].id);
        setLoadingChildren(false);
      });
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
  const completedCount = chores.filter((c) => c.status === "approved").length;
  const bankBalance = rewardBank?.balance_minutes ?? 0;

  if (loadingChildren) {
    return (
      <div className="homev2-light min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="homev2-light min-h-screen bg-background" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">משימות ותגמולים</h1>
            <p className="text-sm text-muted-foreground">מערכת חיובית לניהול זמן מסך</p>
          </div>
          <div className="p-2 rounded-xl bg-primary/10">
            <ClipboardList className="w-6 h-6 text-primary" />
          </div>
        </div>

        {/* Child filter */}
        {children.length > 1 && (
          <Select value={selectedChildId || ""} onValueChange={setSelectedChildId}>
            <SelectTrigger className="bg-card border-border">
              <SelectValue placeholder="בחר ילד/ה" />
            </SelectTrigger>
            <SelectContent>
              {children.map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  {child.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeCount}</p>
                <p className="text-xs text-muted-foreground">משימות פעילות</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{completedCount}</p>
                <p className="text-xs text-muted-foreground">הושלמו ואושרו</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Coins className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{bankBalance}</p>
                <p className="text-xs text-muted-foreground">דק׳ בבנק</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100">
                <Gift className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{todayBonus}</p>
                <p className="text-xs text-muted-foreground">בונוס היום (דק׳)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reward bank */}
        <RewardBankCard balanceMinutes={bankBalance} transactions={transactions} />

        {/* Quick actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })}
          >
            <Plus className="w-4 h-4 ml-1" />
            צור משימה
          </Button>
          {selectedChildId && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => navigate(`/child-v2/${selectedChildId}`)}
            >
              <Settings className="w-4 h-4 ml-1" />
              ניהול הילד
            </Button>
          )}
        </div>

        {/* Add task form */}
        <div ref={formRef}>
          <h2 className="text-base font-semibold text-foreground mb-2">משימה חדשה</h2>
          <ChoreForm onSubmit={addChore} />
        </div>

        {/* Tasks list */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-2">משימות</h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <ChoreList
              chores={chores}
              onApprove={approveChore}
              onReject={rejectChore}
              onDelete={deleteChore}
              childName={childName}
            />
          )}
        </div>
      </div>
      <BottomNavigationV2 />
    </div>
  );
}
