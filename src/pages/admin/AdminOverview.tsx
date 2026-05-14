import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ListChecks, Clock, MapPin, Smartphone, Coins, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface OverviewStats {
  totalParents: number;
  totalWaitlist: number;
  totalDevices: number;
  activeUsersToday: number;
  activeChildrenToday: number;
  activeParentsThisWeek: number;
  funnel: { stage: string; count: number }[];
  // parental controls
  choresActive: number;
  choresCompletedToday: number;
  choresPendingApproval: number;
  rewardBankTotalMinutes: number;
  rewardRedemptionsToday: number;
  bonusGrantsToday: number;
  timeRequestsPending: number;
  familiesWithPlaces: number;
  devicesOnline: number;
  devicesToday: number;
  devicesOffline: number;
  childrenNoDevice: number;
}

interface AdminOverviewProps {
  stats: OverviewStats | null;
  loading: boolean;
  onNavigate: (tab: string, filter?: string) => void;
  onRefresh?: () => void;
}

export function AdminOverview({ stats, loading, onNavigate, onRefresh }: AdminOverviewProps) {
  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">טוען נתונים...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            רענן
          </Button>
        )}
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-cyan-500/20 cursor-pointer hover:shadow-md transition-all" onClick={() => onNavigate("users")}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Users className="w-3 h-3" />
              משפחות פעילות היום
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-cyan-500">{stats.activeUsersToday}</p>
            <p className="text-xs text-muted-foreground mt-1">מכשירים פעילים ב-24ש</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Users className="w-3 h-3" />
              ילדים פעילים היום
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-500">{stats.activeChildrenToday}</p>
            <p className="text-xs text-muted-foreground mt-1">דיווחו metrics היום</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Users className="w-3 h-3" />
              סה"כ הורים
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-500">{stats.totalParents}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.totalWaitlist} ב-Waitlist</p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20" onClick={() => onNavigate("ops")}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Smartphone className="w-3 h-3" />
              מכשירים מחוברים
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-500">{stats.totalDevices}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.devicesOnline} online · {stats.devicesOffline} offline
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Parental Control KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-amber-500/20 cursor-pointer hover:shadow-md transition-all" onClick={() => onNavigate("ops")}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <ListChecks className="w-3 h-3" />
              משימות פעילות
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-500">{stats.choresActive}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.choresCompletedToday} הושלמו · {stats.choresPendingApproval} לאישור
            </p>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Coins className="w-3 h-3" />
              בנק תגמולים
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-500">{stats.rewardBankTotalMinutes}</p>
            <p className="text-xs text-muted-foreground mt-1">דקות זמינות במערכת</p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Clock className="w-3 h-3" />
              בקשות זמן ממתינות
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-500">{stats.timeRequestsPending}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.bonusGrantsToday} בונוסים היום
            </p>
          </CardContent>
        </Card>

        <Card className="border-rose-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <MapPin className="w-3 h-3" />
              משפחות עם גבולות גזרה
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-rose-500">{stats.familiesWithPlaces}</p>
            <p className="text-xs text-muted-foreground mt-1">הגדירו ≥1 מקום</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel */}
      {stats.funnel && stats.funnel.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              משפך המרה
            </CardTitle>
            <CardDescription>מרשימת המתנה ועד משתמש פעיל</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
              {stats.funnel.map((stage, index) => (
                <div key={stage.stage} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[100px]">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{
                        backgroundColor: `hsl(var(--primary) / ${0.2 + index * 0.15})`,
                        borderColor: `hsl(var(--primary))`,
                        borderWidth: "2px",
                      }}
                    >
                      {stage.count}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">{stage.stage}</p>
                  </div>
                  {index < stats.funnel.length - 1 && (
                    <div className="w-8 h-0.5 bg-primary/30 mx-2" />
                  )}
                </div>
              ))}
            </div>
            {stats.funnel.length > 1 && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  שיעור המרה מ-Waitlist להרשמה:{" "}
                  <span className="font-bold text-primary">
                    {stats.funnel[0].count > 0
                      ? ((stats.funnel[1].count / stats.funnel[0].count) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
