import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { User, Bell, Shield, FileText, LogOut, ChevronLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [notifications, setNotifications] = useState(true);
  const [highRiskOnly, setHighRiskOnly] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('parents')
          .select('full_name, email, phone')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setFullName(data.full_name || '');
          setEmail(data.email || user.email || '');
          setPhone(data.phone || '');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('parents')
        .update({ full_name: fullName, phone })
        .eq('id', user.id);
      
      if (error) throw error;
      
      toast({
        title: "הפרופיל עודכן",
        description: "הפרטים נשמרו בהצלחה",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "שגיאה",
        description: "לא הצלחנו לעדכן את הפרופיל",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 glow-primary">
            <User className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground text-glow">
            הגדרות
          </h1>
        </div>
        <p className="text-muted-foreground">ניהול פרופיל והעדפות</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <section className="p-6 rounded-xl bg-card border border-border/50 cyber-border animate-fade-in opacity-0" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">פרופיל</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                שם מלא
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="השם שלך"
                className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                אימייל
              </label>
              <input
                type="email"
                value={email}
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-muted-foreground cursor-not-allowed"
                disabled
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground mt-1">
                לא ניתן לשנות את כתובת האימייל
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                טלפון
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
                className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                dir="ltr"
                disabled={isLoading}
              />
            </div>

            <button
              onClick={handleUpdateProfile}
              disabled={isSaving || isLoading}
              className="w-full py-3 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'שומר...' : 'עדכן פרופיל'}
            </button>
          </div>
        </section>

        {/* Notifications */}
        <section className="p-6 rounded-xl bg-card border border-border/50 cyber-border animate-fade-in opacity-0" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-semibold text-foreground">התראות</h2>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <p className="font-medium text-foreground">הפעל התראות</p>
                <p className="text-sm text-muted-foreground">קבל התראות בזמן אמת</p>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`relative w-12 h-6 rounded-full transition-all ${
                  notifications ? 'bg-primary glow-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-foreground transition-all ${
                    notifications ? 'right-1' : 'right-7'
                  }`}
                />
              </button>
            </label>

            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <p className="font-medium text-foreground">סיכון גבוה בלבד</p>
                <p className="text-sm text-muted-foreground">קבל רק התראות בסיכון גבוה</p>
              </div>
              <button
                onClick={() => setHighRiskOnly(!highRiskOnly)}
                className={`relative w-12 h-6 rounded-full transition-all ${
                  highRiskOnly ? 'bg-destructive glow-destructive' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-foreground transition-all ${
                    highRiskOnly ? 'right-1' : 'right-7'
                  }`}
                />
              </button>
            </label>
          </div>
        </section>

        {/* Security */}
        <section className="p-6 rounded-xl bg-card border border-border/50 cyber-border animate-fade-in opacity-0" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-success" />
            <h2 className="text-lg font-semibold text-foreground">אבטחה</h2>
          </div>

          <div className="p-4 rounded-lg bg-success/5 border border-success/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <p className="font-medium text-success">המערכת מאובטחת</p>
            </div>
            <p className="text-sm text-muted-foreground">
              כל התקשורת מוצפנת באמצעות SSL/TLS
            </p>
          </div>
        </section>

        {/* Legal */}
        <section className="p-6 rounded-xl bg-card border border-border/50 cyber-border animate-fade-in opacity-0" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">משפטי</h2>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => navigate('/privacy')}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-all group"
            >
              <span className="text-foreground">מדיניות פרטיות</span>
              <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
            <button
              onClick={() => navigate('/terms')}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-all group"
            >
              <span className="text-foreground">תנאי שימוש</span>
              <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
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
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
