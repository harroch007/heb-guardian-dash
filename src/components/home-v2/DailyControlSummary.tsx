import { Clock, Gift } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const child = childrenData[0]; // component renders only when there is exactly one child

  const totalUsage = childrenData.reduce(
    (s, c) => s + (c.snapshot?.total_usage_minutes ?? 0),
    0
  );
  const totalBonus = childrenData.reduce((s, c) => s + c.todayBonusMinutes, 0);

  const childPath = child ? `/child-v2/${child.id}` : null;

  const metrics = [
    {
      icon: <Clock className="h-4 w-4 text-blue-500" />,
      value: formatMinutes(totalUsage),
      label: "זמן מסך",
      onClick: childPath ? () => navigate(childPath) : null,
      active: totalUsage > 0,
    },
    {
      icon: <Gift className="h-4 w-4 text-purple-500" />,
      value: `${totalBonus} דק׳`,
      label: "בונוס היום",
      onClick: childPath ? () => navigate(childPath) : null,
      active: totalBonus > 0,
    },
  ];

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground/80">סיכום יומי</h2>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m, i) => {
          const clickable = m.active && !!m.onClick;
          const Tag = clickable ? "button" : "div";
          return (
            <Tag
              key={i}
              onClick={clickable ? m.onClick! : undefined}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl bg-card border border-border transition-colors ${
                clickable
                  ? "cursor-pointer hover:border-primary/60 hover:bg-accent/40 active:scale-95"
                  : ""
              }`}
            >
              {m.icon}
              <span className="text-sm font-bold text-foreground">{m.value}</span>
              <span className="text-[9px] text-muted-foreground text-center leading-tight">
                {m.label}
              </span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
};
