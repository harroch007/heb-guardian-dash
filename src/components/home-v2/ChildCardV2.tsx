import { useNavigate } from "react-router-dom";
import { Battery, MapPin, Clock, Smartphone, Bell, Plus, Volume2, Lock, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getIsraelDate } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { useRingCommand } from "@/hooks/useRingCommand";
import { WHATSAPP_MONITORING_ENABLED } from "@/config/featureFlags";
import { HelpTooltip } from "@/components/help/HelpTooltip";
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
  const hasLimit = child.dailyLimit !== null && child.dailyLimit > 0;
  const remaining = hasLimit ? Math.max(0, child.dailyLimit! - usedMinutes) : null;

  const handleRing = async () => {
    const ok = await sendRing();
    if (ok) toast.success("פקודת צלצול נשלחה");
    else toast.error("שגיאה בשליחת צלצול");
  };

  const handleAddTime = async () => {
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
    if (ringPhase === "sending") return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    if (ringPhase === "ringing") return <Volume2 className="h-3.5 w-3.5 animate-pulse" />;
    if (ringPhase === "child_stopped" || ringPhase === "timeout" || ringPhase === "completed_legacy") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    if (ringPhase === "failed") return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
    return <Volume2 className="h-3.5 w-3.5" />;
  };

  const getRingTitle = () => {
    if (ringPhase === "sending") return "שולח...";
    if (ringPhase === "ringing") return "מצלצל...";
    if (ringPhase === "child_stopped") return "הילד עצר ✓";
    if (ringPhase === "timeout" || ringPhase === "completed_legacy") return "הסתיים ✓";
    if (ringPhase === "failed") return "נכשל";
    return "צלצל";
  };

  const isRingBusy = ringPhase === "sending" || ringPhase === "ringing";
  const isRingDone = ringPhase === "child_stopped" || ringPhase === "timeout" || ringPhase === "completed_legacy";

  // Status line
  const statusParts: string[] = [];
  if (child.pendingTimeRequests > 0) statusParts.push(`⏱️ ${child.pendingTimeRequests} בקשות`);
  if (child.permissionIssues.length > 0) statusParts.push("🛡️ בעיית הרשאות");

  return (
    <div className={`rounded-2xl bg-white border shadow-sm overflow-hidden ${child.activeRestriction ? "border-amber-300" : "border-gray-200"}`}>
      {/* Restriction banner */}
      {child.activeRestriction && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200">
          <Lock className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-xs font-semibold text-amber-700">
            המכשיר מוגבל כרגע — {child.activeRestriction.name}
          </span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-blue-700 font-bold text-sm">
              {child.name.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{child.name}</h3>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span
                className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-gray-300"}`}
              />
              {formatLastSeen(child.device?.last_seen ?? null)}
            </div>
          </div>
        </div>
        {child.device && child.device.battery_level !== null && (() => {
          const lvl = child.device.battery_level;
          const color =
            lvl >= 70 ? "text-emerald-600" :
            lvl >= 40 ? "text-yellow-500" :
            lvl >= 20 ? "text-orange-500" :
            "text-red-600";
          return (
            <div className={`flex items-center gap-1 text-xs font-medium ${color}`}>
              <Battery className="h-3.5 w-3.5" />
              <span>{lvl}%</span>
            </div>
          );
        })()}
      </div>

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
            icon={<Clock className="h-3.5 w-3.5 text-emerald-500" />}
            label="נותר"
            value={formatMinutes(remaining)}
            warn={remaining <= 15}
            helpText="כמה זמן מסך נותר לילד היום עד סיום המגבלה היומית."
          />
        ) : (
          <MetricCell
            icon={<Clock className="h-3.5 w-3.5 text-gray-400" />}
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
        <div className="flex items-start gap-1.5 px-4 pb-2 text-xs text-gray-500">
          <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span className="break-words">{child.device.address}</span>
        </div>
      )}

      {/* Status line */}
      {statusParts.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-amber-600 font-medium">
            {statusParts.join("  ·  ")}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(`/child-v2/${child.id}`)}
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          ניהול הילד ←
        </button>
        <div className="flex items-center gap-2">
          {child.device && (
            <>
              <ActionBtn
                icon={getRingIcon()}
                onClick={ringPhase === "failed" ? retryRing : handleRing}
                disabled={isRingBusy || isRingDone}
                title={getRingTitle()}
              />
              <ActionBtn
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={handleAddTime}
                disabled={addingTime}
                title="הוסף זמן"
              />
            </>
          )}
          {WHATSAPP_MONITORING_ENABLED && child.unacknowledgedAlerts > 0 && (
            <ActionBtn
              icon={<Bell className="h-3.5 w-3.5" />}
              onClick={() => navigate("/alerts-v2")}
              badge={child.unacknowledgedAlerts}
              title="התראות"
            />
          )}
        </div>
      </div>
    </div>
  );
};

const MetricCell = ({
  icon,
  label,
  value,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warn?: boolean;
}) => (
  <div className="flex flex-col items-center gap-0.5 py-1">
    {icon}
    <span className={`text-xs font-bold ${warn ? "text-amber-600" : "text-gray-900"}`}>
      {value}
    </span>
    <span className="text-[10px] text-gray-500">{label}</span>
  </div>
);

const ActionBtn = ({
  icon,
  onClick,
  disabled,
  badge,
  title,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  badge?: number;
  title: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="relative p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 disabled:opacity-50 transition-colors"
  >
    {icon}
    {badge && badge > 0 && (
      <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
        {badge}
      </span>
    )}
  </button>
);
