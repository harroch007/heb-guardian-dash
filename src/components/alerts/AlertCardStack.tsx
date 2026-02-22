import { useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Bookmark, Check, AlertTriangle, Lightbulb, Link2, Clock, Users, User, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AlertFeedback } from "./AlertFeedback";

interface SocialContext {
  label: string;
  participants: string[];
  description: string;
}

interface Alert {
  id: number;
  child_id: string | null;
  child_name?: string;
  sender: string | null;
  sender_display: string | null;
  chat_name: string | null;
  chat_type: string | null;
  parent_message: string | null;
  suggested_action: string | null;
  category: string | null;
  ai_risk_score: number | null;
  ai_verdict: string | null;
  ai_summary: string | null;
  ai_recommendation: string | null;
  ai_title: string | null;
  ai_context: string | null;
  ai_meaning: string | null;
  ai_social_context: SocialContext | null;
  created_at: string;
  is_processed: boolean;
  acknowledged_at?: string | null;
  remind_at?: string | null;
  saved_at?: string | null;
}

interface AlertCardStackProps {
  alerts: Alert[];
  onAcknowledge: (id: number) => void;
  onSave?: (id: number) => void;
  isSavedView?: boolean;
  parentId?: string | null;
  feedbackMap?: Record<number, 'important' | 'not_relevant'>;
  onFeedbackChange?: (alertId: number, feedback: 'important' | 'not_relevant') => void;
}

const SWIPE_THRESHOLD = 80;

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

const categoryLabels: Record<string, string> = {
  violence: 'אלימות',
  bullying: 'בריונות',
  sexual: 'תוכן מיני',
  drugs: 'סמים',
  self_harm: 'פגיעה עצמית',
  hate: 'שנאה',
  predator: 'טורף',
  profanity: 'גסות',
};

