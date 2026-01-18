import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AlertListView, AlertDetailView, EmptyAlertsState } from "@/components/alerts";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";
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
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);

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
        .is('acknowledged_at', null)
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
      setSelectedAlertId(null);
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

  const selectedAlert = selectedAlertId 
    ? alerts.find(a => a.id === selectedAlertId) 
    : null;

  // Count unique children
  const uniqueChildren = new Set(alerts.map(a => a.child_id).filter(Boolean)).size;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-foreground">
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
          <p className="text-sm text-muted-foreground">
            {alerts.length > 0 
              ? `${alerts.length} התראות שדורשות תשומת לב`
              : 'מה דורש תשומת לב — ומה כבר טופל'
            }
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-xl bg-card/50 animate-pulse border border-border/30" />
            ))}
          </div>
        ) : selectedAlert ? (
          <AlertDetailView
            alert={{
              id: selectedAlert.id,
              chat_name: selectedAlert.chat_name,
              sender_display: selectedAlert.sender_display,
              parent_message: selectedAlert.parent_message,
              ai_summary: selectedAlert.ai_summary,
              ai_recommendation: selectedAlert.ai_recommendation,
              chat_type: selectedAlert.chat_type,
              created_at: selectedAlert.created_at,
              ai_risk_score: selectedAlert.ai_risk_score,
            }}
            onAcknowledge={handleAcknowledge}
            onBack={() => setSelectedAlertId(null)}
            showBackButton={alerts.length > 1}
          />
        ) : alerts.length > 0 ? (
          <AlertListView
            alerts={alerts}
            onSelect={setSelectedAlertId}
            childCount={uniqueChildren}
          />
        ) : (
          <EmptyAlertsState />
        )}
      </div>
    </DashboardLayout>
  );
};

export default AlertsPage;
