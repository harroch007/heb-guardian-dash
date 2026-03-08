import { Calendar, Moon, BookOpen, Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SchedulesSection() {
  const rows = [
    {
      icon: Calendar,
      label: "שבת",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Moon,
      label: "שעת שינה",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      icon: BookOpen,
      label: "בית ספר",
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
  ];

  return (
    <div id="schedules-section" className="scroll-mt-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="w-5 h-5 text-primary" />
            לוחות זמנים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.label}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${row.bgColor}`}>
                    <Icon className={`w-4 h-4 ${row.color}`} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{row.label}</span>
                </div>
                <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                  בקרוב
                </Badge>
              </div>
            );
          })}

          {/* Bonus Time - muted placeholder */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/10 opacity-50">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-success/10">
                <Gift className="w-4 h-4 text-success" />
              </div>
              <span className="text-sm text-muted-foreground">זמן בונוס</span>
            </div>
            <span className="text-xs text-muted-foreground">בקרוב</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
