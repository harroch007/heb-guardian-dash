import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getDeviceStatus, getStatusColor } from "@/lib/deviceStatus";

interface Child {
  id: string;
  name: string;
  alertsCount?: number;
  device?: {
    last_seen: string | null;
  };
}

interface ChildTabsProps {
  children: Child[];
  selectedChildId: string | null;
  onSelectChild: (childId: string) => void;
}

export const ChildTabs = ({ children, selectedChildId, onSelectChild }: ChildTabsProps) => {
  if (children.length <= 1) return null;

  return (
    <div className="mb-6 animate-fade-in">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {children.map((child) => {
          const isSelected = child.id === selectedChildId;
          const status = getDeviceStatus(!!child.device);
          
          return (
            <button
              key={child.id}
              onClick={() => onSelectChild(child.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap",
                isSelected 
                  ? "bg-primary/10 border-primary text-foreground" 
                  : "bg-card border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              <div className={cn(
                "w-2 h-2 rounded-full",
                getStatusColor(status)
              )} />
              <span className="font-medium">{child.name}</span>
              {child.alertsCount && child.alertsCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="text-xs px-1.5 py-0 min-w-[1.25rem] h-5"
                >
                  {child.alertsCount}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
