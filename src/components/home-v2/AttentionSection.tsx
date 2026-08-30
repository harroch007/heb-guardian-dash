import { useNavigate } from "react-router-dom";
import { AlertTriangle, WifiOff, ShieldAlert } from "lucide-react";
import type { ChildWithData } from "@/pages/HomeV2";
import { hasCurrentDeviceReport } from "@/lib/v2/guardianMonitoringService";

interface Props {
  childrenData: ChildWithData[];
}

interface AttentionItem {
  id: string;
  icon: React.ReactNode;
  text: string;
  path: string;
  color: string;
}

export const AttentionSection = ({ childrenData }: Props) => {
  const navigate = useNavigate();
  const items: AttentionItem[] = [];

  for (const child of childrenData) {
    if (child.unacknowledgedAlerts > 0) {
      items.push({
        id: `alert-${child.id}`,
        icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        text: `${child.name}: ${child.unacknowledgedAlerts} התראות חדשות`,
        path: "/alerts-v2",
        color: "bg-warning/10 border-amber-200",
      });
    }

    if (child.permissionIssues.length > 0) {
      items.push({
        id: `perm-${child.id}`,
        icon: <ShieldAlert className="h-4 w-4 text-red-500" />,
        text: `${child.name}: בעיית הרשאות`,
        path: `/child-v2/${child.id}`,
        color: "bg-destructive/10 border-red-200",
      });
    } else if (
      child.device?.monitoring_state === "degraded" ||
      child.device?.monitoring_state === "needs_setup"
    ) {
      items.push({
        id: `protection-${child.id}`,
        icon: <ShieldAlert className="h-4 w-4 text-amber-500" />,
        text: `${child.name}: ההגנה דורשת בדיקה`,
        path: `/child-v2/${child.id}`,
        color: "bg-warning/10 border-amber-200",
      });
    } else if (child.device?.monitoring_state === "recovering") {
      items.push({
        id: `recovering-${child.id}`,
        icon: <ShieldAlert className="h-4 w-4 text-amber-500" />,
        text: `${child.name}: החיבור חזר וממתין לאימות יציבות`,
        path: `/child-v2/${child.id}`,
        color: "bg-warning/10 border-amber-200",
      });
    }

    const isDisconnected =
      child.device !== null &&
      !hasCurrentDeviceReport(child.device.monitoring_state);
    if (isDisconnected && child.device !== null) {
      items.push({
        id: `disc-${child.id}`,
        icon: <WifiOff className="h-4 w-4 text-muted-foreground" />,
        text: `${child.name}: מכשיר מנותק`,
        path: `/child-v2/${child.id}`,
        color: "bg-card border-border",
      });
    }

  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground/80">דורש תשומת לב</h2>
      <div className="space-y-2">
        {items.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-right transition-colors ${item.color} hover:opacity-90`}
          >
            {item.icon}
            <span className="text-xs font-medium text-foreground flex-1">{item.text}</span>
            <span className="text-muted-foreground text-xs">←</span>
          </button>
        ))}
      </div>
    </div>
  );
};
