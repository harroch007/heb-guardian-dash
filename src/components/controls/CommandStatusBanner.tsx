import { RefreshCw, CheckCircle2, AlertTriangle, WifiOff, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DeviceCommand } from "@/hooks/useChildControls";

interface CommandStatusBannerProps {
  commands: DeviceCommand[];
}

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: typeof RefreshCw;
  className: string;
}> = {
  PENDING: {
    label: "ממתין לאישור מהמכשיר",
    icon: Loader2,
    className: "border-warning/30 bg-warning/10 text-warning",
  },
  ACKNOWLEDGED: {
    label: "המכשיר קיבל, מחיל...",
    icon: RefreshCw,
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  FAILED: {
    label: "המכשיר לא הצליח להחיל",
    icon: AlertTriangle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  TIMED_OUT: {
    label: "המכשיר לא מחובר — ייושם בחיבור הבא",
    icon: WifiOff,
    className: "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
  },
};

const FAILED_FALLBACK_TEXT = "בדוק הרשאות במכשיר";

export function CommandStatusBanner({ commands }: CommandStatusBannerProps) {
  if (commands.length === 0) return null;

  // Group by status, show most critical first
  const statusOrder = ["FAILED", "TIMED_OUT", "PENDING", "ACKNOWLEDGED"];
  const grouped = statusOrder
    .map((status) => ({
      status,
      items: commands.filter((c) => c.status === status),
    }))
    .filter((g) => g.items.length > 0);

  if (grouped.length === 0) return null;

  return (
    <div className="space-y-2">
      {grouped.map(({ status, items }) => {
        const config = STATUS_CONFIG[status];
        if (!config) return null;
        const Icon = config.icon;
        const isAnimated = status === "PENDING" || status === "ACKNOWLEDGED";

        return (
          <div
            key={status}
            className={cn(
              "flex items-start gap-2.5 p-3 rounded-lg border text-sm",
              config.className
            )}
          >
            <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", isAnimated && "animate-spin")} />
            <div className="min-w-0 flex-1">
              <span className="font-medium">{config.label}</span>
              {status === "FAILED" && items.map((cmd) => (
                <p key={cmd.id} className="text-xs mt-0.5 opacity-80">
                  {cmd.result || FAILED_FALLBACK_TEXT}
                </p>
              ))}
              {items.length > 1 && (
                <Badge variant="outline" className="text-xs mt-1">
                  {items.length} מכשירים
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
