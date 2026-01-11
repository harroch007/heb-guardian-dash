import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Users, Bell, Shield, HelpCircle, LogOut, ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
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
        <section 
          onClick={() => navigate('/alerts')}
          className="p-6 rounded-xl bg-card border border-border/50 cursor-pointer hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-warning" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">התראות</h2>
                <p className="text-sm text-muted-foreground">כללים, תדירות וסוגי התרעות</p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
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
          {/* TODO(DATA): Privacy details content */}
          <p className="text-xs text-muted-foreground mt-4 border-t border-border/50 pt-3">
            פרטים מלאים יופיעו כאן*
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
            {/* TODO(DATA): No messaging handler */}
            <Button variant="outline" size="sm" disabled>
              שלחו הודעה*
            </Button>
            {/* TODO(DATA): No bug report handler */}
            <Button variant="outline" size="sm" disabled>
              דווח על תקלה*
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
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
