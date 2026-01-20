import { useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Bookmark, Check, Users, MessageSquare, FileText, Lightbulb } from "lucide-react";
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
  parent_message: string | null;
  suggested_action: string | null;
  category: string | null;
  ai_risk_score: number | null;
  ai_verdict: string | null;
  ai_summary: string | null;
  ai_recommendation: string | null;
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
}

const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const alertTime = new Date(timestamp);
  const diffMs = now.getTime() - alertTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'עכשיו';
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  return alertTime.toLocaleDateString('he-IL');
};

const SWIPE_THRESHOLD = 80;

export function AlertCardStack({ alerts, onAcknowledge, onSave, isSavedView = false }: AlertCardStackProps) {
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

  return (
    <div className="flex flex-col justify-center min-h-[calc(100vh-200px)] sm:min-h-0" dir="rtl">
      {/* Card Stack Container */}
      <div className="relative h-[720px] sm:h-[520px]">
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
                {/* Header with save button */}
                <div className="flex items-center justify-between p-4 border-b border-border/30">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {currentAlert.chat_type === 'group' ? (
                      <Users className="w-4 h-4" />
                    ) : (
                      <MessageSquare className="w-4 h-4" />
                    )}
                    <span className="text-sm">
                      {currentAlert.chat_type === 'group' ? 'קבוצה' : 'שיחה פרטית'}
                    </span>
                    <span className="text-xs">•</span>
                    <span className="text-xs">{formatTimeAgo(currentAlert.created_at)}</span>
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

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Chat/Contact name */}
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {currentAlert.chat_name || currentAlert.sender_display || 'התראה'}
                    </h2>
                    {currentAlert.child_name && (
                      <p className="text-sm text-muted-foreground">
                        מהמכשיר של {currentAlert.child_name}
                      </p>
                    )}
                  </div>

                  {/* AI Summary */}
                  {currentAlert.ai_summary && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-primary">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm font-medium">סיכום AI</span>
                      </div>
                      <p className="text-foreground/90 text-sm leading-relaxed">
                        {currentAlert.ai_summary}
                      </p>
                    </div>
                  )}

                  {/* AI Recommendation */}
                  {currentAlert.ai_recommendation && (
                    <div className="bg-primary/10 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-primary">
                        <Lightbulb className="w-4 h-4" />
                        <span className="text-sm font-medium">המלצה</span>
                      </div>
                      <p className="text-foreground/90 text-sm leading-relaxed">
                        {currentAlert.ai_recommendation}
                      </p>
                    </div>
                  )}

                  {/* Original message preview */}
                  {currentAlert.parent_message && !currentAlert.ai_summary && (
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">תוכן ההודעה:</span>
                      <p className="text-foreground/90 text-sm leading-relaxed bg-muted/30 rounded-lg p-3">
                        {currentAlert.parent_message}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer with acknowledge button */}
                <div className="p-4 border-t border-border/30 space-y-3">
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
