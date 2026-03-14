import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Chore {
  id: string;
  child_id: string;
  parent_id: string;
  title: string;
  reward_minutes: number;
  is_recurring: boolean;
  recurrence_days: number[] | null;
  status: string;
  completed_at: string | null;
  approved_at: string | null;
  created_at: string;
  proof_photo_base64: string | null;
}

export interface RewardBank {
  child_id: string;
  balance_minutes: number;
}

export function useChores(childId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chores, setChores] = useState<Chore[]>([]);
  const [rewardBank, setRewardBank] = useState<RewardBank | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchChores = useCallback(async () => {
    if (!childId) return;
    const { data } = await supabase
      .from("chores")
      .select("*")
      .eq("child_id", childId)
      .order("created_at", { ascending: false });
    if (data) setChores(data as Chore[]);
  }, [childId]);

  const fetchRewardBank = useCallback(async () => {
    if (!childId) return;
    const { data } = await supabase
      .from("reward_bank")
      .select("child_id, balance_minutes")
      .eq("child_id", childId)
      .maybeSingle();
    setRewardBank(data as RewardBank | null);
  }, [childId]);

  useEffect(() => {
    if (!childId) return;
    setLoading(true);
    Promise.all([fetchChores(), fetchRewardBank()]).finally(() => setLoading(false));

    const choresChannel = supabase
      .channel(`chores-${childId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chores", filter: `child_id=eq.${childId}` }, () => fetchChores())
      .subscribe();

    const bankChannel = supabase
      .channel(`reward-bank-${childId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_bank", filter: `child_id=eq.${childId}` }, () => fetchRewardBank())
      .subscribe();

    // Polling fallback every 30 seconds
    const pollInterval = setInterval(() => {
      fetchChores();
      fetchRewardBank();
    }, 30_000);

    return () => {
      supabase.removeChannel(choresChannel);
      supabase.removeChannel(bankChannel);
      clearInterval(pollInterval);
    };
  }, [childId, fetchChores, fetchRewardBank]);

  const addChore = async (title: string, rewardMinutes: number, isRecurring: boolean, recurrenceDays: number[] | null) => {
    if (!childId || !user) return;
    const { error } = await supabase.from("chores").insert({
      child_id: childId,
      parent_id: user.id,
      title,
      reward_minutes: rewardMinutes,
      is_recurring: isRecurring,
      recurrence_days: recurrenceDays,
    });
    if (error) {
      toast({ title: "שגיאה", description: "לא ניתן להוסיף משימה", variant: "destructive" });
    } else {
      toast({ title: "נוסף", description: `המשימה "${title}" נוספה בהצלחה` });
    }
  };

  const approveChore = async (choreId: string) => {
    const { data, error } = await supabase.rpc("approve_chore", { p_chore_id: choreId });
    if (error || !(data as any)?.success) {
      toast({ title: "שגיאה", description: "לא ניתן לאשר את המשימה", variant: "destructive" });
    } else {
      toast({ title: "אושר! ✅", description: `${(data as any).reward_minutes} דקות נוספו לבנק` });
    }
  };

  const rejectChore = async (choreId: string) => {
    const { error } = await supabase.rpc("reject_chore", { p_chore_id: choreId });
    if (error) {
      toast({ title: "שגיאה", description: "לא ניתן לדחות את המשימה", variant: "destructive" });
    } else {
      toast({ title: "נדחה", description: "המשימה הוחזרה" });
    }
  };

  const deleteChore = async (choreId: string) => {
    const { error } = await supabase.from("chores").delete().eq("id", choreId);
    if (error) {
      toast({ title: "שגיאה", description: "לא ניתן למחוק את המשימה", variant: "destructive" });
    }
  };

  return { chores, rewardBank, loading, addChore, approveChore, rejectChore, deleteChore };
}
