import { Check, X, Trash2, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Chore } from "@/hooks/useChores";

interface ChoreListProps {
  chores: Chore[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "ממתינה לביצוע", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  completed_by_child: { label: "ממתינה לאישורך", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  approved: { label: "בוצע ואושר", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  rejected: { label: "נדחה", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export function ChoreList({ chores, onApprove, onReject, onDelete }: ChoreListProps) {
  if (chores.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium">אין משימות עדיין</p>
        <p className="text-sm">הוסף משימה חדשה למעלה</p>
      </div>
    );
  }

  // Group: pending/waiting first, then completed
  const active = chores.filter(c => c.status === "pending" || c.status === "completed_by_child");
  const done = chores.filter(c => c.status === "approved" || c.status === "rejected");

  return (
    <div className="space-y-3" dir="rtl">
      {active.length > 0 && (
        <div className="space-y-2">
          {active.map(chore => (
            <ChoreItem key={chore.id} chore={chore} onApprove={onApprove} onReject={onReject} onDelete={onDelete} onSimulateComplete={onSimulateComplete} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-2 mt-6">
          <h3 className="text-sm font-medium text-muted-foreground px-1">הושלמו</h3>
          {done.slice(0, 10).map(chore => (
            <ChoreItem key={chore.id} chore={chore} onApprove={onApprove} onReject={onReject} onDelete={onDelete} onSimulateComplete={onSimulateComplete} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChoreItem({ chore, onApprove, onReject, onDelete, onSimulateComplete }: { chore: Chore } & Pick<ChoreListProps, "onApprove" | "onReject" | "onDelete" | "onSimulateComplete">) {
  const config = STATUS_CONFIG[chore.status] || STATUS_CONFIG.pending;

  return (
    <Card className={`transition-all ${chore.status === "completed_by_child" ? "border-orange-500/40 shadow-orange-500/10 shadow-md" : ""}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-medium ${chore.status === "approved" ? "line-through text-muted-foreground" : ""}`}>
              {chore.title}
            </span>
            {chore.is_recurring && <RotateCcw className="w-3 h-3 text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={config.color}>
              {config.label}
            </Badge>
            <span className="text-xs text-primary font-medium">{chore.reward_minutes} דק׳</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {chore.status === "completed_by_child" && (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-500/10" onClick={() => onApprove(chore.id)}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => onReject(chore.id)}>
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
          {chore.status === "pending" && onSimulateComplete && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10" onClick={() => onSimulateComplete(chore.id)} title="סמן כבוצע (סימולציה)">
              <Play className="w-4 h-4" />
            </Button>
          )}
          {(chore.status === "pending" || chore.status === "rejected") && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(chore.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
