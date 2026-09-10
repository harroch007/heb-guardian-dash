import { useEffect, useRef, useState, type RefObject } from "react";
import { Loader2 } from "lucide-react";
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
import { buttonVariants } from "@/components/ui/button";
import { archiveGuardianChild } from "@/lib/v2/childManagementService";
import { cn } from "@/lib/utils";

interface RemoveChildV2ModalProps {
  childId: string;
  childName: string;
  triggerRef: RefObject<HTMLButtonElement>;
  onClose: () => void;
  onRemoved: () => void;
}

/** Mounted per child/open attempt; a retry keeps the same idempotency key. */
export function RemoveChildV2Modal({
  childId,
  childName,
  triggerRef,
  onClose,
  onRemoved,
}: RemoveChildV2ModalProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestKey = useRef(`archive-child:${crypto.randomUUID()}`);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const remove = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await archiveGuardianChild(childId, requestKey.current);
    } catch {
      if (mounted.current) {
        setFailed(true);
        setBusy(false);
      }
      inFlight.current = false;
      return;
    }
    if (mounted.current) onRemoved();
  };

  return (
    <AlertDialog open onOpenChange={(open) => {
      if (!open && !inFlight.current) onClose();
    }}>
      <AlertDialogContent
        dir="rtl"
        className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg motion-reduce:animate-none"
        onEscapeKeyDown={(event) => { if (inFlight.current) event.preventDefault(); }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">הסרת {childName} מהמשפחה</AlertDialogTitle>
          <AlertDialogDescription>
            הילד יוסר מרשימת הילדים של המשפחה, קודי חיבור פתוחים יבוטלו
            וגישת המכשירים לחשבון תבוטל. זו אינה מחיקה של היסטוריית המידע.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">
          להסדרת חיבור במכשיר קיים או חדש, אפשר לבחור בחיבור מחדש במקום להסיר את הילד.
        </p>
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            לא התקבל אישור להסרה. בדקו את החיבור ונסו שוב. אם ההסרה כבר הושלמה,
            ניסיון חוזר יאשר אותה בלי להסיר ילד אחר.
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className="min-h-11">ביטול</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            aria-busy={busy}
            className={cn(buttonVariants({ variant: "destructive" }), "min-h-11")}
            onClick={(event) => { event.preventDefault(); void remove(); }}
          >
            {busy && <Loader2 aria-hidden="true" className="ml-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}
            {busy ? "מסיר..." : "הסרה מהמשפחה"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
