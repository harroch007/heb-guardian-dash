import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AlertCard } from "@/components/AlertCard";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Filter, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Alert {
  id: number;
  sender: string | null;
  content: string | null;
  risk_score: number | null;
  created_at: string;
  ai_summary: string | null;
  ai_recommendation: string | null;
  is_processed: boolean;
}

const AlertsPage = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium'>('all');

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
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

  const deleteAlert = async (id: number) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAlerts(prev => prev.filter(alert => alert.id !== id));
      toast({
        title: "ההתראה נמחקה",
        description: "ההתראה הוסרה בהצלחה מהמערכת",
      });
    } catch (err: any) {
      toast({
        title: "שגיאה",
        description: err.message || "לא ניתן למחוק את ההתראה",
        variant: "destructive",
      });
    }
  };

  const deleteAllAlerts = async () => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את כל ההתראות?')) return;

    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .neq('id', 0);

      if (error) throw error;

      setAlerts([]);
      toast({
        title: "כל ההתראות נמחקו",
        description: "כל ההתראות הוסרו בהצלחה מהמערכת",
      });
    } catch (err: any) {
      toast({
        title: "שגיאה",
        description: err.message || "לא ניתן למחוק את ההתראות",
        variant: "destructive",
      });
    }
  };

  const handleReanalyze = async (id: number) => {
    await fetchAlerts();
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const filteredAlerts = alerts.filter(alert => {
    const score = alert.risk_score ?? 0;
    if (filter === 'high') return score > 80;
    if (filter === 'medium') return score <= 80;
    return true;
  });

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10 glow-warning">
              <Bell className="w-6 h-6 text-warning" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground text-glow">
              התראות
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAlerts}
              disabled={loading}
              className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all glow-primary disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {alerts.length > 0 && (
              <button
                onClick={deleteAllAlerts}
                className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        <p className="text-muted-foreground">צפייה וניהול כל ההתראות במערכת</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'הכל' },
            { key: 'high', label: 'סיכון גבוה' },
            { key: 'medium', label: 'סיכון בינוני' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key as any)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                filter === item.key
                  ? 'bg-primary/20 text-primary glow-primary border border-primary/30'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground mr-auto">
          {filteredAlerts.length} התראות
        </span>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 rounded-xl bg-card/50 animate-pulse border border-border/30" />
          ))}
        </div>
      ) : filteredAlerts.length > 0 ? (
        <div className="space-y-3">
          {filteredAlerts.map((alert, index) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDelete={deleteAlert}
              onReanalyze={handleReanalyze}
              index={index}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 rounded-xl bg-card border border-border/50 text-center">
          <Bell className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-lg text-muted-foreground mb-2">
            {filter === 'all' ? 'אין התראות' : 'אין התראות בקטגוריה זו'}
          </p>
          <p className="text-sm text-muted-foreground/70">
            התראות חדשות יופיעו כאן באופן אוטומטי
          </p>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AlertsPage;