export function AlertCardStack({ alerts, onAcknowledge, onSave, isSavedView = false, parentId, feedbackMap, onFeedbackChange }: AlertCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState<'up' | null>(null);

  const currentAlert = alerts[currentIndex];

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset } = info;
    
    // RTL: right = next (older), left = previous (newer)
    if (offset.x < -SWIPE_THRESHOLD && currentIndex > 0) {
      // Swiped left -> go to previous (newer)
      setCurrentIndex(prev => prev - 1);
    } else if (offset.x > SWIPE_THRESHOLD && currentIndex < alerts.length - 1) {
      // Swiped right -> go to next (older)
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleAcknowledge = () => {
    if (!currentAlert) return;
    setExitDirection('up');
    
    setTimeout(() => {
      onAcknowledge(currentAlert.id);
      setExitDirection(null);
      // Adjust index if needed after removal
      if (currentIndex >= alerts.length - 1 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    }, 300);
  };

  const handleSave = () => {
    if (!currentAlert || !onSave) return;
    onSave(currentAlert.id);
    // Move to next card after saving
    if (currentIndex < alerts.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  if (alerts.length === 0 || !currentAlert) {
    return null;
  }

  // Generate fallback title if ai_title is not available
  const displayTitle = currentAlert.ai_title || 
    (currentAlert.chat_type === 'group' 
      ? `שיחה בקבוצה ${currentAlert.chat_name || ''}`
      : `שיחה פרטית עם ${currentAlert.sender_display || currentAlert.chat_name || 'איש קשר'}`);

  return (
    <div className="flex flex-col justify-center min-h-[calc(100vh-200px)] sm:min-h-0" dir="rtl">
      {/* Card Stack Container */}
      <div className="relative h-[720px] sm:h-[580px]">
        {/* Background cards (depth effect) */}
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

        {/* Main card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentAlert.id}
            className="absolute inset-0"
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
            <Card className="h-full bg-card/95 backdrop-blur-sm border border-border/50 shadow-xl overflow-hidden">
              <CardContent className="p-0 h-full flex flex-col">
                {/* Header with warning icon and title */}
                <div className="flex items-center justify-between p-4 border-b border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-warning/20">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground leading-tight">
                        {displayTitle}
                      </h2>
                      {currentAlert.child_name && (
                        <p className="text-sm text-muted-foreground">
                          מהמכשיר של {currentAlert.child_name}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {!isSavedView && onSave && (
                    <button
                      onClick={handleSave}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        currentAlert.saved_at 
                          ? "bg-primary/20 text-primary" 
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                      aria-label="שמור התראה"
                    >
                      <Bookmark className={cn("w-5 h-5", currentAlert.saved_at && "fill-current")} />
                    </button>
                  )}
                </div>

                {/* Meta-data row */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b border-border/30 text-sm text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatIsraelTime(currentAlert.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {currentAlert.chat_type === 'group' ? (
                      <Users className="w-3.5 h-3.5" />
                    ) : (
                      <User className="w-3.5 h-3.5" />
                    )}
                    <span>{currentAlert.chat_type === 'group' ? 'קבוצה' : 'פרטי'}</span>
                    {currentAlert.chat_name && (
                      <span className="text-foreground/70">• {currentAlert.chat_name}</span>
                    )}
                  </div>
                  {currentAlert.category && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Tag className="w-3 h-3" />
                      {categoryLabels[currentAlert.category] || currentAlert.category}
                    </Badge>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Primary Summary (Cyan) */}
                  {currentAlert.ai_summary && (
                    <p className="text-primary font-medium text-base leading-relaxed">
                      {currentAlert.ai_summary}
                    </p>
                  )}

                  {/* General Context */}
                  {currentAlert.ai_context && (
                    <p className="text-foreground/80 text-sm leading-relaxed">
                      {currentAlert.ai_context}
                    </p>
                  )}

                  {/* Social Context (Groups only) */}
                  {currentAlert.ai_social_context && (
                    <>
                      <Separator className="bg-border/30" />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-muted-foreground" />
                          <Badge variant="secondary" className="text-xs">
                            {currentAlert.ai_social_context.label || "הקשר חברתי"}
                          </Badge>
                        </div>
                        {currentAlert.ai_social_context.participants && 
                         currentAlert.ai_social_context.participants.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">משתתפים מרכזיים: </span>
                            {currentAlert.ai_social_context.participants.join(', ')}
                          </p>
                        )}
                        {currentAlert.ai_social_context.description && (
                          <p className="text-sm text-foreground/70">
                            {currentAlert.ai_social_context.description}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  <Separator className="bg-border/30" />

                  {/* What does it mean? */}
                  {currentAlert.ai_meaning && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-warning" />
                        <span className="text-sm font-medium text-warning">מה המשמעות?</span>
                      </div>
                      <p className="text-foreground/90 text-sm leading-relaxed">
                        {currentAlert.ai_meaning}
                      </p>
                    </div>
                  )}

                  {/* Recommendation */}
                  {currentAlert.ai_recommendation && (
                    <div className="bg-primary/10 rounded-xl p-4">
                      <p className="text-foreground/90 text-sm leading-relaxed">
                        {currentAlert.ai_recommendation}
                      </p>
                    </div>
                  )}

                  {/* Fallback for old alerts without new fields */}
                  {!currentAlert.ai_summary && !currentAlert.ai_context && currentAlert.parent_message && (
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">תוכן ההודעה:</span>
                      <p className="text-foreground/90 text-sm leading-relaxed bg-muted/30 rounded-lg p-3">
                        {currentAlert.parent_message}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer with feedback + acknowledge button */}
                <div className="p-4 border-t border-border/30 space-y-3">
                  {/* Feedback buttons */}
                  <AlertFeedback
                    alertId={currentAlert.id}
                    parentId={parentId || ''}
                    existingFeedback={feedbackMap?.[currentAlert.id] ?? null}
                    onFeedbackChange={onFeedbackChange}
                  />

                  <Button
                    onClick={handleAcknowledge}
                    className="w-full py-6 text-base font-medium bg-primary hover:bg-primary/90"
                  >
                    <Check className="w-5 h-5 ml-2" />
                    הבנתי, תודה
                  </Button>
                  
                  {/* Position indicator */}
                  <div className="text-center text-sm text-muted-foreground">
                    {currentIndex + 1} מתוך {alerts.length} התראות
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