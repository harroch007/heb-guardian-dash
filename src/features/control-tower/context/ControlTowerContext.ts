import { createContext, useContext } from "react";
import type { ControlTowerService } from "../application/ControlTowerService";
import type { StaffAccess } from "../domain/types";

export interface ControlTowerContextValue {
  service: ControlTowerService | null;
  access: StaffAccess | null;
  loading: boolean;
  retryAccess: () => void;
}

export const ControlTowerContext = createContext<ControlTowerContextValue | null>(null);

export function useControlTower(): ControlTowerContextValue {
  const context = useContext(ControlTowerContext);
  if (!context) throw new Error("useControlTower must be used within ControlTowerProvider");
  return context;
}
