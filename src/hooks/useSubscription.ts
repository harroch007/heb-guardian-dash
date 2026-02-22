import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type SubscriptionTier = 'free' | 'premium';

interface UseSubscriptionResult {
  tier: SubscriptionTier;
  isPremium: boolean;
  isLoading: boolean;
}

export function useSubscription(childId: string | undefined): UseSubscriptionResult {
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!childId) {
      setTier('free');
      setIsLoading(false);
      return;
    }

    const fetchTier = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("children")
          .select("subscription_tier")
          .eq("id", childId)
          .maybeSingle();

        if (error) throw error;
        setTier((data?.subscription_tier as SubscriptionTier) || 'free');
      } catch (err) {
        console.error("Error fetching subscription tier:", err);
        setTier('free');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTier();
  }, [childId]);

  return { tier, isPremium: tier === 'premium', isLoading };
}
