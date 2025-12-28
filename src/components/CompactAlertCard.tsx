import { AlertTriangle } from 'lucide-react';

interface Alert {
  id: number;
  parent_message: string | null;
  ai_risk_score: number | null;
  created_at: string;
}

interface CompactAlertCardProps {
  alert: Alert;
  onClick?: () => void;
}

export function CompactAlertCard({ alert, onClick }: CompactAlertCardProps) {
  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const diff = new Date().getTime() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'עכשיו';
    if (mins < 60) return `לפני ${mins} ד'`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `לפני ${hours} ש'`;
    return `לפני ${Math.floor(hours / 24)} ימים`;
  };

  // Get short summary from parent_message
  const getShortSummary = () => {
    if (alert.parent_message) {
      return alert.parent_message.length > 50 
        ? alert.parent_message.slice(0, 50) + '...' 
        : alert.parent_message;
    }
    return 'עדכון מ-Kippy';
  };

  const riskScore = alert.ai_risk_score ?? 0;
  const isHighRisk = riskScore > 80;
  const isMediumRisk = riskScore > 60;

  const getBgStyles = () => {
    if (isHighRisk) return 'bg-destructive/10 border-destructive/30 hover:bg-destructive/15';
    if (isMediumRisk) return 'bg-warning/10 border-warning/30 hover:bg-warning/15';
    return 'bg-warning/5 border-warning/20 hover:bg-warning/10';
  };

  const getIconColor = () => {
    if (isHighRisk) return 'text-destructive';
    if (isMediumRisk) return 'text-warning';
    return 'text-amber-500';
  };

  return (
    <div 
      className={`p-3 rounded-lg flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] border ${getBgStyles()}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <AlertTriangle className={`w-4 h-4 shrink-0 ${getIconColor()}`} />
        <span className="text-sm font-medium truncate">
          {getShortSummary()}
        </span>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap mr-2">
        {formatTimeAgo(alert.created_at)}
      </span>
    </div>
  );
}
