import { useNavigate } from "react-router-dom";
import { Battery, MapPin, Clock, Smartphone, Bell, Plus, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getIsraelDate } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
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

const getActiveSchedule = (
  schedules: ChildWithData["scheduleWindows"]
): string | null => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  for (const s of schedules) {
    if (!s.is_active) continue;
    if (s.schedule_type === "shabbat") continue; // shabbat handled differently
    if (!s.days_of_week || !s.start_time || !s.end_time) continue;
    if (!s.days_of_week.includes(dayOfWeek)) continue;
    if (currentTime >= s.start_time && currentTime <= s.end_time) {
      return s.name;
    }
  }
  return null;
};

export const ChildCardV2 = ({ child, onRefresh }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ringing, setRinging] = useState(false);
  const [addingTime, setAddingTime] = useState(false);

  const connected = isConnected(child.device?.last_seen ?? null);
  const activeSchedule = getActiveSchedule(child.scheduleWindows);
  const usedMinutes = child.snapshot?.total_usage_minutes ?? 0;
  const hasLimit = child.dailyLimit !== null && child.dailyLimit > 0;
  const remaining = hasLimit ? Math.max(0, child.dailyLimit! - usedMinutes) : null;

  const handleRing = async () => {
    if (!child.device) return;
    setRinging(true);
    try {
      await supabase.from("device_commands").insert({
        device_id: child.device.device_id,
        command_type: "RING_DEVICE",
        status: "PENDING",
      });
      toast.success("פקודת צלצול נשלחה");
    } catch {
      toast.error("שגיאה בשליחת צלצול");
    } finally {
      setRinging(false);
    }
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
      // Send refresh to device
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

  // Status line
  const statusParts: string[] = [];
  if (activeSchedule) statusParts.push(`🔒 ${activeSchedule}`);
  
  if (child.pendingTimeRequests > 0) statusParts.push(`⏱️ ${child.pendingTimeRequests} בקשות`);
  if (child.permissionIssues.length > 0) statusParts.push("🛡️ בעיית הרשאות");

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
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
        {child.device && child.device.battery_level !== null && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Battery className="h-3.5 w-3.5" />
            <span>{child.device.battery_level}%</span>
          </div>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        <MetricCell
          icon={<Clock className="h-3.5 w-3.5 text-blue-500" />}
          label="זמן מסך"
          value={formatMinutes(usedMinutes)}
        />
        {remaining !== null ? (
          <MetricCell
            icon={<Clock className="h-3.5 w-3.5 text-emerald-500" />}
            label="נותר"
            value={formatMinutes(remaining)}
            warn={remaining <= 15}
          />
        ) : (
          <MetricCell
            icon={<Clock className="h-3.5 w-3.5 text-gray-400" />}
            label="מגבלה"
            value="לא הוגדר"
          />
        )}
        <MetricCell
          icon={<Smartphone className="h-3.5 w-3.5 text-purple-500" />}
          label="בנק בונוס"
          value={`${child.rewardBankBalance} דק׳`}
        />
      </div>

      {/* Location */}
      {child.device?.address && (
        <div className="flex items-center gap-1.5 px-4 pb-2 text-xs text-gray-500">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{child.device.address}</span>
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
                icon={<Volume2 className="h-3.5 w-3.5" />}
                onClick={handleRing}
                disabled={ringing}
                title="צלצל"
              />
              <ActionBtn
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={handleAddTime}
                disabled={addingTime}
                title="הוסף זמן"
              />
            </>
          )}
          {child.unacknowledgedAlerts > 0 && (
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
