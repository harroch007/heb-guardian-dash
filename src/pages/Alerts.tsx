import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AlertCardStack, AlertTabs, EmptyAlertsState, EmptySavedState, PositiveAlertCard, EmptyPositiveState } from "@/components/alerts";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface SocialContext {
  label: string;
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
  child_role?: string | null;
  created_at: string;
  is_processed: boolean;
  acknowledged_at?: string | null;
  remind_at?: string | null;
  saved_at?: string | null;
  alert_type?: string | null;
}

const ALERT_SELECT_FIELDS = `
  id, child_id, sender, sender_display, chat_name, chat_type,
  parent_message, suggested_action, category, ai_risk_score,
  ai_verdict, ai_summary, ai_recommendation, ai_title, ai_context,
  ai_meaning, ai_social_context, child_role, created_at, is_processed,
  acknowledged_at, remind_at, saved_at, alert_type,
  children!child_id(name)
`;

const AlertsPage = () => {
  const { parentId } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [savedAlerts, setSavedAlerts] = useState<Alert[]>([]);
  const [positiveAlerts, setPositiveAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'new' | 'saved' | 'positive'>('new');
  const [feedbackMap, setFeedbackMap] = useState<Record<number, 'important' | 'not_relevant'>>({});
  const [thresholdMap, setThresholdMap] = useState<Record<string, number>>({});

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      
      // Fetch alert thresholds per child from settings
      const { data: settingsData } = await supabase
        .from('settings')
        .select('child_id, alert_threshold')
        .not('child_id', 'is', null);
      
      const thresholds: Record<string, number> = {};
      settingsData?.forEach(s => {
        if (s.child_id) {
          thresholds[s.child_id] = s.alert_threshold ?? 65;
        }
      });
      setThresholdMap(thresholds);

      // Helper to filter alerts by parent's sensitivity threshold
      const filterByThreshold = (alertsList: Alert[]) =>
        alertsList.filter(a => {
          const threshold = a.child_id ? (thresholds[a.child_id] ?? 65) : 65;
          return (a.ai_risk_score ?? 0) >= threshold;
        });
      
      // Fetch new warning alerts (not acknowledged, not saved)
      const { data: newData, error: newError } = await supabase
        .from('alerts')
        .select(ALERT_SELECT_FIELDS)
        .eq('is_processed', true)
        .is('acknowledged_at', null)
        .is('saved_at', null)
        .is('parent_message', null)
        .eq('alert_type', 'warning')
        .in('ai_verdict', ['notify', 'review'])
        .order('created_at', { ascending: false });

      if (newError) throw newError;
      
      // Fetch saved alerts
      const { data: savedData, error: savedError } = await supabase
        .from('alerts')
        .select(ALERT_SELECT_FIELDS)
        .eq('is_processed', true)
        .is('acknowledged_at', null)
        .not('saved_at', 'is', null)
        .is('parent_message', null)
        .eq('alert_type', 'warning')
        .in('ai_verdict', ['notify', 'review'])
        .order('saved_at', { ascending: false });

      if (savedError) throw savedError;

      // Fetch positive alerts (not acknowledged)
      const { data: positiveData, error: positiveError } = await supabase
        .from('alerts')
        .select(ALERT_SELECT_FIELDS)
        .eq('is_processed', true)
        .is('acknowledged_at', null)
        .is('parent_message', null)
        .eq('alert_type', 'positive')
        .order('created_at', { ascending: false });

      if (positiveError) throw positiveError;
      
      // Filter remind_at in JavaScript
      const now = new Date();
      const filterRemindAt = (data: typeof newData) => 
        data?.filter(alert => !alert.remind_at || new Date(alert.remind_at) < now) || [];
      
      // Transform data
      const transformData = (data: typeof newData) => 
        filterRemindAt(data).map(alert => ({
          ...alert,
          child_name: (alert.children as any)?.name || undefined,
          children: undefined,
          sender_display: alert.sender_display ?? null,
          ai_social_context: (alert.ai_social_context as unknown) as SocialContext | null
        })) as Alert[];
      
      setAlerts(filterByThreshold(transformData(newData)));
      setSavedAlerts(filterByThreshold(transformData(savedData)));
      setPositiveAlerts(transformData(positiveData));

      // Fetch existing feedback
      if (parentId) {
        const allAlertIds = [
          ...(newData || []).map(a => a.id),
          ...(savedData || []).map(a => a.id),
        ];
        if (allAlertIds.length > 0) {
          const { data: fbData } = await supabase
            .from('alert_feedback' as any)
            .select('alert_id, feedback_type')
            .eq('parent_id', parentId)
            .in('alert_id', allAlertIds);
          
          if (fbData) {
            const map: Record<number, 'important' | 'not_relevant'> = {};
            for (const row of fbData as any[]) {
              map[row.alert_id] = row.feedback_type;
            }
            setFeedbackMap(map);
          }
        }
      }
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
      setSavedAlerts(prev => prev.filter(alert => alert.id !== id));
      setPositiveAlerts(prev => prev.filter(alert => alert.id !== id));
      
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

  const handleFeedbackChange = (alertId: number, feedback: 'important' | 'not_relevant') => {
    setFeedbackMap(prev => ({ ...prev, [alertId]: feedback }));
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-foreground">התראות</h1>
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
            positiveCount={positiveAlerts.length}
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-xl bg-card/50 animate-pulse border border-border/30" />
            ))}
          </div>
        ) : activeTab === 'new' ? (
          alerts.length > 0 ? (
            <AlertCardStack
              alerts={alerts}
              onAcknowledge={handleAcknowledge}
              onSave={handleSave}
              isSavedView={false}
              parentId={parentId}
              feedbackMap={feedbackMap}
              onFeedbackChange={handleFeedbackChange}
            />
          ) : (
            <EmptyAlertsState />
          )
        ) : activeTab === 'positive' ? (
          positiveAlerts.length > 0 ? (
            <PositiveAlertCard
              alerts={positiveAlerts}
              onAcknowledge={handleAcknowledge}
            />
          ) : (
            <EmptyPositiveState />
          )
        ) : (
          savedAlerts.length > 0 ? (
            <AlertCardStack
              alerts={savedAlerts}
              onAcknowledge={handleAcknowledge}
              isSavedView={true}
              parentId={parentId}
              feedbackMap={feedbackMap}
              onFeedbackChange={handleFeedbackChange}
            />
          ) : (
            <EmptySavedState />
          )
        )}
      </div>
    </DashboardLayout>
  );
};

export default AlertsPage;
