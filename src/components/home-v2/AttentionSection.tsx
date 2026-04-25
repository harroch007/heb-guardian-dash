import { useNavigate } from "react-router-dom";
import { AlertTriangle, WifiOff, ShieldAlert, Clock } from "lucide-react";
import type { ChildWithData } from "@/pages/HomeV2";
import { WHATSAPP_MONITORING_ENABLED } from "@/config/featureFlags";

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
    if (WHATSAPP_MONITORING_ENABLED && child.unacknowledgedAlerts > 0) {
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
    }

    const isDisconnected = !child.device?.last_seen ||
      Date.now() - new Date(child.device.last_seen).getTime() > 24 * 60 * 60 * 1000;
    if (isDisconnected && child.device !== null) {
      items.push({
        id: `disc-${child.id}`,
        icon: <WifiOff className="h-4 w-4 text-muted-foreground" />,
        text: `${child.name}: מכשיר מנותק`,
        path: `/child-v2/${child.id}`,
        color: "bg-card border-border",
      });
    }

    if (child.pendingTimeRequests > 0) {
      items.push({
        id: `time-${child.id}`,
        icon: <Clock className="h-4 w-4 text-blue-500" />,
        text: `${child.name}: ${child.pendingTimeRequests} בקשות זמן`,
        path: `/child-v2/${child.id}`,
        color: "bg-primary/10 border-blue-200",
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
