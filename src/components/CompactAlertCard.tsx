import { AlertTriangle } from 'lucide-react';

interface Alert {
  id: number;
  sender: string | null;
  content: string | null;
  ai_summary: string | null;
  created_at: string;
  risk_score: number | null;
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

  // Get short summary
  const getShortSummary = () => {
    if (alert.ai_summary) {
      return alert.ai_summary.length > 50 
        ? alert.ai_summary.slice(0, 50) + '...' 
        : alert.ai_summary;
    }
    if (alert.content) {
      return alert.content.length > 50 
        ? alert.content.slice(0, 50) + '...' 
        : alert.content;
    }
    return 'התראה חדשה';
  };

  const isHighRisk = (alert.risk_score ?? 0) > 80;

  return (
    <div 
      className={`
        p-3 rounded-lg flex items-center justify-between cursor-pointer
        transition-all hover:scale-[1.01]
        ${isHighRisk 
          ? 'bg-destructive/10 border border-destructive/30 hover:bg-destructive/15' 
          : 'bg-warning/5 border border-warning/30 hover:bg-warning/10'
        }
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <AlertTriangle className={`w-4 h-4 shrink-0 ${isHighRisk ? 'text-destructive' : 'text-warning'}`} />
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
