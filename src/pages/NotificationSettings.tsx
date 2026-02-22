import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ChevronRight, UserX, Shield, Loader2, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SENSITIVITY_LEVELS = [
  {
    key: "sensitive",
    threshold: 50,
    label: "רגיש",
    description: "כל חשד — גם אירועים ברמת סיכון בינונית",
    icon: ShieldAlert,
  },
  {
    key: "balanced",
    threshold: 65,
    label: "מאוזן",
    description: "מומלץ — התראות על אירועים משמעותיים",
    icon: ShieldCheck,
    recommended: true,
  },
  {
    key: "critical",
    threshold: 85,
    label: "רק חמור",
    description: "רק אירועים חמורים באמת",
    icon: ShieldOff,
  },
] as const;

interface SettingsData {
  alert_threshold: number;
  alert_on_unknown_contacts: boolean;
  monitoring_enabled: boolean;
}

const DEFAULTS: SettingsData = {
  alert_threshold: 65,
  alert_on_unknown_contacts: true,
  monitoring_enabled: true,
};

interface Child {
  id: string;
  name: string;
}

function thresholdToLevel(threshold: number): string {
  if (threshold <= 50) return "sensitive";
  if (threshold <= 75) return "balanced";
  return "critical";
}

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (!selectedChildId) return;
    const fetchSettings = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("settings")
        .select("alert_threshold, alert_on_unknown_contacts, monitoring_enabled")
        .eq("child_id", selectedChildId)
        .is("device_id", null)
        .maybeSingle();

      if (data) {
        setSettings({
          alert_threshold: data.alert_threshold ?? DEFAULTS.alert_threshold,
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
    const prev = { ...settings };
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
      setSettings(prev);
    } else {
      toast.success("ההגדרה עודכנה בהצלחה");
    }
    setSaving(false);
  };

  const selectedLevel = thresholdToLevel(settings.alert_threshold);

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
        <p className="text-muted-foreground">רמת רגישות, סוגי התרעות וניטור</p>
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
          {/* Sensitivity Level */}
          <section className="p-6 rounded-xl bg-card border border-border/50">
            <h2 className="text-lg font-semibold text-foreground mb-1">רמת רגישות התראות</h2>
            <p className="text-sm text-muted-foreground mb-4">
              בחר כמה רגיש המערכת תהיה לאירועים חשודים
            </p>
            <div className="grid grid-cols-3 gap-3">
              {SENSITIVITY_LEVELS.map((level) => {
                const Icon = level.icon;
                const isSelected = selectedLevel === level.key;
                return (
                  <button
                    key={level.key}
                    onClick={() => updateSetting("alert_threshold", level.threshold)}
                    disabled={saving}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/50 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                    } disabled:opacity-50`}
                  >
                    {"recommended" in level && level.recommended && (
                      <span className="absolute -top-2.5 text-[10px] font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        מומלץ
                      </span>
                    )}
                    <Icon className={`w-6 h-6 ${isSelected ? "text-primary" : ""}`} />
                    <span className="font-semibold text-sm">{level.label}</span>
                    <span className="text-xs leading-tight">{level.description}</span>
                  </button>
                );
              })}
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
                <Shield className="w-5 h-5 text-emerald-500" />
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
