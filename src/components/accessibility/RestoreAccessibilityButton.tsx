import { Accessibility } from 'lucide-react';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { cn } from '@/lib/utils';

export function RestoreAccessibilityButton() {
  const { isHidden, showAccessibility } = useAccessibility();

  if (!isHidden) {
    return null;
  }

  return (
    <button
      onClick={showAccessibility}
      className={cn(
        "fixed bottom-2 left-2 z-[9999]",
        "min-w-[44px] min-h-[44px] w-8 h-8",
        "flex items-center justify-center",
        "rounded-full",
        "bg-muted/80 text-muted-foreground",
        "border border-border/50",
        "opacity-30 hover:opacity-100",
        "transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:opacity-100"
      )}
      aria-label="הצג פקדי נגישות"
      title="הצג פקדי נגישות"
    >
      <Accessibility className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}
