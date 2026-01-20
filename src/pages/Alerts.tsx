import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AlertCardStack, AlertTabs, EmptyAlertsState, EmptySavedState } from "@/components/alerts";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SocialContext {
  label: string;
  participants: string[];
  description: string;
}

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
  ai_title: string | null;
  ai_context: string | null;
  ai_meaning: string | null;
  ai_social_context: SocialContext | null;
  created_at: string;
  is_processed: boolean;
  acknowledged_at?: string | null;
  remind_at?: string | null;
  saved_at?: string | null;
}

const AlertsPage = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [savedAlerts, setSavedAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'new' | 'saved'>('new');

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      
      // Fetch new alerts (not acknowledged, not saved)
      const { data: newData, error: newError } = await supabase
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
          ai_title,
          ai_context,
          ai_meaning,
          ai_social_context,
          created_at,
          is_processed,
          acknowledged_at,
          remind_at,
          saved_at,
          children!child_id(name)
        `)
        .eq('is_processed', true)
        .is('acknowledged_at', null)
        .is('saved_at', null)
        .is('parent_message', null)
        .order('created_at', { ascending: false });

      if (newError) throw newError;
      
      // Fetch saved alerts (has saved_at, not acknowledged)
      const { data: savedData, error: savedError } = await supabase
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
          ai_title,
          ai_context,
          ai_meaning,
          ai_social_context,
          created_at,
          is_processed,
          acknowledged_at,
          remind_at,
          saved_at,
          children!child_id(name)
        `)
        .eq('is_processed', true)
        .is('acknowledged_at', null)
        .not('saved_at', 'is', null)
        .is('parent_message', null)
        .order('saved_at', { ascending: false });

      if (savedError) throw savedError;
      
      // Filter remind_at in JavaScript
      const now = new Date();
      const filterRemindAt = (data: typeof newData) => 
        data?.filter(alert => !alert.remind_at || new Date(alert.remind_at) < now) || [];
      
      // Transform data to flatten child name and cast ai_social_context
      const transformData = (data: typeof newData) => 
        filterRemindAt(data).map(alert => ({
          ...alert,
          child_name: (alert.children as any)?.name || undefined,
          children: undefined,
          sender_display: alert.sender_display ?? null,
          ai_social_context: (alert.ai_social_context as unknown) as SocialContext | null
        })) as Alert[];
      
      setAlerts(transformData(newData));
      setSavedAlerts(transformData(savedData));
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

      // Remove from both lists
      setAlerts(prev => prev.filter(alert => alert.id !== id));
      setSavedAlerts(prev => prev.filter(alert => alert.id !== id));
      
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

  const handleSave = async (id: number) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ saved_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      // Move from alerts to savedAlerts
      const alertToSave = alerts.find(a => a.id === id);
      if (alertToSave) {
        setAlerts(prev => prev.filter(a => a.id !== id));
        setSavedAlerts(prev => [{ ...alertToSave, saved_at: new Date().toISOString() }, ...prev]);
      }
      
      toast({
        title: "נשמר!",
        description: "ההתראה נשמרה לעיון מאוחר",
      });
    } catch (err: any) {
      toast({
        title: "שגיאה",
        description: err.message || "לא ניתן לשמור את ההתראה",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const currentAlerts = activeTab === 'new' ? alerts : savedAlerts;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="mb-4">
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
        </div>

        {/* Tabs */}
        <div className="mb-4">
          <AlertTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            newCount={alerts.length}
            savedCount={savedAlerts.length}
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-xl bg-card/50 animate-pulse border border-border/30" />
            ))}
          </div>
        ) : currentAlerts.length > 0 ? (
          <AlertCardStack
            alerts={currentAlerts}
            onAcknowledge={handleAcknowledge}
            onSave={handleSave}
            isSavedView={activeTab === 'saved'}
          />
        ) : activeTab === 'new' ? (
          <EmptyAlertsState />
        ) : (
          <EmptySavedState />
        )}
      </div>
    </DashboardLayout>
  );
};

export default AlertsPage;
