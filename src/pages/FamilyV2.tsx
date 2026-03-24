import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getIsraelDate } from "@/lib/utils";
import { Loader2, ArrowRight, Users, Wifi, AlertTriangle, Crown, Phone, Clock, ChevronLeft, UserPlus, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddChildModal } from "@/components/AddChildModal";
import { useToast } from "@/hooks/use-toast";

interface FamilyChild {
  id: string;
  name: string;
  gender: string;
  subscription_tier: string | null;
  device?: {
    device_id: string;
    battery_level: number | null;
    last_seen: string | null;
  } | null;
  rewardBankBalance: number;
  unacknowledgedAlerts: number;
}

const FamilyV2 = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [ringingDevice, setRingingDevice] = useState<string | null>(null);
  const [addingTime, setAddingTime] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: kids } = await supabase
        .from("children")
        .select("id, name, gender, subscription_tier")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true });

      if (!kids || kids.length === 0) {
        setChildren([]);
        setLoading(false);
        return;
      }

      const childIds = kids.map((c) => c.id);

      const [devicesRes, rewardRes, alertsRes] = await Promise.all([
        supabase
          .from("devices")
          .select("child_id, device_id, battery_level, last_seen")
          .in("child_id", childIds),
        supabase
          .from("reward_bank")
          .select("child_id, balance_minutes")
          .in("child_id", childIds),
        supabase
          .from("alerts")
          .select("child_id")
          .in("child_id", childIds)
          .is("acknowledged_at", null)
          .eq("is_processed", true)
          .eq("alert_type", "warning"),
      ]);

      const enriched: FamilyChild[] = kids.map((child) => {
        const device = devicesRes.data?.find((d) => d.child_id === child.id) || null;
        const bank = rewardRes.data?.find((r) => r.child_id === child.id);
        const alertCount = (alertsRes.data || []).filter((a) => a.child_id === child.id).length;

        return {
          id: child.id,
          name: child.name,
          gender: child.gender,
          subscription_tier: child.subscription_tier,
          device: device
            ? {
                device_id: device.device_id,
                battery_level: device.battery_level,
                last_seen: device.last_seen,
              }
            : null,
          rewardBankBalance: bank?.balance_minutes ?? 0,
          unacknowledgedAlerts: alertCount,
        };
      });

      setChildren(enriched);
    } catch (err) {
      console.error("[FamilyV2] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isConnected = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 24 * 60 * 60 * 1000;
  };

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return "לא דווח";
    const diff = Date.now() - new Date(lastSeen).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "עכשיו";
    if (mins < 60) return `לפני ${mins} דקות`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `לפני ${hours} שעות`;
    return `לפני ${Math.floor(hours / 24)} ימים`;
  };

  const handleRingDevice = async (child: FamilyChild) => {
    if (!child.device?.device_id) return;
    setRingingDevice(child.id);
    try {
      await supabase.from("device_commands").insert({
        device_id: child.device.device_id,
        command_type: "RING_DEVICE",
      });
      toast({ title: "הפקודה נשלחה", description: `צלצול נשלח למכשיר של ${child.name}` });
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן לשלוח את הפקודה", variant: "destructive" });
    } finally {
      setRingingDevice(null);
    }
  };

  const handleAddTime = async (child: FamilyChild) => {
    setAddingTime(child.id);
    try {
      const todayIsrael = getIsraelDate();
      await supabase.from("bonus_time_grants").insert({
        child_id: child.id,
        bonus_minutes: 15,
        grant_date: todayIsrael,
        granted_by: user?.id,
      });
      toast({ title: "זמן בונוס נוסף", description: `15 דקות נוספו ל${child.name}` });
      fetchData();
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן להוסיף זמן", variant: "destructive" });
    } finally {
      setAddingTime(null);
    }
  };

  const connectedCount = children.filter((c) => isConnected(c.device?.last_seen ?? null)).length;
  const totalAlerts = children.reduce((s, c) => s + c.unacknowledgedAlerts, 0);
  const premiumCount = children.filter((c) => c.subscription_tier === "premium").length;
  const hasFreeChildren = children.some((c) => c.subscription_tier !== "premium");

  if (loading) {
    return (
      <div className="homev2-light min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="homev2-light min-h-screen pb-24" dir="rtl">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">המשפחה שלי</h1>
            <p className="text-sm text-muted-foreground">ניהול ילדים, מכשירים והרשאות</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate("/home-v2")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>

        {/* Family Summary */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{children.length}</p>
                <p className="text-xs text-muted-foreground">ילדים</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Wifi className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{connectedCount}</p>
                <p className="text-xs text-muted-foreground">מחוברים</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalAlerts}</p>
                <p className="text-xs text-muted-foreground">התראות פתוחות</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{premiumCount}</p>
                <p className="text-xs text-muted-foreground">פרימיום</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Children List */}
        {children.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">אין ילדים רשומים עדיין</p>
              <Button className="mt-4" onClick={() => setAddChildOpen(true)}>
                <UserPlus className="w-4 h-4 ml-2" />
                הוסף ילד
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {children.map((child) => {
              const connected = isConnected(child.device?.last_seen ?? null);
              return (
                <Card key={child.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    {/* Child info row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-lg font-bold text-primary">
                            {child.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{child.name}</h3>
                            {child.subscription_tier === "premium" && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-0">
                                פרימיום
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {child.device ? formatLastSeen(child.device.last_seen) : "אין מכשיר מחובר"}
                          </p>
                        </div>
                      </div>
                      <div className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-emerald-500" : "bg-gray-300"}`} />
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {child.device?.battery_level != null && (
                        <span className={`${child.device.battery_level < 20 ? "text-red-500" : ""}`}>
                          🔋 {child.device.battery_level}%
                        </span>
                      )}
                      <span>🏦 {child.rewardBankBalance} דק׳</span>
                      {child.unacknowledgedAlerts > 0 && (
                        <span className="text-amber-600">
                          <Bell className="w-3 h-3 inline ml-0.5" />
                          {child.unacknowledgedAlerts} התראות
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/child-v2/${child.id}`)}
                      >
                        נהל ילד
                        <ArrowRight className="w-4 h-4 mr-1" />
                      </Button>
                      {child.device?.device_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRingDevice(child)}
                          disabled={ringingDevice === child.id}
                        >
                          {ringingDevice === child.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Phone className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddTime(child)}
                        disabled={addingTime === child.id}
                      >
                        {addingTime === child.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add Child CTA */}
        {children.length > 0 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setAddChildOpen(true)}
          >
            <UserPlus className="w-4 h-4 ml-2" />
            הוסף ילד
          </Button>
        )}

        {/* Family Subscription Summary */}
        {hasFreeChildren && (
          <Card className="border-purple-200 bg-purple-50/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {premiumCount} מתוך {children.length} ילדים בפרימיום
                  </p>
                  <p className="text-xs text-muted-foreground">שדרג להגנה מלאה על כל המשפחה</p>
                </div>
                <Button size="sm" onClick={() => navigate("/checkout")}>
                  שדרג עכשיו
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <AddChildModal
          open={addChildOpen}
          onOpenChange={setAddChildOpen}
          onChildAdded={fetchData}
        />
      </div>
    </div>
  );
};

export default FamilyV2;
