import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Bell, Shield, HelpCircle, LogOut, ChevronLeft, FileText, MessageCircle, Bug, Lightbulb, BellRing, Send, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SettingsAlertPreview } from "@/components/SettingsAlertPreview";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WHATSAPP_NUMBER = "972548383340";

const SettingsPage = () => {
  const navigate = useNavigate();
  const [isSendingTest, setIsSendingTest] = useState(false);
  const { isSupported, isSubscribed, isLoading: pushLoading, permission, subscribe, unsubscribe } = usePushNotifications();
  const { signOut, user } = useAuth();

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
          url: '/settings'
        }
      });
      
      if (error) throw error;
      toast.success('התראת בדיקה נשלחה בהצלחה');
    } catch (error) {
      console.error('Failed to send test notification:', error);
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

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          הגדרות
        </h1>
        <p className="text-muted-foreground">שליטה, פרטיות ותמיכה</p>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Card 1: התראות */}
        <section className="p-6 rounded-xl bg-card border border-border/50">
          <div 
            onClick={() => navigate('/alerts')}
            className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-warning" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">התראות</h2>
                <p className="text-sm text-muted-foreground">כללים, תדירות וסוגי התרעות</p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </div>
          
          {/* Alerts Preview */}
          <div className="mt-4 pt-4 border-t border-border/30">
            <SettingsAlertPreview 
              alerts={[]}
              onViewAll={() => navigate('/alerts')}
            />
          </div>
        </section>

        {/* Card 2: Push Notifications */}
        {isSupported && (
          <section className="p-6 rounded-xl bg-card border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BellRing className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">התראות Push</h2>
                  <p className="text-sm text-muted-foreground">
                    קבל התראות בזמן אמת גם כשהאפליקציה סגורה
                  </p>
                </div>
              </div>
              {permission === 'denied' ? (
                <span className="text-xs text-destructive">חסום בדפדפן</span>
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
              <p className="mt-3 text-xs text-muted-foreground">
                ההתראות חסומות. יש לאפשר אותן בהגדרות הדפדפן.
              </p>
            )}
            {isSubscribed && (
              <div className="mt-4 pt-4 border-t border-border/30">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestNotification}
                  disabled={isSendingTest}
                  className="gap-2"
                >
                  {isSendingTest ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  שלח התראת בדיקה
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Card 3: פרטיות ושקיפות */}
        <section className="p-6 rounded-xl bg-card border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-success" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">פרטיות ושקיפות</h2>
              <p className="text-sm text-muted-foreground">מדיניות הפרטיות ותנאי השימוש שלנו</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/privacy')}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              מדיניות פרטיות
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/terms')}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              תנאי שימוש
            </Button>
          </div>
        </section>

        {/* Card 3: עזרה ותמיכה */}
        <section className="p-6 rounded-xl bg-card border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <HelpCircle className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">עזרה ותמיכה</h2>
              <p className="text-sm text-muted-foreground">יש שאלה? אנחנו כאן בשבילכם</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => openWhatsApp()}
              className="gap-2 border-green-500/30 text-green-600 hover:bg-green-500/10 hover:text-green-600"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => openWhatsApp("היי, אני רוצה לדווח על תקלה באפליקציה:\n\n")}
              className="gap-2"
            >
              <Bug className="w-4 h-4" />
              דווח על תקלה
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => openWhatsApp("היי, יש לי הצעה לשיפור:\n\n")}
              className="gap-2"
            >
              <Lightbulb className="w-4 h-4" />
              הצעה לשיפור
            </Button>
          </div>
        </section>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full py-3 px-6 rounded-lg bg-destructive/10 text-destructive font-medium hover:bg-destructive/20 transition-all border border-destructive/20 flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          התנתקות
        </button>

        {/* Version Footer */}
        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground">
            גרסה 1.0.1 • עודכן לאחרונה 04/01/26
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
