import { Shield, Clock, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatScreenTime } from "@/components/ScreenTimeCard";

interface QuickActionsGridProps {
  blockedCount: number;
  totalUsageMinutes: number;
  screenTimeLimit: number | null;
}

const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export function QuickActionsGrid({
  blockedCount,
  totalUsageMinutes,
  screenTimeLimit,
}: QuickActionsGridProps) {
  const actions = [
    {
      id: "apps-section",
      icon: Shield,
      title: "אפליקציות",
      summary: blockedCount > 0 ? `${blockedCount} חסומות` : "ללא חסימות",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      id: "screentime-section",
      icon: Clock,
      title: "זמן מסך",
      summary: screenTimeLimit
        ? `${formatScreenTime(totalUsageMinutes)} / ${formatScreenTime(screenTimeLimit)}`
        : formatScreenTime(totalUsageMinutes),
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      id: "schedules-section",
      icon: Calendar,
      title: "לוחות זמנים",
      summary: "בקרוב",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {actions.map((action) => (
        <Card
          key={action.id}
          className="border-border/50 cursor-pointer hover:border-primary/30 transition-colors"
          onClick={() => scrollTo(action.id)}
        >
          <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center gap-1.5">
            <div className={`p-2 rounded-lg ${action.bgColor}`}>
              <action.icon className={`w-5 h-5 ${action.color}`} />
            </div>
            <span className="text-xs sm:text-sm font-medium text-foreground">
              {action.title}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
              {action.summary}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
