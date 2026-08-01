import { ControlTowerProvider } from "../context/ControlTowerProvider";
import { ControlTowerGuard } from "./ControlTowerGuard";
import { ControlTowerRoutes } from "./ControlTowerRoutes";
import "../control-tower.css";

export function ControlTowerEntry() {
  return (
    <div className="ct-root" dir="rtl">
      <ControlTowerProvider>
        <ControlTowerGuard>
          <ControlTowerRoutes />
        </ControlTowerGuard>
      </ControlTowerProvider>
    </div>
  );
}

