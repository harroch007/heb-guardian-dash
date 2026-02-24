import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ChevronRight, Loader2, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SENSITIVITY_LEVELS = [
  {
    key: "sensitive",
    threshold: 50,
    label: "רגיש",
    description: "כל חשד — גם אירועים ברמת סיכון בינונית",
    dynamicDescription: "תקבל/י התראות על כל אירוע ברמת סיכון בינונית - מגביר את הסיכוי להתראות שווא, לא בטוח שזה השקט שאתם מחפשים",
    icon: ShieldAlert,
  },
  {
    key: "balanced",
    threshold: 65,
    label: "מאוזן",
    description: "מומלץ — התראות על אירועים משמעותיים",
    dynamicDescription: "תקבל/י התראות רק על אירועים משמעותיים - איזון בין שקט נפשי לבטיחות",
    icon: ShieldCheck,
    recommended: true,
  },
  {
    key: "critical",
    threshold: 85,
    label: "רק חמור",
    description: "רק אירועים חמורים באמת",
    dynamicDescription: "תקבל/י התראות רק על מצבים חמורים באמת - מינימום הפרעות, מקסימום רלוונטיות",
    icon: ShieldOff,
  },
] as const;

interface SettingsData {
  alert_threshold: number;
}

const DEFAULTS: SettingsData = {
  alert_threshold: 65,
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
        .select("alert_threshold")
        .eq("child_id", selectedChildId)
        .is("device_id", null)
        .maybeSingle();

      if (data) {
        setSettings({
          alert_threshold: data.alert_threshold ?? DEFAULTS.alert_threshold,
        });
      } else {
        setSettings(DEFAULTS);
      }
      setLoading(false);
    };
    fetchSettings();
  }, [selectedChildId]);

  const updateSetting = async (key: keyof SettingsData, value: number) => {
    if (!selectedChildId || !user) return;
    setSaving(true);
    const prev = { ...settings };
    setSettings({ ...settings, [key]: value });

    // Try update first (avoids 409 from partial unique index)
    const { data: updated, error } = await supabase
      .from("settings")
      .update({ [key]: value })
      .eq("child_id", selectedChildId)
      .is("device_id", null)
      .select();

    if (error) {
      console.error("Failed to update setting:", error);
      toast.error("שגיאה בשמירת ההגדרה");
      setSettings(prev);
    } else if (!updated || updated.length === 0) {
      // No existing row – insert
      const { error: insertError } = await supabase
        .from("settings")
        .insert({ child_id: selectedChildId, parent_id: user.id, [key]: value });
      if (insertError) {
        console.error("Failed to insert setting:", insertError);
        toast.error("שגיאה בשמירת ההגדרה");
        setSettings(prev);
      } else {
        toast.success("ההגדרה עודכנה בהצלחה");
      }
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
          <p className="text-sm text-muted-foreground mt-3 text-center">
            {SENSITIVITY_LEVELS.find(l => l.key === selectedLevel)?.dynamicDescription}
          </p>
        </div>
      )}
    </DashboardLayout>
  );
};

export default NotificationSettings;
