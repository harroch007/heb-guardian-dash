import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCardStack, AlertTabs, EmptyAlertsState, EmptySavedState, PositiveAlertCard, EmptyPositiveState } from "@/components/alerts";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Shield, Bell, Bookmark, Star, Crown } from "lucide-react";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getFamilyParentIds } from "@/lib/familyScope";
import { Card } from "@/components/ui/card";

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

interface Child {
  id: string;
  name: string;
  subscription_tier: string | null;
}

const ALERT_SELECT_FIELDS = `
  id, child_id, sender, sender_display, chat_name, chat_type,
  parent_message, suggested_action, category, ai_risk_score,
  ai_verdict, ai_summary, ai_recommendation, ai_title, ai_context,
  ai_meaning, ai_social_context, child_role, created_at, is_processed,
  acknowledged_at, remind_at, saved_at, alert_type,
  children!child_id(name)
`;

const AlertsV2 = () => {
  const { user, parentId } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [savedAlerts, setSavedAlerts] = useState<Alert[]>([]);
  const [positiveAlerts, setPositiveAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'new' | 'saved' | 'positive'>('new');
  const [feedbackMap, setFeedbackMap] = useState<Record<number, 'important' | 'not_relevant'>>({});

  // Fetch children list — explicitly scoped to this family
  useEffect(() => {
    if (!user?.id) return;
    const fetchChildren = async () => {
      const allowedParentIds = await getFamilyParentIds(user.id);
      const { data } = await supabase
        .from('children')
        .select('id, name, subscription_tier')
        .in('parent_id', allowedParentIds)
        .order('created_at');
      if (data) setChildren(data);
    };
    fetchChildren();
  }, [user?.id]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);

      // Fetch alert thresholds per child
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

      const filterByThreshold = (alertsList: Alert[]) =>
        alertsList.filter(a => {
          const threshold = a.child_id ? (thresholds[a.child_id] ?? 65) : 65;
          return (a.ai_risk_score ?? 0) >= threshold;
        });

      // Build base query helper
      const buildQuery = (type: 'new' | 'saved' | 'positive') => {
        let query = supabase
          .from('alerts')
          .select(ALERT_SELECT_FIELDS)
          .eq('is_processed', true)
          .is('parent_message', null);

        if (selectedChildId) {
          query = query.eq('child_id', selectedChildId);
        }

        if (type === 'new') {
          query = query
            .is('acknowledged_at', null)
            .is('saved_at', null)
            .eq('alert_type', 'warning')
            .in('ai_verdict', ['notify', 'review'])
            .order('created_at', { ascending: false });
        } else if (type === 'saved') {
          query = query
            .is('acknowledged_at', null)
            .not('saved_at', 'is', null)
            .eq('alert_type', 'warning')
            .in('ai_verdict', ['notify', 'review'])
            .order('saved_at', { ascending: false });
        } else {
          query = query
            .is('acknowledged_at', null)
            .eq('alert_type', 'positive')
            .order('created_at', { ascending: false });
        }

        return query;
      };

      const [newRes, savedRes, positiveRes] = await Promise.all([
        buildQuery('new'),
        buildQuery('saved'),
        buildQuery('positive'),
      ]);

      if (newRes.error) throw newRes.error;
      if (savedRes.error) throw savedRes.error;
      if (positiveRes.error) throw positiveRes.error;

      const now = new Date();
      const filterRemindAt = (data: any[]) =>
        data?.filter((alert: any) => !alert.remind_at || new Date(alert.remind_at) < now) || [];

      const transformData = (data: any[]) =>
        filterRemindAt(data).map((alert: any) => ({
          ...alert,
          child_name: (alert.children as any)?.name || undefined,
          children: undefined,
          sender_display: alert.sender_display ?? null,
          ai_social_context: (alert.ai_social_context as unknown) as SocialContext | null,
        })) as Alert[];

      setAlerts(filterByThreshold(transformData(newRes.data || [])));
      setSavedAlerts(filterByThreshold(transformData(savedRes.data || [])));
      setPositiveAlerts(transformData(positiveRes.data || []));

      // Fetch feedback
      if (parentId) {
        const allAlertIds = [
          ...(newRes.data || []).map((a: any) => a.id),
          ...(savedRes.data || []).map((a: any) => a.id),
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

  useEffect(() => {
    fetchAlerts();
  }, [selectedChildId]);

  const handleAcknowledge = async (id: number) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

      setAlerts(prev => prev.filter(a => a.id !== id));
      setSavedAlerts(prev => prev.filter(a => a.id !== id));
      setPositiveAlerts(prev => prev.filter(a => a.id !== id));

      toast({ title: "תודה!", description: "ההתראה סומנה כטופלה" });
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message || "לא ניתן לסמן את ההתראה", variant: "destructive" });
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

      toast({ title: "נשמר!", description: "ההתראה נשמרה לעיון מאוחר" });
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message || "לא ניתן לשמור את ההתראה", variant: "destructive" });
    }
  };

  const handleFeedbackChange = (alertId: number, feedback: 'important' | 'not_relevant') => {
    setFeedbackMap(prev => ({ ...prev, [alertId]: feedback }));
  };

  const hasPremium = children.some(c => c.subscription_tier && c.subscription_tier !== 'free');
  const totalAlerts = alerts.length + savedAlerts.length + positiveAlerts.length;

  return (
    <div className="v2-dark min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">הגנה חכמה</h1>
            <p className="text-sm text-muted-foreground">ניטור AI והתראות</p>
          </div>
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="p-2.5 rounded-xl bg-card border border-border/50 text-primary hover:bg-primary/5 transition-all disabled:opacity-50"
            aria-label="רענן"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Child filter */}
        {children.length > 1 && (
          <div className="mb-4">
            <select
              value={selectedChildId || ''}
              onChange={e => setSelectedChildId(e.target.value || null)}
              className="w-full p-3 rounded-xl bg-card border border-border/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">כל הילדים</option>
              {children.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Card className="p-3 bg-card border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">פתוחות</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{alerts.length}</p>
          </Card>
          <Card className="p-3 bg-card border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Bookmark className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">שמורות</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{savedAlerts.length}</p>
          </Card>
          <Card className="p-3 bg-card border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">חיוביות</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{positiveAlerts.length}</p>
          </Card>
          <Card className="p-3 bg-card border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">סטטוס</span>
            </div>
            <p className="text-sm font-semibold text-foreground mt-1">
              {hasPremium ? 'פרימיום' : 'חינמי'}
            </p>
          </Card>
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
            <EmptyAlertsState hasPremium={hasPremium} />
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

        {/* Smart Protection status - secondary */}
        <Card className="mt-8 p-4 bg-card border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">סטטוס הגנה חכמה</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">מנוי</span>
              <span className="font-medium text-foreground">{hasPremium ? 'פרימיום פעיל' : 'חינמי'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">סה״כ התראות</span>
              <span className="font-medium text-foreground">{totalAlerts}</span>
            </div>
          </div>
        </Card>
      </div>
      <BottomNavigationV2 />
    </div>
  );
};

export default AlertsV2;
