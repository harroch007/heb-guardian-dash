import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getV2GuardianMonitoring,
  type GuardianMonitoringChild,
} from "@/lib/v2/guardianMonitoringService";

export function useV2GuardianMonitoring() {
  const { familyId } = useAuth();
  const [children, setChildren] = useState<GuardianMonitoringChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!familyId) {
      setChildren([]);
      setError(false);
      setLoading(false);
      return;
    }

    if (!options?.silent) setLoading(true);
    setError(false);
    try {
      setChildren(await getV2GuardianMonitoring(familyId));
    } catch (loadError) {
      console.error("[guardian-monitoring] Failed to load", loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { children, loading, error, refresh };
}
