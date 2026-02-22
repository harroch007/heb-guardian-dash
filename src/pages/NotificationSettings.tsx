import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ChevronRight, Gauge, MessageSquareWarning, UserX, Shield, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SettingsData {
  alert_threshold: number;
  alert_on_trigger_words: boolean;
  alert_on_unknown_contacts: boolean;
  monitoring_enabled: boolean;
}

const DEFAULTS: SettingsData = {
  alert_threshold: 70,
  alert_on_trigger_words: true,
  alert_on_unknown_contacts: true,
  monitoring_enabled: true,
};

interface Child {
  id: string;
  name: string;
}

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch children
  useEffect(() => {
    if (!user) return;
    const fetchChildren = async () => {
      const { data } = await supabase
        .from("children")
        .select("id, name")
        .eq("parent_id", user.id);
      if (data && data.length > 0) {
        setChildren(data);
        setSelectedChildId(data[0].id);
      }
      setLoading(false);
    };
    fetchChildren();
  }, [user]);

  // Fetch settings for selected child
  useEffect(() => {
    if (!selectedChildId) return;
    const fetchSettings = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("settings")
        .select("alert_threshold, alert_on_trigger_words, alert_on_unknown_contacts, monitoring_enabled")
        .eq("child_id", selectedChildId)
        .maybeSingle();

      if (data) {
        setSettings({
          alert_threshold: data.alert_threshold ?? DEFAULTS.alert_threshold,
          alert_on_trigger_words: data.alert_on_trigger_words ?? DEFAULTS.alert_on_trigger_words,
          alert_on_unknown_contacts: data.alert_on_unknown_contacts ?? DEFAULTS.alert_on_unknown_contacts,
          monitoring_enabled: data.monitoring_enabled ?? DEFAULTS.monitoring_enabled,
        });
      } else {
        setSettings(DEFAULTS);
      }
      setLoading(false);
    };
    fetchSettings();
  }, [selectedChildId]);

  const updateSetting = async (key: keyof SettingsData, value: number | boolean) => {
    if (!selectedChildId || !user) return;
    setSaving(true);
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    const { error } = await supabase
      .from("settings")
      .upsert(
        {
          child_id: selectedChildId,
          parent_id: user.id,
          [key]: value,
        },
        { onConflict: "parent_id,child_id,device_id" }
      );

    if (error) {
      console.error("Failed to update setting:", error);
      toast.error("שגיאה בשמירת ההגדרה");
      // Revert
      setSettings(settings);
    } else {
      toast.success("ההגדרה עודכנה בהצלחה");
    }
    setSaving(false);
  };

  if (loading && children.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronRight className="w-4 h-4" />
          חזרה להגדרות
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          הגדרות התראות
        </h1>
        <p className="text-muted-foreground">כללים, תדירות וסוגי התרעות</p>
      </div>

      {/* Child tabs */}
      {children.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                selectedChildId === child.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {child.name}
            </button>
          ))}
        </div>
      )}

      {children.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>אין ילדים מחוברים. הוסף ילד כדי לנהל הגדרות התראות.</p>
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          {/* Alert Threshold */}
          <section className="p-6 rounded-xl bg-card border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <Gauge className="w-5 h-5 text-warning" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">סף רגישות התראות</h2>
                <p className="text-sm text-muted-foreground">
                  ציון סיכון מינימלי שיגרום להתראה. ערך נמוך = יותר התראות.
                </p>
              </div>
            </div>
            <div className="px-1" dir="ltr">
              <Slider
                value={[settings.alert_threshold]}
                min={0}
                max={100}
                step={5}
                onValueCommit={(val) => updateSetting("alert_threshold", val[0])}
                disabled={saving}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground" dir="rtl">
              <span>רגיש מאוד (0)</span>
              <span className="font-medium text-foreground">{settings.alert_threshold}</span>
              <span>רק חמור (100)</span>
            </div>
          </section>

          {/* Trigger Words */}
          <section className="p-6 rounded-xl bg-card border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquareWarning className="w-5 h-5 text-destructive" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">התראה על מילות טריגר</h2>
                  <p className="text-sm text-muted-foreground">
                    קבל התראה כשמזוהות מילים מסוכנות בשיחות
                  </p>
                </div>
              </div>
              <div dir="ltr">
                <Switch
                  checked={settings.alert_on_trigger_words}
                  disabled={saving}
                  onCheckedChange={(checked) => updateSetting("alert_on_trigger_words", checked)}
                />
              </div>
            </div>
          </section>

          {/* Unknown Contacts */}
          <section className="p-6 rounded-xl bg-card border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserX className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">התראה על אנשי קשר לא מוכרים</h2>
                  <p className="text-sm text-muted-foreground">
                    קבל התראה כשהילד מתכתב עם גורם לא מוכר
                  </p>
                </div>
              </div>
              <div dir="ltr">
                <Switch
                  checked={settings.alert_on_unknown_contacts}
                  disabled={saving}
                  onCheckedChange={(checked) => updateSetting("alert_on_unknown_contacts", checked)}
                />
              </div>
            </div>
          </section>

          {/* Monitoring Enabled */}
          <section className="p-6 rounded-xl bg-card border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-success" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">ניטור פעיל</h2>
                  <p className="text-sm text-muted-foreground">
                    הפעלה או השבתה של ניטור ההודעות באופן כללי
                  </p>
                </div>
              </div>
              <div dir="ltr">
                <Switch
                  checked={settings.monitoring_enabled}
                  disabled={saving}
                  onCheckedChange={(checked) => updateSetting("monitoring_enabled", checked)}
                />
              </div>
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
};

export default NotificationSettings;
