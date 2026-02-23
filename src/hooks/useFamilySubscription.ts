import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ChildSubscriptionInfo {
  id: string;
  name: string;
  subscription_tier: string | null;
}

interface UseFamilySubscriptionResult {
  children: ChildSubscriptionInfo[];
  allPremium: boolean;
  hasFreeChildren: boolean;
  childCount: number;
  isLoading: boolean;
}

export function getFamilyPrice(childCount: number): number {
  if (childCount <= 1) return 19;
  if (childCount === 2) return 30;
  return 40; // 3+
}

export function useFamilySubscription(): UseFamilySubscriptionResult {
  const { user } = useAuth();
  const [children, setChildren] = useState<ChildSubscriptionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setChildren([]);
      setIsLoading(false);
      return;
    }

    const fetch = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("children")
          .select("id, name, subscription_tier")
          .eq("parent_id", user.id);

        if (error) throw error;
        setChildren(data || []);
      } catch (err) {
        console.error("Error fetching family subscription:", err);
        setChildren([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetch();
  }, [user?.id]);

  const allPremium = children.length > 0 && children.every(c => c.subscription_tier === "premium");
  const hasFreeChildren = children.some(c => c.subscription_tier !== "premium");

  return {
    children,
    allPremium,
    hasFreeChildren,
    childCount: children.length,
    isLoading,
  };
}
