import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BellRing,
  Check,
  FileText,
  HelpCircle,
  Loader2,
  LogOut,
  MessageCircle,
  Pencil,
  Shield,
  User,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useV2PushNotifications } from "@/hooks/useV2PushNotifications";
import {
  getV2GuardianPortalSnapshot,
  updateV2GuardianProfile,
  type V2GuardianPortalSnapshot,
} from "@/lib/v2/guardianPortalService";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { InstallAppCard } from "@/components/InstallAppCard";
import { TopNavigationV2 } from "@/components/TopNavigationV2";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const SUPPORT_NUMBER = "972548383340";

export default function SettingsV2Canonical() {
  const navigate = useNavigate();
  const {
    user,
    familyId,
    signOut,
    checkParentStatus,
  } = useAuth();
  const push = useV2PushNotifications();
  const [snapshot, setSnapshot] = useState<V2GuardianPortalSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const load = useCallback(async () => {
    if (!user?.id || !familyId) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getV2GuardianPortalSnapshot({
        familyId,
        userId: user.id,
      });
      setSnapshot(data);
      setName(data.displayName);
      setPhone(data.phone ?? "");
    } catch (error) {
      console.error("[settings-v2] Failed to load guardian portal", error);
      setSnapshot(null);
      toast.error("לא ניתן לטעון את הגדרות החשבון");
    } finally {
      setLoading(false);
    }
  }, [familyId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async () => {
    if (name.trim().length < 2) {
      toast.error("יש להזין שם באורך שני תווים לפחות");
      return;
    }
    setSaving(true);
    try {
      await updateV2GuardianProfile({
        displayName: name,
        phone: phone || null,
      });
      await checkParentStatus();
      await load();
      setEditing(false);
      toast.success("פרטי החשבון עודכנו");
    } catch (error) {
      console.error("[settings-v2] Failed to update profile", error);
      toast.error("לא ניתן לעדכן את הפרטים כרגע");
    } finally {
      setSaving(false);
    }
  };

  const togglePush = async (checked: boolean) => {
    const ok = checked ? await push.subscribe() : await push.unsubscribe();
    if (ok) {
      toast.success(
        checked ? "התראות Push הופעלו" : "התראות Push כובו במכשיר הזה",
      );
    } else if (Notification.permission === "denied") {
      toast.error("הדפדפן חסם התראות. יש לאפשר אותן בהגדרות האתר.");
    } else {
      toast.error("לא ניתן לעדכן את התראות ה־Push כרגע");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/landing-v1");
  };

  if (loading) {
    return (
      <div className="v2-dark flex min-h-screen items-center justify-center" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="v2-dark min-h-screen bg-background pb-24" dir="rtl">
        <TopNavigationV2 />
        <main className="mx-auto max-w-lg px-4 py-6">
          <section className="space-y-4 rounded-2xl border border-destructive/40 bg-card p-5 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-foreground">
                לא ניתן לטעון את הגדרות החשבון
              </h1>
              <p className="text-sm text-muted-foreground">
                הנתונים לא הוצגו כדי שלא להציג פרטי משפחה שגויים.
              </p>
            </div>
            <Button onClick={() => void load()}>נסה שוב</Button>
          </section>
        </main>
        <BottomNavigationV2 />
      </div>
    );
  }

  return (
    <div className="v2-dark min-h-screen bg-background pb-24" dir="rtl">
      <TopNavigationV2 />
      <main className="mx-auto max-w-lg space-y-5 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">הגדרות</h1>
          <p className="text-sm text-muted-foreground">
            חשבון הורה, התראות ותמיכה
          </p>
        </div>

        <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  חשבון הורה
                </h2>
                <Badge variant="secondary" className="mt-1 text-[10px]">
                  {snapshot.role === "owner" ? "הורה ראשי" : "הורה שותף"}
                </Badge>
              </div>
            </div>
            {!editing && (
              <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">שם מלא</label>
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">טלפון</label>
                <Input
                  dir="ltr"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void saveProfile()} disabled={saving}>
                  {saving ? (
                    <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="ml-1 h-4 w-4" />
                  )}
                  שמור
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setName(snapshot.displayName);
                    setPhone(snapshot.phone ?? "");
                    setEditing(false);
                  }}
                >
                  <X className="ml-1 h-4 w-4" />
                  ביטול
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border/30 py-2">
                <span className="text-muted-foreground">שם</span>
                <span className="font-medium">{snapshot.displayName || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-border/30 py-2">
                <span className="text-muted-foreground">אימייל</span>
                <span dir="ltr" className="font-medium">{user?.email ?? "—"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">טלפון</span>
                <span dir="ltr" className="font-medium">{snapshot.phone ?? "—"}</span>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">המשפחה</h2>
              <p className="text-xs text-muted-foreground">
                {snapshot.childCount} ילדים · {snapshot.guardianCount} הורים
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/family-v2")}>
            ניהול המשפחה
          </Button>
        </section>

        {push.isSupported && (
          <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <BellRing className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">התראות Push</h2>
                  <p className="text-xs text-muted-foreground">
                    התראות בטיחות מאומתות במכשיר הזה
                  </p>
                </div>
              </div>
              <Switch
                checked={push.isSubscribed}
                disabled={push.isLoading}
                onCheckedChange={(checked) => void togglePush(checked)}
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {push.permission === "denied"
                ? "הדפדפן חסם התראות. ניתן לאפשר אותן מחדש בהגדרות האתר."
                : push.isSubscribed
                  ? "המכשיר הזה רשום לקבלת התראות בטיחות מאומתות."
                  : "הפעלת Push תאפשר לקבל התראה גם כאשר לוח ההורה סגור."}
            </p>
          </section>
        )}

        <InstallAppCard variant="settings" />

        <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-success" />
            <div>
              <h2 className="font-semibold">פרטיות ושקיפות</h2>
              <p className="text-xs text-muted-foreground">
                תנאי השימוש והגנת המידע
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/privacy")}>
              <FileText className="ml-1 h-4 w-4" />
              פרטיות
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/terms")}>
              <FileText className="ml-1 h-4 w-4" />
              תנאי שימוש
            </Button>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">עזרה ותמיכה</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://wa.me/${SUPPORT_NUMBER}`, "_blank")}
          >
            <MessageCircle className="ml-1 h-4 w-4" />
            WhatsApp
          </Button>
        </section>

        <Button variant="destructive" className="w-full" onClick={() => void handleSignOut()}>
          <LogOut className="ml-2 h-4 w-4" />
          התנתקות
        </Button>
      </main>
      <BottomNavigationV2 />
    </div>
  );
}
