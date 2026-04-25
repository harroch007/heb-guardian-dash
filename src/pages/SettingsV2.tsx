import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Crown, BellRing, Send, Loader2, Users, Shield, FileText, MessageCircle, Bug, Lightbulb, LogOut, HelpCircle, ChevronLeft, Pencil, Check, X, ShieldCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InstallAppCard } from "@/components/InstallAppCard";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilySubscription } from "@/hooks/useFamilySubscription";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { WHATSAPP_MONITORING_ENABLED } from "@/config/featureFlags";

const WHATSAPP_NUMBER = "972548383340";

const SettingsV2 = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { children, allPremium, hasFreeChildren, childCount, isLoading: subLoading } = useFamilySubscription();
  const { isOwner, role } = useFamilyRole();
  const { isSupported, isSubscribed, isLoading: pushLoading, permission, subscribe, unsubscribe } = usePushNotifications();
  const [parentName, setParentName] = useState<string | null>(null);
  const [parentPhone, setParentPhone] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Profile edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("parents").select("full_name, phone").eq("id", user.id).single().then(({ data }) => {
      if (data?.full_name) setParentName(data.full_name);
      if (data?.phone) setParentPhone(data.phone);
    });
  }, [user?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleTestNotification = async () => {
    if (!user || !isSubscribed) return;
    setIsSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          parent_id: user.id,
          title: '🎉 התראת בדיקה',
          body: 'מעולה! ההתראות עובדות כמו שצריך.',
          url: '/settings-v2'
        }
      });
      if (error) throw error;
      toast.success('התראת בדיקה נשלחה בהצלחה');
    } catch {
      toast.error('שגיאה בשליחת התראה');
    } finally {
      setIsSendingTest(false);
    }
  };

  const startEditing = () => {
    setEditName(parentName || "");
    setEditPhone(parentPhone || "");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const saveProfile = async () => {
    if (!user?.id) return;
    const trimmedName = editName.trim();
    const trimmedPhone = editPhone.trim();

    if (trimmedName.length < 2) {
      toast.error("השם חייב להכיל לפחות 2 תווים");
      return;
    }

    setIsSaving(true);
    try {
      const updateData: Record<string, string> = { full_name: trimmedName };
      if (trimmedPhone) {
        updateData.phone = trimmedPhone;
      }

      const { error } = await supabase
        .from("parents")
        .update(updateData)
        .eq("id", user.id);

      if (error) {
        if (error.code === "23505" && error.message?.includes("phone")) {
          toast.error("מספר הטלפון כבר קיים במערכת");
        } else {
          throw error;
        }
        return;
      }

      setParentName(trimmedName);
      if (trimmedPhone) setParentPhone(trimmedPhone);
      setIsEditing(false);
      toast.success("הפרטים עודכנו בהצלחה");
    } catch {
      toast.error("שגיאה בעדכון הפרטים");
    } finally {
      setIsSaving(false);
    }
  };

  const openWhatsApp = (message?: string) => {
    const baseUrl = `https://wa.me/${WHATSAPP_NUMBER}`;
    const url = message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
    window.open(url, '_blank');
  };

  const premiumCount = children.filter(c => c.subscription_tier === "premium").length;

  return (
    <div className="v2-dark min-h-screen bg-background" dir="rtl">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">הגדרות</h1>
            <p className="text-sm text-muted-foreground">ניהול חשבון, התראות ותמיכה</p>
          </div>
        </div>

        {/* Account */}
        <section className="p-5 rounded-2xl bg-card border border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">חשבון</h2>
                <p className="text-xs text-muted-foreground">פרטי החשבון שלך</p>
                {!isOwner && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0 mt-0.5">
                    <ShieldCheck className="w-3 h-3 ml-0.5" />
                    הורה שותף
                  </Badge>
                )}
              </div>
            </div>
            {!isEditing && (
              <button
                onClick={startEditing}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="ערוך פרטים"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">שם מלא</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9 text-sm"
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">טלפון</label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="h-9 text-sm"
                  dir="ltr"
                  type="tel"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={saveProfile}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  שמור
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  ביטול
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {parentName && (
                <div className="flex justify-between items-center py-2 border-b border-border/30">
                  <span className="text-muted-foreground">שם</span>
                  <span className="font-medium text-foreground">{parentName}</span>
                </div>
              )}
              {user?.email && (
                <div className="flex justify-between items-center py-2 border-b border-border/30">
                  <span className="text-muted-foreground">אימייל</span>
                  <span className="font-medium text-foreground text-left" dir="ltr">{user.email}</span>
                </div>
              )}
              {parentPhone && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">טלפון</span>
                  <span className="font-medium text-foreground" dir="ltr">{parentPhone}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Subscription — hidden when WhatsApp monitoring is disabled */}
        {WHATSAPP_MONITORING_ENABLED && (
          <section className="p-5 rounded-2xl bg-card border border-border/50 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">מינוי</h2>
                <p className="text-xs text-muted-foreground">סטטוס המינוי המשפחתי</p>
              </div>
            </div>
            {!subLoading && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-border/30">
                  <span className="text-muted-foreground">סטטוס</span>
                  <span className={`font-medium ${allPremium ? 'text-green-600' : 'text-foreground'}`}>
                    {allPremium ? 'פרימיום פעיל' : 'חינמי'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/30">
                  <span className="text-muted-foreground">ילדים</span>
                  <span className="font-medium text-foreground">{childCount}</span>
                </div>
                {childCount > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">ילדים פרימיום</span>
                    <span className="font-medium text-foreground">{premiumCount} / {childCount}</span>
                  </div>
                )}
                {isOwner && hasFreeChildren && (
                  <Button
                    onClick={() => navigate('/checkout')}
                    className="w-full mt-2 gap-2 bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                  >
                    <Crown className="w-4 h-4" />
                    שדרג עכשיו
                  </Button>
                )}
                {/* No self-service cancellation: backend only supports expiry-based downgrade */}
              </div>
            )}
          </section>
        )}

        {/* Push Notifications */}
        {isSupported && (
          <section className="p-5 rounded-2xl bg-card border border-border/50 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <BellRing className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">התראות Push</h2>
                  <p className="text-xs text-muted-foreground">קבל התראות בזמן אמת</p>
                </div>
              </div>
              <div dir="ltr">
                <Switch
                  checked={isSubscribed}
                  disabled={pushLoading}
                  onCheckedChange={async (checked) => {
                    if (checked) {
                      const ok = await subscribe();
                      if (!ok && Notification.permission === 'denied') {
                        toast.error('ההתראות חסומות בדפדפן. יש לאפשר אותן בהגדרות האתר.');
                      }
                    } else {
                      await unsubscribe();
                    }
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isSubscribed
                ? 'אתה מקבל התראות בזמן אמת.'
                : permission === 'denied'
                  ? 'ההתראות חסומות בדפדפן. אפשר לאפשר ידנית בהגדרות הדפדפן.'
                  : 'אישור יאפשר קבלת התראות גם כשהאפליקציה סגורה.'}
            </p>
            {permission === 'denied' && (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="text-xs text-primary hover:underline">
                    איך מאפשרים?
                  </button>
                </PopoverTrigger>
                <PopoverContent dir="rtl" className="w-auto max-w-[260px] p-3 text-xs leading-relaxed text-right">
                  לחצו על אייקון המנעול/הגדרות בסרגל הכתובת של הדפדפן ←
                  בחרו "הגדרות אתר" ← אפשרו "התראות" עבור Kippy. רעננו את הדף.
                </PopoverContent>
              </Popover>
            )}
            {isSubscribed && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestNotification}
                disabled={isSendingTest}
                className="gap-2 mt-1"
              >
                {isSendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                שלח התראת בדיקה
              </Button>
            )}
          </section>
        )}

        {/* Install App (PWA) */}
        <InstallAppCard variant="settings" />


        {/* Family Summary */}
        {!subLoading && childCount > 0 && (
          <section className="p-5 rounded-2xl bg-card border border-border/50 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">משפחה</h2>
                <p className="text-xs text-muted-foreground">{childCount} ילדים מחוברים</p>
              </div>
            </div>
            <div className="space-y-2">
              {children.map((child) => (
                <div key={child.id} className="flex justify-between items-center py-2 border-b border-border/30 last:border-0 text-sm">
                  <span className="font-medium text-foreground">{child.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${child.subscription_tier === 'premium' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                    {child.subscription_tier === 'premium' ? 'פרימיום' : 'חינמי'}
                  </span>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/family-v2')} className="gap-2 mt-1">
              <Users className="w-4 h-4" />
              ניהול משפחה
            </Button>
          </section>
        )}

        {/* Privacy & Legal */}
        <section className="p-5 rounded-2xl bg-card border border-border/50 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">פרטיות ושקיפות</h2>
              <p className="text-xs text-muted-foreground">מדיניות הפרטיות ותנאי השימוש</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/privacy')} className="gap-2">
              <FileText className="w-4 h-4" />
              מדיניות פרטיות
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/terms')} className="gap-2">
              <FileText className="w-4 h-4" />
              תנאי שימוש
            </Button>
          </div>
        </section>

        {/* Support */}
        <section className="p-5 rounded-2xl bg-card border border-border/50 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">עזרה ותמיכה</h2>
              <p className="text-xs text-muted-foreground">יש שאלה? אנחנו כאן בשבילכם</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => openWhatsApp()} className="gap-2 border-green-500/30 text-green-600 hover:bg-green-50 hover:text-green-700">
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={() => openWhatsApp("היי, אני רוצה לדווח על תקלה באפליקציה:\n\n")} className="gap-2">
              <Bug className="w-4 h-4" />
              דווח על תקלה
            </Button>
            <Button variant="outline" size="sm" onClick={() => openWhatsApp("היי, יש לי הצעה לשיפור:\n\n")} className="gap-2">
              <Lightbulb className="w-4 h-4" />
              הצעה לשיפור
            </Button>
          </div>
        </section>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full py-3 px-6 rounded-2xl bg-destructive/10 text-destructive font-medium hover:bg-destructive/20 transition-all border border-destructive/20 flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          התנתקות
        </button>

        {/* Version */}
        <div className="text-center pt-2 pb-4">
          <p className="text-xs text-muted-foreground">גרסה 1.0.1 • עודכן לאחרונה 04/01/26</p>
        </div>
      </div>
      <BottomNavigationV2 />
    </div>
  );
};

export default SettingsV2;