import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Mail, Smartphone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  activateChildReconnectSession, ChildReconnectError, getCachedChildReconnectSession,
  prepareChildReconnectSession, RECONNECT_MAX_ATTEMPTS, refreshChildReconnectSession,
  type ChildReconnectSession, type ReconnectFailure,
} from "@/lib/v2/childReconnectService";

interface ReconnectChildV2ModalProps {
  childId: string | null;
  childName: string;
  onClose: () => void;
  onConnected?: () => void;
}

const errorMessages: Record<ReconnectFailure, string> = {
  BUSY: "בקשת חיבור קודמת עדיין מתבצעת. המתינו לסיומה ונסו שוב.",
  CREATE_UNAVAILABLE: "לא הצלחנו להכין קוד חיבור. לא התבקשה שליחת אימייל. אפשר לנסות שוב.",
  INVALID_SESSION: "פרטי החיבור שהתקבלו אינם תקינים. לא התבקשה שליחת אימייל. נסו שוב.",
  COOLDOWN: "יש להמתין דקה בין בקשות לשליחת קוד.",
  LIMIT: "הגעתם למגבלת שלוש בקשות השליחה. אפשר להשתמש בקוד האחרון, או ליצור קוד חדש לאחר פקיעת התוקף.",
  SESSION_CLOSED: "החיבור אינו זמין לשליחה נוספת. ייתכן שהקוד נוצל, בוטל או שהגעתם למגבלת השליחה. בדקו את מצב החיבור.",
  EMAIL_UNAVAILABLE: "לא ניתן לשלוח כרגע לאימייל ההורה. בדקו את החשבון ונסו שוב מאוחר יותר.",
  DELIVERY_FAILED: "בקשת שליחת האימייל נכשלה. בדקו אם התקבל קוד לפני ניסיון נוסף.",
  DELIVERY_UNKNOWN: "לא התקבל אישור לשליחה. ייתכן שהקוד כבר נשלח — בדקו את האימייל לפני שליחה חוזרת.",
  STATUS_UNAVAILABLE: "לא ניתן לבדוק כרגע אם המכשיר קושר. אין צורך לשלוח קוד נוסף; אפשר לנסות שוב את בדיקת המצב.",
};

