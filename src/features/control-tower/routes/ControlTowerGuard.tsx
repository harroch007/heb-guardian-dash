import type { ReactNode } from "react";
import { canEnterInbox } from "../domain/permissions";
import { useControlTower } from "../context/ControlTowerContext";
import { ControlTowerAccessStatePage } from "../pages/ControlTowerAccessStatePage";

export function ControlTowerGuard({ children }: { children: ReactNode }) {
  const { loading, access, retryAccess } = useControlTower();

  if (loading || !access) {
    return <ControlTowerAccessStatePage state="LOADING" />;
  }

  if (access.kind !== "GRANTED") {
    return <ControlTowerAccessStatePage state={access.kind} onRetry={retryAccess} />;
  }

  if (access.session.assurance !== "AAL2") {
    return <ControlTowerAccessStatePage state="MFA_REQUIRED" onRetry={retryAccess} />;
  }

  if (!canEnterInbox(access.session)) {
    return <ControlTowerAccessStatePage state="FORBIDDEN" />;
  }

  return <>{children}</>;
}
