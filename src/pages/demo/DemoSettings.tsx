import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DemoBanner } from "@/components/DemoBanner";
import { useDemo } from "@/contexts/DemoContext";
import { Bell, Shield, HelpCircle, LogOut, ChevronLeft, FileText, MessageCircle, Bug, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsAlertPreview } from "@/components/SettingsAlertPreview";
import { DEMO_ALERTS } from "@/data/demoData";

const WHATSAPP_NUMBER = "972548383340";

const DemoSettings = () => {
  const navigate = useNavigate();
  const { exitDemoMode } = useDemo();

  const handleExitDemo = () => {
    exitDemoMode();
    navigate('/');
  };

  const openWhatsApp = (message?: string) => {
    const baseUrl = `https://wa.me/${WHATSAPP_NUMBER}`;
    const url = message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
    window.open(url, '_blank');
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
        {/* Card 1: התראות */}
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

        {/* Card 2: פרטיות ושקיפות */}
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
              onClick={() => navigate('/privacy-policy')}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              מדיניות פרטיות
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/terms-of-service')}
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

        {/* Exit Demo Mode */}
        <button
          onClick={handleExitDemo}
          className="w-full py-3 px-6 rounded-lg bg-warning/10 text-warning font-medium hover:bg-warning/20 transition-all border border-warning/20 flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          יציאה ממצב הדגמה
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

export default DemoSettings;
