import { Users, ShieldCheck, AlertTriangle, Wifi } from "lucide-react";

interface FamilyStatusHeroProps {
  childrenCount: number;
  connectedCount: number;
  openIssues: number;
  permissionIssueCount: number;
}

export const FamilyStatusHero = ({
  childrenCount,
  connectedCount,
  openIssues,
  permissionIssueCount,
}: FamilyStatusHeroProps) => {
  const allConnected = connectedCount === childrenCount && childrenCount > 0;
  const hasIssues = openIssues > 0;

  return (
    <div className="rounded-2xl bg-gradient-to-bl from-blue-50 to-indigo-50 border border-blue-100 p-4">
      {/* Status line */}
      <div className="flex items-center gap-2 mb-4">
        {hasIssues ? (
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        ) : (
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
        )}
        <span className="text-sm font-semibold text-gray-800">
          {hasIssues ? "יש נושאים שדורשים תשומת לב" : "הכול תקין כרגע"}
        </span>
      </div>

      {/* Metric pills */}
      <div className="grid grid-cols-3 gap-2">
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
        <Pill
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          value={String(openIssues)}
          label="פתוחים"
          warn={openIssues > 0}
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
