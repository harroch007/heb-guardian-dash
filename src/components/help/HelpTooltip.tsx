import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  text: string;
  ariaLabel?: string;
  className?: string;
  iconSize?: number;
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * אייקון עזרה (?) שנפתח בלחיצה ומציג הסבר קצר בעברית.
 * עובד גם במובייל (tap) וגם בדסקטופ. RTL מובנה.
 */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  text,
  ariaLabel,
  className,
  iconSize = 14,
  side = "top",
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel || "עזרה"}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors rounded-full p-0.5",
            className,
          )}
        >
          <HelpCircle style={{ width: iconSize, height: iconSize }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="center"
        dir="rtl"
        className="w-auto max-w-[220px] p-2.5 text-xs leading-relaxed text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {text}
      </PopoverContent>
    </Popover>
  );
};
