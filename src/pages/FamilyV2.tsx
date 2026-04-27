import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { getIsraelDate } from "@/lib/utils";
import { getFamilyParentIds } from "@/lib/familyScope";
import { Loader2, ArrowRight, Users, Wifi, AlertTriangle, Crown, Phone, Clock, UserPlus, Bell, Volume2, CheckCircle2, Mail, UserMinus, ShieldCheck, Copy, MessageCircle, Share2 } from "lucide-react";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AddChildModal } from "@/components/AddChildModal";
import { useToast } from "@/hooks/use-toast";
import { useRingCommand, type RingPhase } from "@/hooks/useRingCommand";
import { WHATSAPP_MONITORING_ENABLED } from "@/config/featureFlags";

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

interface CoParentRow {
  id: string;
  invited_email: string;
  invited_name: string | null;
  status: string;
  receive_alerts: boolean;
  member_id: string | null;
  accepted_at: string | null;
  pairing_code: string | null;
  pairing_code_expires_at: string | null;
}

const FamilyV2 = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isOwner, loading: roleLoading } = useFamilyRole();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [addingTime, setAddingTime] = useState<string | null>(null);

  // Co-parent management state
  const [coParent, setCoParent] = useState<CoParentRow | null>(null);
  const [coParentLoading, setCoParentLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteAlerts, setInviteAlerts] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [updatingAlerts, setUpdatingAlerts] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Explicitly scope to this family's owners (own + accepted co-parent owners)
      // so admin RLS bypass doesn't leak other families' children.
      const allowedParentIds = await getFamilyParentIds(user.id);
      const { data: kids } = await supabase
        .from("children")
        .select("id, name, gender, subscription_tier")
        .in("parent_id", allowedParentIds)
        .order("created_at", { ascending: true });

      if (!kids || kids.length === 0) {
        setChildren([]);
        setLoading(false);
        return;
      }

      const childIds = kids.map((c) => c.id);

      const [devicesRes, rewardRes, alertsRes, settingsRes] = await Promise.all([
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
          .select("child_id, ai_risk_score, remind_at")
          .in("child_id", childIds)
          .is("acknowledged_at", null)
          .is("saved_at", null)
          .is("parent_message", null)
          .eq("is_processed", true)
          .eq("alert_type", "warning")
          .in("ai_verdict", ["notify", "review"]),
        supabase
          .from("settings")
          .select("child_id, alert_threshold")
          .in("child_id", childIds),
      ]);

      const thresholds: Record<string, number> = {};
      settingsRes.data?.forEach((s) => {
        if (s.child_id) thresholds[s.child_id] = s.alert_threshold ?? 65;
      });

      const now = new Date();

      const enriched: FamilyChild[] = kids.map((child) => {
        const device = devicesRes.data?.find((d) => d.child_id === child.id) || null;
        const bank = rewardRes.data?.find((r) => r.child_id === child.id);
        const threshold = thresholds[child.id] ?? 65;
        const alertCount = (alertsRes.data || []).filter(
          (a) =>
            a.child_id === child.id &&
            (a.ai_risk_score ?? 0) >= threshold &&
            (!a.remind_at || new Date(a.remind_at) < now)
        ).length;

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

  // Fetch co-parent data (owner only)
  const fetchCoParent = useCallback(async () => {
    if (!user?.id || !isOwner) return;
    setCoParentLoading(true);
    try {
      const { data } = await supabase
        .from("family_members")
        .select("id, invited_email, invited_name, status, receive_alerts, member_id, accepted_at, pairing_code, pairing_code_expires_at")
        .eq("owner_id", user.id)
        .in("status", ["pending", "accepted"])
        .order("invited_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setCoParent(data ?? null);
    } catch (err) {
      console.error("[FamilyV2] Co-parent fetch error:", err);
    } finally {
      setCoParentLoading(false);
    }
  }, [user?.id, isOwner]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!roleLoading) fetchCoParent();
  }, [roleLoading, fetchCoParent]);

  // Realtime listener for invite acceptance
  useEffect(() => {
    if (!coParent?.id || coParent.status !== "pending") return;
    const channel = supabase
      .channel(`family_invite_${coParent.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "family_members", filter: `id=eq.${coParent.id}` },
        (payload) => {
          const next = payload.new as { status: string };
          if (next.status === "accepted") {
            toast({ title: "ההורה הצטרף!", description: "ההורה הנוסף אישר את ההזמנה" });
            fetchCoParent();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [coParent?.id, coParent?.status, toast, fetchCoParent]);

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

  // Co-parent actions
  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.rpc("create_family_invite_with_code", {
        p_email: inviteEmail.trim().toLowerCase(),
        p_name: inviteName.trim(),
      });
      if (error) {
        toast({ title: "שגיאה", description: error.message || "לא ניתן ליצור קוד", variant: "destructive" });
        return;
      }
      const result = data as {
        success: boolean;
        error?: string;
        invite_id?: string;
        invited_email?: string;
        invited_name?: string;
        pairing_code?: string;
        expires_at?: string;
      };
      if (!result?.success) {
        const errorMap: Record<string, string> = {
          NOT_AUTHENTICATED: "יש להתחבר מחדש.",
          INVALID_EMAIL: "כתובת אימייל לא תקינה.",
          MISSING_NAME: "יש להזין שם להורה.",
          ALREADY_MEMBER: "הורה זה כבר חבר במשפחה.",
        };
        toast({
          title: "שגיאה",
          description: errorMap[result?.error || ""] || "לא ניתן ליצור קוד",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "הקוד נוצר", description: "שלח את הקוד והלינק להורה הנוסף" });
      setShowInviteForm(false);
      setInviteEmail("");
      setInviteName("");
      setInviteAlerts(false);
      setCoParent({
        id: result.invite_id!,
        invited_email: result.invited_email!,
        invited_name: result.invited_name ?? null,
        status: "pending",
        receive_alerts: false,
        member_id: null,
        accepted_at: null,
        pairing_code: result.pairing_code!,
        pairing_code_expires_at: result.expires_at!,
      });
    } catch {
      toast({ title: "שגיאה", description: "שגיאה בלתי צפויה", variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const handleRegenerateCode = async () => {
    if (!coParent) return;
    try {
      const { data, error } = await supabase.rpc("regenerate_family_invite_code", {
        p_invite_id: coParent.id,
      });
      if (error) throw error;
      const result = data as { code: string; expires_at: string };
      setCoParent({
        ...coParent,
        status: "pending",
        member_id: null,
        accepted_at: null,
        pairing_code: result.code,
        pairing_code_expires_at: result.expires_at,
      });
      toast({ title: "נוצר קוד חדש" });
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן להפיק קוד חדש", variant: "destructive" });
    }
  };

  const handleRevoke = async () => {
    if (!coParent) return;
    setRevoking(true);
    try {
      const { error } = await supabase.rpc("revoke_co_parent", {
        p_membership_id: coParent.id,
      });
      if (error) {
        toast({ title: "שגיאה", description: error.message || "לא ניתן לבטל", variant: "destructive" });
        return;
      }
      toast({ title: "ההזמנה בוטלה", description: "ההורה השותף הוסר בהצלחה" });
      setCoParent(null);
    } catch {
      toast({ title: "שגיאה", description: "שגיאה בלתי צפויה", variant: "destructive" });
    } finally {
      setRevoking(false);
    }
  };

  const handleToggleAlerts = async (checked: boolean) => {
    if (!coParent) return;
    setUpdatingAlerts(true);
    try {
      const { error } = await supabase
        .from("family_members")
        .update({ receive_alerts: checked })
        .eq("id", coParent.id);
      if (error) throw error;
      setCoParent({ ...coParent, receive_alerts: checked });
      toast({ title: checked ? "התראות הופעלו" : "התראות כובו" });
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן לעדכן", variant: "destructive" });
    } finally {
      setUpdatingAlerts(false);
    }
  };

  const connectedCount = children.filter((c) => isConnected(c.device?.last_seen ?? null)).length;
  const totalAlerts = children.reduce((s, c) => s + c.unacknowledgedAlerts, 0);
  const premiumCount = children.filter((c) => c.subscription_tier === "premium").length;
  const hasFreeChildren = children.some((c) => c.subscription_tier !== "premium");

  if ((loading || roleLoading) && !addChildOpen) {
    return (
      <div className="v2-dark min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="v2-dark min-h-screen pb-24" dir="rtl">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">המשפחה שלי</h1>
            <p className="text-sm text-muted-foreground">ניהול ילדים, מכשירים והרשאות</p>
          </div>
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
                <Wifi className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{connectedCount}</p>
                <p className="text-xs text-muted-foreground">מחוברים</p>
              </div>
            </CardContent>
          </Card>
          {WHATSAPP_MONITORING_ENABLED && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalAlerts}</p>
                  <p className="text-xs text-muted-foreground">התראות פתוחות</p>
                </div>
              </CardContent>
            </Card>
          )}
          {WHATSAPP_MONITORING_ENABLED && premiumCount > 0 && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{premiumCount}</p>
                  <p className="text-xs text-muted-foreground">פרימיום</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Children List */}
        {children.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">אין ילדים רשומים עדיין</p>
              {isOwner && (
                <Button className="mt-4" onClick={() => setAddChildOpen(true)}>
                  <UserPlus className="w-4 h-4 ml-2" />
                  הוסף ילד
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {children.map((child) => {
              const connected = isConnected(child.device?.last_seen ?? null);
              return (
                <Card key={child.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
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
                            {WHATSAPP_MONITORING_ENABLED && child.subscription_tier === "premium" && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-accent/15 text-accent border-0">
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

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {child.device?.battery_level != null && (
                        <span className={`${child.device.battery_level < 20 ? "text-destructive" : ""}`}>
                          🔋 {child.device.battery_level}%
                        </span>
                      )}
                      <span>🏦 {child.rewardBankBalance} דק׳</span>
                      {WHATSAPP_MONITORING_ENABLED && child.unacknowledgedAlerts > 0 && (
                        <span className="text-warning">
                          <Bell className="w-3 h-3 inline ml-0.5" />
                          {child.unacknowledgedAlerts} התראות
                        </span>
                      )}
                    </div>

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
                        <FamilyRingButton deviceId={child.device.device_id} />
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

        {/* Add Child CTA — owner only */}
        {isOwner && children.length > 0 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setAddChildOpen(true)}
          >
            <UserPlus className="w-4 h-4 ml-2" />
            הוסף ילד
          </Button>
        )}

        {/* Family Subscription Summary — owner only */}
        {WHATSAPP_MONITORING_ENABLED && isOwner && hasFreeChildren && (
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

        {/* Co-Parent Management — owner only */}
        {isOwner && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">הורה שותף</h3>
                  <p className="text-xs text-muted-foreground">הזמן הורה נוסף לנהל את המשפחה</p>
                </div>
              </div>

              {coParentLoading ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : coParent ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-border/30">
                    <div className="flex flex-col gap-0.5">
                      {coParent.invited_name && (
                        <span className="text-sm font-semibold text-foreground">
                          {coParent.invited_name}
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground" dir="ltr">{coParent.invited_email}</span>
                      </div>
                    </div>
                    <Badge variant={coParent.status === "accepted" ? "default" : "secondary"} className="text-[10px]">
                      {coParent.status === "accepted" ? "פעיל" : "ממתין לאישור"}
                    </Badge>
                  </div>

                  {coParent.status === "pending" && (
                    <div className="space-y-3 py-2">
                      {coParent.pairing_code ? (
                        <>
                          <div className="text-center space-y-1">
                            <p className="text-xs text-muted-foreground">קוד הצטרפות (6 ספרות)</p>
                            <p className="text-3xl font-bold tracking-[0.4em] text-primary" dir="ltr">
                              {coParent.pairing_code}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              תוקף עד {coParent.pairing_code_expires_at
                                ? new Date(coParent.pairing_code_expires_at).toLocaleDateString("he-IL")
                                : "—"}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => {
                              const url = `${window.location.origin}/join-family`;
                              const text =
                                `שלום! הוזמנת להצטרף כהורה שותף ב-KippyAI 👨‍👩‍👧\n` +
                                `1) פתח/י את הקישור: ${url}\n` +
                                `2) השתמש/י באימייל: ${coParent.invited_email}\n` +
                                `3) הזן/י את קוד ההצטרפות: ${coParent.pairing_code}\n` +
                                `הקוד תקף ל-7 ימים.`;
                              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                            }}
                          >
                            <MessageCircle className="w-4 h-4" />
                            שלח להורה דרך WhatsApp
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={handleRegenerateCode}
                          >
                            הפק קוד חדש
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={handleRegenerateCode}
                        >
                          הפק קוד הצטרפות
                        </Button>
                      )}
                    </div>
                  )}

                  {coParent.status === "accepted" && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-foreground">קבלת התראות</span>
                      <div dir="ltr">
                        <Switch
                          checked={coParent.receive_alerts}
                          disabled={updatingAlerts}
                          onCheckedChange={handleToggleAlerts}
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRevoke}
                    disabled={revoking}
                    className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    {revoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                    {coParent.status === "accepted" ? "הסר הורה שותף" : "בטל הזמנה"}
                  </Button>
                </div>
              ) : showInviteForm ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">אימייל ההורה השותף</label>
                    <Input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="email@example.com"
                      type="email"
                      dir="ltr"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-foreground">קבלת התראות</span>
                    <div dir="ltr">
                      <Switch
                        checked={inviteAlerts}
                        onCheckedChange={setInviteAlerts}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="gap-2">
                      {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      שלח הזמנה
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowInviteForm(false)} disabled={inviting}>
                      ביטול
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowInviteForm(true)} className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  הזמן הורה שותף
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Co-parent role badge */}
        {!isOwner && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">הורה שותף</p>
                <p className="text-xs text-muted-foreground">אתה מחובר כהורה שותף במשפחה הזו</p>
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
      <BottomNavigationV2 />
    </div>
  );
};

// Extracted component so useRingCommand hook can be called per-child
function FamilyRingButton({ deviceId }: { deviceId: string }) {
  const { phase, sendRing, retry } = useRingCommand(deviceId);

  const isBusy = phase === "sending" || phase === "ringing";
  const isDone = phase === "child_stopped" || phase === "timeout" || phase === "completed_legacy";
  const isFailed = phase === "failed";

  const icon = () => {
    if (phase === "sending") return <Loader2 className="w-4 h-4 animate-spin" />;
    if (phase === "ringing") return <Volume2 className="w-4 h-4 animate-pulse" />;
    if (isDone) return <CheckCircle2 className="w-4 h-4 text-success" />;
    if (isFailed) return <AlertTriangle className="w-4 h-4 text-destructive" />;
    return <Phone className="w-4 h-4" />;
  };

  return (
    <Button
      size="sm"
      variant={isFailed ? "destructive" : "outline"}
      onClick={() => isFailed ? retry() : sendRing()}
      disabled={isBusy || isDone}
    >
      {icon()}
    </Button>
  );
}

export default FamilyV2;
