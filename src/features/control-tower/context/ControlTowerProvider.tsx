import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createControlTowerService, type ControlTowerService } from "../application/ControlTowerService";
import { createControlTowerRepository } from "../data/createControlTowerRepository";
import type { StaffAccess } from "../domain/types";
import { ControlTowerContext, type ControlTowerContextValue } from "./ControlTowerContext";

export function ControlTowerProvider({ children }: { children: ReactNode }) {
  const [service, setService] = useState<ControlTowerService | null>(null);
  const [access, setAccess] = useState<StaffAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setAccess(null);

    void createControlTowerRepository()
      .then((repository) => {
        const nextService = createControlTowerService(repository);
        if (!active) return null;
        setService(nextService);
        return nextService.access(controller.signal);
      })
      .then((nextAccess) => {
        if (active && nextAccess) setAccess(nextAccess);
      })
      .catch(() => {
        if (active) {
          setAccess({ kind: "UNAVAILABLE", reasonCode: "SOURCE_UNAVAILABLE" });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [retryToken]);

  const value = useMemo<ControlTowerContextValue>(
    () => ({
      service,
      access,
      loading,
      retryAccess: () => setRetryToken((token) => token + 1),
    }),
    [service, access, loading],
  );

  return <ControlTowerContext.Provider value={value}>{children}</ControlTowerContext.Provider>;
}
