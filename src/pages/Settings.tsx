import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Settings, Database, Bell, Shield, Moon, Sun, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SettingsPage = () => {
  const [supabaseUrl, setSupabaseUrl] = useState(import.meta.env.VITE_SUPABASE_URL || '');
  const [supabaseKey, setSupabaseKey] = useState(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  const [notifications, setNotifications] = useState(true);
  const [highRiskOnly, setHighRiskOnly] = useState(false);

  const handleSave = () => {
    toast({
      title: "ההגדרות נשמרו",
      description: "השינויים יחולו לאחר רענון הדף",
    });
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 glow-primary">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground text-glow">
            הגדרות
          </h1>
        </div>
        <p className="text-muted-foreground">ניהול הגדרות המערכת והתחברות</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Database Connection */}
        <section className="p-6 rounded-xl bg-card border border-border/50 cyber-border animate-fade-in opacity-0" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">חיבור לבסיס נתונים</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            הגדר את פרטי ההתחברות ל-Supabase שלך
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Supabase URL
              </label>
              <input
                type="url"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Supabase Anon Key
              </label>
              <input
                type="password"
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                placeholder="your-anon-key"
                className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                dir="ltr"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              💡 הגדר משתני סביבה VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY בפרויקט שלך
            </p>
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

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="w-full py-3 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all glow-primary flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          שמור הגדרות
        </button>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
