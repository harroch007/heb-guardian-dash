import { Users, ShieldCheck, AlertTriangle, Wifi, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WHATSAPP_MONITORING_ENABLED } from "@/config/featureFlags";
import { HelpTooltip } from "@/components/help/HelpTooltip";

interface FamilyStatusHeroProps {
  childrenCount: number;
  connectedCount: number;
  openIssues: number;
  permissionIssueCount: number;
  hasPremium: boolean;
}

export const FamilyStatusHero = ({
  childrenCount,
  connectedCount,
  openIssues,
  permissionIssueCount,
  hasPremium,
}: FamilyStatusHeroProps) => {
  const navigate = useNavigate();
  const allConnected = connectedCount === childrenCount && childrenCount > 0;
  const hasIssues = openIssues > 0;
  // When WhatsApp monitoring is disabled, suppress all premium upsell UI
  const showPremiumUpsell = WHATSAPP_MONITORING_ENABLED && !hasPremium;
  const effectivePremium = WHATSAPP_MONITORING_ENABLED ? hasPremium : true;
  const showIssuesPill = WHATSAPP_MONITORING_ENABLED && effectivePremium;

  // When monitoring is off, status line depends only on connectivity
  const renderStatusLine = () => {
    if (showPremiumUpsell) {
      return (
        <>
          <Crown className="h-5 w-5 text-amber-500" />
          <span className="text-sm font-semibold text-foreground">
            שדרגו לפרימיום כדי להפעיל ניטור חכם
          </span>
        </>
      );
    }
    if (!WHATSAPP_MONITORING_ENABLED) {
      if (childrenCount > 0 && !allConnected) {
        return (
          <>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-semibold text-foreground">
              {childrenCount - connectedCount === 1 ? "יש מכשיר מנותק" : `${childrenCount - connectedCount} מכשירים מנותקים`}
            </span>
          </>
        );
      }
      return (
        <>
          <ShieldCheck className="h-5 w-5 text-success" />
          <span className="text-sm font-semibold text-foreground">
            הכול תקין כרגע
          </span>
        </>
      );
    }
    if (hasIssues) {
      return (
        <>
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span className="text-sm font-semibold text-foreground">
            יש נושאים שדורשים תשומת לב
          </span>
        </>
      );
    }
    return (
      <>
        <ShieldCheck className="h-5 w-5 text-success" />
        <span className="text-sm font-semibold text-foreground">
          הכול תקין כרגע
        </span>
      </>
    );
  };

  return (
    <div className="rounded-2xl bg-gradient-to-bl from-primary/10 via-card to-card border border-primary/30 p-4">
      {/* Status line */}
      <div className="flex items-center gap-2 mb-4">
        {renderStatusLine()}
      </div>

      {/* Metric pills */}
      <div className={`grid ${showIssuesPill ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
        <Pill
          icon={<Users className="h-4 w-4 text-primary" />}
          value={`${connectedCount}/${childrenCount}`}
          label="מחוברים"
          helpText="מספר הילדים שהמכשיר שלהם דיווח ב-24 השעות האחרונות, מתוך סך הילדים."
        />
        <Pill
          icon={<Wifi className="h-4 w-4 text-success" />}
          value={allConnected ? "תקין" : `${childrenCount - connectedCount} מנותק`}
          label="חיבור"
          warn={!allConnected}
          helpText="מצב התקשורת של מכשירי הילדים. 'מנותק' = המכשיר לא שלח עדכון ב-24 שעות."
        />
        {showIssuesPill && (
          <Pill
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            value={String(openIssues)}
            label="פתוחים"
            warn={openIssues > 0}
            helpText="התראות, בקשות זמן ובעיות הרשאה שמחכות לטיפול."
          />
        )}
      </div>

      {/* Upgrade button for free users */}
      {showPremiumUpsell && (
        <button
          onClick={() => navigate("/checkout")}
          className="mt-3 w-full py-2 bg-warning text-white text-xs font-semibold rounded-lg hover:bg-warning transition-colors"
        >
          שדרוג לפרימיום
        </button>
      )}
    </div>
  );
};

const Pill = ({
  icon,
  value,
  label,
  warn,
  helpText,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  warn?: boolean;
  helpText?: string;
}) => (
  <div className="flex flex-col items-center gap-1 rounded-xl bg-card/70 border border-border/50 py-2 px-1">
    {icon}
    <span className={`text-sm font-bold ${warn ? "text-warning" : "text-foreground"}`}>
      {value}
    </span>
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {helpText && <HelpTooltip text={helpText} iconSize={11} />}
    </div>
  </div>
);
