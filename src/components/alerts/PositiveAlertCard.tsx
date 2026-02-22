import { useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Star, Check, Clock, User, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Alert {
  id: number;
  child_id: string | null;
  child_name?: string;
  sender: string | null;
  sender_display: string | null;
  chat_name: string | null;
  chat_type: string | null;
  ai_summary: string | null;
  ai_recommendation: string | null;
  ai_title: string | null;
  category: string | null;
  created_at: string;
}

interface PositiveAlertCardProps {
  alerts: Alert[];
  onAcknowledge: (id: number) => void;
}

const SWIPE_THRESHOLD = 80;

const positiveTypeLabels: Record<string, string> = {
  empathy: 'אמפתיה',
  leadership: 'מנהיגות',
  maturity: 'בגרות',
  helpfulness: 'עזרה לזולת',
  defense: 'הגנה על אחרים',
  expression: 'ביטוי יפה',
};

function formatIsraelTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  
  const israelFormatter = new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const time = israelFormatter.format(date);
  
  const israelDate = new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const todayStr = israelDate.format(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = israelDate.format(yesterday);
  const alertDateStr = israelDate.format(date);
  
  const ltr = '\u202A';
  const pop = '\u202C';
  
  if (alertDateStr === todayStr) {
    return `היום ב-${ltr}${time}${pop}`;
  } else if (alertDateStr === yesterdayStr) {
    return `אתמול ב-${ltr}${time}${pop}`;
  } else {
    const shortDate = new Intl.DateTimeFormat('he-IL', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit',
      month: '2-digit',
    }).format(date);
    return `${ltr}${shortDate}${pop} ב-${ltr}${time}${pop}`;
  }
}

export function PositiveAlertCard({ alerts, onAcknowledge }: PositiveAlertCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState<'up' | null>(null);

  const currentAlert = alerts[currentIndex];

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset } = info;
    if (offset.x < -SWIPE_THRESHOLD && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else if (offset.x > SWIPE_THRESHOLD && currentIndex < alerts.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleAcknowledge = () => {
    if (!currentAlert) return;
    setExitDirection('up');
    setTimeout(() => {
      onAcknowledge(currentAlert.id);
      setExitDirection(null);
      if (currentIndex >= alerts.length - 1 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    }, 300);
  };

  if (alerts.length === 0 || !currentAlert) return null;

  return (
    <div className="flex flex-col" dir="rtl">
      <div className="relative min-h-0">
        {alerts.slice(currentIndex + 1, currentIndex + 3).map((_, idx) => (
          <div
            key={`bg-${idx}`}
            className="absolute inset-0 rounded-2xl bg-card/60 border border-border/30"
            style={{
              transform: `translateY(${(idx + 1) * 8}px) scale(${1 - (idx + 1) * 0.03})`,
              opacity: 1 - (idx + 1) * 0.2,
              zIndex: -idx - 1,
            }}
          />
        ))}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentAlert.id}
            className="relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ 
              opacity: exitDirection ? 0 : 1, 
              scale: exitDirection ? 0.9 : 1,
              y: exitDirection === 'up' ? -100 : 0,
            }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
          >
            <Card className="bg-card/95 backdrop-blur-sm border border-success/30 shadow-xl overflow-hidden">
              <CardContent className="p-0 flex flex-col">
                {/* Header - warm green */}
                <div className="flex items-center justify-between p-4 border-b border-success/20 bg-success/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-success/20">
                      <Star className="w-5 h-5 text-success fill-success" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground leading-tight">
                        {currentAlert.ai_title || 'התנהגות חיובית!'}
                      </h2>
                      {currentAlert.child_name && (
                        <p className="text-sm text-muted-foreground">
                          מהמכשיר של {currentAlert.child_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <Sparkles className="w-5 h-5 text-success/60" />
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b border-border/30 text-sm text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatIsraelTime(currentAlert.created_at)}</span>
                  </div>
                  {currentAlert.chat_name && (
                    <div className="flex items-center gap-1.5">
                      {currentAlert.chat_type === 'GROUP' ? (
                        <Users className="w-3.5 h-3.5" />
                      ) : (
                        <User className="w-3.5 h-3.5" />
                      )}
                      <span>{currentAlert.chat_name}</span>
                    </div>
                  )}
                  {currentAlert.category && positiveTypeLabels[currentAlert.category] && (
                    <span className="bg-success/15 text-success text-xs px-2 py-0.5 rounded-full font-medium">
                      {positiveTypeLabels[currentAlert.category]}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                  {currentAlert.ai_summary && (
                    <p className="text-success font-medium text-base leading-relaxed">
                      {currentAlert.ai_summary}
                    </p>
                  )}

                  {currentAlert.ai_recommendation && (
                    <div className="bg-success/10 rounded-xl p-4 border border-success/20">
                      <p className="text-foreground/90 text-sm leading-relaxed">
                        💡 {currentAlert.ai_recommendation}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border/30 space-y-3">
                  <Button
                    onClick={handleAcknowledge}
                    className="w-full py-6 text-base font-medium bg-success hover:bg-success/90 text-success-foreground"
                  >
                    <Check className="w-5 h-5 ml-2" />
                    ראיתי, תודה! 🎉
                  </Button>
                  
                  <div className="text-center text-sm text-muted-foreground">
                    {currentIndex + 1} מתוך {alerts.length} רגעים טובים
                    {alerts.length > 1 && (
                      <span className="block text-xs mt-1">
                        ← החלק ימינה להמשך →
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
