import { useEffect, useRef } from 'react';
import { X, Plus, Minus, Eye, ZapOff, Focus, Type, EyeOff, Info, Keyboard } from 'lucide-react';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function AccessibilityPanel() {
  const {
    isPanelOpen,
    closePanel,
    textSizeLevel,
    setTextSizeLevel,
    highContrast,
    toggleHighContrast,
    enhancedFocus,
    toggleEnhancedFocus,
    reduceMotion,
    toggleReduceMotion,
    tripleEscapeEnabled,
    toggleTripleEscape,
    hideAccessibility,
  } = useAccessibility();

  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and Escape to close
  useEffect(() => {
    if (!isPanelOpen) return;

    // Focus the close button when panel opens
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closePanel();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && panelRef.current) {
        const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPanelOpen, closePanel]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isPanelOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isPanelOpen]);

  if (!isPanelOpen) {
    return null;
  }

  const textSizeLabels = ['רגיל', '+10%', '+20%', '+30%', '+40%'];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9998]"
        onClick={closePanel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="accessibility-panel-title"
        className={cn(
          "fixed z-[9999]",
          // Mobile: centered, almost full width with safe margins
          "inset-x-4 bottom-4 sm:inset-auto",
          // Desktop: fixed position from left
          "sm:bottom-4 sm:left-20",
          "w-auto sm:w-[90vw] max-w-md max-h-[70vh]",
          "bg-card border border-border rounded-lg shadow-xl",
          "overflow-hidden flex flex-col",
          "animate-fade-in"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id="accessibility-panel-title" className="text-lg font-semibold text-foreground">
            הגדרות נגישות
          </h2>
          <button
            ref={closeButtonRef}
            onClick={closePanel}
            className={cn(
              "min-w-[44px] min-h-[44px] flex items-center justify-center",
              "rounded-md text-muted-foreground hover:text-foreground hover:bg-muted",
              "transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-ring"
            )}
            aria-label="סגור הגדרות נגישות"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Text Size */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-foreground">
              <Type className="w-5 h-5" aria-hidden="true" />
              <span className="font-medium">גודל טקסט</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTextSizeLevel(textSizeLevel - 1)}
                disabled={textSizeLevel === 0}
                className="min-w-[44px] min-h-[44px]"
                aria-label="הקטן טקסט"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-foreground font-medium min-w-[60px] text-center" aria-live="polite">
                {textSizeLabels[textSizeLevel]}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTextSizeLevel(textSizeLevel + 1)}
                disabled={textSizeLevel === 4}
                className="min-w-[44px] min-h-[44px]"
                aria-label="הגדל טקסט"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* High Contrast */}
          <ToggleControl
            icon={Eye}
            label="ניגודיות גבוהה"
            description="מגביר את הניגודיות בין צבעים"
            checked={highContrast}
            onCheckedChange={toggleHighContrast}
          />

          {/* Enhanced Focus */}
          <ToggleControl
            icon={Focus}
            label="הדגשת פוקוס"
            description="מדגיש אלמנטים בזמן ניווט מקלדת"
            checked={enhancedFocus}
            onCheckedChange={toggleEnhancedFocus}
          />

          {/* Reduce Motion */}
          <ToggleControl
            icon={ZapOff}
            label="הפסק אנימציות"
            description="מבטל תנועות ואנימציות"
            checked={reduceMotion}
            onCheckedChange={toggleReduceMotion}
          />

          {/* Triple Escape Shortcut */}
          <ToggleControl
            icon={Keyboard}
            label="קיצור 3×Escape"
            description="אפשר פתיחה עם 3 לחיצות Escape"
            checked={tripleEscapeEnabled}
            onCheckedChange={toggleTripleEscape}
          />

          {/* Screen Reader Notice */}
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              אתר זה תומך בקוראי מסך ומותאם לתקן נגישות WCAG 2.0 AA
            </p>
          </div>

          {/* Hide Accessibility UI */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full min-h-[44px] gap-2"
              >
                <EyeOff className="w-4 h-4" />
                הסתר פקדי נגישות
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="z-[10000]" dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>הסתר פקדי נגישות?</AlertDialogTitle>
                <AlertDialogDescription>
                  פקדי הנגישות יוסתרו מהמסך. תוכל לשחזר אותם בכל עת דרך כפתור קטן בפינת המסך.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-[44px]">ביטול</AlertDialogCancel>
                <AlertDialogAction onClick={hideAccessibility} className="min-h-[44px]">
                  הסתר
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </>
  );
}

interface ToggleControlProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: () => void;
}

function ToggleControl({ icon: Icon, label, description, checked, onCheckedChange }: ToggleControlProps) {
  const id = `toggle-${label.replace(/\s/g, '-')}`;
  
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <label htmlFor={id} className="font-medium text-foreground cursor-pointer">
            {label}
          </label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="shrink-0"
        dir="ltr"
        aria-describedby={`${id}-description`}
      />
    </div>
  );
}
