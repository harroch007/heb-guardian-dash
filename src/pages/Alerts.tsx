import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AlertCard } from "@/components/AlertCard";
import { supabase } from "@/integrations/supabase/client";
import { Bell, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
}

const AlertsPage = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  // TODO(DATA): in_progress and closed filters are UI-only - no status field exists
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'closed'>('all');

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('alerts')
        .select(`
          id,
          child_id,
          sender,
          sender_display,
          chat_name,
          chat_type,
          parent_message,
          suggested_action,
          category,
          ai_risk_score,
          ai_verdict,
          ai_summary,
          ai_recommendation,
          created_at,
          is_processed,
          acknowledged_at,
          remind_at,
          children!child_id(name)
        `)
        .eq('is_processed', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter remind_at in JavaScript (PostgREST doesn't support now())
      const now = new Date();
      const filteredData = data?.filter(alert => 
        !alert.remind_at || new Date(alert.remind_at) < now
      ) || [];
      
      // Transform data to flatten child name
      const transformedData = filteredData.map(alert => ({
        ...alert,
        child_name: (alert.children as any)?.name || undefined,
        children: undefined,
        sender_display: alert.sender_display ?? null
      }));
      
      setAlerts(transformedData);
    } catch (err: any) {
      toast({
        title: "שגיאה",
        description: err.message || "לא ניתן לטעון התראות",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setAlerts(prev => prev.filter(alert => alert.id !== id));
      toast({
        title: "תודה!",
        description: "ההתראה סומנה כטופלה",
      });
    } catch (err: any) {
      toast({
        title: "שגיאה",
        description: err.message || "לא ניתן לסמן את ההתראה",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'open') return !alert.acknowledged_at;
    // TODO(DATA): in_progress requires a status field that doesn't exist
    if (filter === 'in_progress') return false;
    // closed = acknowledged
    if (filter === 'closed') return !!alert.acknowledged_at;
    return true;
  });

  const filterOptions = [
    { key: 'all', label: 'הכל' },
    { key: 'open', label: 'פתוחות' },
    // TODO(DATA): in_progress requires status field
    { key: 'in_progress', label: 'בטיפול*' },
    // TODO(DATA): closed uses acknowledged_at as proxy
    { key: 'closed', label: 'נסגרו*' },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            התראות
          </h1>
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all disabled:opacity-50"
            aria-label="רענן"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
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
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-36 rounded-xl bg-card/50 animate-pulse border border-border/30" />
          ))}
        </div>
      ) : filteredAlerts.length > 0 ? (
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

export default AlertsPage;
