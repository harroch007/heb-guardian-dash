import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TimeRequest {
  id: string;
  child_id: string;
  reason: string | null;
  requested_minutes: number;
  status: string;
  created_at: string;
}

interface TimeRequestsCardProps {
  childId: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}

export function TimeRequestsCard({ childId }: TimeRequestsCardProps) {
  const [requests, setRequests] = useState<TimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from("time_extension_requests")
      .select("*")
      .eq("child_id", childId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setRequests((data as TimeRequest[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel(`time-requests-${childId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_extension_requests", filter: `child_id=eq.${childId}` },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [childId]);

  const handleRespond = async (requestId: string, approved: boolean) => {
    setResponding(requestId);
    const { data, error } = await supabase.rpc("respond_time_request", {
      p_request_id: requestId,
      p_approved: approved,
      p_minutes: 15,
    });

    if (error || !(data as any)?.success) {
      toast.error("שגיאה בעדכון הבקשה");
    } else {
      toast.success(approved ? "הבקשה אושרה — 15 דקות נוספו" : "הבקשה נדחתה");
    }
    setResponding(null);
    fetchRequests();
  };

  if (loading || requests.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Clock className="w-4 h-4" />
          <span>בקשות לזמן נוסף</span>
          <HelpTooltip text="בקשות שהילד שלח להארכת זמן מסך. אישור מוסיף 15 דקות מיידית, דחייה סוגרת את הבקשה." iconSize={12} />
        </div>
        {requests.map((req) => (
          <div key={req.id} className="flex items-center justify-between gap-2 bg-card rounded-lg px-3 py-2 border border-border/50">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">
                {req.reason || "ללא סיבה"}
              </p>
              <p className="text-[11px] text-muted-foreground">{timeAgo(req.created_at)}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                onClick={() => handleRespond(req.id, false)}
                disabled={responding === req.id}
              >
                {responding === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-success hover:bg-success/10"
                onClick={() => handleRespond(req.id, true)}
                disabled={responding === req.id}
              >
                {responding === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
