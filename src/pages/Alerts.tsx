import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AlertCard } from "@/components/AlertCard";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Filter, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Alert {
  id: number;
  child_id: string | null;
  child_name?: string;
  sender: string | null;
  sender_display: string | null;
  parent_message: string | null;
  suggested_action: string | null;
  category: string | null;
  ai_risk_score: number | null;
  created_at: string;
  is_processed: boolean;
  acknowledged_at?: string | null;
}

const AlertsPage = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'important' | 'attention'>('all');

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
          parent_message,
          suggested_action,
          category,
          ai_risk_score,
          created_at,
          is_processed,
          acknowledged_at,
          children!child_id(name)
        `)
        .is('acknowledged_at', null)
        .eq('is_processed', true)
        .not('parent_message', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to flatten child name
      const transformedData = (data || []).map(alert => ({
        ...alert,
        child_name: (alert.children as any)?.name || 'לא ידוע',
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
        description: "ההודעה סומנה כנקראה",
      });
    } catch (err: any) {
      toast({
        title: "שגיאה",
        description: err.message || "לא ניתן לסמן את ההתראה",
        variant: "destructive",
      });
    }
  };

  const handleRemindLater = (id: number) => {
    toast({
      title: "תזכורת נשמרה",
      description: "נזכיר לך מאוחר יותר",
    });
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const filteredAlerts = alerts.filter(alert => {
    const score = alert.ai_risk_score ?? 0;
    if (filter === 'urgent') return score > 80;
    if (filter === 'important') return score > 60 && score <= 80;
    if (filter === 'attention') return score > 30 && score <= 60;
    return true;
  });

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 glow-primary">
              <MessageCircle className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground text-glow">
              עדכונים מ-Kippy
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
        <p className="text-muted-foreground">עדכונים חשובים על הילדים שלך</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: 'הכל' },
            { key: 'urgent', label: '🔴 דחוף' },
            { key: 'important', label: '🟠 חשוב' },
            { key: 'attention', label: '🟡 שים לב' },
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
          {filteredAlerts.length} עדכונים
        </span>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 rounded-xl bg-card/50 animate-pulse border border-border/30" />
          ))}
        </div>
      ) : filteredAlerts.length > 0 ? (
        <div className="space-y-4">
          {filteredAlerts.map((alert, index) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onRemindLater={handleRemindLater}
              onDelete={deleteAlert}
              index={index}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 rounded-xl bg-card border border-border/50 text-center">
          <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-lg text-muted-foreground mb-2">
            {filter === 'all' ? 'אין עדכונים חדשים' : 'אין עדכונים בקטגוריה זו'}
          </p>
          <p className="text-sm text-muted-foreground/70">
            עדכונים חדשים יופיעו כאן באופן אוטומטי
          </p>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AlertsPage;
