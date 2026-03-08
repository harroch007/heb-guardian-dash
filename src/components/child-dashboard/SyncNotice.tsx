import { Loader2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeviceCommand } from "@/hooks/useChildControls";

interface SyncNoticeProps {
  commands: DeviceCommand[];
}

export function SyncNotice({ commands }: SyncNoticeProps) {
  if (commands.length === 0) return null;

  const hasPending = commands.some(
    (c) => c.status === "PENDING" || c.status === "ACKNOWLEDGED"
  );
  const hasTimedOut = commands.some((c) => c.status === "TIMED_OUT");

  if (!hasPending && !hasTimedOut) return null;

  const text = hasPending
    ? "מעדכן נתונים..."
    : "השינויים ייושמו כשהמכשיר יתחבר";

  const Icon = hasPending ? Loader2 : WifiOff;

  return (
    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-muted-foreground/20 bg-muted/50 text-sm text-muted-foreground">
      <Icon
        className={cn(
          "w-4 h-4 shrink-0",
          hasPending && "animate-spin"
        )}
      />
      <span>{text}</span>
    </div>
  );
}
