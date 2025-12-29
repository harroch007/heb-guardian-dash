import { useNavigate } from "react-router-dom";
import { Bell, CheckCircle, ChevronLeft, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Alert {
  id: number;
  parent_message: string | null;
  ai_risk_score: number | null;
  created_at: string;
  child_id: string | null;
}

interface AlertsCardProps {
  alerts: Alert[];
  onAlertAcknowledged?: () => void;
}

export const AlertsCard = ({ alerts, onAlertAcknowledged }: AlertsCardProps) => {
  const navigate = useNavigate();

  const handleAcknowledge = async (alertId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const { error } = await supabase
      .from('alerts')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', alertId);
    
    if (error) {
      toast.error('שגיאה בעדכון ההתראה');
    } else {
      toast.success('ההתראה סומנה כנקראה');
      onAlertAcknowledged?.();
    }
  };

  const getRiskColor = (score: number | null) => {
    if (!score) return 'bg-muted';
    if (score >= 80) return 'bg-destructive';
    if (score >= 60) return 'bg-warning';
    return 'bg-success';
  };

  if (alerts.length === 0) {
    return (
      <Card className="p-6 bg-success/5 border-success/20 text-center">
        <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
        <h3 className="font-semibold text-foreground mb-1">הכל בסדר! ✅</h3>
        <p className="text-sm text-muted-foreground">אין התראות פתוחות</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-card border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="w-5 h-5 text-warning" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[10px] text-white flex items-center justify-center font-bold">
              {alerts.length}
            </span>
          </div>
          <h3 className="font-semibold text-foreground">התראות פתוחות</h3>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/alerts')}
          className="text-muted-foreground hover:text-foreground gap-1"
        >
          הכל
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {alerts.slice(0, 3).map((alert) => (
          <div 
            key={alert.id}
            className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => navigate('/alerts')}
          >
            <div className={`w-2 h-2 rounded-full mt-2 ${getRiskColor(alert.ai_risk_score)}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground line-clamp-2">
                {alert.parent_message || 'התראה חדשה'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(alert.created_at), { 
                  addSuffix: true, 
                  locale: he 
                })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleAcknowledge(alert.id, e)}
              className="text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              הבנתי
            </Button>
          </div>
        ))}
      </div>

      {alerts.length > 3 && (
        <Button 
          variant="ghost" 
          onClick={() => navigate('/alerts')} 
          className="w-full mt-3 text-muted-foreground hover:text-foreground"
        >
          ראה את כל ההתראות ({alerts.length})
        </Button>
      )}
    </Card>
  );
};
