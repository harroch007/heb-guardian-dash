import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DemoBanner } from "@/components/DemoBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, MessageSquare, Brain, Bell, User, Calendar } from "lucide-react";
import { DEMO_DAILY_METRICS } from "@/data/demoData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Timezone-safe helper for Israel time
const getIsraelISO = (offsetDays: number): string => {
  const now = new Date();
  const israelNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  israelNow.setDate(israelNow.getDate() + offsetDays);
  return israelNow.toISOString().split("T")[0];
};

// Generate date options for the last 7 days
const getDateOptions = () => {
  const labels = ["אתמול", "לפני יומיים", "לפני 3 ימים", "לפני 4 ימים", "לפני 5 ימים", "לפני 6 ימים", "לפני שבוע"];
  
  return labels.map((label, index) => {
    const date = getIsraelISO(-(index + 1));
    const formatted = new Date(date).toLocaleDateString('he-IL');
    return {
      value: date,
      label: `${label} (${formatted})`
    };
  });
};

const DemoDailyReport = () => {
  const navigate = useNavigate();
  const { childId } = useParams<{ childId: string }>();

  const dateOptions = getDateOptions();
  const [selectedDate, setSelectedDate] = useState<string>(getIsraelISO(-1));
  const metrics = DEMO_DAILY_METRICS;

  // No child guard
  if (!childId) {
    return (
      <DashboardLayout>
        <DemoBanner />
        <div className="max-w-2xl mx-auto p-8 text-center" dir="rtl">
          <p className="text-muted-foreground">לא נבחר ילד</p>
          <Button onClick={() => navigate("/dashboard")} className="mt-4">
            חזרה לדשבורד
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DemoBanner />
      <div className="max-w-2xl mx-auto relative" dir="rtl">
        {/* Back button - absolute top-right */}
        <button 
          onClick={() => navigate(-1)}
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

        {/* Date Selector */}
        <div className="flex items-center justify-center mb-6">
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="w-auto min-w-[200px]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <SelectValue placeholder="בחר תאריך" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-background border">
              {dateOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-6">
          {/* Section A: Status Today */}
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">סטטוס היום</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="font-medium text-foreground">היום עבר בצורה תקינה</p>
                <p className="text-sm text-muted-foreground">קיפי לא זיהה מצבים שדורשים התערבות הורית</p>
              </div>
            </CardContent>
          </Card>

          {/* Section B: Key Metrics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">נתונים מרכזיים</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-primary" />
                <span className="text-foreground">
                  הודעות שנסרקו היום: <span className="font-bold">{metrics.messages_scanned}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-primary" />
                <span className="text-foreground">
                  פעמים שנשלח ל-AI: <span className="font-bold">{metrics.stacks_sent_to_ai}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-primary" />
                <span className="text-foreground">
                  התרעות שנשלחו להורה: <span className="font-bold">{metrics.alerts_sent}</span>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Section C: Top Contacts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">3 אנשי הקשר הפעילים היום</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-foreground">דניאל כהן — 050-1234567</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-foreground">052-9876543</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-foreground">מיכל לוי — 054-5555555</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Section D: Positive Insights */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">תובנות חיוביות</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 list-disc list-inside text-foreground">
                <li>שיחות עם חברים קרובים בטון חיובי</li>
                <li>שימוש מאוזן במסכים לאורך היום</li>
                <li>תקשורת פתוחה ובריאה</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DemoDailyReport;
