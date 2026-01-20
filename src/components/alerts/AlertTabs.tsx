import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Bookmark } from "lucide-react";

interface AlertTabsProps {
  activeTab: 'new' | 'saved';
  onTabChange: (tab: 'new' | 'saved') => void;
  newCount: number;
  savedCount: number;
}

export function AlertTabs({ activeTab, onTabChange, newCount, savedCount }: AlertTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as 'new' | 'saved')} className="w-full" dir="rtl">
      <TabsList className="w-full grid grid-cols-2 bg-muted/50 p-1 h-12">
        <TabsTrigger 
          value="new" 
          className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm"
        >
          <Bell className="w-4 h-4" />
          <span>חדשות</span>
          {newCount > 0 && (
            <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
              {newCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger 
          value="saved" 
          className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm"
        >
          <Bookmark className="w-4 h-4" />
          <span>שמורות</span>
          {savedCount > 0 && (
            <span className="bg-secondary/50 text-secondary-foreground text-xs px-2 py-0.5 rounded-full font-medium">
              {savedCount}
            </span>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
