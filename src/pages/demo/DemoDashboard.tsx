import { useState } from "react";
import { RefreshCw, BarChart3, Brain, Users, Smartphone, TrendingUp, MapPin, Battery, Clock, Mail, Bot, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DemoBanner } from "@/components/DemoBanner";
import { toast } from "sonner";
import {
  DEMO_PARENT,
  DEMO_CHILDREN,
  DEMO_DAILY_STATS,
  DEMO_AI_INSIGHTS,
  DEMO_TOP_FRIENDS,
  DEMO_TOP_APPS,
  DEMO_DAILY_CONTEXT,
  DEMO_DEVICE_STATUS,
} from "@/data/demoData";

const DemoDashboard = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const child = DEMO_CHILDREN[0]; // רואי

  const handleRefresh = () => {
    setIsRefreshing(true);
    toast.success("הנתונים עודכנו");
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <DashboardLayout>
      <DemoBanner />
      
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">תמונת מצב יומית</h1>
            <p className="text-sm text-muted-foreground">
              {DEMO_PARENT.name} · הורה | {child.name} · ילד
            </p>
            <p className="text-xs text-muted-foreground">
              עודכן לאחרונה: {DEMO_DAILY_STATS.last_updated}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            רענון
          </Button>
        </div>

        {/* Card 1 - Digital Activity */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              פעילות דיגיטלית
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold text-foreground">{DEMO_DAILY_STATS.messages_scanned}</div>
                <div className="text-xs text-muted-foreground">הודעות נסרקו</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold text-foreground">{DEMO_DAILY_STATS.messages_sent_to_ai}</div>
                <div className="text-xs text-muted-foreground">הועברו לניתוח AI</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold text-foreground">{DEMO_DAILY_STATS.alerts_sent}</div>
                <div className="text-xs text-muted-foreground">התראה נשלחה</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center pt-2 border-t border-border">
              {DEMO_DAILY_STATS.context_message}
            </p>
          </CardContent>
        </Card>

        {/* Card 2 - AI Insights */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Brain className="h-5 w-5 text-muted-foreground" />
              תובנות AI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {DEMO_AI_INSIGHTS.map((insight, index) => (
                <li key={index} className="flex gap-3 text-sm text-foreground">
                  <span className="text-muted-foreground">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Card 3 - Top Friends */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5 text-muted-foreground" />
              הקשרים הפעילים ביותר היום
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              {DEMO_TOP_FRIENDS.map((friend, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 rounded-full bg-muted text-sm font-medium text-foreground"
                >
                  {friend}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              אלו החברים איתם התקיימה מרבית האינטראקציה היום.
            </p>
          </CardContent>
        </Card>

        {/* Card 4 - App Usage */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              האפליקציות המרכזיות היום
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {DEMO_TOP_APPS.map((app, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="font-medium text-foreground">{app.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{app.usage}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Card 5 - Daily Context */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              הקשר יומי
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{DEMO_DAILY_CONTEXT}</p>
          </CardContent>
        </Card>

        {/* Card 6 - Device Status */}
        <Card className="bg-muted/30 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              מצב המכשיר
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">מיקום אחרון: {DEMO_DEVICE_STATUS.location}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Battery className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">סוללה: {DEMO_DEVICE_STATUS.battery}%</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">עדכון אחרון: {DEMO_DEVICE_STATUS.last_update}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              הנתונים משקפים את המצב האחרון שדווח מהמכשיר.
            </p>
          </CardContent>
        </Card>

        {/* Bottom CTA */}
        <div className="flex justify-center pt-4 pb-8">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            רענון נתונים
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DemoDashboard;
