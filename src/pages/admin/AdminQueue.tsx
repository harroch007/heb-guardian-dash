import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, AlertTriangle, Clock, XCircle, Loader2, Zap, Cpu, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PendingAlert {
  id: string;
  alert_id: number;
  status: string;
  attempt: number;
  created_at: string;
  last_error: string | null;
  is_processed: boolean;
}

interface AdminQueueProps {
  queuePending: number;
  queueFailed: number;
  oldestPendingMinutes: number;
  pendingAlerts: PendingAlert[];
  onRefresh?: () => void;
}

export function AdminQueue({ queuePending, queueFailed, oldestPendingMinutes, pendingAlerts, onRefresh }: AdminQueueProps) {
  const [processing, setProcessing] = useState(false);
  const [processingAll, setProcessingAll] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const hasIssues = queuePending > 0 || queueFailed > 0;
  const isStuck = queuePending > 0 && oldestPendingMinutes > 5;
  const staleCount = pendingAlerts.filter(a => a.is_processed).length;

  const handleProcessOne = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('analyze-alert', { body: {} });
      if (error) throw error;
      toast.success("עיבוד התראה אחת הושלם");
      onRefresh?.();
    } catch (e: any) {
      toast.error("שגיאה בעיבוד: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessAll = async () => {
    setProcessingAll(true);
    let processed = 0;
    const realPending = pendingAlerts.filter(a => !a.is_processed && a.status === 'pending').length;
    try {
      for (let i = 0; i < realPending; i++) {
        const { error } = await supabase.functions.invoke('analyze-alert', { body: {} });
        if (error) throw error;
        processed++;
      }
      toast.success(`עובדו ${processed} התראות בהצלחה`);
      onRefresh?.();
    } catch (e: any) {
      toast.error(`עובדו ${processed}, שגיאה: ${e.message}`);
    } finally {
      setProcessingAll(false);
    }
  };

  const handleProcessSingle = async (alertId: number, queueId: string) => {
    setProcessingId(queueId);
    try {
      const { error } = await supabase.functions.invoke('analyze-alert', { body: { alert_id: alertId } });
      if (error) throw error;
      toast.success(`התראה ${alertId} עובדה בהצלחה`);
      onRefresh?.();
    } catch (e: any) {
      toast.error("שגיאה: " + e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCleanupStale = async () => {
    setCleaningUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-stale-queue');
      if (error) throw error;
      toast.success(`נוקו ${data?.cleaned || 0} רשומות מיותמות`);
      onRefresh?.();
    } catch (e: any) {
      toast.error("שגיאה בניקוי: " + e.message);
    } finally {
      setCleaningUp(false);
    }
  };

  const handleRetryFailed = async () => {
    setRetrying(true);
    try {
      const { data, error } = await supabase.rpc('retry_failed_queue_items');
      if (error) throw error;
      toast.success(`אופסו ${(data as any)?.reset_count || 0} התראות שנכשלו`);
      onRefresh?.();
    } catch (e: any) {
      toast.error("שגיאה באיפוס: " + e.message);
    } finally {
      setRetrying(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (!hasIssues) {
    return (
      <Card className="border-2 border-green-500/50 bg-green-500/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            בריאות תור עיבוד
          </CardTitle>
          <CardDescription>0 ממתינות — הכל תקין ✓</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card className={`border-2 ${isStuck ? 'border-red-500/50 bg-red-500/5' : 'border-orange-500/50 bg-orange-500/5'}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${isStuck ? 'text-red-500' : 'text-orange-500'}`} />
            בריאות תור עיבוד
          </CardTitle>
          <CardDescription>
            {isStuck ? 'התור תקוע! התראות ממתינות מעל 5 דקות' : 'יש פריטים בתור'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-sm">ממתינות: <strong className="text-orange-500">{queuePending}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm">נכשלו: <strong className="text-red-500">{queueFailed}</strong></span>
            </div>
            {oldestPendingMinutes > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">הישנה ביותר: <strong>{oldestPendingMinutes} דק׳</strong></span>
              </div>
            )}
            {staleCount > 0 && (
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-yellow-500" />
                <span className="text-sm">מיותמות: <strong className="text-yellow-500">{staleCount}</strong></span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleProcessOne} disabled={processing || processingAll || queuePending === 0}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              עבד התראה אחת
            </Button>
            <Button size="sm" onClick={handleProcessAll} disabled={processing || processingAll || queuePending === 0}>
              {processingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
              עבד את כולם ({queuePending - staleCount})
            </Button>
            {staleCount > 0 && (
              <Button size="sm" variant="secondary" onClick={handleCleanupStale} disabled={cleaningUp}>
                {cleaningUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                נקה מיותמות ({staleCount})
              </Button>
            )}
            {queueFailed > 0 && (
              <Button size="sm" variant="destructive" onClick={handleRetryFailed} disabled={retrying}>
                {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                אפס נכשלות ({queueFailed})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Table */}
      {pendingAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">פריטים בתור ({pendingAlerts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">Alert ID</TableHead>
                    <TableHead className="text-right">נוצר</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">ניסיונות</TableHead>
                    <TableHead className="text-right">שגיאה</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingAlerts.map((item) => (
                    <TableRow key={item.id} className={item.is_processed ? 'opacity-50' : ''}>
                      <TableCell className="font-mono text-sm">{item.alert_id}</TableCell>
                      <TableCell className="text-sm">{formatDate(item.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'failed' ? 'destructive' : item.is_processed ? 'secondary' : 'outline'}>
                          {item.is_processed ? 'מיותמת' : item.status === 'pending' ? 'ממתינה' : item.status === 'failed' ? 'נכשלה' : 'בעיבוד'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{item.attempt}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={item.last_error || ''}>
                        {item.last_error || '—'}
                      </TableCell>
                      <TableCell>
                        {!item.is_processed && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleProcessSingle(item.alert_id, item.id)}
                            disabled={processingId === item.id || processingAll}
                          >
                            {processingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
