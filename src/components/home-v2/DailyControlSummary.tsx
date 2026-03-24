import { Clock, Gift, ListChecks, Timer } from "lucide-react";
import type { ChildWithData } from "@/pages/HomeV2";

interface Props {
  childrenData: ChildWithData[];
}

const formatMinutes = (m: number): string => {
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h > 0) return `${h}:${mins.toString().padStart(2, "0")}`;
  return `${mins} דק׳`;
};

export const DailyControlSummary = ({ childrenData }: Props) => {
  const totalUsage = childrenData.reduce(
    (s, c) => s + (c.snapshot?.total_usage_minutes ?? 0),
    0
  );
  const totalTimeReqs = childrenData.reduce((s, c) => s + c.pendingTimeRequests, 0);
  const totalBonus = childrenData.reduce((s, c) => s + c.todayBonusMinutes, 0);
  const totalChoresDone = childrenData.reduce((s, c) => s + c.todayChoresCompleted, 0);

  const metrics = [
    { icon: <Clock className="h-4 w-4 text-blue-500" />, value: formatMinutes(totalUsage), label: "זמן מסך" },
    { icon: <Timer className="h-4 w-4 text-amber-500" />, value: String(totalTimeReqs), label: "בקשות ממתינות" },
    { icon: <Gift className="h-4 w-4 text-purple-500" />, value: `${totalBonus} דק׳`, label: "בונוס היום" },
    { icon: <ListChecks className="h-4 w-4 text-emerald-500" />, value: String(totalChoresDone), label: "משימות הושלמו" },
  ];

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-700">סיכום יומי</h2>
      <div className="grid grid-cols-4 gap-2">
        {metrics.map((m, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-1 py-3 rounded-xl bg-white border border-gray-200"
          >
            {m.icon}
            <span className="text-sm font-bold text-gray-900">{m.value}</span>
            <span className="text-[9px] text-gray-500 text-center leading-tight">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