export function ReconnectChildV2Modal({ childId, childName, onClose, onConnected }: ReconnectChildV2ModalProps) {
  const { user } = useAuth();
  const closeFence = useRef(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  const close = () => {
    closeFence.current += 1;
    onClose();
  };

  return (
    <Dialog open={Boolean(childId)} onOpenChange={(open) => !open && close()}>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-lg sm:max-w-md motion-reduce:animate-none motion-reduce:transition-none" dir="rtl"
        onOpenAutoFocus={() => {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.current?.focus(); }}>
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle className="flex items-start gap-2 pl-6 break-words">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            חיבור מחדש — {childName}
          </DialogTitle>
          <DialogDescription>
            במכשיר הילד שכבר מותקנת בו אפליקציית Kippy העדכנית, פתחו אותה והזינו את אימייל ההורה ואת הקוד.
          </DialogDescription>
        </DialogHeader>
        {childId && user?.id && user.email ? (
          <ReconnectForm key={`${user.id}:${childId}`} guardianId={user.id} childId={childId}
            parentEmail={user.email} onClose={close} onConnected={onConnected}
            closeFence={closeFence} />
        ) : (
          <p role="alert" className="py-6 text-sm text-muted-foreground">
            שליחת קוד דורשת חשבון הורה מחובר עם כתובת אימייל.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ReconnectFormProps {
  guardianId: string;
  childId: string;
  parentEmail: string;
  onClose: () => void;
  onConnected?: () => void;
  closeFence: { current: number };
}

function ReconnectForm({ guardianId, childId, parentEmail, onClose, onConnected, closeFence }: ReconnectFormProps) {
  const [session, setSession] = useState<ChildReconnectSession | null>(() => getCachedChildReconnectSession(guardianId, childId));
  const [working, setWorking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<ReconnectFailure | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [pollRevision, setPollRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  const alive = useRef(false);
  const sending = useRef(false);
  const completed = useRef(false);
  const callback = useRef(onConnected);
  callback.current = onConnected;
  const mountedFence = useRef(closeFence.current);
  const isCurrent = () => alive.current && mountedFence.current === closeFence.current;

  useEffect(() => {
    alive.current = true;
    const timer = window.setInterval(() => {
      if (!alive.current || mountedFence.current !== closeFence.current) return;
      setNow(Date.now());
      const cached = getCachedChildReconnectSession(guardianId, childId);
      if (cached) setSession(cached);
    }, 1_000);
    return () => { alive.current = false; window.clearInterval(timer); };
  }, [guardianId, childId, closeFence]);

  const sessionId = session?.sessionId;
  const terminal = session?.status === "consumed" || session?.status === "cancelled" || session?.status === "expired";
  useEffect(() => {
    if (!working && (session?.delivery === "requested" || session?.delivery === "recent_request_exists")) {
      setError((previous) => previous === "DELIVERY_UNKNOWN" ? null : previous);
    }
  }, [working, sessionId, session?.attempts, session?.delivery]);

  useEffect(() => {
    if (!sessionId || terminal || working) return;
    let stopped = false;
    let timer: number | undefined;
    const check = async () => {
      setChecking(true);
      try {
        const current = await refreshChildReconnectSession(guardianId, childId, sessionId);
        if (stopped || !alive.current || mountedFence.current !== closeFence.current) return;
        setSession(current);
        setStatusError(false);
        if (current.status === "created" || current.status === "activated") {
          timer = window.setTimeout(() => void check(), 5_000);
        }
      } catch {
        if (!stopped && alive.current && mountedFence.current === closeFence.current) setStatusError(true);
        // A failed status request stops polling until an explicit manual check.
      } finally {
        if (!stopped && alive.current && mountedFence.current === closeFence.current) setChecking(false);
      }
    };
    void check();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [guardianId, childId, sessionId, terminal, working, pollRevision, closeFence]);

  useEffect(() => {
    if (session?.status === "consumed" && !completed.current && alive.current && mountedFence.current === closeFence.current) {
      completed.current = true;
      callback.current?.();
    }
  }, [session?.status, closeFence]);

  const send = async () => {
    if (sending.current || !isCurrent()) return;
    sending.current = true;
    setWorking(true);
    setError(null);
    try {
      const prepared = await prepareChildReconnectSession(guardianId, childId);
      if (!isCurrent()) return;
      setSession(prepared);
      const sent = await activateChildReconnectSession(guardianId, childId, prepared.sessionId);
      if (!isCurrent()) return;
      setSession(sent);
      setStatusError(false);
      setPollRevision((value) => value + 1);
    } catch (failure) {
      if (!isCurrent()) return;
      setError(failure instanceof ChildReconnectError ? failure.code : "DELIVERY_UNKNOWN");
      const cached = getCachedChildReconnectSession(guardianId, childId);
      if (cached) setSession(cached);
    } finally {
      sending.current = false;
      if (isCurrent()) { setWorking(false); setNow(Date.now()); }
    }
  };

  const remaining = Math.max(0, Math.ceil(((session?.retryAt ?? 0) - now) / 1_000));
  const expired = session?.status === "expired" || Boolean(session && session.expiresAt <= now);
  const canCreate = !session || expired || session.status === "cancelled";
  const limited = Boolean(session && !canCreate && session.attempts >= RECONNECT_MAX_ATTEMPTS);
  const disabled = working || (!canCreate && (remaining > 0 || limited || session?.blocked));
  const consumed = session?.status === "consumed";

  return (
    <div className="space-y-4 text-right">
      {consumed ? (
        <div role="status" className="space-y-2 rounded-xl bg-primary/10 p-4">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 shrink-0" />המכשיר קושר בהצלחה</p>
          <p className="text-sm">השלימו את ההרשאות במכשיר הילד. מצב ההגנה יתעדכן לאחר שהמכשיר ידווח.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">הקוד יישלח אל <bdi className="break-all font-medium text-foreground">{parentEmail}</bdi>.</p>
          <p className="text-sm text-muted-foreground">בקשת חיבור חדשה מחליפה קישור חיבור קודם שעדיין פתוח, גם עבור ילד אחר.</p>
          <div role="status" aria-live="polite" className="space-y-2 text-sm">
            {expired ? <p>תוקף קוד החיבור פג. ניתן לשלוח קוד חדש.</p> : session?.status === "cancelled" ?
              <p>בקשת החיבור בוטלה. ניתן לשלוח קוד חדש.</p> : session?.delivery === "requested" ?
                <p>בקשת שליחת הקוד לאימייל אושרה. בדקו גם בתיקיית הספאם.</p> : session?.delivery === "recent_request_exists" ?
                  <p>כבר קיימת בקשת שליחה מהדקה האחרונה; לא נשלח קוד נוסף. בדקו את האימייל.</p> : null}
            {session && !expired && session.status !== "cancelled" && <p>
              החיבור תקף עד <bdi>{new Date(session.expiresAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</bdi>.
            </p>}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{errorMessages[error]}</p>}
          {limited && error !== "LIMIT" && <p className="text-sm text-muted-foreground">{errorMessages.LIMIT}</p>}
          <Button type="button" className="min-h-11 w-full whitespace-normal" disabled={disabled} onClick={() => void send()}>
            {working ? <Loader2 aria-hidden="true" className="ml-2 h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" /> : <Mail aria-hidden="true" className="ml-2 h-4 w-4 shrink-0" />}
            {working ? "מבקשים שליחת קוד…" : canCreate || session?.attempts === 0 ? "שליחת קוד לאימייל" : "שליחה חוזרת"}
          </Button>
          {remaining > 0 && !canCreate && <p className="text-center text-xs text-muted-foreground">שליחה חוזרת בעוד {remaining} שניות</p>}
          {(statusError || session?.blocked) && !terminal && <div className="space-y-2">
            {statusError && <p role="alert" className="text-sm text-destructive">{errorMessages.STATUS_UNAVAILABLE}</p>}
            <Button type="button" variant="outline" className="min-h-11 w-full" disabled={working || checking}
              onClick={() => { setStatusError(false); setPollRevision((value) => value + 1); }}>בדיקת מצב החיבור</Button>
          </div>}
        </>
      )}
      <Button type="button" variant="ghost" className="min-h-11 w-full" onClick={onClose}>סגירה</Button>
    </div>
  );
}
