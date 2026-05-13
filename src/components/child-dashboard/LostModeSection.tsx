import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Lock, Unlock, ShieldAlert, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { getFamilyParentIds } from "@/lib/familyScope";

interface LostModeSectionProps {
  childId: string;
  childName: string;
}

interface LockState {
  is_locked: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  message: string | null;
  locked_at: string | null;
}

interface ParentOption {
  id: string;
  full_name: string | null;
  phone_number: string | null;
}

export function LostModeSection({ childId, childName }: LostModeSectionProps) {
  const { user } = useAuth();
  const [lockState, setLockState] = useState<LockState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openLockDialog, setOpenLockDialog] = useState(false);
  const [openUnlockConfirm, setOpenUnlockConfirm] = useState(false);

  const [parents, setParents] = useState<ParentOption[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState("הטלפון שלי אבד. אנא חייגו אליי בכפתור למטה.");

  const fetchLockState = async () => {
    const { data } = await supabase
      .from("device_lock_state")
      .select("is_locked, contact_name, contact_phone, message, locked_at")
      .eq("child_id", childId)
      .maybeSingle();
    setLockState(data ?? null);
    setLoading(false);
  };

  const fetchParents = async () => {
    if (!user) return;
    const ids = await getFamilyParentIds(user.id);
    if (ids.length === 0) return;
    const { data } = await supabase
      .from("parents")
      .select("id, full_name, phone_number")
      .in("id", ids);
    if (data) setParents(data as ParentOption[]);
  };

  useEffect(() => {
    fetchLockState();
    fetchParents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, user]);

  const openDialog = () => {
    // Default to current logged-in parent's details
    const me = parents.find((p) => p.id === user?.id);
    setContactName(me?.full_name || "");
    setContactPhone(me?.phone_number || "");
    setMessage("הטלפון שלי אבד. אנא חייגו אליי בכפתור למטה.");
    setOpenLockDialog(true);
  };

  const handleLock = async () => {
    if (!contactPhone.trim()) {
      toast.error("יש להזין מספר טלפון לחיוג");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("lock_child_device", {
      p_child_id: childId,
      p_contact_name: contactName.trim() || null,
      p_contact_phone: contactPhone.trim(),
      p_message: message.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error("שגיאה בהפעלת מצב 'מכשיר אבוד'");
      console.error(error);
      return;
    }
    toast.success("המכשיר ננעל. הפקודה נשלחה.");
    setOpenLockDialog(false);
    fetchLockState();
  };

  const handleUnlock = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("unlock_child_device", {
      p_child_id: childId,
    });
    setBusy(false);
    if (error) {
      toast.error("שגיאה בביטול הנעילה");
      console.error(error);
      return;
    }
    toast.success("הנעילה בוטלה. פקודת שחרור נשלחה.");
    setOpenUnlockConfirm(false);
    fetchLockState();
  };

  if (loading) {
    return (
      <Card className="border-border shadow-sm bg-card">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isLocked = !!lockState?.is_locked;

  return (
    <>
      <Card
        className={
          isLocked
            ? "border-destructive/40 shadow-sm bg-destructive/5"
            : "border-border shadow-sm bg-card"
        }
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 " +
                (isLocked ? "bg-destructive/15" : "bg-primary/10")
              }
            >
              {isLocked ? (
                <Lock className="w-5 h-5 text-destructive" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">מצב מכשיר אבוד</p>
              {isLocked ? (
                <div className="mt-1 space-y-1">
                  <p className="text-xs text-destructive font-medium">
                    המכשיר נעול כעת
                  </p>
                  {lockState?.contact_name && (
                    <p className="text-xs text-muted-foreground">
                      איש קשר מוצג: {lockState.contact_name}
                    </p>
                  )}
                  {lockState?.contact_phone && (
                    <p
                      className="text-xs text-muted-foreground flex items-center gap-1"
                      dir="ltr"
                    >
                      <Phone className="w-3 h-3" />
                      {lockState.contact_phone}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  נעלו את {childName} כשהמכשיר אבד. תוצג הודעה למוצא עם כפתור חיוג חזרה.
                </p>
              )}
            </div>
            {isLocked ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpenUnlockConfirm(true)}
                disabled={busy}
                className="shrink-0"
              >
                <Unlock className="w-4 h-4 ml-1" />
                בטל נעילה
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onClick={openDialog}
                disabled={busy}
                className="shrink-0"
              >
                <Lock className="w-4 h-4 ml-1" />
                נעל מכשיר
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* LOCK DIALOG */}
      <Dialog open={openLockDialog} onOpenChange={setOpenLockDialog}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">נעילת המכשיר של {childName}</DialogTitle>
            <DialogDescription className="text-right">
              המסך של הילד יוצג עם הודעה ומספר חיוג למוצא. ניתן לבטל בכל רגע.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {parents.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">בחירה מהירה מההורים במשפחה</Label>
                <div className="flex flex-wrap gap-2">
                  {parents.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!p.phone_number}
                      onClick={() => {
                        setContactName(p.full_name || "");
                        setContactPhone(p.phone_number || "");
                      }}
                    >
                      {p.full_name || "הורה"}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="contact-name">שם איש הקשר (יוצג למוצא)</Label>
              <Input
                id="contact-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="לדוגמה: אמא של דניאל"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="contact-phone">מספר טלפון לחיוג *</Label>
              <Input
                id="contact-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="050-0000000"
                dir="ltr"
                inputMode="tel"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="lost-message">הודעה למסך הנעילה</Label>
              <Textarea
                id="lost-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={300}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenLockDialog(false)} disabled={busy}>
              ביטול
            </Button>
            <Button variant="destructive" onClick={handleLock} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              נעל עכשיו
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UNLOCK CONFIRM */}
      <AlertDialog open={openUnlockConfirm} onOpenChange={setOpenUnlockConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">לבטל את נעילת המכשיר?</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              המכשיר של {childName} יחזור לפעילות רגילה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>חזרה</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlock} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "בטל נעילה"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
