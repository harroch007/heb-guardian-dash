import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Crown, Bell, BellRing, Send, Loader2, Users, Shield, FileText, MessageCircle, Bug, Lightbulb, LogOut, HelpCircle, ChevronLeft } from "lucide-react";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilySubscription } from "@/hooks/useFamilySubscription";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const WHATSAPP_NUMBER = "972548383340";

const SettingsV2 = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { children, allPremium, hasFreeChildren, childCount, isLoading: subLoading } = useFamilySubscription();
  const { isSupported, isSubscribed, isLoading: pushLoading, permission, subscribe, unsubscribe } = usePushNotifications();
  const [parentName, setParentName] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("parents").select("full_name").eq("id", user.id).single().then(({ data }) => {
      if (data?.full_name) setParentName(data.full_name);
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

  const openWhatsApp = (message?: string) => {
    const baseUrl = `https://wa.me/${WHATSAPP_NUMBER}`;
    const url = message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
    window.open(url, '_blank');
  };

  const premiumCount = children.filter(c => c.subscription_tier === "premium").length;

  return (
    <div className="homev2-light min-h-screen bg-background" dir="rtl">
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">חשבון</h2>
              <p className="text-xs text-muted-foreground">פרטי החשבון שלך</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {parentName && (
              <div className="flex justify-between items-center py-2 border-b border-border/30">
                <span className="text-muted-foreground">שם</span>
                <span className="font-medium text-foreground">{parentName}</span>
              </div>
            )}
            {user?.email && (
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">אימייל</span>
                <span className="font-medium text-foreground text-left" dir="ltr">{user.email}</span>
              </div>
            )}
          </div>
        </section>

        {/* Subscription */}
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
              {hasFreeChildren && (
                <Button
                  onClick={() => navigate('/checkout')}
                  className="w-full mt-2 gap-2 bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                >
                  <Crown className="w-4 h-4" />
                  שדרג עכשיו
                </Button>
              )}
            </div>
          )}
        </section>

        {/* Push Notifications */}
        {isSupported && (
          <section className="p-5 rounded-2xl bg-card border border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <BellRing className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">התראות Push</h2>
                  <p className="text-xs text-muted-foreground">קבל התראות בזמן אמת</p>
                </div>
              </div>
              {permission === 'denied' ? (
                <span className="text-xs text-destructive font-medium">חסום</span>
              ) : (
                <div dir="ltr">
                  <Switch
                    checked={isSubscribed}
                    disabled={pushLoading}
                    onCheckedChange={(checked) => checked ? subscribe() : unsubscribe()}
                  />
                </div>
              )}
            </div>
            {permission === 'denied' && (
              <p className="text-xs text-muted-foreground">ההתראות חסומות. יש לאפשר אותן בהגדרות הדפדפן.</p>
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
            <button
              onClick={() => navigate('/notification-settings')}
              className="flex items-center justify-between w-full text-sm text-primary hover:underline pt-1"
            >
              <span className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                הגדרות התראות מתקדמות
              </span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </section>
        )}

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
            <Button variant="outline" size="sm" onClick={() => navigate('/family')} className="gap-2 mt-1">
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
