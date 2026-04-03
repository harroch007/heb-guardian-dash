import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FamilyMembership {
  id: string;
  owner_id: string;
  receive_alerts: boolean;
  status: string;
}

interface UseFamilyRoleResult {
  role: "owner" | "co_parent";
  isOwner: boolean;
  membership: FamilyMembership | null;
  loading: boolean;
}

export function useFamilyRole(): UseFamilyRoleResult {
  const { user } = useAuth();
  const [membership, setMembership] = useState<FamilyMembership | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from("family_members")
        .select("id, owner_id, receive_alerts, status")
        .eq("member_id", user.id)
        .eq("status", "accepted")
        .maybeSingle();

      setMembership(data ?? null);
      setLoading(false);
    };

    fetch();
  }, [user?.id]);

  const isCoParent = membership !== null;

  return {
    role: isCoParent ? "co_parent" : "owner",
    isOwner: !isCoParent,
    membership,
    loading,
  };
}
