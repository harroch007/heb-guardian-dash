import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Battery,
  Clock,
  Loader2,
  Plus,
  Smartphone,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getV2GuardianHome,
  type V2GuardianHomeChild,
} from "@/lib/v2/guardianHomeService";
import { grantParentBonusTime } from "@/lib/parental-controls/settingsService";
import { getIsraelDate } from "@/lib/utils";
import { AddChildModal } from "@/components/AddChildModal";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { TopNavigationV2 } from "@/components/TopNavigationV2";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const connected = (child: V2GuardianHomeChild) =>
  Boolean(
    child.device?.lastSeenAt &&
      Date.now() - new Date(child.device.lastSeenAt).getTime() <
        24 * 60 * 60 * 1000,
  );

const lastSeenCopy = (value: string | null | undefined) => {
  if (!value) return "טרם התקבל דיווח";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (minutes < 1) return "מחובר עכשיו";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
};

export default function FamilyV2Canonical() {
  const { user, familyId } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<V2GuardianHomeChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [addingTime, setAddingTime] = useState<string | null>(null);

  const fetchChildren = useCallback(async () => {
    if (!familyId) {
      setChildren([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setChildren(
        await getV2GuardianHome(familyId, getIsraelDate()),
      );
    } catch (error) {
      console.error("[family-v2] Failed to load family", error);
      toast.error("לא ניתן לטעון את נתוני המשפחה");
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    void fetchChildren();
  }, [fetchChildren]);

  const addTime = async (child: V2GuardianHomeChild) => {
    if (!user?.id) return;
    setAddingTime(child.id);
    try {
      await grantParentBonusTime({
        childId: child.id,
        parentId: user.id,
        grantDate: getIsraelDate(),
        minutes: 15,
      });
      toast.success(`נוספו 15 דקות ל${child.displayName}`);
      await fetchChildren();
    } catch (error) {
      console.error(error);
      toast.error("לא ניתן להוסיף זמן כרגע");
    } finally {
      setAddingTime(null);
    }
  };

  const connectedCount = children.filter(connected).length;

  if (loading) {
    return (
      <div className="v2-dark flex min-h-screen items-center justify-center" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="v2-dark min-h-screen pb-24" dir="rtl">
      <TopNavigationV2 />
      <main className="mx-auto max-w-lg space-y-5 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">המשפחה שלי</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {children.length} ילדים · {connectedCount} מכשירים מחוברים
            </p>
          </div>
          <Button size="sm" onClick={() => setAddChildOpen(true)}>
            <Plus className="ml-1 h-4 w-4" />
            הוספת ילד
          </Button>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                ניהול המשפחה מחובר ל־Kippy V2
              </p>
              <p className="text-xs text-muted-foreground">
                כל ילד ומכשיר מוצגים מאותו מקור נתונים מאובטח.
              </p>
            </div>
          </CardContent>
        </Card>

        {children.length === 0 ? (
          <Card className="border-dashed border-border bg-card">
            <CardContent className="py-12 text-center">
              <Smartphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium text-foreground">
                עדיין לא נוסף ילד
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                הוסיפו ילד כדי לקבל QR לחיבור מכשיר Android.
              </p>
              <Button
                className="mt-4"
                onClick={() => setAddChildOpen(true)}
              >
                <Plus className="ml-1 h-4 w-4" />
                הוספת ילד ראשון
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {children.map((child) => {
              const isConnected = connected(child);
              return (
                <Card key={child.id} className="border-border bg-card">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-right"
                        onClick={() => navigate(`/child-v2/${child.id}`)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                            {child.displayName.charAt(0)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">
                              {child.displayName}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {isConnected ? (
                                <Wifi className="h-3 w-3 text-success" />
                              ) : (
                                <WifiOff className="h-3 w-3 text-warning" />
                              )}
                              {lastSeenCopy(child.device?.lastSeenAt)}
                            </div>
                          </div>
                        </div>
                      </button>

                      <Badge
                        variant="secondary"
                        className={
                          isConnected
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                        }
                      >
                        {isConnected ? "פעיל" : "דורש בדיקה"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-muted/40 px-2 py-2">
                        <Clock className="mx-auto mb-1 h-3.5 w-3.5 text-primary" />
                        <p className="text-xs font-bold text-foreground">
                          {child.totalUsageMinutes} דק׳
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          היום
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/40 px-2 py-2">
                        <Battery className="mx-auto mb-1 h-3.5 w-3.5 text-primary" />
                        <p className="text-xs font-bold text-foreground">
                          {child.device?.batteryLevel ?? "—"}
                          {child.device?.batteryLevel != null ? "%" : ""}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          סוללה
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/40 px-2 py-2">
                        <Plus className="mx-auto mb-1 h-3.5 w-3.5 text-primary" />
                        <p className="text-xs font-bold text-foreground">
                          {child.todayBonusMinutes} דק׳
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          בונוס
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate(`/child-v2/${child.id}`)}
                      >
                        מרכז הגנה
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1"
                        disabled={
                          !child.device || addingTime === child.id
                        }
                        onClick={() => void addTime(child)}
                      >
                        {addingTime === child.id ? (
                          <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="ml-1 h-4 w-4" />
                        )}
                        הוסף 15 דק׳
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <AddChildModal
        open={addChildOpen}
        onOpenChange={setAddChildOpen}
        onChildAdded={() => void fetchChildren()}
      />
      <BottomNavigationV2 />
    </div>
  );
}
