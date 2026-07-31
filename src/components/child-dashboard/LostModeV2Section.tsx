import { useCallback, useEffect, useState } from "react";
import { v2Supabase } from "@/integrations/supabase/v2-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Lock, ShieldAlert, Unlock } from "lucide-react";
import { toast } from "sonner";

interface LostModeV2SectionProps {
  childId: string;
  childName: string;
}

const requestKey = () => `lost-mode:${crypto.randomUUID()}`;

export function LostModeV2Section({
  childId,
  childName,
}: LostModeV2SectionProps) {
  const [enabled, setEnabled] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [message, setMessage] = useState(
    "המכשיר אבד. אנא מסרו אותו למבוגר אחראי.",
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openLockDialog, setOpenLockDialog] = useState(false);
  const [openUnlockConfirm, setOpenUnlockConfirm] = useState(false);

  const fetchState = useCallback(async () => {
    const { data, error } = await v2Supabase
      .from("v2_parental_settings")
      .select("lost_mode_enabled, lost_mode_message")
      .eq("child_id", childId)
      .maybeSingle();
    if (!error) {
      setEnabled(data?.lost_mode_enabled ?? false);
      setSavedMessage(data?.lost_mode_message ?? null);
    }
    setLoading(false);
  }, [childId]);

  useEffect(() => {
    void fetchState();
    const channel = v2Supabase
      .channel(`v2-lost-mode-${childId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "v2_parental_settings",
          filter: `child_id=eq.${childId}`,
        },
        () => void fetchState(),
      )
      .subscribe();
    return () => {
      void v2Supabase.removeChannel(channel);
    };
  }, [childId, fetchState]);

  const setLostMode = async (nextEnabled: boolean, nextMessage: string) => {
    setBusy(true);
    const { error } = await v2Supabase.rpc("v2_set_lost_mode", {
      target_child_id: childId,
      target_enabled: nextEnabled,
      target_message:
        (nextEnabled ? nextMessage : null) as unknown as string,
      target_request_key: requestKey(),
    });
    setBusy(false);
    if (error) throw error;
    await fetchState();
  };

  const handleLock = async () => {
    const cleanMessage = message.trim();
    if (!cleanMessage) {
      toast.error("יש להזין הודעה שתוצג על המכשיר");
      return;
    }
    try {
      await setLostMode(true, cleanMessage);
      toast.success("מצב מכשיר אבוד הופעל");
      setOpenLockDialog(false);
    } catch (error) {
      console.error(error);
      toast.error("שגיאה בהפעלת מצב מכשיר אבוד");
    }
  };

  const handleUnlock = async () => {
    try {
      await setLostMode(false, "");
      toast.success("מצב מכשיר אבוד בוטל");
      setOpenUnlockConfirm(false);
    } catch (error) {
      console.error(error);
      toast.error("שגיאה בביטול מצב מכשיר אבוד");
    }
  };

  if (loading) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="flex items-center justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        className={
          enabled
            ? "border-destructive/40 bg-destructive/5 shadow-sm"
            : "border-border bg-card shadow-sm"
        }
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                enabled ? "bg-destructive/15" : "bg-primary/10"
              }`}
            >
              {enabled ? (
                <Lock className="h-5 w-5 text-destructive" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                מצב מכשיר אבוד
              </p>
              {enabled ? (
                <>
                  <p className="mt-1 text-xs font-medium text-destructive">
                    המכשיר מוגבל כעת
                  </p>
                  {savedMessage && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      ההודעה המוצגת: {savedMessage}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  הגבילו את המכשיר של {childName} והציגו הודעה למוצא.
                </p>
              )}
            </div>
            {enabled ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpenUnlockConfirm(true)}
                disabled={busy}
              >
                <Unlock className="ml-1 h-4 w-4" />
                בטל
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setMessage(
                    savedMessage ||
                      "המכשיר אבד. אנא מסרו אותו למבוגר אחראי.",
                  );
                  setOpenLockDialog(true);
                }}
                disabled={busy}
              >
                <Lock className="ml-1 h-4 w-4" />
                הפעל
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={openLockDialog} onOpenChange={setOpenLockDialog}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">
              הפעלת מצב אבוד אצל {childName}
            </DialogTitle>
            <DialogDescription className="text-right">
              ההודעה תוצג במכשיר כל עוד מצב אבוד פעיל.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            maxLength={160}
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setOpenLockDialog(false)}
              disabled={busy}
            >
              ביטול
            </Button>
            <Button variant="destructive" onClick={handleLock} disabled={busy}>
              {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              הפעל מצב אבוד
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={openUnlockConfirm}
        onOpenChange={setOpenUnlockConfirm}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>לבטל מצב מכשיר אבוד?</AlertDialogTitle>
            <AlertDialogDescription>
              המכשיר יחזור מיד למדיניות ההגנה הרגילה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={busy}>השאר פעיל</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlock} disabled={busy}>
              {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              בטל מצב אבוד
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
