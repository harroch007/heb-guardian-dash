import { Users, ShieldCheck, AlertTriangle, Wifi } from "lucide-react";
import { HelpTooltip } from "@/components/help/HelpTooltip";

interface FamilyStatusHeroProps {
  childrenCount: number;
  connectedCount: number;
  openIssues: number;
}

export const FamilyStatusHero = ({
  childrenCount,
  connectedCount,
  openIssues,
}: FamilyStatusHeroProps) => {
  const allConnected = connectedCount === childrenCount && childrenCount > 0;
  const hasIssues = openIssues > 0;

  const renderStatusLine = () => {
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
      <div className="grid grid-cols-3 gap-2">
        <Pill
          icon={<Users className="h-4 w-4 text-primary" />}
          value={`${connectedCount}/${childrenCount}`}
          label="מחוברים"
          helpText="מספר הילדים שמכשירם שולח דיווח עדכני לפי חלון הדיווח שהוגדר במכשיר, מתוך סך הילדים."
        />
        <Pill
          icon={<Wifi className="h-4 w-4 text-success" />}
          value={allConnected ? "תקין" : `${childrenCount - connectedCount} מנותק`}
          label="חיבור"
          warn={!allConnected}
          helpText="מצב התקשורת של מכשירי הילדים. 'מנותק' = לא התקבל דיווח בחלון הזמן שהמכשיר הגדיר."
        />
        <Pill
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          value={String(openIssues)}
          label="דורשים טיפול"
          warn={openIssues > 0}
          helpText="התראות בטיחות מאומתות, בעיות הרשאה ומכשירים שלא דיווחו."
        />
      </div>
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
