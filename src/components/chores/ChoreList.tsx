import { useState } from "react";
import { Check, X, Trash2, Clock, RotateCcw, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Chore } from "@/hooks/useChores";

interface ChoreListProps {
  chores: Chore[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  childName?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "ממתינה לביצוע", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  completed_by_child: { label: "ממתינה לאישורך", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  approved: { label: "בוצע ואושר", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  rejected: { label: "נדחה", color: "bg-destructive/20 text-red-400 border-red-500/30" },
};

export function ChoreList({ chores, onApprove, onReject, onDelete, childName }: ChoreListProps) {
  const [photoChore, setPhotoChore] = useState<Chore | null>(null);

  if (chores.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium">אין משימות עדיין</p>
        <p className="text-sm">הוסף משימה חדשה למעלה</p>
      </div>
    );
  }

  const active = chores.filter(c => c.status === "pending" || c.status === "completed_by_child");
  const done = chores.filter(c => c.status === "approved" || c.status === "rejected");

  return (
    <div className="space-y-3" dir="rtl">
      {active.length > 0 && (
        <div className="space-y-2">
          {active.map(chore => (
            <ChoreItem key={chore.id} chore={chore} onApprove={onApprove} onReject={onReject} onDelete={onDelete} childName={childName} onPhotoClick={setPhotoChore} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-2 mt-6">
          <h3 className="text-sm font-medium text-muted-foreground px-1">הושלמו</h3>
          {done.slice(0, 10).map(chore => (
            <ChoreItem key={chore.id} chore={chore} onApprove={onApprove} onReject={onReject} onDelete={onDelete} childName={childName} onPhotoClick={setPhotoChore} />
          ))}
        </div>
      )}

      {/* Photo proof dialog */}
      <Dialog open={!!photoChore} onOpenChange={(open) => !open && setPhotoChore(null)}>
        <DialogContent className="max-w-md p-4">
          <DialogTitle className="text-center text-base font-semibold">
            תמונת הוכחה — {photoChore?.title}
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            {childName ? `${childName} צירף/ה תמונה` : "תמונה שצורפה למשימה"}
          </DialogDescription>
          {photoChore?.proof_photo_base64 && (
            <img
              src={`data:image/jpeg;base64,${photoChore.proof_photo_base64}`}
              alt="תמונת הוכחה"
              className="w-full rounded-lg max-h-[60vh] object-contain"
            />
          )}
          {photoChore?.status === "completed_by_child" && (
            <div className="flex gap-2 mt-2">
              <Button
                className="flex-1"
                variant="default"
                onClick={async () => {
                  await onApprove(photoChore.id);
                  setPhotoChore(null);
                }}
              >
                <Check className="w-4 h-4 ml-1" />
                אשר
              </Button>
              <Button
                className="flex-1"
                variant="destructive"
                onClick={async () => {
                  await onReject(photoChore.id);
                  setPhotoChore(null);
                }}
              >
                <X className="w-4 h-4 ml-1" />
                דחה
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChoreItem({ chore, onApprove, onReject, onDelete, childName, onPhotoClick }: { chore: Chore; childName?: string; onPhotoClick: (chore: Chore) => void } & Pick<ChoreListProps, "onApprove" | "onReject" | "onDelete">) {
  const config = STATUS_CONFIG[chore.status] || STATUS_CONFIG.pending;
  const hasPhoto = !!chore.proof_photo_base64;

  return (
    <Card className={`transition-all ${chore.status === "completed_by_child" ? "border-orange-500/40 shadow-orange-500/10 shadow-md" : ""}`}>
      <CardContent className="p-3 flex items-center gap-3">
        {/* Photo thumbnail */}
        {hasPhoto && (
          <button
            onClick={() => onPhotoClick(chore)}
            className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-border/50 hover:ring-2 hover:ring-primary/50 transition-all"
          >
            <img
              src={`data:image/jpeg;base64,${chore.proof_photo_base64}`}
              alt="הוכחה"
              className="w-full h-full object-cover"
            />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-medium ${chore.status === "approved" ? "line-through text-muted-foreground" : ""}`}>
              {chore.title}
            </span>
            {chore.is_recurring && <RotateCcw className="w-3 h-3 text-muted-foreground" />}
            {hasPhoto && !hasPhoto && <Camera className="w-3.5 h-3.5 text-primary/60" />}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={config.color}>
              {chore.status === "completed_by_child" && childName
                ? `${childName} סימן/ה כבוצע`
                : config.label}
            </Badge>
            <span className="text-xs text-primary font-medium">{chore.reward_minutes} דק׳</span>
            {hasPhoto && (
              <button onClick={() => onPhotoClick(chore)} className="flex items-center gap-0.5 text-xs text-primary/70 hover:text-primary transition-colors">
                <Camera className="w-3 h-3" />
                <span>תמונה</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {chore.status === "completed_by_child" && (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-500/10" onClick={() => onApprove(chore.id)}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-destructive/10" onClick={() => onReject(chore.id)}>
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(chore.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
