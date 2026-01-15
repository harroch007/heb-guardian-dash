import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Users, Lightbulb, Heart, Bookmark } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { DEMO_SINGLE_ALERT, DEMO_CHILDREN } from "@/data/demoData";

const DemoAlerts = () => {
  const [acknowledged, setAcknowledged] = useState(false);
  const child = DEMO_CHILDREN[0]; // רואי

  const handleAcknowledge = () => {
    setAcknowledged(true);
    toast({
      title: "תודה",
      description: "ההתראה נשמרה",
    });
  };

  const handleRemind = () => {
    toast({
      title: "נשמר",
      description: "נזכיר לך לעקוב בהמשך",
    });
  };

  if (acknowledged) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto px-4 py-12 text-center" dir="rtl">
          <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Heart className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            אין התראות נוספות כרגע
          </h2>
          <p className="text-muted-foreground">
            כשמשהו ידרוש תשומת לב — תראה את זה כאן
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6" dir="rtl">
        {/* Screen Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            התראה שדורשת תשומת לב
          </h1>
          <p className="text-sm text-muted-foreground">
            הסבר מפורט על אירוע שזוהה היום בפעילות של {child.name}
          </p>
        </div>

        {/* Single Alert Card */}
        <Card className="border-warning/30 bg-card">
          {/* Card Header */}
          <div className="p-6 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-warning/20 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {DEMO_SINGLE_ALERT.title}
            </h2>
          </div>

          <CardContent className="space-y-6 pt-0">
            {/* Main Insight */}
            <div className="space-y-2">
              <p className="text-foreground leading-relaxed whitespace-pre-line">
                {DEMO_SINGLE_ALERT.mainInsight}
              </p>
            </div>

            {/* Social Context Section */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">הקשר חברתי</span>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">משתתפים מרכזיים: </span>
                  {DEMO_SINGLE_ALERT.socialContext.participants.join("، ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {DEMO_SINGLE_ALERT.socialContext.note}
                </p>
              </div>
            </div>

            {/* Pattern & Depth Insight */}
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {DEMO_SINGLE_ALERT.patternInsight}
              </p>
              
              {/* Meaning Block */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      מה המשמעות?
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {DEMO_SINGLE_ALERT.meaning}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Parental Framing */}
            <div className="border-t border-border pt-4">
              <p className="text-sm text-foreground/80 italic leading-relaxed">
                {DEMO_SINGLE_ALERT.parentalGuidance}
              </p>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button 
                onClick={handleAcknowledge}
                className="flex-1"
              >
                הבנתי, תודה
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemind}
                className="text-muted-foreground hover:text-foreground"
              >
                <Bookmark className="w-4 h-4 ml-1" />
                לזכור ולעקוב בהמשך
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DemoAlerts;
