import { PersonStanding } from "lucide-react";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

export function AccessibilityButton() {
  const { isHidden, openPanel } = useAccessibility();
  const location = useLocation();
  
  const allowedPaths = ["/", "/dashboard"];
  const isOnAllowedPage = allowedPaths.includes(location.pathname);

  if (isHidden || !isOnAllowedPage) {
    return null;
  }

  return (
    <button
      onClick={openPanel}
      className={cn(
        "fixed bottom-24 left-4 z-[9999]",
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
