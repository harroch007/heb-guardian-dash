import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ChoreForm } from "@/components/chores/ChoreForm";
import { ChoreList } from "@/components/chores/ChoreList";
import { RewardBankCard } from "@/components/chores/RewardBankCard";
import { useChores } from "@/hooks/useChores";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList } from "lucide-react";

interface Child {
  id: string;
  name: string;
}

export default function Chores() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("children")
      .select("id, name")
      .eq("parent_id", user.id)
      .then(({ data }) => {
        const kids = (data || []) as Child[];
        setChildren(kids);
        if (kids.length > 0) setSelectedChildId(kids[0].id);
        setLoadingChildren(false);
      });
  }, [user]);

  const { chores, rewardBank, loading, addChore, approveChore, rejectChore, deleteChore, simulateComplete } = useChores(selectedChildId);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-4 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ClipboardList className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">משימות ותגמולים</h1>
            <p className="text-sm text-muted-foreground">הגדר משימות והרוויח דקות שימוש</p>
          </div>
        </div>

        {/* Child selector */}
        {loadingChildren ? (
          <Skeleton className="h-10 w-full" />
        ) : children.length > 1 ? (
          <Select value={selectedChildId || ""} onValueChange={setSelectedChildId}>
            <SelectTrigger>
              <SelectValue placeholder="בחר ילד/ה" />
            </SelectTrigger>
            <SelectContent>
              {children.map(child => (
                <SelectItem key={child.id} value={child.id}>{child.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {/* Reward Bank */}
        <RewardBankCard balanceMinutes={rewardBank?.balance_minutes ?? 0} />

        {/* Add chore form */}
        <ChoreForm onSubmit={addChore} />

        {/* Chores list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : (
          <ChoreList chores={chores} onApprove={approveChore} onReject={rejectChore} onDelete={deleteChore} />
        )}
      </div>
    </DashboardLayout>
  );
}
