import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DemoBanner } from "@/components/DemoBanner";
import { AlertCard } from "@/components/AlertCard";
import { Bell, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { DEMO_ALERTS } from "@/data/demoData";

const DemoAlerts = () => {
  const [alerts, setAlerts] = useState(DEMO_ALERTS);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'closed'>('all');

  const handleAcknowledge = async (id: number) => {
    // Simulate acknowledge in demo mode
    setAlerts(prev => prev.filter(alert => alert.id !== id));
    toast({
      title: "תודה!",
      description: "ההתראה סומנה כטופלה (מצב הדגמה)",
    });
  };

  const handleRefresh = () => {
    // Reset to original demo data
    setAlerts(DEMO_ALERTS);
    toast({
      title: "רשימה עודכנה",
      description: "מצב הדגמה - נתונים אופסו",
    });
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'open') return !alert.acknowledged_at;
    if (filter === 'in_progress') return false;
    if (filter === 'closed') return !!alert.acknowledged_at;
    return true;
  });

  const filterOptions = [
    { key: 'all', label: 'הכל' },
    { key: 'open', label: 'פתוחות' },
    { key: 'in_progress', label: 'בטיפול' },
    { key: 'closed', label: 'נסגרו' },
  ];

  return (
    <DashboardLayout>
      <DemoBanner />
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            התראות
          </h1>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all"
            aria-label="רענן"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
        <p className="text-muted-foreground">מה דורש תשומת לב — ומה כבר טופל</p>
      </div>

      {/* Filters - compact horizontal row, scrollable on mobile */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 -mx-1 px-1">
        {filterOptions.map(item => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key as typeof filter)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filter === item.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
        <span className="text-xs text-muted-foreground whitespace-nowrap mr-auto pr-2">
          {filteredAlerts.length} התראות
        </span>
      </div>

      {/* Alerts List */}
      {filteredAlerts.length > 0 ? (
        <div className="space-y-3">
          {filteredAlerts.map((alert, index) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              index={index}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 rounded-xl bg-card border border-border/50 text-center">
          <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-lg text-foreground mb-2">
            אין התראות כרגע
          </p>
          <p className="text-sm text-muted-foreground">
            כשמשהו ידרוש תשומת לב — תראה את זה כאן
          </p>
        </div>
      )}
    </DashboardLayout>
  );
};

export default DemoAlerts;
