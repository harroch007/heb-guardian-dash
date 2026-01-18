import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DemoBanner } from "@/components/DemoBanner";
import { useDemo } from "@/contexts/DemoContext";
import { Users, Bell, Shield, HelpCircle, LogOut, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsAlertPreview } from "@/components/SettingsAlertPreview";
import { DEMO_ALERTS } from "@/data/demoData";

const DemoSettings = () => {
  const navigate = useNavigate();
  const { exitDemoMode } = useDemo();

  const handleExitDemo = () => {
    exitDemoMode();
    navigate('/');
  };

  return (
    <DashboardLayout>
      <DemoBanner />
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          הגדרות
        </h1>
        <p className="text-muted-foreground">שליטה, פרטיות ותמיכה</p>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Card 1: פרטי המשפחה */}
        <section 
          onClick={() => navigate('/family')}
          className="p-6 rounded-xl bg-card border border-border/50 cursor-pointer hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">פרטי המשפחה</h2>
                <p className="text-sm text-muted-foreground">ניהול ילדים, חיבורי מכשירים והרשאות</p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </div>
        </section>

        {/* Card 2: התראות */}
        <section className="p-6 rounded-xl bg-card border border-border/50">
          <div 
            onClick={() => navigate('/demo/alerts')}
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
              alerts={DEMO_ALERTS}
              onViewAll={() => navigate('/demo/alerts')}
            />
          </div>
        </section>

        {/* Card 3: פרטיות ושקיפות */}
        <section className="p-6 rounded-xl bg-card border border-border/50">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-5 h-5 text-success" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">פרטיות ושקיפות</h2>
              <p className="text-sm text-muted-foreground">מה נאסף, מתי נשלח ל-AI, ומה נשמר</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 border-t border-border/50 pt-3">
            פרטים מלאים יופיעו כאן
          </p>
        </section>

        {/* Card 4: עזרה ותמיכה */}
        <section className="p-6 rounded-xl bg-card border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <HelpCircle className="w-5 h-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">עזרה ותמיכה</h2>
              <p className="text-sm text-muted-foreground">שאלות נפוצות, יצירת קשר ודיווח בעיה</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" disabled>
              שלחו הודעה
            </Button>
            <Button variant="outline" size="sm" disabled>
              דווח על תקלה
            </Button>
          </div>
        </section>

        {/* Exit Demo Mode */}
        <button
          onClick={handleExitDemo}
          className="w-full py-3 px-6 rounded-lg bg-warning/10 text-warning font-medium hover:bg-warning/20 transition-all border border-warning/20 flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          יציאה ממצב הדגמה
        </button>
      </div>
    </DashboardLayout>
  );
};

export default DemoSettings;
