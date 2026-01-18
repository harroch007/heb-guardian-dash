import { AlertTriangle, Users, Lightbulb, ArrowRight, FileText, Clock, MessageSquare } from "lucide-react";
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
  chat_type?: string | null;
  created_at?: string;
  ai_risk_score?: number | null;
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

const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'עכשיו';
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'אתמול';
  return `לפני ${diffDays} ימים`;
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

  // Check if we have rich demo-style data or just basic AI data
  const hasRichData = !!(alert.socialContext || alert.patternInsight || alert.meaning);

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
          {/* Main Insight / AI Summary */}
          {mainContent && (
            <div className="space-y-2">
              {!hasRichData && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">סיכום AI</span>
                </div>
              )}
              <p className="text-foreground leading-relaxed whitespace-pre-line">
                {mainContent}
              </p>
            </div>
          )}

          {/* Social Context Section - only for rich data */}
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

          {/* Pattern & Depth Insight - only for rich data */}
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

          {/* Recommendation Block - Enhanced styling for basic data */}
          {recommendation && (
            <div className={hasRichData 
              ? "border-t border-border pt-4" 
              : "bg-primary/5 border border-primary/20 rounded-lg p-4"
            }>
              {hasRichData ? (
                <p className="text-sm text-foreground/80 italic leading-relaxed">
                  {recommendation}
                </p>
              ) : (
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      המלצה
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {recommendation}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Meta Info - for basic data */}
          {!hasRichData && (alert.created_at || alert.chat_type) && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
              {alert.created_at && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeAgo(alert.created_at)}</span>
                </div>
              )}
              {alert.chat_type && (
                <div className="flex items-center gap-1">
                  {alert.chat_type === 'group' ? (
                    <>
                      <Users className="w-3 h-3" />
                      <span>שיחה קבוצתית</span>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-3 h-3" />
                      <span>שיחה פרטית</span>
                    </>
                  )}
                </div>
              )}
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
