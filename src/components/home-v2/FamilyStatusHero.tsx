import { Users, ShieldCheck, AlertTriangle, Wifi, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WHATSAPP_MONITORING_ENABLED } from "@/config/featureFlags";

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

  return (
    <div className="rounded-2xl bg-gradient-to-bl from-blue-50 to-indigo-50 border border-blue-100 p-4">
      {/* Status line */}
      <div className="flex items-center gap-2 mb-4">
        {showPremiumUpsell ? (
          <>
            <Crown className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-semibold text-gray-800">
              שדרגו לפרימיום כדי להפעיל ניטור חכם
            </span>
          </>
        ) : hasIssues ? (
          <>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-semibold text-gray-800">
              יש נושאים שדורשים תשומת לב
            </span>
          </>
        ) : (
          <>
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-semibold text-gray-800">
              הכול תקין כרגע
            </span>
          </>
        )}
      </div>

      {/* Metric pills */}
      <div className={`grid ${effectivePremium ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
        <Pill
          icon={<Users className="h-4 w-4 text-blue-600" />}
          value={`${connectedCount}/${childrenCount}`}
          label="מחוברים"
        />
        <Pill
          icon={<Wifi className="h-4 w-4 text-emerald-600" />}
          value={allConnected ? "תקין" : `${childrenCount - connectedCount} מנותק`}
          label="חיבור"
          warn={!allConnected}
        />
        {effectivePremium && (
          <Pill
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            value={String(openIssues)}
            label="פתוחים"
            warn={openIssues > 0}
          />
        )}
      </div>

      {/* Upgrade button for free users */}
      {showPremiumUpsell && (
        <button
          onClick={() => navigate("/checkout")}
          className="mt-3 w-full py-2 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition-colors"
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
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  warn?: boolean;
}) => (
  <div className="flex flex-col items-center gap-1 rounded-xl bg-white/70 border border-gray-100 py-2 px-1">
    {icon}
    <span className={`text-sm font-bold ${warn ? "text-amber-600" : "text-gray-900"}`}>
      {value}
    </span>
    <span className="text-[10px] text-gray-500">{label}</span>
  </div>
);
