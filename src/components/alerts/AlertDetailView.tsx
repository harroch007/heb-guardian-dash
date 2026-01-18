import { AlertTriangle, Users, Lightbulb, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AlertDetail {
  id: number;
  title?: string;
  chat_name?: string | null;
  sender_display?: string | null;
  parent_message?: string | null;
  mainInsight?: string;
  socialContext?: {
    participants: string[];
    note: string;
  };
  patternInsight?: string;
  meaning?: string;
  parentalGuidance?: string;
  ai_summary?: string | null;
  ai_recommendation?: string | null;
}

interface AlertDetailViewProps {
  alert: AlertDetail;
  onAcknowledge: (id: number) => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

const getTitle = (alert: AlertDetail): string => {
  if (alert.title) return alert.title;
  if (alert.chat_name) return `שיחה עם ${alert.chat_name}`;
  if (alert.sender_display) return `שיחה עם ${alert.sender_display}`;
  return 'התראה שדורשת תשומת לב';
};

const getMainContent = (alert: AlertDetail): string => {
  if (alert.mainInsight) return alert.mainInsight;
  if (alert.ai_summary) return alert.ai_summary;
  if (alert.parent_message) return alert.parent_message;
  return '';
};

export const AlertDetailView = ({ 
  alert, 
  onAcknowledge, 
  onBack, 
  showBackButton = false 
}: AlertDetailViewProps) => {
  const title = getTitle(alert);
  const mainContent = getMainContent(alert);
  const recommendation = alert.parentalGuidance || alert.ai_recommendation;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Back button */}
      {showBackButton && onBack && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground -mr-2"
        >
          <ArrowRight className="w-4 h-4 ml-1" />
          חזרה לרשימה
        </Button>
      )}

      {/* Alert Card */}
      <Card className="border-warning/30 bg-card">
        {/* Card Header */}
        <div className="p-6 pb-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-warning/20 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {title}
          </h2>
        </div>

        <CardContent className="space-y-6 pt-0">
          {/* Main Insight */}
          {mainContent && (
            <div className="space-y-2">
              <p className="text-foreground leading-relaxed whitespace-pre-line">
                {mainContent}
              </p>
            </div>
          )}

          {/* Social Context Section */}
          {alert.socialContext && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">הקשר חברתי</span>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">משתתפים מרכזיים: </span>
                  {alert.socialContext.participants.join("، ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {alert.socialContext.note}
                </p>
              </div>
            </div>
          )}

          {/* Pattern & Depth Insight */}
          {(alert.patternInsight || alert.meaning) && (
            <div className="space-y-3">
              {alert.patternInsight && (
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {alert.patternInsight}
                </p>
              )}
              
              {/* Meaning Block */}
              {alert.meaning && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        מה המשמעות?
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {alert.meaning}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Parental Framing */}
          {recommendation && (
            <div className="border-t border-border pt-4">
              <p className="text-sm text-foreground/80 italic leading-relaxed">
                {recommendation}
              </p>
            </div>
          )}

          {/* Footer Action */}
          <div className="pt-2">
            <Button 
              onClick={() => onAcknowledge(alert.id)}
              className="w-full"
            >
              הבנתי, תודה
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
