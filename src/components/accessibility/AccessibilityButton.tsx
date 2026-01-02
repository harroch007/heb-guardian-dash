import { PersonStanding } from "lucide-react";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";

export function AccessibilityButton() {
  const { isHidden, openPanel } = useAccessibility();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [offsetBottom, setOffsetBottom] = useState(96); // default 24 * 4 = 96px (bottom-24)

  const checkCollision = useCallback(() => {
    if (!buttonRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Find elements that might overlap (bottom nav, other fixed controls)
    const fixedElements = document.querySelectorAll(
      'nav[class*="fixed"][class*="bottom-0"], [class*="fixed"][class*="bottom-"]'
    );

    let maxObstacleHeight = 0;

    fixedElements.forEach((el) => {
      if (el === buttonRef.current) return;
      const rect = el.getBoundingClientRect();
      // Check if element is at the bottom of viewport
      if (rect.bottom >= viewportHeight - 10) {
        maxObstacleHeight = Math.max(maxObstacleHeight, viewportHeight - rect.top);
      }
    });

    // Position button above obstacles with padding
    const newOffset = Math.max(96, maxObstacleHeight + 16 + 48); // obstacle + padding + button size
    setOffsetBottom(newOffset);
  }, []);

  useEffect(() => {
    checkCollision();
    window.addEventListener("resize", checkCollision);
    // Recheck after DOM might have changed
    const timeout = setTimeout(checkCollision, 100);
    return () => {
      window.removeEventListener("resize", checkCollision);
      clearTimeout(timeout);
    };
  }, [checkCollision]);

  if (isHidden) {
    return null;
  }

  return (
    <button
      ref={buttonRef}
      onClick={openPanel}
      style={{ bottom: `${offsetBottom}px` }}
      className={cn(
        "fixed left-4 z-[9999]",
        "min-w-[44px] min-h-[44px] w-12 h-12",
        "flex items-center justify-center",
        "rounded-full",
        "bg-primary text-primary-foreground",
        "shadow-lg hover:shadow-xl",
        "transition-all duration-200",
        "hover:scale-105",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
      )}
      aria-label="הגדרות נגישות"
      title="הגדרות נגישות"
    >
      <PersonStanding className="w-6 h-6" aria-hidden="true" />
    </button>
  );
}
