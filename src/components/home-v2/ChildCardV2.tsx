import { useNavigate } from "react-router-dom";
import { Battery, MapPin, Clock, Smartphone, Bell, Plus, Volume2, Lock, Loader2, CheckCircle2, AlertTriangle, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getIsraelDate } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { useRingCommand } from "@/hooks/useRingCommand";
import { WHATSAPP_MONITORING_ENABLED } from "@/config/featureFlags";
import { HelpTooltip } from "@/components/help/HelpTooltip";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import type { ChildWithData } from "@/pages/HomeV2";

interface Props {
  child: ChildWithData;
  onRefresh: () => void;
}

const formatMinutes = (m: number): string => {
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h > 0) return `${h}:${mins.toString().padStart(2, "0")} שעות`;
  return `${mins} דק׳`;
};

const formatLastSeen = (ts: string | null): string => {
  if (!ts) return "לא זמין";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (diff < 1) return "מחובר עכשיו";
  if (diff < 60) return `לפני ${diff} דק׳`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `לפני ${h} שעות`;
  return `לפני ${Math.floor(h / 24)} ימים`;
};

const isConnected = (lastSeen: string | null) => {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 24 * 60 * 60 * 1000;
};


export const ChildCardV2 = ({ child, onRefresh }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [addingTime, setAddingTime] = useState(false);

  const { phase: ringPhase, sendRing, retry: retryRing } = useRingCommand(child.device?.device_id ?? null);

  const connected = isConnected(child.device?.last_seen ?? null);
  const usedMinutes = child.snapshot?.total_usage_minutes ?? 0;
  const effectiveLimit =
    child.dailyLimit !== null && child.dailyLimit > 0
      ? child.dailyLimit + (child.todayBonusMinutes ?? 0)
      : null;
  const hasLimit = effectiveLimit !== null;
  const remaining = hasLimit ? Math.max(0, effectiveLimit! - usedMinutes) : null;
  const screenTimeExceeded =
    hasLimit && remaining === 0 && !child.activeRestriction;

  const handleRing = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const ok = await sendRing();
    if (ok) toast.success("פקודת צלצול נשלחה");
    else toast.error("שגיאה בשליחת צלצול");
  };

  const handleAddTime = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user?.id) return;
    setAddingTime(true);
    try {
      await supabase.from("bonus_time_grants").insert({
        child_id: child.id,
        grant_date: getIsraelDate(),
        bonus_minutes: 15,
        granted_by: user.id,
      });
      if (child.device) {
        await supabase.from("device_commands").insert({
          device_id: child.device.device_id,
          command_type: "REFRESH_SETTINGS",
          status: "PENDING",
        });
      }
      toast.success("נוספו 15 דקות בונוס");
      onRefresh();
    } catch {
      toast.error("שגיאה בהוספת זמן");
    } finally {
      setAddingTime(false);
    }
  };

  // Ring icon/label helpers
  const getRingIcon = () => {
    if (ringPhase === "sending") return <Loader2 className="h-4 w-4 animate-spin" />;
    if (ringPhase === "ringing") return <Volume2 className="h-4 w-4 animate-pulse" />;
    if (ringPhase === "child_stopped" || ringPhase === "timeout" || ringPhase === "completed_legacy") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (ringPhase === "failed") return <AlertTriangle className="h-4 w-4 text-red-500" />;
    return <Volume2 className="h-4 w-4" />;
  };

  const getRingTitle = () => {
    if (ringPhase === "sending") return "שולח...";
    if (ringPhase === "ringing") return "מצלצל...";
    if (ringPhase === "child_stopped") return "הילד עצר ✓";
    if (ringPhase === "timeout" || ringPhase === "completed_legacy") return "הסתיים ✓";
    if (ringPhase === "failed") return "נכשל";
    return "צלצל למכשיר";
  };

  const isRingBusy = ringPhase === "sending" || ringPhase === "ringing";
  const isRingDone = ringPhase === "child_stopped" || ringPhase === "timeout" || ringPhase === "completed_legacy";

  // Status line
  const statusParts: string[] = [];
  if (child.pendingTimeRequests > 0) statusParts.push(`⏱️ ${child.pendingTimeRequests} בקשות`);
  if (child.permissionIssues.length > 0) statusParts.push("🛡️ בעיית הרשאות");

  const borderClass = !connected
    ? "border-red-300 ring-1 ring-red-200"
    : screenTimeExceeded
      ? "border-red-300 ring-1 ring-red-200"
      : child.activeRestriction
        ? "border-amber-300"
        : "border-border";

  return (
    <AccordionItem
      value={child.id}
      className={`rounded-2xl bg-card border shadow-sm overflow-hidden ${borderClass}`}
    >
      {/* Disconnected banner (highest priority) */}
      {!connected && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-red-200">
          <WifiOff className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-xs font-semibold text-destructive">
            המכשיר לא מחובר — ייתכן שהשליטה אינה פעילה
          </span>
        </div>
      )}
      {/* Screen-time exceeded banner */}
      {connected && screenTimeExceeded && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-red-200">
          <Lock className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-xs font-semibold text-destructive">
            המכשיר נעול — הילד חרג ממגבלת זמן המסך היומית
          </span>
        </div>
      )}
      {/* Restriction banner */}
      {child.activeRestriction && (
        <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-amber-200">
          <Lock className="h-4 w-4 text-warning shrink-0" />
          <span className="text-xs font-semibold text-warning">
            המכשיר מוגבל כרגע — {child.activeRestriction.name}
          </span>
        </div>
      )}

      {/* Header (Accordion Trigger) */}
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:border-b [&[data-state=open]]:border-border/50">
        <div className="flex items-center justify-between w-full gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-sm">
                {child.name.charAt(0)}
              </span>
            </div>
            <div className="text-right min-w-0">
              <h3 className="font-semibold text-foreground text-sm truncate">{child.name}</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={`w-2 h-2 rounded-full ${connected ? "bg-success" : "bg-destructive"}`}
                />
                {formatLastSeen(child.device?.last_seen ?? null)}
              </div>
            </div>
          </div>
          {child.device && child.device.battery_level !== null && (() => {
            const lvl = child.device.battery_level;
            const color =
              lvl >= 70 ? "text-success" :
              lvl >= 40 ? "text-yellow-500" :
              lvl >= 20 ? "text-orange-500" :
              "text-destructive";
            return (
              <div className={`flex items-center gap-1 text-xs font-medium ${color} shrink-0`}>
                <Battery className="h-3.5 w-3.5" />
                <span>{lvl}%</span>
              </div>
            );
          })()}
        </div>
      </AccordionTrigger>

      <AccordionContent className="pb-0 pt-0">
        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-2 px-4 py-3">
          <MetricCell
            icon={<Clock className="h-3.5 w-3.5 text-blue-500" />}
            label="זמן מסך"
            value={formatMinutes(usedMinutes)}
            helpText="כמה זמן הילד השתמש במכשיר היום (לפי שעון ישראל, מתאפס בחצות)."
          />
          {child.activeRestriction ? (
            <MetricCell
              icon={<Lock className="h-3.5 w-3.5 text-amber-500" />}
              label="הגבלה פעילה"
              value={child.activeRestriction.name}
              helpText="כרגע פעיל לוח זמנים שמגביל את השימוש במכשיר."
            />
          ) : remaining !== null ? (
            <MetricCell
              icon={<Clock className={`h-3.5 w-3.5 ${screenTimeExceeded ? "text-red-500" : "text-emerald-500"}`} />}
              label="נותר"
              value={formatMinutes(remaining)}
              warn={!screenTimeExceeded && remaining <= 15}
              danger={screenTimeExceeded}
              helpText="כמה זמן מסך נותר לילד היום עד סיום המגבלה היומית."
            />
          ) : (
            <MetricCell
              icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
              label="מגבלה"
              value="לא הוגדר"
              helpText="לא הוגדרה מגבלת זמן יומית. ניתן להגדיר במסך ניהול הילד."
            />
          )}
          <MetricCell
            icon={<Smartphone className="h-3.5 w-3.5 text-purple-500" />}
            label="בנק בונוס"
            value={`${child.rewardBankBalance} דק׳`}
            helpText="דקות בונוס שהילד צבר ממשימות וזמינות לפדיון."
          />
        </div>

        {/* Location */}
        {child.device?.address && (
          <div className="flex items-start gap-1.5 px-4 pb-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span className="break-words">{child.device.address}</span>
          </div>
        )}

        {/* Status line */}
        {statusParts.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-xs text-warning font-medium">
              {statusParts.join("  ·  ")}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-border/50 px-4 py-3">
          {child.device ? (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleAddTime}
                disabled={addingTime}
                className="flex-1 max-w-[180px] flex items-center justify-center gap-2 h-10 rounded-lg bg-muted/60 hover:bg-muted text-foreground text-xs font-medium disabled:opacity-50 transition-colors"
              >
                {addingTime ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span>הוסף 15 דק׳</span>
              </button>
              <button
                onClick={ringPhase === "failed" ? (e) => { e.stopPropagation(); retryRing(); } : handleRing}
                disabled={isRingBusy || isRingDone}
                className="flex-1 max-w-[180px] flex items-center justify-center gap-2 h-10 rounded-lg bg-muted/60 hover:bg-muted text-foreground text-xs font-medium disabled:opacity-50 transition-colors"
              >
                {getRingIcon()}
                <span>{getRingTitle()}</span>
              </button>
              {WHATSAPP_MONITORING_ENABLED && child.unacknowledgedAlerts > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate("/alerts-v2"); }}
                  title="התראות"
                  className="relative p-2 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground transition-colors"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute -top-1 -left-1 bg-destructive text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {child.unacknowledgedAlerts}
                  </span>
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center">אין מכשיר מחובר</p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

const MetricCell = ({
  icon,
  label,
  value,
  warn,
  danger,
  helpText,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warn?: boolean;
  danger?: boolean;
  helpText?: string;
}) => (
  <div className="flex flex-col items-center gap-0.5 py-1">
    {icon}
    <span className={`text-xs font-bold ${danger ? "text-destructive" : warn ? "text-warning" : "text-foreground"}`}>
      {value}
    </span>
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {helpText && <HelpTooltip text={helpText} iconSize={10} />}
    </div>
  </div>
);
