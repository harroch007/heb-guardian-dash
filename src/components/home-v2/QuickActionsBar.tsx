import { useNavigate } from "react-router-dom";
import { UserPlus, ListChecks, Smartphone } from "lucide-react";
import type { ChildWithData } from "@/pages/HomeV2";

interface Props {
  childrenData: ChildWithData[];
}

export const QuickActionsBar = ({ childrenData }: Props) => {
  const navigate = useNavigate();

  const actions = [
    {
      icon: <UserPlus className="h-5 w-5" />,
      label: "הוסף ילד",
      onClick: () => navigate("/family-v2"),
    },
    {
      icon: <ListChecks className="h-5 w-5" />,
      label: "משימות",
      onClick: () => navigate("/chores-v2"),
    },
    ...(childrenData.length === 1
      ? [
          {
            icon: <Smartphone className="h-5 w-5" />,
            label: "ניהול אפליקציות",
            onClick: () => navigate(`/child-v2/${childrenData[0].id}`),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground/80">פעולות מהירות</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={a.onClick}
            className="flex flex-col items-center gap-1.5 min-w-[72px] py-3 px-2 rounded-xl bg-card border border-border hover:bg-card transition-colors"
          >
            <span className="text-primary">{a.icon}</span>
            <span className="text-[10px] font-medium text-foreground/80">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
