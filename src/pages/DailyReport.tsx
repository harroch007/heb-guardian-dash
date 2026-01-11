import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, CheckCircle2, MessageSquare, Brain, Bell, User } from "lucide-react";

const DailyReport = () => {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto relative" dir="rtl">
        {/* Back button - absolute top-right */}
        <button 
          onClick={() => navigate("/dashboard")}
          className="absolute top-4 right-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה
        </button>

        {/* Page Title */}
        <div className="mb-8 text-center pt-12">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            הדוח היומי
          </h1>
          <p className="text-muted-foreground">
            סיכום פעילות ל-24 השעות האחרונות
          </p>
        </div>

        <div className="space-y-6">
          {/* TODO(DATA): daily_status_summary - replace statusSummary with real data */}
          {/* Section A: Status Today */}
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">סטטוס היום*</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="font-medium text-foreground">היום עבר בצורה תקינה*</p>
                <p className="text-sm text-muted-foreground">קיפי לא זיהה מצבים שדורשים התערבות הורית*</p>
              </div>
            </CardContent>
          </Card>

          {/* TODO(DATA): daily_scanned_messages_count, daily_ai_requests_count, daily_parent_alerts_count */}
          {/* Section B: Key Metrics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">נתונים מרכזיים</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-primary" />
                <span className="text-foreground">הודעות שנסרקו היום*: <span className="font-bold">142*</span></span>
              </div>
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-primary" />
                <span className="text-foreground">פעמים שנשלח ל-AI*: <span className="font-bold">8*</span></span>
              </div>
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-primary" />
                <span className="text-foreground">התרעות שנשלחו להורה*: <span className="font-bold">1*</span></span>
              </div>
            </CardContent>
          </Card>

          {/* TODO(DATA): daily_top_contacts - must return name and/or phone */}
          {/* Section C: Top Contacts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">3 אנשי הקשר הפעילים היום*</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-foreground">דניאל כהן — 050-1234567*</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-foreground">052-9876543*</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-foreground">מיכל לוי — 054-5555555*</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* TODO(DATA): daily_positive_insights - replace with real data */}
          {/* Section D: Positive Insights */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">תובנות חיוביות*</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 list-disc list-inside text-foreground">
                <li>שיחות עם חברים קרובים בטון חיובי*</li>
                <li>שימוש מאוזן במסכים לאורך היום*</li>
                <li>תקשורת פתוחה ובריאה*</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DailyReport;
