import { useEffect, useRef, useState, type RefObject } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { Button, buttonVariants } from "@/components/ui/button";
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
  const [confirmationStep, setConfirmationStep] = useState<"details" | "final">("details");
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
          <AlertDialogTitle className="break-words">
            {confirmationStep === "details" ? `הסרת ${childName} מהמשפחה` : `אישור סופי להסרת ${childName}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmationStep === "details"
              ? "הילד יוסר מרשימת הילדים של המשפחה, קודי חיבור פתוחים יבוטלו וגישת המכשירים לחשבון תבוטל. זו אינה מחיקה של היסטוריית המידע."
              : `זהו שלב האישור האחרון. לאחר האישור ${childName} יוסר מהמשפחה והמכשיר לא יהיה מחובר יותר לחשבון.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {confirmationStep === "details" ? (
          <p className="text-sm text-muted-foreground">
            להסדרת חיבור במכשיר קיים או חדש, אפשר לבחור בחיבור מחדש במקום להסיר את הילד.
          </p>
        ) : (
          <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p>ודאו שבחרתם בילד הנכון. פעולה זו תנתק את כל המכשירים המשויכים אליו.</p>
          </div>
        )}
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            לא התקבל אישור להסרה. בדקו את החיבור ונסו שוב. אם ההסרה כבר הושלמה,
            ניסיון חוזר יאשר אותה בלי להסיר ילד אחר.
          </p>
        )}
        <AlertDialogFooter>
          {confirmationStep === "details" ? (
            <>
              <AlertDialogCancel disabled={busy} className="min-h-11">ביטול</AlertDialogCancel>
              <AlertDialogAction
                className="min-h-11"
                onClick={(event) => {
                  event.preventDefault();
                  setConfirmationStep("final");
                }}
              >
                המשך לאישור
              </AlertDialogAction>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                className="min-h-11"
                onClick={() => setConfirmationStep("details")}
              >
                חזרה
              </Button>
              <AlertDialogAction
                disabled={busy}
                aria-busy={busy}
                className={cn(buttonVariants({ variant: "destructive" }), "min-h-11")}
                onClick={(event) => { event.preventDefault(); void remove(); }}
              >
                {busy && <Loader2 aria-hidden="true" className="ml-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}
                {busy ? "מסיר..." : `כן, להסיר את ${childName}`}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
